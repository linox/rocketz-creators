<?php

namespace App\Http\Controllers\Api;

use App\Enums\ApplicationStatus;
use App\Enums\ApprovalFlowType;
use App\Enums\CampaignStatus;
use App\Enums\CreatorStatus;
use App\Enums\DeliveryStatus;
use App\Enums\PaymentStatus;
use App\Enums\SignatureStatus;
use App\Enums\NotificationTargetRole;
use App\Enums\NotificationType;
use App\Enums\StageApprovalStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\CampaignCreatorResource;
use App\Http\Resources\CampaignResource;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\CampaignCreatorContent;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CampaignController extends Controller
{
    public function __construct(private readonly NotificationService $notifications) {}

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
        $query = Campaign::query()
            ->with(['company', 'briefing', 'deliverable', 'campaignCreators'])
            ->where('status', '!=', CampaignStatus::Finished);

        if ($user->role !== UserRole::Admin) {
            $query->where('is_secret', false);
        }

        if ($user->role === UserRole::Company) {
            $query->where('company_id', '!=', $user->companyUser?->company_id);
        }

        return response()->json(['data' => CampaignResource::collection($query->latest()->get())]);
    }

    public function show(Request $request, Campaign $campaign): JsonResponse
    {
        $this->assertCanView($request, $campaign);
        $campaign->load(['company', 'briefing', 'deliverable', 'campaignCreators.creator', 'campaignCreators.content']);

        return response()->json(['data' => new CampaignResource($campaign)]);
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

        return response()->json(['data' => new CampaignResource($campaign->load(['company', 'briefing', 'deliverable']))], 201);
    }

    public function update(Request $request, Campaign $campaign): JsonResponse
    {
        $data = $this->validatedCampaign($request, false);
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

        return response()->json(['data' => new CampaignResource($campaign->fresh()->load(['company', 'briefing', 'deliverable', 'campaignCreators.creator']))]);
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
        abort_unless(in_array($creator->status, [CreatorStatus::Active, CreatorStatus::Review], true), 422, __('auth.creator_must_be_approved'));

        $data = $request->validate([
            'notes' => ['nullable', 'string'],
            'amount' => ['nullable', 'numeric'],
            'delivery_type' => ['nullable', 'string', 'max:80'],
        ]);

        $row = CampaignCreator::query()->updateOrCreate(
            ['campaign_id' => $campaign->id, 'creator_id' => $creator->id],
            [
                'notes' => $data['notes'] ?? null,
                'amount' => $data['amount'] ?? 0,
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
            'signature_status' => ['nullable', Rule::enum(SignatureStatus::class)],
            'delivery_date' => ['nullable', 'date'],
            'script' => ['nullable', 'string'],
            'video_url' => ['nullable', 'string', 'max:2048'],
            'image_url' => ['nullable', 'string', 'max:2048'],
            'published_link' => ['nullable', 'string', 'max:2048'],
        ]);

        $contentFields = array_intersect_key($data, array_flip(['script', 'video_url', 'image_url', 'published_link']));
        unset($data['script'], $data['video_url'], $data['image_url'], $data['published_link']);

        if (isset($data['script_status']) && $data['script_status'] === StageApprovalStatus::Submitted) {
            $data['script_submitted_at'] = now();
        }
        if (isset($data['video_status']) && $data['video_status'] === StageApprovalStatus::Submitted) {
            $data['video_submitted_at'] = now();
        }

        $campaignCreator->fill($data)->save();

        if ($contentFields) {
            CampaignCreatorContent::query()->updateOrCreate(
                ['campaign_creator_id' => $campaignCreator->id],
                $contentFields,
            );
        }

        $creatorUserId = $campaignCreator->creator?->user_id;
        $statusValue = isset($data['application_status'])
            ? ($data['application_status'] instanceof ApplicationStatus ? $data['application_status']->value : $data['application_status'])
            : null;
        if ($creatorUserId && in_array($statusValue, [ApplicationStatus::Approved->value, ApplicationStatus::Rejected->value], true)) {
            $approved = $statusValue === ApplicationStatus::Approved->value;
            $this->notifications->send([
                'user_id' => $creatorUserId,
                'creator_id' => $campaignCreator->creator_id,
                'campaign_id' => $campaignCreator->campaign_id,
                'title' => $approved ? __('auth.application_approved_title') : __('auth.application_rejected_title'),
                'message' => $approved
                    ? __('auth.application_approved')
                    : (($data['rejection_reason'] ?? '') ?: __('auth.application_rejected')),
                'type' => $approved ? NotificationType::Approval : NotificationType::Rejection,
                'target_role' => NotificationTargetRole::Creator,
                'link' => '/creators/'.$campaignCreator->creator_id,
            ]);
        }

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

        $row = CampaignCreator::query()->updateOrCreate(
            ['campaign_id' => $campaign->id, 'creator_id' => $data['creator_id']],
            [
                'amount' => $data['amount'] ?? 0,
                'delivery_type' => $data['delivery_type'] ?? 'ugc',
                'application_status' => ApplicationStatus::Approved,
                'delivery_status' => DeliveryStatus::Pending,
            ],
        );

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
            'creators_budget' => ['nullable', 'numeric'],
            'creator_cache' => ['nullable', 'numeric'],
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
        abort_unless($data['company_id'] ?? null, 422, __('auth.company_not_linked'));
        $data['status'] ??= CampaignStatus::Briefing;
        $data['approval_flow'] ??= ApprovalFlowType::ScriptAndVideo;

        return $data;
    }

    private function scoped(Request $request)
    {
        $user = $request->user();
        $query = Campaign::query();

        return match ($user->role) {
            UserRole::Admin => $query,
            UserRole::Company => $query->where('company_id', $user->companyUser?->company_id),
            UserRole::Creator => $query->where(function ($builder) use ($user) {
                $builder->where('is_secret', false)
                    ->orWhereHas('campaignCreators', fn ($q) => $q->where('creator_id', $user->creator?->id));
            }),
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
            if (! $campaign->is_secret || $campaign->campaignCreators()->where('creator_id', $user->creator?->id)->exists()) {
                return;
            }
        }
        abort(403, __('auth.forbidden'));
    }
}
