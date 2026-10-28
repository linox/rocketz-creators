<?php

namespace App\Services;

use App\Enums\ApplicationStatus;
use App\Enums\NotificationType;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\Creator;
use App\Models\CreatorCoupon;
use App\Support\SocialHandle;

class CreatorCouponIssuer
{
    public function __construct(private readonly NotificationService $notifications) {}

    public function syncCampaign(Campaign $campaign, bool $reactivate = false): void
    {
        if (! $campaign->is_benefit_coupon) {
            CreatorCoupon::query()
                ->where('campaign_id', $campaign->id)
                ->where('is_auto', true)
                ->update(['is_active' => false]);

            return;
        }

        CampaignCreator::query()
            ->where('campaign_id', $campaign->id)
            ->where('application_status', ApplicationStatus::Approved)
            ->with('creator')
            ->get()
            ->each(function (CampaignCreator $row) use ($campaign, $reactivate) {
                if ($row->creator) {
                    $this->issue($campaign, $row->creator, false, $reactivate);
                }
            });
    }

    public function issue(Campaign $campaign, Creator $creator, bool $notify = true, bool $reactivate = false): ?CreatorCoupon
    {
        if (! $campaign->is_benefit_coupon) {
            return null;
        }

        $existing = CreatorCoupon::query()
            ->where('campaign_id', $campaign->id)
            ->where('creator_id', $creator->id)
            ->first();

        $code = $this->uniqueCode($campaign, $creator, $this->codeFor($creator, $campaign->benefit_coupon_code));
        $amounts = [
            'discount_percent' => $campaign->benefit_discount_percent,
            'commission_percent' => $campaign->benefit_commission_percent,
        ];

        if ($existing) {
            $existing->update([
                ...$amounts,
                'code' => $existing->is_auto ? $code : $existing->code,
                ...($reactivate && $existing->is_auto ? ['is_active' => true] : []),
            ]);

            return $existing->fresh();
        }

        $coupon = CreatorCoupon::query()->create([
            ...$amounts,
            'company_id' => $campaign->company_id,
            'campaign_id' => $campaign->id,
            'creator_id' => $creator->id,
            'code' => $code,
            'is_active' => true,
            'is_auto' => true,
        ]);

        if ($notify) {
            $coupon->loadMissing('campaign:id,name');
            $this->notifications->notifyCreator((int) $creator->id, [
                'campaign_id' => $campaign->id,
                'title' => __('auth.creator_coupon_assigned_title'),
                'message' => __('auth.creator_coupon_assigned', [
                    'campaign' => $coupon->campaign?->name ?? $campaign->name,
                    'code' => $coupon->code,
                ]),
                'type' => NotificationType::General,
                'link' => '/coupons',
            ]);
        }

        return $coupon;
    }

    public function release(int $campaignId, int $creatorId): void
    {
        CreatorCoupon::query()
            ->where('campaign_id', $campaignId)
            ->where('creator_id', $creatorId)
            ->where('is_auto', true)
            ->delete();
    }

    public function codeFor(Creator $creator, ?string $suffix): string
    {
        $extra = strtoupper((string) preg_replace('/[^A-Z0-9-]/', '', strtoupper(trim((string) $suffix))));

        return substr('@'.$this->handle($creator).$extra, 0, 64);
    }

    private function handle(Creator $creator): string
    {
        $socials = is_array($creator->socials) ? $creator->socials : [];
        $instagram = SocialHandle::instagram(isset($socials['instagram']) ? (string) $socials['instagram'] : null);
        if ($instagram !== '') {
            return $instagram;
        }

        $tiktok = SocialHandle::tiktok(isset($socials['tiktok']) ? (string) $socials['tiktok'] : null);
        if ($tiktok !== '') {
            return $tiktok;
        }

        $name = SocialHandle::instagram((string) $creator->artistic_name);
        if ($name !== '') {
            return $name;
        }

        return 'criador'.$creator->id;
    }

    private function uniqueCode(Campaign $campaign, Creator $creator, string $base): string
    {
        $taken = CreatorCoupon::query()
            ->where('company_id', $campaign->company_id)
            ->where('code', $base)
            ->where(function ($query) use ($campaign, $creator) {
                $query->where('campaign_id', '!=', $campaign->id)
                    ->orWhere('creator_id', '!=', $creator->id);
            })
            ->exists();

        if (! $taken) {
            return $base;
        }

        $mark = (string) $campaign->id;

        return substr($base, 0, 64 - strlen($mark)).$mark;
    }
}
