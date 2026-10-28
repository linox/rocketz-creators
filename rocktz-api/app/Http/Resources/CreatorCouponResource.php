<?php

namespace App\Http\Resources;

use App\Support\MediaUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CreatorCouponResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'company_id' => (int) $this->company_id,
            'campaign_id' => (int) $this->campaign_id,
            'creator_id' => (int) $this->creator_id,
            'code' => $this->code,
            'discount_percent' => $this->discount_percent !== null ? (float) $this->discount_percent : null,
            'commission_percent' => $this->commission_percent !== null ? (float) $this->commission_percent : null,
            'is_active' => (bool) $this->is_active,
            'company' => $this->whenLoaded('company', fn () => $this->company ? [
                'id' => $this->company->id,
                'name' => $this->company->name,
            ] : null),
            'campaign' => $this->whenLoaded('campaign', fn () => $this->campaign ? [
                'id' => $this->campaign->id,
                'name' => $this->campaign->name,
            ] : null),
            'creator' => $this->whenLoaded('creator', fn () => $this->creator ? [
                'id' => $this->creator->id,
                'artistic_name' => $this->creator->artistic_name,
                'full_name' => $this->creator->full_name,
                'photo_url' => MediaUrl::publicAbsolute($this->creator->photo_url),
            ] : null),
        ];
    }
}
