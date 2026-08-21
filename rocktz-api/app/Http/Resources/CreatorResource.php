<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

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
            'country' => $this->country,
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
            'can_access_all_countries' => (bool) $this->can_access_all_countries,
            'portfolio' => $this->whenLoaded('portfolioVideos', fn () => $this->portfolioVideos->map(fn ($video) => [
                'id' => $video->id,
                'title' => $video->title,
                'url' => $video->url,
                'download_url' => $this->portfolioDownloadUrl($video->url),
                'description' => $video->description,
                'orientation' => $video->orientation,
                'file_size' => (int) $video->file_size,
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

    private function portfolioDownloadUrl(?string $url): string
    {
        $path = parse_url((string) $url, PHP_URL_PATH) ?: '';
        if (! is_string($path) || ! str_contains($path, '/uploads/')) {
            return (string) $url;
        }

        $relative = ltrim(Str::after($path, '/uploads/'), '/');

        return rtrim((string) config('app.url'), '/').'/downloads/'.$relative;
    }
}
