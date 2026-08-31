<?php

namespace App\Http\Resources;

use App\Enums\ConsentType;
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
            'two_factor_enabled' => (bool) $this->two_factor_enabled,
            'has_password' => filled($this->password),
            'lgpd_accepted' => $this->consents()->where('type', ConsentType::LgpdSignup)->exists(),
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
                    'categories' => $this->creator->categories ?? [],
                    'socials' => $this->creator->socials ?? [],
                    'contract_acceptance' => $latestContract ? [
                        'id' => $latestContract->id,
                        'status' => $latestContract->status?->value,
                        'accepted_at' => $latestContract->accepted_at?->toIso8601String(),
                        'full_name' => $latestContract->full_name,
                    ] : null,
                ];
            }),
            'company' => $this->whenLoaded('company', fn () => $this->companyPayload($this->company)),
            'companies' => $this->whenLoaded('companyUsers', function () {
                return $this->companyUsers
                    ->map(function ($row) {
                        $payload = $this->companyPayload($row->company);
                        if (! $payload) {
                            return null;
                        }
                        $payload['company_user_id'] = $row->id;

                        return $payload;
                    })
                    ->filter()
                    ->values()
                    ->all();
            }),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function companyPayload(mixed $company): ?array
    {
        if (! $company) {
            return null;
        }

        return [
            'id' => $company->id,
            'name' => $company->name,
            'status' => $company->status?->value,
            'logo_url' => $company->logo_url,
            'whatsapp' => $company->whatsapp,
            'city' => $company->city,
            'country' => $company->country,
            'currency' => $company->currency,
            'creator_invite_code' => $company->creator_invite_code,
        ];
    }
}
