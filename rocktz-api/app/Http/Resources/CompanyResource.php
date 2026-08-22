<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CompanyResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'cnpj' => $this->cnpj,
            'segment' => $this->segment,
            'responsible_name' => $this->responsible_name,
            'whatsapp' => $this->whatsapp,
            'email' => $this->email,
            'city' => $this->city,
            'country' => $this->country,
            'currency' => $this->currency,
            'observations' => $this->observations,
            'logo_url' => $this->logo_url,
            'objective' => $this->objective,
            'status' => $this->status?->value,
            'creator_invite_code' => $this->when(
                $request->user()?->role?->value === 'admin'
                    || $request->user()?->companyUser?->company_id === $this->id,
                $this->creator_invite_code,
            ),
            'contacts' => $this->whenLoaded('contacts', fn () => $this->contacts->map(fn ($contact) => [
                'id' => $contact->id,
                'name' => $contact->name,
                'role' => $contact->role,
                'email' => $contact->email,
                'whatsapp' => $contact->whatsapp,
            ])),
            'favorite_creator_ids' => $this->whenLoaded('favoriteCreators', fn () => $this->favoriteCreators->pluck('id')->all()),
            'users' => $this->whenLoaded('companyUsers', fn () => $this->companyUsers->map(fn ($companyUser) => [
                'id' => $companyUser->id,
                'user_id' => $companyUser->user_id,
                'email' => $companyUser->user?->email,
                'name' => $companyUser->user?->name,
                'status' => $companyUser->status?->value,
                'can_publish_without_approval' => (bool) $companyUser->can_publish_without_approval,
            ])),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
