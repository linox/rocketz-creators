<?php

namespace App\Http\Resources;

use App\Models\Creator;
use App\Support\MediaUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CreatorGroupResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'company_id' => (int) $this->company_id,
            'company' => $this->whenLoaded('company', fn () => $this->company ? [
                'id' => $this->company->id,
                'name' => $this->company->name,
            ] : null),
            'name' => $this->name,
            'description' => $this->description,
            'members_count' => (int) ($this->creators_count ?? ($this->relationLoaded('creators') ? $this->creators->count() : 0)),
            'creators' => $this->whenLoaded('creators', fn () => $this->creators->map(fn (Creator $creator) => [
                'id' => $creator->id,
                'artistic_name' => $creator->artistic_name,
                'photo_url' => MediaUrl::publicAbsolute($creator->photo_url),
                'metrics' => $creator->metrics ?? [],
                'status' => $creator->status?->value,
                'city' => $creator->city,
            ])->values()),
        ];
    }
}
