<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CreatorResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'role' => $this->user?->role?->value,
            'full_name' => $this->full_name,
            'artistic_name' => $this->artistic_name,
            'photo_url' => $this->photo_url,
            'document' => $this->document,
            'cpf' => $this->cpf,
            'whatsapp' => $this->whatsapp,
            'email' => $this->user?->email,
            'city' => $this->city,
            'state' => $this->state,
            'birth_date' => $this->birth_date?->toDateString(),
            'pix_key' => $this->pix_key,
            'bank_details' => $this->bank_details,
            'socials' => $this->socials ?? [],
            'metrics' => $this->metrics ?? [],
            'categories' => $this->categories ?? [],
            'pricing' => $this->pricing ?? [],
            'accepts_exchange' => (bool) $this->accepts_exchange,
            'accepts_paid_traffic' => (bool) $this->accepts_paid_traffic,
            'accepts_exclusivity' => (bool) $this->accepts_exclusivity,
            'bio' => $this->bio,
            'work_affinities' => $this->work_affinities ?? [],
            'internal_notes' => $this->when($request->user()?->role?->value === 'admin', $this->internal_notes),
            'status' => $this->status?->value,
            'portfolio' => $this->whenLoaded('portfolioVideos', fn () => $this->portfolioVideos->map(fn ($video) => [
                'id' => $video->id,
                'title' => $video->title,
                'url' => $video->url,
                'description' => $video->description,
                'uploaded_at' => $video->uploaded_at?->toIso8601String(),
            ])),
            'contract_acceptance' => $this->whenLoaded('contractAcceptances', function () {
                $latest = $this->contractAcceptances->first();

                return $latest ? [
                    'id' => $latest->id,
                    'status' => $latest->status?->value,
                    'accepted_at' => $latest->accepted_at?->toIso8601String(),
                    'full_name' => $latest->full_name,
                ] : null;
            }),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
