<?php

namespace App\Http\Controllers\Api;

use App\Enums\ApplicationStatus;
use App\Enums\ApprovalFlowType;
use App\Enums\CampaignStatus;
use App\Enums\CreatorStatus;
use App\Enums\DeliveryStatus;
use App\Enums\NotificationType;
use App\Enums\PaymentStatus;
use App\Enums\SignatureStatus;
use App\Enums\StageApprovalStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\CampaignCreatorResource;
use App\Http\Resources\CampaignResource;
use App\Jobs\SyncCampaignPostMetricsJob;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\CampaignCreatorContent;
use App\Models\Company;
use App\Services\Mail\MailNotifier;
use App\Services\NotificationService;
use App\Support\Geo;
use App\Support\MetricsSyncStatus;
use App\Support\RevisionHistory;
use App\Support\SubmissionVersioning;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CampaignController extends Controller
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly MailNotifier $mail,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = $this->scoped($request)
            ->with(['company', 'briefing', 'deliverable'])
            ->withCount(['campaignCreators as pending_applications_count' => fn ($q) => $q->where('application_status', ApplicationStatus::Pending)]);

        if ($request->user()?->role !== UserRole::Creator) {
            $query->with(['campaignCreators.creator', 'campaignCreators.content']);
        }

        if ($status = $request->string('status')->toString()) {
            $query->where('status', $status);
        }

        if ($search = $request->string('q')->toString()) {
            $query->where('name', 'like', "%{$search}%");
        }

        return response()->json(['data' => CampaignResource::collection($query->latest()->get())]);
    }

    public function available(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_if(
            $user->role === UserRole::Creator && $user->creator?->status !== CreatorStatus::Active,
            403,
            __('auth.creator_must_be_approved'),
        );

        $query = Campaign::query()
            ->with(['company', 'briefing', 'deliverable', 'campaignCreators'])
            ->whereNotIn('status', [CampaignStatus::Finished, CampaignStatus::PendingAgency]);

        if ($user->role !== UserRole::Admin) {
            $query->where('is_secret', false);
        }

        if ($user->role === UserRole::Company) {
            $query->where('company_id', '!=', $user->companyUser?->company_id);
        }

        if ($user->role === UserRole::Creator && $user->creator) {
            $query->forCreatorMarketplace($user->creator);
        }

        return response()->json(['data' => CampaignResource::collection($query->latest()->get())]);
    }

    public function show(Request $request, Campaign $campaign): JsonResponse
    {
        $this->assertCanView($request, $campaign);
        $campaign->load(['company', 'briefing', 'deliverable', 'campaignCreators.creator', 'campaignCreators.content']);
        $campaign->loadCount(['campaignCreators as pending_applications_count' => fn ($q) => $q->where('application_status', ApplicationStatus::Pending)]);

        return response()->json(['data' => new CampaignResource($campaign)]);
    }

    public function syncPostMetrics(Request $request, Campaign $campaign): JsonResponse
    {
        $this->assertCanManage($request, $campaign);

        $data = $request->validate([
            'force' => ['sometimes', 'boolean'],
            'campaign_creator_id' => ['nullable', 'integer'],
        ]);

        $campaignCreatorId = isset($data['campaign_creator_id']) ? (int) $data['campaign_creator_id'] : null;
        $key = MetricsSyncStatus::campaignKey($campaign->id, $campaignCreatorId);

        if (! MetricsSyncStatus::busy($key)) {
            MetricsSyncStatus::put($key, MetricsSyncStatus::QUEUED);
            $job = new SyncCampaignPostMetricsJob(
                $campaign->id,
                $campaignCreatorId,
                (bool) ($data['force'] ?? false),
            );
            if (app()->runningUnitTests()) {
                dispatch_sync($job);
            } else {
                dispatch($job)->afterResponse();
            }
        }

        return $this->postMetricsJobResponse($campaign, $key);
    }

    public function postMetricsStatus(Request $request, Campaign $campaign): JsonResponse
    {
        $this->assertCanManage($request, $campaign);

        $campaignCreatorId = $request->integer('campaign_creator_id') ?: null;
        $key = MetricsSyncStatus::campaignKey($campaign->id, $campaignCreatorId);

        return $this->postMetricsJobResponse($campaign, $key);
    }

    private function postMetricsJobResponse(Campaign $campaign, string $key): JsonResponse
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

        $campaign->load(['company', 'briefing', 'deliverable', 'campaignCreators.creator', 'campaignCreators.content']);
        $campaign->loadCount(['campaignCreators as pending_applications_count' => fn ($q) => $q->where('application_status', ApplicationStatus::Pending)]);

        return response()->json([
            'status' => $status,
            'data' => new CampaignResource($campaign),
            'sync' => $state['sync'] ?? [],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validatedCampaign($request);
        $campaign = DB::transaction(function () use ($data) {
            $briefing = $data['briefing'] ?? [];
            $deliverables = $data['deliverables'] ?? [];
            unset($data['briefing'], $data['deliverables']);
            $campaign = Campaign::query()->create($data);
            $campaign->briefing()->create($briefing);
            $campaign->deliverable()->create($deliverables);

            return $campaign;
        });

        $campaign->load(['company', 'briefing', 'deliverable']);
        if ($campaign->isPendingAgency()) {
            $this->notifyAgencyReview($campaign);
            $this->mail->campaignPendingAgency($campaign);
        } else {
            $this->mail->campaignVisible($campaign);
        }

        return response()->json(['data' => new CampaignResource($campaign)], 201);
    }

    public function update(Request $request, Campaign $campaign): JsonResponse
    {
        $this->assertCanManage($request, $campaign);
        $previousStatus = $campaign->status;
        $data = $this->validatedCampaign($request, false);
        if (
            array_key_exists('company_id', $data)
            && $data['company_id']
            && (int) $data['company_id'] !== (int) $campaign->company_id
        ) {
            Company::assertApproved((int) $data['company_id']);
        }
        DB::transaction(function () use ($campaign, $data) {
            $briefing = $data['briefing'] ?? null;
            $deliverables = $data['deliverables'] ?? null;
            unset($data['briefing'], $data['deliverables']);
            $campaign->fill($data)->save();
            if (is_array($briefing)) {
                $campaign->briefing()->updateOrCreate(['campaign_id' => $campaign->id], $briefing);
            }
            if (is_array($deliverables)) {
                $campaign->deliverable()->updateOrCreate(['campaign_id' => $campaign->id], $deliverables);
            }
        });

        $campaign = $campaign->fresh()->load(['company', 'briefing', 'deliverable', 'campaignCreators.creator']);
        $this->notifyReleasedIfNeeded($campaign, $previousStatus);

        return response()->json(['data' => new CampaignResource($campaign)]);
    }

    public function approveAgency(Request $request, Campaign $campaign): JsonResponse
    {
        abort_unless($campaign->isPendingAgency(), 422, __('auth.agency_approval_not_pending'));
        $data = $request->validate([
            'agency_fee_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);
        $previousStatus = $campaign->status;
        $percent = array_key_exists('agency_fee_percent', $data) && $data['agency_fee_percent'] !== null
            ? (float) $data['agency_fee_percent']
            : (float) ($campaign->agency_fee_percent ?? Campaign::DEFAULT_AGENCY_FEE_PERCENT);
        $campaign->update([
            'status' => CampaignStatus::Briefing,
            ...Campaign::feeSplit((float) $campaign->total_budget, $percent),
        ]);
        $campaign->load(['company', 'briefing', 'deliverable', 'campaignCreators.creator']);
        $this->notifyReleasedIfNeeded($campaign, $previousStatus);

        return response()->json(['data' => new CampaignResource($campaign)]);
    }

    public function destroy(Campaign $campaign): JsonResponse
    {
        $campaign->delete();

        return response()->json(['message' => __('auth.campaign_removed')]);
    }

    public function reset(): JsonResponse
    {
        $deleted = Campaign::query()->count();
        Campaign::query()->delete();

        return response()->json(['message' => __('auth.campaigns_reset'), 'deleted' => $deleted]);
    }

    public function apply(Request $request, Campaign $campaign): JsonResponse
    {
        $user = $request->user();
        $creator = $user->creator;
        abort_unless($creator, 403, __('auth.creators_only_apply'));
        abort_unless($creator->status === CreatorStatus::Active, 403, __('auth.creator_must_be_approved'));
        abort_if($campaign->isPendingAgency(), 403, __('auth.campaign_awaiting_agency'));
        abort_unless(
            $creator->contractAcceptances()->exists(),
            403,
            __('auth.creator_must_accept_contract'),
        );
        $campaign->loadMissing('company');
        abort_unless(
            $creator->canAccessCompanyCountry($campaign->company),
            403,
            __('auth.campaign_country_restricted'),
        );

        $data = $request->validate([
            'notes' => ['nullable', 'string'],
            'delivery_type' => ['nullable', 'string', 'max:80'],
        ]);

        $row = CampaignCreator::query()->updateOrCreate(
            ['campaign_id' => $campaign->id, 'creator_id' => $creator->id],
            [
                'notes' => $data['notes'] ?? null,
                'amount' => $this->defaultCreatorAmount($campaign),
                'delivery_type' => $data['delivery_type'] ?? 'ugc',
                'application_status' => ApplicationStatus::Pending,
                'delivery_status' => DeliveryStatus::Pending,
            ],
        );

        $this->notifications->notifyAdmins(
            'Nova candidatura',
            "{$creator->artistic_name} se candidatou à campanha {$campaign->name}.",
            NotificationType::Application,
            '/campaigns/'.$campaign->id,
            ['campaign_id' => $campaign->id, 'creator_id' => $creator->id],
        );

        $this->mail->creatorApplied($campaign, $creator);

        return response()->json(['data' => new CampaignCreatorResource($row->load('creator'))], 201);
    }

    public function updateParticipation(Request $request, CampaignCreator $campaignCreator): JsonResponse
    {
        $data = $request->validate([
            'application_status' => ['nullable', Rule::enum(ApplicationStatus::class)],
            'delivery_status' => ['nullable', Rule::enum(DeliveryStatus::class)],
            'script_status' => ['nullable', Rule::enum(StageApprovalStatus::class)],
            'video_status' => ['nullable', Rule::enum(StageApprovalStatus::class)],
            'rejection_reason' => ['nullable', 'string'],
            'revision_details' => ['nullable', 'string'],
            'script_feedback' => ['nullable', 'string'],
            'video_feedback' => ['nullable', 'string'],
            'amount' => ['nullable', 'numeric'],
            'delivery_type' => ['nullable', 'string'],
            'payment_status' => ['nullable', Rule::enum(PaymentStatus::class)],
            'payment_date' => ['nullable', 'date', 'required_if:payment_status,scheduled'],
            'signature_status' => ['nullable', Rule::enum(SignatureStatus::class)],
            'delivery_date' => ['nullable', 'date'],
            'script' => ['nullable', 'string'],
            'video_url' => ['nullable', 'string', 'max:2048'],
            'video_file_size' => ['nullable', 'integer', 'min:0'],
            'image_url' => ['nullable', 'string', 'max:2048'],
            'published_link' => ['nullable', 'string', 'max:2048'],
        ]);

        $contentFields = array_intersect_key($data, array_flip(['script', 'video_url', 'video_file_size', 'image_url', 'published_link']));
        unset($data['script'], $data['video_url'], $data['video_file_size'], $data['image_url'], $data['published_link']);

        $campaignCreator->loadMissing('campaign');
        $approvedStatus = ApplicationStatus::Approved->value;
        $nextStatus = isset($data['application_status'])
            ? ($data['application_status'] instanceof ApplicationStatus ? $data['application_status']->value : $data['application_status'])
            : null;
        if ($nextStatus === $approvedStatus && (! array_key_exists('amount', $data) || $data['amount'] === null)) {
            $data['amount'] = $this->defaultCreatorAmount($campaignCreator->campaign);
        }

        if (NotificationService::is($data['script_status'] ?? null, StageApprovalStatus::Submitted)) {
            $data['script_submitted_at'] = now();
        }
        if (NotificationService::is($data['video_status'] ?? null, StageApprovalStatus::Submitted)) {
            $data['video_submitted_at'] = now();
        }

        $nextPayment = $data['payment_status'] ?? null;
        $nextPaymentValue = $nextPayment instanceof PaymentStatus ? $nextPayment->value : $nextPayment;
        if ($nextPaymentValue !== null) {
            abort_unless(in_array($request->user()?->role, [UserRole::Admin, UserRole::Company], true), 403);
        }
        if (in_array($nextPaymentValue, [PaymentStatus::Paid->value, PaymentStatus::Scheduled->value], true)
            && ! $this->contentReadyForPayment($campaignCreator, $data)) {
            throw ValidationException::withMessages([
                'payment_status' => __('auth.payment_requires_approved_content'),
            ]);
        }
        if ($nextPaymentValue === PaymentStatus::Paid->value && empty($data['payment_date'])) {
            $data['payment_date'] = now()->toDateString();
        }

        $campaignCreator->fill($data)->save();

        if ($contentFields) {
            CampaignCreatorContent::query()->updateOrCreate(
                ['campaign_creator_id' => $campaignCreator->id],
                $contentFields,
            );
        }

        $campaignCreator->unsetRelation('content');
        $campaignCreator->load('content');

        if (Schema::hasColumn('campaign_creator_contents', 'revision_history')) {
            if (NotificationService::is($data['script_status'] ?? null, StageApprovalStatus::Revision)) {
                $content = $campaignCreator->content
                    ?? CampaignCreatorContent::query()->firstOrCreate(['campaign_creator_id' => $campaignCreator->id]);
                RevisionHistory::append(
                    $content,
                    'script',
                    (string) ($data['script_feedback'] ?? $data['revision_details'] ?? ''),
                );
                $content->save();
            }

            if (NotificationService::is($data['video_status'] ?? null, StageApprovalStatus::Revision)) {
                $content = $campaignCreator->content
                    ?? CampaignCreatorContent::query()->firstOrCreate(['campaign_creator_id' => $campaignCreator->id]);
                RevisionHistory::append(
                    $content,
                    'video',
                    (string) ($data['video_feedback'] ?? $data['revision_details'] ?? ''),
                );
                $content->save();
            }
        }

        if (NotificationService::is($data['script_status'] ?? null, StageApprovalStatus::Submitted)) {
            $content = $campaignCreator->content
                ?? CampaignCreatorContent::query()->firstOrCreate(['campaign_creator_id' => $campaignCreator->id]);
            SubmissionVersioning::append($content, 'script', [
                'script' => $content->script,
            ]);
        }

        if (NotificationService::is($data['video_status'] ?? null, StageApprovalStatus::Submitted)) {
            $content = $campaignCreator->content
                ?? CampaignCreatorContent::query()->firstOrCreate(['campaign_creator_id' => $campaignCreator->id]);
            if ($content->video_url) {
                SubmissionVersioning::append($content, 'video', [
                    'video_url' => $content->video_url,
                    'video_file_size' => $content->video_file_size,
                ]);
            }
        }

        $campaignCreator->loadMissing(['creator.user', 'campaign', 'content']);
        $this->notifyParticipationChange($campaignCreator, $data);

        return response()->json(['data' => new CampaignCreatorResource($campaignCreator->fresh()->load(['creator', 'content', 'campaign']))]);
    }

    public function destroyParticipation(CampaignCreator $campaignCreator): JsonResponse
    {
        $campaignCreator->delete();

        return response()->json(['message' => __('auth.creator_removed')]);
    }

    public function assign(Request $request, Campaign $campaign): JsonResponse
    {
        $data = $request->validate([
            'creator_id' => ['required', 'exists:creators,id'],
            'amount' => ['nullable', 'numeric'],
            'delivery_type' => ['nullable', 'string'],
        ]);

        $existing = CampaignCreator::query()
            ->where('campaign_id', $campaign->id)
            ->where('creator_id', $data['creator_id'])
            ->first();
        $shouldNotify = $existing === null
            || $existing->application_status !== ApplicationStatus::Approved;

        $row = CampaignCreator::query()->updateOrCreate(
            ['campaign_id' => $campaign->id, 'creator_id' => $data['creator_id']],
            [
                'amount' => array_key_exists('amount', $data) && $data['amount'] !== null
                    ? $data['amount']
                    : $this->defaultCreatorAmount($campaign),
                'delivery_type' => $data['delivery_type'] ?? 'ugc',
                'application_status' => ApplicationStatus::Approved,
                'delivery_status' => DeliveryStatus::Pending,
            ],
        );

        if ($shouldNotify && ! $campaign->isPendingAgency()) {
            $this->notifications->notifyCreator((int) $data['creator_id'], [
                'campaign_id' => $campaign->id,
                'title' => __('auth.campaign_assigned_title'),
                'message' => __('auth.campaign_assigned', ['name' => $campaign->name]),
                'type' => NotificationType::Approval,
                'link' => '/creators/'.$data['creator_id'].'?tab=campaigns',
            ]);
            $row->loadMissing('creator.user');
            if ($row->creator) {
                $this->mail->campaignAssigned($campaign->loadMissing('company'), $row->creator);
                $this->mail->applicationDecided($row, true);
            }
        }

        return response()->json(['data' => new CampaignCreatorResource($row->load('creator'))], 201);
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedCampaign(Request $request, bool $creating = true): array
    {
        $user = $request->user();
        $rules = [
            'company_id' => [$creating && $user->role === UserRole::Admin ? 'required' : 'nullable', 'exists:companies,id'],
            'name' => [$creating ? 'required' : 'sometimes', 'string', 'max:255'],
            'objective' => ['nullable', 'string'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'total_budget' => ['nullable', 'numeric'],
            'agency_fee' => ['nullable', 'numeric'],
            'agency_fee_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'creators_budget' => ['nullable', 'numeric'],
            'creator_cache' => [Rule::requiredIf(fn () => $creating && ! $request->boolean('is_barter')), 'nullable', 'numeric', 'min:0'],
            'status' => ['nullable', Rule::enum(CampaignStatus::class)],
            'image_url' => ['nullable', 'string', 'max:2048'],
            'is_secret' => ['sometimes', 'boolean'],
            'is_direct_contract' => ['sometimes', 'boolean'],
            'is_barter' => ['sometimes', 'boolean'],
            'barter_details' => ['nullable', 'string'],
            'approval_flow' => ['nullable', Rule::enum(ApprovalFlowType::class)],
            'briefing' => ['nullable', 'array'],
            'deliverables' => ['nullable', 'array'],
        ];

        $data = $request->validate($rules);
        if ($user->role === UserRole::Company) {
            $data['company_id'] = $user->companyUser?->company_id;
        }
        if ($creating) {
            abort_unless($data['company_id'] ?? null, 422, __('auth.company_not_linked'));
            Company::assertApproved((int) $data['company_id']);
        }
        $companyId = (int) ($data['company_id'] ?? $request->route('campaign')?->company_id);
        if ($creating || array_key_exists('company_id', $data)) {
            $company = Company::query()->find($companyId);
            $data['currency'] = $company?->currencyCode() ?: Geo::DEFAULT_CURRENCY;
        }
        if (! $user->canPublishWithoutApproval()) {
            if ($creating) {
                $data['status'] = CampaignStatus::PendingAgency;
            } else {
                unset($data['status']);
            }
        } elseif ($creating) {
            $data['status'] ??= CampaignStatus::Briefing;
        }
        if ($creating) {
            $data['approval_flow'] ??= ApprovalFlowType::ScriptAndVideo;
        }

        return $this->withAgencyFeeSplit(
            $data,
            $creating ? null : $request->route('campaign'),
            $user,
        );
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function withAgencyFeeSplit(array $data, mixed $existing, mixed $user): array
    {
        $campaign = $existing instanceof Campaign ? $existing : null;
        $isAdmin = $user?->role === UserRole::Admin;
        if (! $isAdmin) {
            unset($data['agency_fee_percent'], $data['agency_fee']);
        }

        $shouldSplit = $campaign === null
            || array_key_exists('agency_fee_percent', $data)
            || array_key_exists('total_budget', $data);

        if (! $shouldSplit) {
            return $data;
        }

        $percent = $isAdmin && array_key_exists('agency_fee_percent', $data) && $data['agency_fee_percent'] !== null
            ? (float) $data['agency_fee_percent']
            : (float) ($campaign?->agency_fee_percent ?? Campaign::DEFAULT_AGENCY_FEE_PERCENT);
        $budget = array_key_exists('total_budget', $data)
            ? (float) ($data['total_budget'] ?? 0)
            : (float) ($campaign?->total_budget ?? 0);

        return array_merge($data, Campaign::feeSplit($budget, $percent));
    }

    private function scoped(Request $request)
    {
        $user = $request->user();
        $query = Campaign::query();

        return match ($user->role) {
            UserRole::Admin => $query,
            UserRole::Company => $query->where('company_id', $user->companyUser?->company_id),
            UserRole::Creator => $user->creator?->status === CreatorStatus::Active
                ? $query->where('status', '!=', CampaignStatus::PendingAgency)
                    ->where(function ($builder) use ($user) {
                        $builder->whereHas('campaignCreators', fn ($q) => $q->where('creator_id', $user->creator?->id));
                        if ($user->creator?->canAccessAllCountries()) {
                            $builder->orWhere('is_secret', false);
                        } else {
                            $country = $user->creator?->countryCode() ?: Geo::DEFAULT_COUNTRY;
                            $builder->orWhere(function ($inner) use ($country) {
                                $inner->where('is_secret', false)
                                    ->whereHas('company', fn ($q) => $q->where('country', $country));
                            });
                        }
                    })
                : $query->whereRaw('1 = 0'),
            default => $query->whereRaw('1=0'),
        };
    }

    private function assertCanView(Request $request, Campaign $campaign): void
    {
        $user = $request->user();
        if ($user->role === UserRole::Admin) {
            return;
        }
        if ($user->role === UserRole::Company && $user->companyUser?->company_id === $campaign->company_id) {
            return;
        }
        if ($user->role === UserRole::Creator) {
            abort_if($campaign->isPendingAgency(), 403, __('auth.campaign_awaiting_agency'));
            abort_unless($user->creator?->status === CreatorStatus::Active, 403, __('auth.creator_must_be_approved'));
            $assigned = $campaign->campaignCreators()->where('creator_id', $user->creator?->id)->exists();
            if ($assigned) {
                return;
            }
            if ($campaign->is_secret) {
                abort(403, __('auth.forbidden'));
            }
            $campaign->loadMissing('company');
            abort_unless($user->creator?->canAccessCompanyCountry($campaign->company), 403, __('auth.campaign_country_restricted'));

            return;
        }
        abort(403, __('auth.forbidden'));
    }

    private function assertCanManage(Request $request, Campaign $campaign): void
    {
        $user = $request->user();
        if ($user->role === UserRole::Admin) {
            return;
        }
        if ($user->role === UserRole::Company && $user->companyUser?->company_id === $campaign->company_id) {
            return;
        }
        abort(403, __('auth.forbidden'));
    }

    private function notifyAgencyReview(Campaign $campaign): void
    {
        $this->notifications->notifyAdmins(
            __('auth.agency_review_campaign_title'),
            __('auth.agency_review_campaign', ['name' => $campaign->name]),
            NotificationType::Approval,
            '/campaigns/'.$campaign->id,
            ['campaign_id' => $campaign->id],
        );
    }

    private function notifyReleasedIfNeeded(Campaign $campaign, mixed $previousStatus): void
    {
        $wasPending = $previousStatus === CampaignStatus::PendingAgency
            || $previousStatus === CampaignStatus::PendingAgency->value;
        if (! $wasPending || $campaign->isPendingAgency()) {
            return;
        }

        $this->notifications->notifyCompany((int) $campaign->company_id, [
            'campaign_id' => $campaign->id,
            'title' => __('auth.agency_approved_campaign_title'),
            'message' => __('auth.agency_approved_campaign', ['name' => $campaign->name]),
            'type' => NotificationType::Approval,
            'link' => '/campaigns/'.$campaign->id,
        ]);

        $campaign->loadMissing('campaignCreators');
        foreach ($campaign->campaignCreators as $row) {
            $this->notifications->notifyCreator((int) $row->creator_id, [
                'campaign_id' => $campaign->id,
                'title' => __('auth.campaign_assigned_title'),
                'message' => __('auth.campaign_assigned', ['name' => $campaign->name]),
                'type' => NotificationType::Approval,
                'link' => '/creators/'.$row->creator_id.'?tab=campaigns',
            ]);
        }

        $this->mail->campaignVisible($campaign);
    }

    private function defaultCreatorAmount(Campaign $campaign): float
    {
        if ($campaign->is_barter) {
            return 0.0;
        }

        return (float) ($campaign->creator_cache ?? 0);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function notifyParticipationChange(CampaignCreator $campaignCreator, array $data): void
    {
        $creatorId = $campaignCreator->creator_id;
        $campaignId = (int) $campaignCreator->campaign_id;
        $companyId = (int) ($campaignCreator->campaign?->company_id ?? 0);
        $campaignName = $campaignCreator->campaign?->name ?? '';
        $companyLink = '/campaigns/'.$campaignId;
        $creatorLink = '/creators/'.$creatorId.'?tab=campaigns';
        $application = NotificationService::value($data['application_status'] ?? null);
        $script = NotificationService::value($data['script_status'] ?? null);
        $video = NotificationService::value($data['video_status'] ?? null);
        $delivery = NotificationService::value($data['delivery_status'] ?? null);
        $materialApproved = $delivery === DeliveryStatus::Approved->value
            || $video === StageApprovalStatus::Approved->value;
        $videoRevision = $video === StageApprovalStatus::Revision->value
            || $delivery === DeliveryStatus::Revision->value;

        if (in_array($application, [ApplicationStatus::Approved->value, ApplicationStatus::Rejected->value], true)) {
            $approved = $application === ApplicationStatus::Approved->value;
            $this->notifications->notifyCreator($creatorId, [
                'campaign_id' => $campaignId,
                'title' => $approved ? __('auth.application_approved_title') : __('auth.application_rejected_title'),
                'message' => $approved
                    ? __('auth.application_approved')
                    : (($data['rejection_reason'] ?? '') ?: __('auth.application_rejected')),
                'type' => $approved ? NotificationType::Approval : NotificationType::Rejection,
                'link' => $creatorLink,
            ]);
            if ($campaignCreator->creator?->user) {
                $this->mail->applicationDecided(
                    $campaignCreator,
                    $approved,
                    $approved ? null : (($data['rejection_reason'] ?? '') ?: null),
                );
            }
        }

        if ($script === StageApprovalStatus::Approved->value && ! $materialApproved) {
            $this->notifications->notifyCreator($creatorId, [
                'campaign_id' => $campaignId,
                'title' => __('auth.script_approved_title'),
                'message' => __('auth.script_approved', ['title' => $campaignName, 'project' => $campaignName]),
                'type' => NotificationType::Approval,
                'link' => $creatorLink,
            ]);
            if ($campaignCreator->creator?->user) {
                $this->mail->deliveryApproved(
                    $campaignCreator->creator->user,
                    $campaignName,
                    $campaignName,
                    $creatorLink,
                    ['campaign_id' => $campaignId, 'creator_id' => $creatorId, 'company_id' => $companyId],
                );
            }
        }

        if ($materialApproved) {
            $this->notifications->notifyCreator($creatorId, [
                'campaign_id' => $campaignId,
                'title' => __('auth.material_approved_title'),
                'message' => __('auth.material_approved', ['title' => $campaignName, 'project' => $campaignName]),
                'type' => NotificationType::Approval,
                'link' => $creatorLink,
            ]);
            if ($campaignCreator->creator?->user) {
                $this->mail->deliveryApproved(
                    $campaignCreator->creator->user,
                    $campaignName,
                    $campaignName,
                    $creatorLink,
                    ['campaign_id' => $campaignId, 'creator_id' => $creatorId, 'company_id' => $companyId],
                );
            }
        }

        if ($script === StageApprovalStatus::Revision->value && ! $videoRevision) {
            $this->notifications->notifyCreator($creatorId, [
                'campaign_id' => $campaignId,
                'title' => __('auth.material_revision_title'),
                'message' => ($data['script_feedback'] ?? $data['revision_details'] ?? '')
                    ?: __('auth.material_revision', ['title' => $campaignName]),
                'type' => NotificationType::DeliveryReview,
                'link' => $creatorLink,
            ]);
            if ($campaignCreator->creator?->user) {
                $this->mail->revisionRequested(
                    $campaignCreator->creator->user,
                    $campaignName,
                    $campaignName,
                    (string) ($data['script_feedback'] ?? $data['revision_details'] ?? ''),
                    $creatorLink,
                    ['campaign_id' => $campaignId, 'creator_id' => $creatorId, 'company_id' => $companyId],
                );
            }
        }

        if ($videoRevision) {
            $this->notifications->notifyCreator($creatorId, [
                'campaign_id' => $campaignId,
                'title' => __('auth.material_revision_title'),
                'message' => ($data['video_feedback'] ?? $data['revision_details'] ?? '')
                    ?: __('auth.material_revision', ['title' => $campaignName]),
                'type' => NotificationType::DeliveryReview,
                'link' => $creatorLink,
            ]);
            if ($campaignCreator->creator?->user) {
                $this->mail->revisionRequested(
                    $campaignCreator->creator->user,
                    $campaignName,
                    $campaignName,
                    (string) ($data['video_feedback'] ?? $data['revision_details'] ?? ''),
                    $creatorLink,
                    ['campaign_id' => $campaignId, 'creator_id' => $creatorId, 'company_id' => $companyId],
                );
            }
        }

        if ($companyId && $script === StageApprovalStatus::Submitted->value) {
            $this->notifications->notifyCompany($companyId, [
                'creator_id' => $creatorId,
                'campaign_id' => $campaignId,
                'title' => __('auth.script_submitted_title'),
                'message' => __('auth.script_submitted', ['title' => $campaignName, 'project' => $campaignName]),
                'type' => NotificationType::DeliveryReview,
                'link' => $companyLink,
            ]);
            $this->notifications->notifyAdmins(
                __('auth.script_submitted_title'),
                __('auth.script_submitted', ['title' => $campaignName, 'project' => $campaignName]),
                NotificationType::DeliveryReview,
                $companyLink,
                ['creator_id' => $creatorId, 'campaign_id' => $campaignId],
            );
            if ($campaignCreator->creator) {
                $this->mail->deliverySubmitted(
                    $companyId,
                    $campaignCreator->creator,
                    $campaignName,
                    $companyLink,
                    ['campaign_id' => $campaignId, 'company_id' => $companyId, 'creator_id' => $creatorId],
                    $campaignCreator->campaign,
                );
            }
        }

        if ($companyId && ($video === StageApprovalStatus::Submitted->value || $delivery === DeliveryStatus::Sent->value)) {
            $this->notifications->notifyCompany($companyId, [
                'creator_id' => $creatorId,
                'campaign_id' => $campaignId,
                'title' => __('auth.video_submitted_title'),
                'message' => __('auth.video_submitted', ['title' => $campaignName, 'project' => $campaignName]),
                'type' => NotificationType::DeliveryReview,
                'link' => $companyLink,
            ]);
            $this->notifications->notifyAdmins(
                __('auth.video_submitted_title'),
                __('auth.video_submitted', ['title' => $campaignName, 'project' => $campaignName]),
                NotificationType::DeliveryReview,
                $companyLink,
                ['creator_id' => $creatorId, 'campaign_id' => $campaignId],
            );
            if ($campaignCreator->creator) {
                $this->mail->deliverySubmitted(
                    $companyId,
                    $campaignCreator->creator,
                    $campaignName,
                    $companyLink,
                    ['campaign_id' => $campaignId, 'company_id' => $companyId, 'creator_id' => $creatorId],
                    $campaignCreator->campaign,
                );
            }
        }
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function contentReadyForPayment(CampaignCreator $row, array $data): bool
    {
        $delivery = $data['delivery_status'] ?? $row->delivery_status;
        $deliveryValue = $delivery instanceof DeliveryStatus ? $delivery->value : (string) ($delivery ?? '');
        if (in_array($deliveryValue, [DeliveryStatus::Approved->value, DeliveryStatus::Published->value], true)) {
            return true;
        }

        $row->loadMissing('campaign');
        $flow = $row->campaign?->approval_flow;
        $flowValue = $flow instanceof ApprovalFlowType ? $flow->value : (string) ($flow ?? ApprovalFlowType::ScriptAndVideo->value);

        $script = $data['script_status'] ?? $row->script_status;
        $scriptValue = $script instanceof StageApprovalStatus ? $script->value : (string) ($script ?? '');
        $video = $data['video_status'] ?? $row->video_status;
        $videoValue = $video instanceof StageApprovalStatus ? $video->value : (string) ($video ?? '');

        $scriptApproved = $scriptValue === StageApprovalStatus::Approved->value;
        $videoApproved = $videoValue === StageApprovalStatus::Approved->value;
        $scriptOnly = $flowValue === ApprovalFlowType::ScriptOnly->value;
        $staged = $flowValue !== ApprovalFlowType::VideoOnly->value;

        if ($videoApproved && (! $staged || $scriptApproved || $scriptOnly)) {
            return true;
        }

        return $scriptOnly && $scriptApproved;
    }
}
