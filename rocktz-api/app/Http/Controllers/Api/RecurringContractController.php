<?php

namespace App\Http\Controllers\Api;

use App\Enums\ApprovalFlowType;
use App\Enums\ContentPlanningStatus;
use App\Enums\PostingProfile;
use App\Enums\ContentType;
use App\Enums\NotificationType;
use App\Enums\RecurringContractStatus;
use App\Enums\StageApprovalStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\ContentPlanningItemResource;
use App\Http\Resources\RecurringContractResource;
use App\Jobs\SyncRecurringPostMetricsJob;
use App\Models\Company;
use App\Models\ContentPlanningItem;
use App\Models\Creator;
use App\Models\RecurringContract;
use App\Models\RecurringContractCreator;
use App\Services\Mail\MailNotifier;
use App\Services\NotificationService;
use App\Support\Geo;
use App\Support\MetricsSyncStatus;
use App\Support\RevisionHistory;
use App\Support\SafeHttpUrl;
use App\Support\SubmissionVersioning;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class RecurringContractController extends Controller
{
    /** @var array<string, array{type: ContentType, format_key: string}> */
    private const DELIVERABLE_MAP = [
        'reels' => ['type' => ContentType::Reel, 'format_key' => 'reels'],
        'stories' => ['type' => ContentType::Story, 'format_key' => 'stories'],
        'posts' => ['type' => ContentType::Post, 'format_key' => 'posts'],
        'tiktok' => ['type' => ContentType::Tiktok, 'format_key' => 'tiktok'],
        'ugc' => ['type' => ContentType::Ugc, 'format_key' => 'ugc'],
        'youtube' => ['type' => ContentType::Youtube, 'format_key' => 'youtube'],
        'live_instagram' => ['type' => ContentType::LiveInstagram, 'format_key' => 'live_instagram'],
        'live_tiktok' => ['type' => ContentType::LiveTiktok, 'format_key' => 'live_tiktok'],
        'live_youtube' => ['type' => ContentType::LiveYoutube, 'format_key' => 'live_youtube'],
    ];

    public function __construct(
        private readonly NotificationService $notifications,
        private readonly MailNotifier $mail,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = RecurringContract::query()->with('company');
        $this->scopeContractsForUser($query, $user);
        $this->eagerLoadForUser($query, $user, $this->wantsInclude($request, 'items'));

        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }

        return response()->json(['data' => RecurringContractResource::collection($query->latest()->get())]);
    }

    public function show(Request $request, RecurringContract $recurringContract): JsonResponse
    {
        $this->assertCanView($request, $recurringContract);
        $this->loadVisibleRelations($request, $recurringContract);

        return response()->json(['data' => new RecurringContractResource($recurringContract)]);
    }

    public function syncPostMetrics(Request $request, RecurringContract $recurringContract): JsonResponse
    {
        $this->assertCanManage($request, $recurringContract);

        $data = $request->validate([
            'force' => ['sometimes', 'boolean'],
            'month' => ['nullable', 'string', 'regex:/^\d{4}-\d{2}$/'],
            'content_planning_item_id' => ['nullable', 'integer'],
        ]);

        $month = $data['month'] ?? null;
        $itemId = isset($data['content_planning_item_id']) ? (int) $data['content_planning_item_id'] : null;
        $key = MetricsSyncStatus::recurringKey($recurringContract->id, $month, $itemId);

        if (! MetricsSyncStatus::busy($key)) {
            MetricsSyncStatus::put($key, MetricsSyncStatus::QUEUED);
            $job = new SyncRecurringPostMetricsJob(
                $recurringContract->id,
                $month,
                $itemId,
                (bool) ($data['force'] ?? false),
            );
            if (app()->runningUnitTests()) {
                dispatch_sync($job);
            } else {
                dispatch($job)->afterResponse();
            }
        }

        return $this->postMetricsJobResponse($recurringContract, $key);
    }

    public function postMetricsStatus(Request $request, RecurringContract $recurringContract): JsonResponse
    {
        $this->assertCanManage($request, $recurringContract);

        $month = $request->string('month')->toString() ?: null;
        $itemId = $request->integer('content_planning_item_id') ?: null;
        $key = MetricsSyncStatus::recurringKey($recurringContract->id, $month, $itemId);

        return $this->postMetricsJobResponse($recurringContract, $key);
    }

    private function postMetricsJobResponse(RecurringContract $contract, string $key): JsonResponse
    {
        $state = MetricsSyncStatus::get($key) ?? ['status' => MetricsSyncStatus::QUEUED];
        $status = (string) ($state['status'] ?? MetricsSyncStatus::QUEUED);

        if ($status === MetricsSyncStatus::FAILED) {
            return response()->json([
                'status' => $status,
                'message' => $state['message'] ?? __('auth.post_metrics_unavailable'),
            ], 422);
        }

        if ($status !== MetricsSyncStatus::DONE) {
            return response()->json(['status' => $status], 202);
        }

        $this->loadVisibleRelations(request(), $contract);

        return response()->json([
            'status' => $status,
            'data' => new RecurringContractResource($contract),
            'sync' => $state['sync'] ?? [],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'company_id' => [$request->user()->role === UserRole::Admin ? 'required' : 'nullable', 'exists:companies,id'],
            'title' => ['required', 'string', 'max:255'],
            'objective' => ['nullable', 'string'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'status' => ['nullable', Rule::enum(RecurringContractStatus::class)],
            'monthly_fee' => ['nullable', 'numeric'],
            'notes' => ['nullable', 'string'],
            'creator_ids' => ['nullable', 'array'],
            'creator_ids.*' => ['exists:creators,id'],
        ]);

        if ($request->user()->role === UserRole::Company) {
            $data['company_id'] = $request->user()->companyUser?->company_id;
        }

        abort_unless($data['company_id'] ?? null, 422, __('auth.company_not_linked'));
        Company::assertApproved((int) $data['company_id']);
        $data['currency'] = Company::query()->find((int) $data['company_id'])?->currencyCode() ?: Geo::DEFAULT_CURRENCY;
        $data['start_date'] ??= now()->toDateString();

        $ids = $data['creator_ids'] ?? [];
        unset($data['creator_ids']);
        $this->assertCompanyCanAssignCreators($request, $ids);
        if (! $request->user()->canPublishWithoutApproval()) {
            $data['status'] = RecurringContractStatus::PendingAgency;
        } else {
            $data['status'] ??= RecurringContractStatus::Active;
        }
        $contract = RecurringContract::query()->create($data);
        foreach ($ids as $creatorId) {
            $contract->recurringContractCreators()->create(['creator_id' => $creatorId]);
            if (! $contract->isPendingAgency()) {
                $this->notifyRecurringAssigned($contract, (int) $creatorId);
            }
        }

        if ($contract->isPendingAgency()) {
            $this->notifyAgencyReview($contract);
            $this->mail->recurringPendingAgency($contract->loadMissing('company'));
        }

        return response()->json(['data' => new RecurringContractResource($contract->load(['company', 'recurringContractCreators.creator']))], 201);
    }

    public function reset(): JsonResponse
    {
        $deleted = RecurringContract::query()->count();
        RecurringContract::query()->delete();

        return response()->json(['message' => __('auth.recurring_reset'), 'deleted' => $deleted]);
    }

    public function update(Request $request, RecurringContract $recurringContract): JsonResponse
    {
        $this->assertCanManage($request, $recurringContract);
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'objective' => ['nullable', 'string'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'status' => ['nullable', Rule::enum(RecurringContractStatus::class)],
            'monthly_fee' => ['nullable', 'numeric'],
            'notes' => ['nullable', 'string'],
        ]);
        if (! $request->user()->canPublishWithoutApproval()) {
            unset($data['status']);
        }
        $previousStatus = $recurringContract->status;
        $recurringContract->fill($data)->save();
        $this->notifyReleasedIfNeeded($recurringContract, $previousStatus);

        return response()->json(['data' => new RecurringContractResource($recurringContract->fresh()->load(['company', 'recurringContractCreators.creator']))]);
    }

    public function approveAgency(Request $request, RecurringContract $recurringContract): JsonResponse
    {
        abort_unless($recurringContract->isPendingAgency(), 422, __('auth.agency_approval_not_pending'));
        $previousStatus = $recurringContract->status;
        $recurringContract->update(['status' => RecurringContractStatus::Active]);
        $this->notifyReleasedIfNeeded($recurringContract, $previousStatus);

        return response()->json(['data' => new RecurringContractResource($recurringContract->fresh()->load(['company', 'recurringContractCreators.creator']))]);
    }

    public function destroy(Request $request, RecurringContract $recurringContract): JsonResponse
    {
        $this->assertCanManage($request, $recurringContract);
        $recurringContract->delete();

        return response()->json(['message' => __('auth.contract_removed')]);
    }

    public function attachCreator(Request $request, RecurringContract $recurringContract): JsonResponse
    {
        $this->assertCanManage($request, $recurringContract);
        $data = $request->validate([
            'creator_id' => ['required', 'exists:creators,id'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'monthly_fee' => ['nullable', 'numeric'],
            'monthly_cache' => ['nullable', 'numeric'],
            'monthly_deliverables' => ['nullable', 'array'],
            'notes' => ['nullable', 'string'],
        ]);
        $this->assertCompanyCanAssignCreators($request, [(int) $data['creator_id']], $recurringContract);
        $row = $recurringContract->recurringContractCreators()->updateOrCreate(
            ['creator_id' => $data['creator_id']],
            $data,
        );

        $this->syncMonthlyDeliverables($recurringContract, $row);

        if ($row->wasRecentlyCreated && ! $recurringContract->isPendingAgency()) {
            $this->notifyRecurringAssigned($recurringContract, (int) $row->creator_id);
        }

        return response()->json(['data' => $row->load('creator')], 201);
    }

    public function generateMonthDemands(Request $request, RecurringContract $recurringContract): JsonResponse
    {
        $this->assertCanManage($request, $recurringContract);
        $data = $request->validate([
            'creator_id' => ['required', 'exists:creators,id'],
            'month' => ['required', 'string', 'regex:/^\d{4}-\d{2}$/'],
        ]);

        $row = $recurringContract->recurringContractCreators()
            ->where('creator_id', $data['creator_id'])
            ->firstOrFail();

        $created = $this->syncMonthlyDeliverables($recurringContract, $row, $data['month']);

        if ($created > 0 && ! $recurringContract->isPendingAgency()) {
            $row->loadMissing('creator.user');
            $this->notifications->notifyCreator($row->creator_id, [
                'recurring_contract_id' => $recurringContract->id,
                'title' => __('auth.new_demands_title'),
                'message' => __('auth.new_demands', [
                    'count' => $created,
                    'project' => $recurringContract->title,
                    'month' => $data['month'],
                ]),
                'type' => NotificationType::Contract,
                'link' => '/creators/'.$row->creator_id.'?tab=recurring',
            ]);
            if ($row->creator?->user) {
                $this->mail->demandAssignedToCreator($row->creator, $recurringContract);
            }
        }

        return response()->json([
            'message' => __('auth.recurring_demands_generated', ['count' => $created]),
            'created' => $created,
            'data' => new RecurringContractResource($recurringContract->fresh()->load([
                'company',
                'recurringContractCreators.creator',
                'contentPlanningItems.creator',
                'contentPlanningItems.company',
            ])),
        ]);
    }

    public function detachCreator(RecurringContract $recurringContract, RecurringContractCreator $recurringContractCreator): JsonResponse
    {
        abort_unless($recurringContractCreator->recurring_contract_id === $recurringContract->id, 404);
        $recurringContractCreator->delete();

        return response()->json(['message' => __('auth.recurring_creator_removed')]);
    }

    public function storeItem(Request $request, RecurringContract $recurringContract): JsonResponse
    {
        $data = $request->validate([
            'creator_id' => ['required', 'exists:creators,id'],
            'month' => ['required', 'string', 'max:7'],
            'content_type' => ['required', Rule::enum(ContentType::class)],
            'title' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'briefing' => ['nullable'],
            'briefing_fields' => ['nullable', 'array'],
            'briefing_fields.product' => ['nullable', 'string'],
            'briefing_fields.key_message' => ['nullable', 'string'],
            'briefing_fields.must_have' => ['nullable', 'string'],
            'briefing_fields.donts' => ['nullable', 'string'],
            'briefing_fields.cta' => ['nullable', 'string'],
            'briefing_fields.hashtags' => ['nullable', 'string'],
            'script' => ['nullable', 'string'],
            'references' => ['nullable', 'string', 'max:2048'],
            'planned_date' => ['nullable', 'date'],
            'status' => ['nullable', Rule::enum(ContentPlanningStatus::class)],
            'approval_flow' => ['nullable', Rule::enum(ApprovalFlowType::class)],
            'posting_profile' => ['nullable', Rule::enum(PostingProfile::class)],
            'published_url' => ['nullable', 'string', 'max:2048'],
        ]);
        $this->normalizeBriefingPayload($data);

        if ($this->isLiveContentType($data['content_type'] ?? null)) {
            $data['approval_flow'] = ApprovalFlowType::LiveLink;
            if (! empty($data['published_url'])) {
                $data['status'] = ContentPlanningStatus::Published;
                $data['reviewed_at'] = now();
            }
        } else {
            $data['approval_flow'] ??= ApprovalFlowType::ScriptAndVideo;
        }
        $data['posting_profile'] ??= PostingProfile::Creator;

        $item = $recurringContract->contentPlanningItems()->create([
            ...$data,
            'company_id' => $recurringContract->company_id,
            'status' => $data['status'] ?? ContentPlanningStatus::Planned,
        ]);

        if (! $recurringContract->isPendingAgency()) {
            $this->notifyPautaReady($item, $recurringContract);
        }

        return response()->json(['data' => new ContentPlanningItemResource($item->load('creator'))], 201);
    }

    public function updateItem(Request $request, ContentPlanningItem $contentPlanningItem): JsonResponse
    {
        $data = $request->validate([
            'title' => ['sometimes', 'nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'briefing' => ['nullable'],
            'briefing_fields' => ['nullable', 'array'],
            'briefing_fields.product' => ['nullable', 'string'],
            'briefing_fields.key_message' => ['nullable', 'string'],
            'briefing_fields.must_have' => ['nullable', 'string'],
            'briefing_fields.donts' => ['nullable', 'string'],
            'briefing_fields.cta' => ['nullable', 'string'],
            'briefing_fields.hashtags' => ['nullable', 'string'],
            'script' => ['nullable', 'string'],
            'references' => ['nullable', 'string', 'max:2048'],
            'caption' => ['nullable', 'string'],
            'content_type' => ['sometimes', Rule::enum(ContentType::class)],
            'creator_id' => ['sometimes', 'exists:creators,id'],
            'month' => ['sometimes', 'string', 'max:7'],
            'planned_date' => ['nullable', 'date'],
            'status' => ['nullable', Rule::enum(ContentPlanningStatus::class)],
            'submission_url' => ['nullable', 'string', 'max:2048'],
            'media_url' => ['nullable', 'string', 'max:2048'],
            'published_url' => ['nullable', 'string', 'max:2048'],
            'submission_notes' => ['nullable', 'string'],
            'feedback_note' => ['nullable', 'string'],
            'approval_flow' => ['nullable', Rule::enum(ApprovalFlowType::class)],
            'posting_profile' => ['nullable', Rule::enum(PostingProfile::class)],
            'script_status' => ['nullable', Rule::enum(StageApprovalStatus::class)],
            'video_status' => ['nullable', Rule::enum(StageApprovalStatus::class)],
            'script_feedback' => ['nullable', 'string'],
            'video_feedback' => ['nullable', 'string'],
        ]);
        $this->normalizeBriefingPayload($data);
        $data = SafeHttpUrl::validateFields($data, ['references', 'submission_url', 'media_url', 'published_url']);

        $this->assertCanViewItem($request, $contentPlanningItem);
        $actorIsCreator = $request->user()->role === UserRole::Creator;
        $hadBriefing = $this->itemHasBriefing($contentPlanningItem);
        if ($actorIsCreator) {
            abort_unless($contentPlanningItem->creator_id === $request->user()->creator?->id, 403, __('auth.forbidden'));
            $data = $this->restrictCreatorPlanningPayload($data, $contentPlanningItem);
            $this->assertCreatorCanSubmitPauta($data, $contentPlanningItem);
        }

        if (isset($data['content_type']) && $this->isLiveContentType($data['content_type'])) {
            $data['approval_flow'] = ApprovalFlowType::LiveLink;
        }

        if (isset($data['published_url']) && trim((string) $data['published_url']) !== '') {
            $isLive = $contentPlanningItem->approval_flow === ApprovalFlowType::LiveLink
                || $this->isLiveContentType($data['content_type'] ?? $contentPlanningItem->content_type?->value);
            $materialApproved = $contentPlanningItem->status === ContentPlanningStatus::Approved
                || $contentPlanningItem->video_status === StageApprovalStatus::Approved;
            if ($isLive || $materialApproved) {
                $data['status'] = ContentPlanningStatus::Published;
                $data['reviewed_at'] = now();
            }
        }

        if (isset($data['submission_url']) || isset($data['media_url'])) {
            $data['submitted_at'] = now();
            $data['status'] ??= ContentPlanningStatus::Review;
        }

        if (NotificationService::is($data['script_status'] ?? null, StageApprovalStatus::Submitted)) {
            $data['script_submitted_at'] = now();
            $data['submitted_at'] = now();
            $data['status'] ??= ContentPlanningStatus::Review;
        }

        if (NotificationService::is($data['video_status'] ?? null, StageApprovalStatus::Submitted)) {
            $data['video_submitted_at'] = now();
            $data['submitted_at'] = now();
            $data['status'] ??= ContentPlanningStatus::Review;
        }

        $flow = $data['approval_flow'] ?? $contentPlanningItem->approval_flow;
        $nextVideo = $data['video_status'] ?? $contentPlanningItem->video_status;

        if ($flow === ApprovalFlowType::ScriptAndVideo) {
            if (NotificationService::is($data['script_status'] ?? null, StageApprovalStatus::Approved) && ! NotificationService::is($nextVideo, StageApprovalStatus::Approved)) {
                $data['status'] = ContentPlanningStatus::InProduction;
                $data['reviewed_at'] = now();
            }
            if (NotificationService::is($data['video_status'] ?? null, StageApprovalStatus::Approved)) {
                $data['status'] = ContentPlanningStatus::Approved;
                $data['reviewed_at'] = now();
            }
        }

        if (isset($data['status']) && in_array(NotificationService::value($data['status']), [
            ContentPlanningStatus::Approved->value,
            ContentPlanningStatus::Rejected->value,
            ContentPlanningStatus::Published->value,
        ], true)) {
            $data['reviewed_at'] = now();
        }

        $contentPlanningItem->fill($data);

        if (NotificationService::is($data['script_status'] ?? null, StageApprovalStatus::Revision)) {
            RevisionHistory::append(
                $contentPlanningItem,
                'script',
                (string) ($data['script_feedback'] ?? $data['feedback_note'] ?? ''),
            );
        }

        if (NotificationService::is($data['video_status'] ?? null, StageApprovalStatus::Revision)) {
            RevisionHistory::append(
                $contentPlanningItem,
                'video',
                (string) ($data['video_feedback'] ?? $data['feedback_note'] ?? ''),
            );
        }

        $contentPlanningItem->save();

        if (NotificationService::is($data['script_status'] ?? null, StageApprovalStatus::Submitted)) {
            SubmissionVersioning::append($contentPlanningItem, 'script', [
                'script' => $contentPlanningItem->script,
            ]);
        }

        if (NotificationService::is($data['video_status'] ?? null, StageApprovalStatus::Submitted)) {
            SubmissionVersioning::append($contentPlanningItem, 'video', [
                'media_url' => $contentPlanningItem->media_url ?: $contentPlanningItem->submission_url,
                'submission_url' => $contentPlanningItem->submission_url,
            ]);
        }

        $contentPlanningItem->loadMissing(['creator.user', 'recurringContract']);
        $this->notifyPlanningItemChange($contentPlanningItem, $data);

        if (
            isset($data['planned_date'])
            || NotificationService::is($data['status'] ?? null, ContentPlanningStatus::Rejected)
        ) {
            $this->mail->demandUpdated(
                $contentPlanningItem,
                $data['feedback_note'] ?? null,
            );
        }

        if (
            ! $actorIsCreator
            && ! $hadBriefing
            && $this->itemHasBriefing($contentPlanningItem)
            && $contentPlanningItem->recurringContract
        ) {
            $this->notifyPautaReady($contentPlanningItem, $contentPlanningItem->recurringContract);
        }

        return response()->json(['data' => new ContentPlanningItemResource($contentPlanningItem->fresh()->load(['creator', 'company']))]);
    }

    public function destroyItem(Request $request, ContentPlanningItem $contentPlanningItem): JsonResponse
    {
        $contentPlanningItem->loadMissing(['creator.user', 'recurringContract.company']);
        abort_unless($contentPlanningItem->recurringContract, 404);
        $this->assertCanManage($request, $contentPlanningItem->recurringContract);
        if ($contentPlanningItem->creator?->user) {
            $this->mail->demandUpdated($contentPlanningItem, __('auth.item_removed'));
        }
        $contentPlanningItem->delete();

        return response()->json(['message' => __('auth.item_removed')]);
    }

    private function scopeContractsForUser(Builder $query, mixed $user): void
    {
        if ($user->role === UserRole::Company) {
            $query->where('company_id', $user->companyUser?->company_id);
        } elseif ($user->role === UserRole::Creator) {
            $query->where('status', '!=', RecurringContractStatus::PendingAgency)
                ->whereHas('recurringContractCreators', fn ($q) => $q->where('creator_id', $user->creator?->id));
        }
    }

    private function eagerLoadForUser(Builder $query, mixed $user, bool $withItems = true): void
    {
        $creatorId = $user->creator?->id;
        if ($user->role === UserRole::Creator && $creatorId) {
            $with = [
                'company',
                'recurringContractCreators' => fn ($q) => $q->where('creator_id', $creatorId)->with('creator'),
            ];
            if ($withItems) {
                $with['contentPlanningItems'] = fn ($q) => $q->where('creator_id', $creatorId)->with(['creator', 'company']);
            }
            $query->with($with);

            return;
        }

        $with = ['recurringContractCreators.creator'];
        if ($withItems) {
            $with[] = 'contentPlanningItems.creator';
            $with[] = 'contentPlanningItems.company';
        }
        $query->with($with);
    }

    private function wantsInclude(Request $request, string $key): bool
    {
        return collect(explode(',', $request->string('include')->toString()))
            ->contains(fn ($value) => trim($value) === $key);
    }

    private function loadVisibleRelations(Request $request, RecurringContract $contract): void
    {
        $user = $request->user();
        $creatorId = $user->creator?->id;
        if ($user->role === UserRole::Creator && $creatorId) {
            $contract->load([
                'company',
                'recurringContractCreators' => fn ($q) => $q->where('creator_id', $creatorId)->with('creator'),
                'contentPlanningItems' => fn ($q) => $q->where('creator_id', $creatorId)->with(['creator', 'company']),
            ]);

            return;
        }

        $contract->load(['company', 'recurringContractCreators.creator', 'contentPlanningItems.creator', 'contentPlanningItems.company']);
    }

    private function isLiveContentType(mixed $type): bool
    {
        if ($type instanceof ContentType) {
            $type = $type->value;
        }

        return in_array($type, ['live', 'live_instagram', 'live_tiktok', 'live_youtube'], true);
    }

    private function syncMonthlyDeliverables(RecurringContract $contract, RecurringContractCreator $row, ?string $targetMonth = null): int
    {
        $deliverables = $row->monthly_deliverables;
        if (! is_array($deliverables) || $deliverables === []) {
            return 0;
        }

        $anchorDate = $row->start_date ? Carbon::parse($row->start_date) : now();
        if ($targetMonth) {
            $month = $targetMonth;
            $plannedDate = Carbon::createFromFormat('Y-m-d', $targetMonth.'-01')->toDateString();
        } else {
            $month = $anchorDate->format('Y-m');
            $plannedDate = $anchorDate->toDateString();
        }

        $created = 0;

        foreach (self::DELIVERABLE_MAP as $key => $config) {
            $quota = max(0, (int) ($deliverables[$key] ?? 0));
            if ($quota === 0) {
                continue;
            }

            $existing = ContentPlanningItem::query()
                ->where('recurring_contract_id', $contract->id)
                ->where('creator_id', $row->creator_id)
                ->where('month', $month)
                ->where('content_type', $config['type'])
                ->count();

            $isLive = $this->isLiveContentType($config['type']->value);

            for ($index = $existing + 1; $index <= $quota; $index++) {
                $contract->contentPlanningItems()->create([
                    'company_id' => $contract->company_id,
                    'creator_id' => $row->creator_id,
                    'month' => $month,
                    'content_type' => $config['type'],
                    'title' => null,
                    'planned_date' => $plannedDate,
                    'status' => ContentPlanningStatus::Planned,
                    'approval_flow' => $isLive ? ApprovalFlowType::LiveLink : ApprovalFlowType::ScriptAndVideo,
                    'posting_profile' => PostingProfile::Creator,
                ]);
                $created++;
            }
        }

        return $created;
    }

    private function itemLabel(ContentPlanningItem $item): string
    {
        $title = trim((string) $item->title);
        if ($title !== '' && ! preg_match('/\s+\d+\/\d+$/', $title)) {
            return $title;
        }

        $type = $item->content_type instanceof ContentType
            ? $item->content_type
            : ContentType::tryFrom((string) $item->content_type);

        foreach (self::DELIVERABLE_MAP as $config) {
            if ($config['type'] === $type) {
                return __('auth.recurring_formats.'.$config['format_key']);
            }
        }

        return $type?->value ?: __('auth.new_demand_title');
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function restrictCreatorPlanningPayload(array $data, ContentPlanningItem $item): array
    {
        $allowed = [
            'script',
            'submission_url',
            'media_url',
            'published_url',
            'submission_notes',
            'script_status',
            'video_status',
            'status',
        ];
        abort_if(array_diff_key($data, array_flip($allowed)) !== [], 403, __('auth.forbidden'));
        $data = array_intersect_key($data, array_flip($allowed));

        foreach (['script_status', 'video_status'] as $field) {
            if (isset($data[$field]) && ! NotificationService::is($data[$field], StageApprovalStatus::Submitted)) {
                abort(403, __('auth.forbidden'));
            }
        }

        if (isset($data['status'])) {
            $status = NotificationService::value($data['status']);
            if ($status !== ContentPlanningStatus::Review->value) {
                abort(403, __('auth.forbidden'));
            }
        }

        if ($item->posting_profile === PostingProfile::Brand && array_key_exists('published_url', $data)) {
            abort(403, __('auth.brand_sends_published_link'));
        }

        return $data;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function assertCreatorCanSubmitPauta(array $data, ContentPlanningItem $item): void
    {
        if ($this->isLiveContentType($item->content_type) || $this->itemHasBriefing($item)) {
            return;
        }

        $submitting = array_key_exists('script', $data)
            || array_key_exists('script_status', $data)
            || array_key_exists('media_url', $data)
            || array_key_exists('submission_url', $data)
            || array_key_exists('video_status', $data)
            || array_key_exists('status', $data);

        abort_if($submitting, 422, __('auth.pauta_awaiting_briefing'));
    }

    private function assertCanViewItem(Request $request, ContentPlanningItem $item): void
    {
        $item->loadMissing('recurringContract');
        abort_unless($item->recurringContract, 404);
        $this->assertCanView($request, $item->recurringContract);
    }

    private function assertCanView(Request $request, RecurringContract $contract): void
    {
        $user = $request->user();
        if ($user->role === UserRole::Admin) {
            return;
        }
        if ($user->role === UserRole::Company && $user->companyUser?->company_id === $contract->company_id) {
            return;
        }
        if ($user->role === UserRole::Creator && $contract->recurringContractCreators()->where('creator_id', $user->creator?->id)->exists()) {
            abort_if($contract->isPendingAgency(), 403, __('auth.recurring_awaiting_agency'));

            return;
        }
        abort(403, __('auth.forbidden'));
    }

    private function assertCanManage(Request $request, RecurringContract $contract): void
    {
        $user = $request->user();
        if ($user->role === UserRole::Admin) {
            return;
        }
        if ($user->role === UserRole::Company && $user->companyUser?->company_id === $contract->company_id) {
            return;
        }
        abort(403, __('auth.forbidden'));
    }

    /**
     * @param  list<int|string>  $creatorIds
     */
    private function assertCompanyCanAssignCreators(Request $request, array $creatorIds, ?RecurringContract $contract = null): void
    {
        if ($request->user()?->role !== UserRole::Company || $creatorIds === []) {
            return;
        }

        $companyId = (int) $request->user()->companyUser?->company_id;
        abort_unless($companyId, 403, __('auth.company_not_linked'));

        $ids = array_values(array_unique(array_map('intval', $creatorIds)));
        $alreadyAttached = $contract
            ? array_map('intval', $contract->recurringContractCreators()->whereIn('creator_id', $ids)->pluck('creator_id')->all())
            : [];
        $pending = array_values(array_diff($ids, $alreadyAttached));
        if ($pending === []) {
            return;
        }

        $allowed = Creator::query()->inCompanyPool($companyId)->whereIn('id', $pending)->count();
        abort_unless($allowed === count($pending), 403, __('auth.creator_not_in_company_pool'));
    }

    private function notifyAgencyReview(RecurringContract $contract): void
    {
        $this->notifications->notifyAdmins(
            __('auth.agency_review_recurring_title'),
            __('auth.agency_review_recurring', ['name' => $contract->title]),
            NotificationType::Approval,
            '/recurring/'.$contract->id,
            ['recurring_contract_id' => $contract->id],
        );
    }

    private function notifyReleasedIfNeeded(RecurringContract $contract, mixed $previousStatus): void
    {
        $wasPending = $previousStatus === RecurringContractStatus::PendingAgency
            || $previousStatus === RecurringContractStatus::PendingAgency->value;
        if (! $wasPending || $contract->isPendingAgency()) {
            return;
        }

        $this->notifications->notifyCompany((int) $contract->company_id, [
            'recurring_contract_id' => $contract->id,
            'title' => __('auth.agency_approved_recurring_title'),
            'message' => __('auth.agency_approved_recurring', ['name' => $contract->title]),
            'type' => NotificationType::Approval,
            'link' => '/recurring/'.$contract->id,
        ]);

        $contract->loadMissing('recurringContractCreators');
        foreach ($contract->recurringContractCreators as $row) {
            $this->notifyRecurringAssigned($contract, (int) $row->creator_id);
        }
    }

    private function notifyRecurringAssigned(RecurringContract $contract, int $creatorId): void
    {
        $this->notifications->notifyCreator($creatorId, [
            'recurring_contract_id' => $contract->id,
            'title' => __('auth.recurring_assigned_title'),
            'message' => __('auth.recurring_assigned', ['project' => $contract->title]),
            'type' => NotificationType::Contract,
            'link' => '/creators/'.$creatorId.'?tab=recurring',
        ]);
        $creator = Creator::query()->with('user')->find($creatorId);
        if ($creator?->user) {
            $this->mail->demandAssignedToCreator($creator, $contract);
        }
    }

    private function notifyPautaReady(ContentPlanningItem $item, RecurringContract $contract): void
    {
        $this->notifications->notifyCreator($item->creator_id, [
            'recurring_contract_id' => $contract->id,
            'title' => __('auth.pauta_ready_title'),
            'message' => __('auth.pauta_ready', [
                'title' => $this->itemLabel($item),
                'project' => $contract->title,
            ]),
            'type' => NotificationType::Contract,
            'link' => '/creators/'.$item->creator_id.'?tab=recurring',
        ]);
        $item->loadMissing('creator.user');
        if ($item->creator?->user) {
            $this->mail->demandAssignedToCreator($item->creator, $contract, $item);
        }
    }

    private function itemHasBriefing(ContentPlanningItem $item): bool
    {
        if (trim((string) ($item->briefing ?: $item->briefing_note)) !== '') {
            return true;
        }

        return $this->briefingFieldsSummary($item->briefing_fields ?? []) !== '';
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function normalizeBriefingPayload(array &$data): void
    {
        if (isset($data['briefing']) && is_array($data['briefing'])) {
            $data['briefing_fields'] = array_merge($data['briefing_fields'] ?? [], $data['briefing']);
            unset($data['briefing']);
        }

        if (! isset($data['briefing_fields']) || ! is_array($data['briefing_fields'])) {
            return;
        }

        $data['briefing_fields'] = $this->sanitizeBriefingFields($data['briefing_fields']);
        $summary = $this->briefingFieldsSummary($data['briefing_fields']);
        if ($summary !== '' && (! array_key_exists('briefing', $data) || $data['briefing'] === null || $data['briefing'] === '')) {
            $data['briefing'] = $summary;
        }
        if (is_string($data['briefing'] ?? null)) {
            $data['briefing'] = trim((string) $data['briefing']) ?: null;
        }
    }

    /**
     * @param  array<string, mixed>  $fields
     * @return array<string, string|null>
     */
    private function sanitizeBriefingFields(array $fields): array
    {
        $clean = [];
        foreach (['product', 'key_message', 'must_have', 'donts', 'cta', 'hashtags'] as $key) {
            $value = $fields[$key] ?? null;
            if (is_string($value) || is_numeric($value)) {
                $trimmed = trim((string) $value);
                $clean[$key] = $trimmed === '' ? null : $trimmed;
            } else {
                $clean[$key] = null;
            }
        }

        return $clean;
    }

    /**
     * @param  array<string, mixed>  $fields
     */
    private function briefingFieldsSummary(array $fields): string
    {
        $parts = [];
        foreach (['product', 'key_message', 'must_have', 'donts', 'cta', 'hashtags'] as $key) {
            $value = trim((string) ($fields[$key] ?? ''));
            if ($value !== '') {
                $parts[] = $value;
            }
        }

        return implode("\n\n", $parts);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function notifyPlanningItemChange(ContentPlanningItem $item, array $data): void
    {
        $creatorId = $item->creator_id;
        $contractId = $item->recurring_contract_id;
        $companyId = (int) ($item->company_id ?: $item->recurringContract?->company_id);
        $projectTitle = $item->recurringContract?->title ?? '';
        $itemTitle = $this->itemLabel($item);
        $companyLink = '/recurring/'.$contractId;
        $creatorLink = '/creators/'.$creatorId.'?tab=recurring';
        $script = NotificationService::value($data['script_status'] ?? null);
        $video = NotificationService::value($data['video_status'] ?? null);
        $status = NotificationService::value($data['status'] ?? null);
        $materialApproved = $video === StageApprovalStatus::Approved->value
            || (
                $status === ContentPlanningStatus::Approved->value
                && $video === null
                && $script !== StageApprovalStatus::Approved->value
            );

        if ($companyId && $script === StageApprovalStatus::Submitted->value) {
            $this->notifications->notifyCompany($companyId, [
                'creator_id' => $creatorId,
                'recurring_contract_id' => $contractId,
                'title' => __('auth.script_submitted_title'),
                'message' => __('auth.script_submitted', ['title' => $itemTitle, 'project' => $projectTitle]),
                'type' => NotificationType::DeliveryReview,
                'link' => $companyLink,
            ]);
            $this->notifications->notifyAdmins(
                __('auth.script_submitted_title'),
                __('auth.script_submitted', ['title' => $itemTitle, 'project' => $projectTitle]),
                NotificationType::DeliveryReview,
                $companyLink,
                ['creator_id' => $creatorId, 'recurring_contract_id' => $contractId],
            );
        }

        if ($companyId && $video === StageApprovalStatus::Submitted->value) {
            $this->notifications->notifyCompany($companyId, [
                'creator_id' => $creatorId,
                'recurring_contract_id' => $contractId,
                'title' => __('auth.video_submitted_title'),
                'message' => __('auth.video_submitted', ['title' => $itemTitle, 'project' => $projectTitle]),
                'type' => NotificationType::DeliveryReview,
                'link' => $companyLink,
            ]);
            $this->notifications->notifyAdmins(
                __('auth.video_submitted_title'),
                __('auth.video_submitted', ['title' => $itemTitle, 'project' => $projectTitle]),
                NotificationType::DeliveryReview,
                $companyLink,
                ['creator_id' => $creatorId, 'recurring_contract_id' => $contractId],
            );
        }

        if (
            $companyId
            && (isset($data['submission_url']) || isset($data['media_url']))
            && $script !== StageApprovalStatus::Submitted->value
            && $video !== StageApprovalStatus::Submitted->value
        ) {
            $this->notifications->notifyCompany($companyId, [
                'creator_id' => $creatorId,
                'recurring_contract_id' => $contractId,
                'title' => __('auth.video_submitted_title'),
                'message' => __('auth.video_submitted', ['title' => $itemTitle, 'project' => $projectTitle]),
                'type' => NotificationType::DeliveryReview,
                'link' => $companyLink,
            ]);
            $this->notifications->notifyAdmins(
                __('auth.video_submitted_title'),
                __('auth.video_submitted', ['title' => $itemTitle, 'project' => $projectTitle]),
                NotificationType::DeliveryReview,
                $companyLink,
                ['creator_id' => $creatorId, 'recurring_contract_id' => $contractId],
            );
        }

        if ($script === StageApprovalStatus::Approved->value && ! $materialApproved) {
            $this->notifications->notifyCreator($creatorId, [
                'recurring_contract_id' => $contractId,
                'title' => __('auth.script_approved_title'),
                'message' => __('auth.script_approved', ['title' => $itemTitle, 'project' => $projectTitle]),
                'type' => NotificationType::Approval,
                'link' => $creatorLink,
            ]);
        }

        if ($materialApproved) {
            $this->notifications->notifyCreator($creatorId, [
                'recurring_contract_id' => $contractId,
                'title' => __('auth.material_approved_title'),
                'message' => __('auth.material_approved', ['title' => $itemTitle, 'project' => $projectTitle]),
                'type' => NotificationType::Approval,
                'link' => $creatorLink,
            ]);
        }

        if ($status === ContentPlanningStatus::Published->value) {
            $this->notifications->notifyCreator($creatorId, [
                'recurring_contract_id' => $contractId,
                'title' => __('auth.material_published_title'),
                'message' => __('auth.material_published', ['title' => $itemTitle, 'project' => $projectTitle]),
                'type' => NotificationType::Approval,
                'link' => $creatorLink,
            ]);
        }

        if ($script === StageApprovalStatus::Revision->value && $video !== StageApprovalStatus::Revision->value) {
            $this->notifications->notifyCreator($creatorId, [
                'recurring_contract_id' => $contractId,
                'title' => __('auth.material_revision_title'),
                'message' => ($data['script_feedback'] ?? '')
                    ?: __('auth.material_revision', ['title' => $itemTitle]),
                'type' => NotificationType::DeliveryReview,
                'link' => $creatorLink,
            ]);
        }

        if ($video === StageApprovalStatus::Revision->value) {
            $this->notifications->notifyCreator($creatorId, [
                'recurring_contract_id' => $contractId,
                'title' => __('auth.material_revision_title'),
                'message' => ($data['video_feedback'] ?? $data['feedback_note'] ?? '')
                    ?: __('auth.material_revision', ['title' => $itemTitle]),
                'type' => NotificationType::DeliveryReview,
                'link' => $creatorLink,
            ]);
        }

        $user = $item->creator?->user;
        $ids = ['creator_id' => $creatorId, 'company_id' => $companyId];
        if ($companyId && $item->creator && (
            $script === StageApprovalStatus::Submitted->value
            || $video === StageApprovalStatus::Submitted->value
            || isset($data['submission_url'])
            || isset($data['media_url'])
        )) {
            $this->mail->deliverySubmitted($companyId, $item->creator, $itemTitle, $companyLink, $ids, $item->recurringContract);
        }
        if ($user && ($materialApproved || $status === ContentPlanningStatus::Published->value || $status === ContentPlanningStatus::Approved->value)) {
            $this->mail->deliveryApproved($user, $projectTitle, $itemTitle, $creatorLink, $ids);
        }
        if ($user && ($script === StageApprovalStatus::Revision->value || $video === StageApprovalStatus::Revision->value)) {
            $this->mail->revisionRequested(
                $user,
                $projectTitle,
                $itemTitle,
                (string) ($data['video_feedback'] ?? $data['script_feedback'] ?? $data['feedback_note'] ?? ''),
                $creatorLink,
                $ids,
            );
        }
    }
}
