<?php

namespace App\Http\Resources;

use App\Enums\UserRole;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CampaignResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $isCreator = $request->user()?->role === UserRole::Creator;

        return [
            'id' => $this->id,
            'company_id' => $this->company_id,
            'company' => $this->whenLoaded('company', fn () => [
                'id' => $this->company->id,
                'name' => $this->company->name,
                'logo_url' => $this->company->logo_url,
                'status' => $this->company->status?->value,
                'segment' => $this->company->segment,
                'country' => $this->company->country,
                'currency' => $this->company->currency,
            ]),
            'name' => $this->name,
            'objective' => $this->objective,
            'start_date' => $this->start_date?->toDateString(),
            'end_date' => $this->end_date?->toDateString(),
            'total_budget' => $isCreator ? null : ($this->total_budget !== null ? (float) $this->total_budget : null),
            'agency_fee' => $isCreator ? null : ($this->agency_fee !== null ? (float) $this->agency_fee : null),
            'agency_fee_percent' => $isCreator ? null : ($this->agency_fee_percent !== null ? (float) $this->agency_fee_percent : null),
            'creators_budget' => $isCreator ? null : ($this->creators_budget !== null ? (float) $this->creators_budget : null),
            'creator_cache' => $this->creator_cache !== null ? (float) $this->creator_cache : null,
            'currency' => $this->currency ?: $this->company?->currency,
            'status' => $this->status?->value,
            'image_url' => $this->image_url,
            'is_secret' => (bool) $this->is_secret,
            'is_direct_contract' => (bool) $this->is_direct_contract,
            'is_barter' => (bool) $this->is_barter,
            'limit_by_city' => (bool) $this->limit_by_city,
            'state' => $this->state,
            'city' => $this->city,
            'barter_details' => $this->barter_details,
            'approval_flow' => $this->approval_flow?->value,
            'posting_profile' => $this->posting_profile?->value ?? 'creator',
            'briefing' => $this->whenLoaded('briefing', fn () => $this->briefing ? [
                'product' => $this->briefing->product,
                'key_message' => $this->briefing->key_message,
                'must_have' => $this->briefing->must_have,
                'donts' => $this->briefing->donts,
                'cta' => $this->briefing->cta,
                'hashtags' => $this->briefing->hashtags,
                'link' => $this->briefing->link,
                'coupon' => $this->briefing->coupon,
                'attachments' => $this->briefing->attachments ?? [],
            ] : null),
            'deliverables' => $this->whenLoaded('deliverable', fn () => $this->deliverable ? [
                'summary' => $this->deliverable->summary,
                'reels' => $this->deliverable->reels,
                'stories' => $this->deliverable->stories,
                'tiktok' => $this->deliverable->tiktok,
                'ugc' => $this->deliverable->ugc,
                'posts' => $this->deliverable->posts,
                'youtube' => $this->deliverable->youtube,
                'deadline_days' => $this->deliverable->deadline_days,
                'guidelines' => $this->deliverable->guidelines,
            ] : null),
            'applications' => $this->whenLoaded('campaignCreators', function () use ($request, $isCreator) {
                $rows = $this->campaignCreators;
                if ($isCreator) {
                    $ownId = $request->user()?->creator?->id;
                    $rows = $rows->where('creator_id', $ownId);
                }

                return CampaignCreatorResource::collection($rows);
            }),
            'pending_applications' => $this->when(isset($this->pending_applications_count), (int) $this->pending_applications_count),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
