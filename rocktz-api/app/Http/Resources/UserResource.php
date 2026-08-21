<?php

namespace App\Http\Resources;

use App\Support\AppLocale;
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
            'locale' => $this->locale ?: AppLocale::DEFAULT,
            'avatar_url' => $this->avatar_url,
            'permissions' => $this->permissionSlugs(),
            'can_publish_without_approval' => $this->canPublishWithoutApproval(),
            'creator' => $this->whenLoaded('creator', function () {
                if (! $this->creator) {
                    return null;
                }

                $latestContract = $this->creator->relationLoaded('contractAcceptances')
                    ? $this->creator->contractAcceptances->first()
                    : $this->creator->contractAcceptances()->latest('id')->first();

                return [
                    'id' => $this->creator->id,
                    'full_name' => $this->creator->full_name,
                    'artistic_name' => $this->creator->artistic_name,
                    'status' => $this->creator->status?->value,
                    'photo_url' => $this->creator->photo_url,
                    'whatsapp' => $this->creator->whatsapp,
                    'city' => $this->creator->city,
                    'country' => $this->creator->country,
                    'state' => $this->creator->state,
                    'document' => $this->creator->document,
                    'can_access_all_countries' => (bool) $this->creator->can_access_all_countries,
                    'socials' => $this->creator->socials ?? [],
                    'contract_acceptance' => $latestContract ? [
                        'id' => $latestContract->id,
                        'status' => $latestContract->status?->value,
                        'accepted_at' => $latestContract->accepted_at?->toIso8601String(),
                        'full_name' => $latestContract->full_name,
                    ] : null,
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
                    'whatsapp' => $this->company->whatsapp,
                    'city' => $this->company->city,
                    'country' => $this->company->country,
                    'currency' => $this->company->currency,
                ];
            }),
        ];
    }
}
