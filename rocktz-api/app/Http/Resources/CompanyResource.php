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
        $private = $this->viewerCanSeePrivate($request);

        return [
            'id' => $this->id,
            'name' => $this->name,
            'cnpj' => $this->when($private, $this->cnpj),
            'segment' => $this->segment,
            'responsible_name' => $this->when($private, $this->responsible_name),
            'whatsapp' => $this->when($private, $this->whatsapp),
            'email' => $this->when($private, $this->email),
            'city' => $this->city,
            'country' => $this->country,
            'currency' => $this->currency,
            'observations' => $this->when($private, $this->observations),
            'logo_url' => $this->logo_url,
            'objective' => $this->objective,
            'status' => $this->status?->value,
            'creator_invite_code' => $this->when($private, $this->creator_invite_code),
            'contacts' => $this->when($private && $this->relationLoaded('contacts'), fn () => $this->contacts->map(fn ($contact) => [
                'id' => $contact->id,
                'name' => $contact->name,
                'role' => $contact->role,
                'email' => $contact->email,
                'whatsapp' => $contact->whatsapp,
            ])),
            'favorite_creator_ids' => $this->when($private && $this->relationLoaded('favoriteCreators'), fn () => $this->favoriteCreators->pluck('id')->all()),
            'users' => $this->when($private && $this->relationLoaded('companyUsers'), fn () => $this->companyUsers->map(fn ($companyUser) => [
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

    private function viewerCanSeePrivate(Request $request): bool
    {
        $user = $request->user();
        if (! $user) {
            return false;
        }

        return $user->role?->value === 'admin'
            || $user->belongsToCompany((int) $this->id);
    }
}
