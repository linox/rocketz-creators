<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CompanyLandingSignupResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'company_id' => $this->company_id,
            'company_landing_page_id' => $this->company_landing_page_id,
            'creator_id' => $this->creator_id,
            'source' => 'company_landing_page',
            'status' => $this->status?->value,
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'reviewed_by' => $this->whenLoaded('reviewedBy', fn () => $this->reviewedBy ? [
                'id' => $this->reviewedBy->id,
                'name' => $this->reviewedBy->name,
            ] : null),
            'creator' => $this->whenLoaded('creator', fn () => new CreatorResource($this->creator)),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
