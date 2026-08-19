<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role?->value,
            'creator' => $this->whenLoaded('creator', function () {
                if (! $this->creator) {
                    return null;
                }

                return [
                    'id' => $this->creator->id,
                    'full_name' => $this->creator->full_name,
                    'artistic_name' => $this->creator->artistic_name,
                    'status' => $this->creator->status?->value,
                    'photo_url' => $this->creator->photo_url,
                ];
            }),
            'company' => $this->whenLoaded('company', function () {
                if (! $this->company) {
                    return null;
                }

                return [
                    'id' => $this->company->id,
                    'name' => $this->company->name,
                    'status' => $this->company->status?->value,
                    'logo_url' => $this->company->logo_url,
                ];
            }),
        ];
    }
}
