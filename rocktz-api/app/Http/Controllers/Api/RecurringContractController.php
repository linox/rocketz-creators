<?php

namespace App\Http\Controllers\Api;

use App\Enums\ApprovalFlowType;
use App\Enums\ContentPlanningStatus;
use App\Enums\ContentType;
use App\Enums\NotificationType;
use App\Enums\RecurringContractStatus;
use App\Enums\StageApprovalStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\ContentPlanningItemResource;
use App\Http\Resources\RecurringContractResource;
use App\Models\Company;
use App\Models\ContentPlanningItem;
use App\Models\RecurringContract;
use App\Models\RecurringContractCreator;
use App\Services\NotificationService;
use App\Support\RevisionHistory;
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

    public function __construct(private readonly NotificationService $notifications) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = RecurringContract::query()->with('company');
        $this->scopeContractsForUser($query, $user);
        $this->eagerLoadForUser($query, $user);

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

        $ids = $data['creator_ids'] ?? [];
        unset($data['creator_ids']);
        $data['status'] ??= RecurringContractStatus::Active;
        $contract = RecurringContract::query()->create($data);
        foreach ($ids as $creatorId) {
            $contract->recurringContractCreators()->create(['creator_id' => $creatorId]);
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
        $recurringContract->fill($data)->save();

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
        $row = $recurringContract->recurringContractCreators()->updateOrCreate(
            ['creator_id' => $data['creator_id']],
            $data,
        );

        $this->syncMonthlyDeliverables($recurringContract, $row);

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

        if ($created > 0) {
            $row->loadMissing('creator');
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
            'briefing' => ['nullable', 'string'],
            'script' => ['nullable', 'string'],
            'references' => ['nullable', 'string', 'max:2048'],
            'planned_date' => ['nullable', 'date'],
            'status' => ['nullable', Rule::enum(ContentPlanningStatus::class)],
            'approval_flow' => ['nullable', Rule::enum(ApprovalFlowType::class)],
            'published_url' => ['nullable', 'string', 'max:2048'],
        ]);

        if ($this->isLiveContentType($data['content_type'] ?? null)) {
            $data['approval_flow'] = ApprovalFlowType::LiveLink;
            if (! empty($data['published_url'])) {
                $data['status'] = ContentPlanningStatus::Published;
                $data['reviewed_at'] = now();
            }
        } else {
            $data['approval_flow'] ??= ApprovalFlowType::ScriptAndVideo;
        }

        $item = $recurringContract->contentPlanningItems()->create([
            ...$data,
            'company_id' => $recurringContract->company_id,
            'status' => $data['status'] ?? ContentPlanningStatus::Planned,
        ]);

        $this->notifications->notifyCreator($item->creator_id, [
            'recurring_contract_id' => $recurringContract->id,
            'title' => __('auth.new_demand_title'),
            'message' => __('auth.new_demand', [
                'title' => $this->itemLabel($item),
                'project' => $recurringContract->title,
            ]),
            'type' => NotificationType::Contract,
            'link' => '/creators/'.$item->creator_id.'?tab=recurring',
        ]);

        return response()->json(['data' => new ContentPlanningItemResource($item->load('creator'))], 201);
    }

    public function updateItem(Request $request, ContentPlanningItem $contentPlanningItem): JsonResponse
    {
        $data = $request->validate([
            'title' => ['sometimes', 'nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'briefing' => ['nullable', 'string'],
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
            'script_status' => ['nullable', Rule::enum(StageApprovalStatus::class)],
            'video_status' => ['nullable', Rule::enum(StageApprovalStatus::class)],
            'script_feedback' => ['nullable', 'string'],
            'video_feedback' => ['nullable', 'string'],
        ]);

        $this->assertCanViewItem($request, $contentPlanningItem);
        if ($request->user()->role === UserRole::Creator) {
            abort_unless($contentPlanningItem->creator_id === $request->user()->creator?->id, 403, __('auth.forbidden'));
            unset($data['creator_id'], $data['feedback_note'], $data['script_feedback'], $data['video_feedback']);
        }

        if (isset($data['content_type']) && $this->isLiveContentType($data['content_type'])) {
            $data['approval_flow'] = ApprovalFlowType::LiveLink;
        }

        if (isset($data['published_url']) && ($contentPlanningItem->approval_flow === ApprovalFlowType::LiveLink || $this->isLiveContentType($contentPlanningItem->content_type?->value))) {
            $data['status'] = ! empty($data['published_url']) ? ContentPlanningStatus::Published : ($data['status'] ?? $contentPlanningItem->status);
            $data['reviewed_at'] = ! empty($data['published_url']) ? now() : $contentPlanningItem->reviewed_at;
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

        $contentPlanningItem->loadMissing(['creator', 'recurringContract']);
        $this->notifyPlanningItemChange($contentPlanningItem, $data);

        return response()->json(['data' => new ContentPlanningItemResource($contentPlanningItem->fresh()->load(['creator', 'company']))]);
    }

    public function destroyItem(ContentPlanningItem $contentPlanningItem): JsonResponse
    {
        $contentPlanningItem->delete();

        return response()->json(['message' => __('auth.item_removed')]);
    }

    private function scopeContractsForUser(Builder $query, mixed $user): void
    {
        if ($user->role === UserRole::Company) {
            $query->where('company_id', $user->companyUser?->company_id);
        } elseif ($user->role === UserRole::Creator) {
            $query->whereHas('recurringContractCreators', fn ($q) => $q->where('creator_id', $user->creator?->id));
        }
    }

    private function eagerLoadForUser(Builder $query, mixed $user): void
    {
        $creatorId = $user->creator?->id;
        if ($user->role === UserRole::Creator && $creatorId) {
            $query->with([
                'recurringContractCreators' => fn ($q) => $q->where('creator_id', $creatorId)->with('creator'),
                'contentPlanningItems' => fn ($q) => $q->where('creator_id', $creatorId)->with(['creator', 'company']),
            ]);

            return;
        }

        $query->with(['recurringContractCreators.creator', 'contentPlanningItems.creator', 'contentPlanningItems.company']);
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
    }
}
