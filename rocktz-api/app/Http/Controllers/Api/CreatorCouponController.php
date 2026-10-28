<?php

namespace App\Http\Controllers\Api;

use App\Enums\ApplicationStatus;
use App\Enums\NotificationType;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\CreatorCouponResource;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\Company;
use App\Models\CreatorCoupon;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CreatorCouponController extends Controller
{
    public function __construct(private readonly NotificationService $notifications) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = CreatorCoupon::query()
            ->with([
                'company:id,name',
                'campaign:id,name',
                'creator:id,artistic_name,full_name,photo_url',
            ])
            ->latest('id');

        if ($user->role === UserRole::Creator) {
            $creatorId = (int) ($user->creator?->id ?? 0);
            abort_unless($creatorId, 403, __('auth.forbidden'));
            $query->where('creator_id', $creatorId);
        } elseif ($user->role === UserRole::Company) {
            $companyId = (int) $user->actingCompanyId();
            abort_unless($companyId, 403, __('auth.company_not_linked'));
            $query->where('company_id', $companyId);
        } elseif ($request->filled('company_id')) {
            $query->where('company_id', $request->integer('company_id'));
        }

        if ($request->filled('campaign_id')) {
            $query->where('campaign_id', $request->integer('campaign_id'));
        }

        return response()->json([
            'data' => CreatorCouponResource::collection($query->get()),
        ]);
    }

    public function options(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);
        Company::assertApproved($companyId);

        $campaigns = Campaign::query()
            ->where('company_id', $companyId)
            ->where('is_benefit_coupon', true)
            ->orderBy('name')
            ->get([
                'id',
                'name',
                'benefit_coupon_code',
                'benefit_discount_percent',
                'benefit_commission_percent',
            ]);

        $participants = CampaignCreator::query()
            ->whereIn('campaign_id', $campaigns->pluck('id'))
            ->where('application_status', ApplicationStatus::Approved)
            ->with('creator:id,artistic_name,full_name')
            ->get();

        $assigned = CreatorCoupon::query()
            ->where('company_id', $companyId)
            ->get(['id', 'campaign_id', 'creator_id'])
            ->keyBy(fn (CreatorCoupon $coupon) => $coupon->campaign_id.':'.$coupon->creator_id);

        return response()->json([
            'data' => [
                'campaigns' => $campaigns->map(function (Campaign $campaign) use ($participants, $assigned) {
                    $creators = $participants
                        ->where('campaign_id', $campaign->id)
                        ->filter(fn (CampaignCreator $row) => $row->creator !== null)
                        ->sortBy(fn (CampaignCreator $row) => mb_strtolower((string) ($row->creator->artistic_name ?: $row->creator->full_name)))
                        ->map(function (CampaignCreator $row) use ($assigned) {
                            $coupon = $assigned->get($row->campaign_id.':'.$row->creator_id);

                            return [
                                'id' => $row->creator->id,
                                'artistic_name' => $row->creator->artistic_name,
                                'full_name' => $row->creator->full_name,
                                'coupon_id' => $coupon?->id,
                            ];
                        })
                        ->values();

                    return [
                        'id' => $campaign->id,
                        'name' => $campaign->name,
                        'benefit_coupon_code' => $campaign->benefit_coupon_code,
                        'benefit_discount_percent' => $campaign->benefit_discount_percent !== null ? (float) $campaign->benefit_discount_percent : null,
                        'benefit_commission_percent' => $campaign->benefit_commission_percent !== null ? (float) $campaign->benefit_commission_percent : null,
                        'creators' => $creators,
                    ];
                })->values(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);
        Company::assertApproved($companyId);

        $coupon = CreatorCoupon::query()->create([
            ...$this->attributes($request, $companyId),
            'company_id' => $companyId,
            'created_by' => $request->user()->id,
            'is_active' => $request->exists('is_active') ? $request->boolean('is_active') : true,
        ]);

        $coupon = $this->present($coupon);
        $this->notifyCreator($coupon);

        return response()->json([
            'message' => __('auth.creator_coupon_created'),
            'data' => new CreatorCouponResource($coupon),
        ], 201);
    }

    public function update(Request $request, CreatorCoupon $creatorCoupon): JsonResponse
    {
        $this->assertCanManage($request, $creatorCoupon);

        $data = [];
        if ($request->exists('is_active')) {
            $data['is_active'] = $request->boolean('is_active');
        }
        if ($request->exists('campaign_id') || $request->exists('creator_id') || $request->exists('code') || $request->exists('discount_percent') || $request->exists('commission_percent')) {
            $data = [
                ...$data,
                ...$this->attributes($request, (int) $creatorCoupon->company_id, $creatorCoupon),
            ];
        }

        if ($data !== []) {
            $creatorCoupon->update($data);
        }

        return response()->json([
            'message' => __('auth.creator_coupon_updated'),
            'data' => new CreatorCouponResource($this->present($creatorCoupon)),
        ]);
    }

    public function destroy(Request $request, CreatorCoupon $creatorCoupon): JsonResponse
    {
        $this->assertCanManage($request, $creatorCoupon);
        $creatorCoupon->delete();

        return response()->json([
            'message' => __('auth.creator_coupon_deleted'),
        ]);
    }

    private function companyId(Request $request): int
    {
        $user = $request->user();
        if ($user->role === UserRole::Company) {
            $id = (int) $user->actingCompanyId();
            abort_unless($id, 403, __('auth.company_not_linked'));

            return $id;
        }

        $id = $request->integer('company_id');
        abort_unless($id > 0, 422, __('auth.company_not_linked'));

        return $id;
    }

    private function assertCanManage(Request $request, CreatorCoupon $coupon): void
    {
        $user = $request->user();
        if ($user->role === UserRole::Admin) {
            return;
        }

        abort_unless(
            $user->role === UserRole::Company && $user->belongsToCompany((int) $coupon->company_id),
            403,
            __('auth.forbidden'),
        );
    }

    /**
     * @return array{campaign_id: int, creator_id: int, code: string, discount_percent: string, commission_percent: string}
     */
    private function attributes(Request $request, int $companyId, ?CreatorCoupon $current = null): array
    {
        $request->validate([
            'campaign_id' => [$current ? 'sometimes' : 'required', 'integer'],
            'creator_id' => [$current ? 'sometimes' : 'required', 'integer'],
            'code' => [$current ? 'sometimes' : 'required', 'string', 'max:40'],
            'discount_percent' => ['nullable', 'numeric'],
            'commission_percent' => ['nullable', 'numeric'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $campaignId = $request->exists('campaign_id') ? (int) $request->input('campaign_id') : (int) $current?->campaign_id;
        $creatorId = $request->exists('creator_id') ? (int) $request->input('creator_id') : (int) $current?->creator_id;
        $campaign = $this->campaignFor($companyId, $campaignId);
        $this->assertCreatorEligible($campaign, $creatorId);
        $this->assertUniquePair($campaign->id, $creatorId, $current?->id);

        $rawCode = $request->exists('code') ? $request->input('code') : $current?->code;
        $code = $this->normalizeCode($rawCode);
        $this->assertUniqueCode($companyId, $code, $current?->id);

        return [
            'campaign_id' => $campaign->id,
            'creator_id' => $creatorId,
            'code' => $code,
            'discount_percent' => $this->percent(
                $request->exists('discount_percent') ? $request->input('discount_percent') : $current?->discount_percent,
                $campaign->benefit_discount_percent,
                'discount_percent',
            ),
            'commission_percent' => $this->percent(
                $request->exists('commission_percent') ? $request->input('commission_percent') : $current?->commission_percent,
                $campaign->benefit_commission_percent,
                'commission_percent',
            ),
        ];
    }

    private function campaignFor(int $companyId, int $campaignId): Campaign
    {
        $campaign = Campaign::query()
            ->whereKey($campaignId)
            ->where('company_id', $companyId)
            ->first();

        if (! $campaign || ! $campaign->is_benefit_coupon) {
            throw ValidationException::withMessages([
                'campaign_id' => __('auth.creator_coupon_campaign'),
            ]);
        }

        return $campaign;
    }

    private function assertCreatorEligible(Campaign $campaign, int $creatorId): void
    {
        $eligible = CampaignCreator::query()
            ->where('campaign_id', $campaign->id)
            ->where('creator_id', $creatorId)
            ->where('application_status', ApplicationStatus::Approved)
            ->exists();

        if (! $eligible) {
            throw ValidationException::withMessages([
                'creator_id' => __('auth.creator_coupon_creator'),
            ]);
        }
    }

    private function assertUniquePair(int $campaignId, int $creatorId, ?int $ignoreId): void
    {
        $taken = CreatorCoupon::query()
            ->where('campaign_id', $campaignId)
            ->where('creator_id', $creatorId)
            ->when($ignoreId, fn ($query) => $query->whereKeyNot($ignoreId))
            ->exists();

        if ($taken) {
            throw ValidationException::withMessages([
                'creator_id' => __('auth.creator_coupon_duplicate'),
            ]);
        }
    }

    private function assertUniqueCode(int $companyId, string $code, ?int $ignoreId): void
    {
        $taken = CreatorCoupon::query()
            ->where('company_id', $companyId)
            ->where('code', $code)
            ->when($ignoreId, fn ($query) => $query->whereKeyNot($ignoreId))
            ->exists();

        if ($taken) {
            throw ValidationException::withMessages([
                'code' => __('auth.creator_coupon_code_taken'),
            ]);
        }
    }

    private function normalizeCode(mixed $raw): string
    {
        $code = strtoupper((string) preg_replace('/\s+/', '', trim((string) $raw)));
        if (! preg_match('/^[A-Z0-9][A-Z0-9-]{1,39}$/', $code)) {
            throw ValidationException::withMessages([
                'code' => __('auth.creator_coupon_code'),
            ]);
        }

        return $code;
    }

    private function percent(mixed $value, mixed $fallback, string $field): string
    {
        if ($value === null || $value === '') {
            $value = $fallback;
        }

        if (! is_numeric($value)) {
            throw ValidationException::withMessages([
                $field => __('auth.benefit_coupon_percent_invalid'),
            ]);
        }

        $number = round((float) $value, 2);
        if ($number <= 0 || $number > 100) {
            throw ValidationException::withMessages([
                $field => __('auth.benefit_coupon_percent_invalid'),
            ]);
        }

        return number_format($number, 2, '.', '');
    }

    private function present(CreatorCoupon $coupon): CreatorCoupon
    {
        return $coupon->load([
            'company:id,name',
            'campaign:id,name',
            'creator:id,artistic_name,full_name,photo_url',
        ]);
    }

    private function notifyCreator(CreatorCoupon $coupon): void
    {
        if (! $coupon->is_active) {
            return;
        }

        $this->notifications->notifyCreator((int) $coupon->creator_id, [
            'campaign_id' => $coupon->campaign_id,
            'title' => __('auth.creator_coupon_assigned_title'),
            'message' => __('auth.creator_coupon_assigned', [
                'campaign' => $coupon->campaign?->name ?? '',
                'code' => $coupon->code,
            ]),
            'type' => NotificationType::General,
            'link' => '/coupons',
        ]);
    }
}
