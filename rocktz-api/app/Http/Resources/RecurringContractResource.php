<?php

namespace App\Http\Resources;

use App\Enums\UserRole;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RecurringContractResource extends JsonResource
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
                'country' => $this->company->country,
                'currency' => $this->company->currency,
            ]),
            'title' => $this->title,
            'objective' => $this->objective,
            'start_date' => $this->start_date?->toDateString(),
            'end_date' => $this->end_date?->toDateString(),
            'status' => $this->status?->value,
            'monthly_fee' => $isCreator ? null : ($this->monthly_fee !== null ? (float) $this->monthly_fee : null),
            'currency' => $this->currency ?: $this->company?->currency,
            'notes' => $isCreator ? null : $this->notes,
            'creators' => $this->whenLoaded('recurringContractCreators', fn () => $this->recurringContractCreators->map(fn ($row) => [
                'id' => $row->id,
                'creator_id' => $row->creator_id,
                'start_date' => $row->start_date?->toDateString(),
                'end_date' => $row->end_date?->toDateString(),
                'creator' => $row->creator ? [
                    'id' => $row->creator->id,
                    'artistic_name' => $row->creator->artistic_name,
                    'full_name' => $row->creator->full_name,
                    'photo_url' => $row->creator->photo_url,
                    'city' => $row->creator->city,
                    'country' => $row->creator->country,
                    'state' => $row->creator->state,
                    'categories' => $row->creator->categories ?? [],
                    'socials' => $row->creator->socials ?? [],
                ] : null,
                'monthly_cache' => $row->monthly_cache !== null ? (float) $row->monthly_cache : null,
                'monthly_fee' => $row->monthly_fee !== null ? (float) $row->monthly_fee : null,
                'deliverables_fee' => $row->deliverables_fee !== null ? (float) $row->deliverables_fee : null,
                'monthly_deliverables' => $row->monthly_deliverables ?? [],
                'notes' => $row->notes,
            ])),
            'items' => $this->whenLoaded('contentPlanningItems', fn () => ContentPlanningItemResource::collection($this->contentPlanningItems)),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
