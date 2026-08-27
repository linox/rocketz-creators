<?php

namespace App\Http\Resources;

use App\Models\CompanyLandingSignup;
use App\Support\CreatorPrivacy;
use App\Support\MediaUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CreatorResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $canSeePersonal = CreatorPrivacy::canViewPersonalData($request->user(), (int) $this->id);

        return [
            'id' => $this->id,
            'user_id' => $this->when($canSeePersonal, $this->user_id),
            'role' => $this->user?->role?->value,
            'full_name' => $this->when($canSeePersonal, $this->full_name),
            'artistic_name' => $this->artistic_name,
            'photo_url' => $this->photo_url,
            'document' => $this->when($canSeePersonal, $this->document),
            'cpf' => $this->when($canSeePersonal, $this->cpf),
            'whatsapp' => $this->when($canSeePersonal, $this->whatsapp),
            'email' => $this->when($canSeePersonal, $this->user?->email),
            'city' => $this->city,
            'country' => $this->country,
            'state' => $this->state,
            'birth_date' => $this->when($canSeePersonal, $this->birth_date?->toDateString()),
            'pix_key' => $this->when($canSeePersonal, $this->pix_key),
            'bank_details' => $this->when($canSeePersonal, $this->bank_details),
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
            'invited_by_company_id' => $this->invited_by_company_id,
            'invited_by_company' => $this->whenLoaded('invitedByCompany', fn () => $this->invitedByCompany ? [
                'id' => $this->invitedByCompany->id,
                'name' => $this->invitedByCompany->name,
            ] : null),
            'landing_review' => $this->when(
                $request->user()?->role?->value === 'company' && $request->route('creator'),
                fn () => $this->landingReviewForViewer($request),
            ),
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
            'contract_acceptance' => $this->when($canSeePersonal && $this->relationLoaded('contractAcceptances'), function () {
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
        $path = MediaUrl::objectKeyFromPublicUrl($url);

        return $path ? MediaUrl::download($path) : (string) $url;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function landingReviewForViewer(Request $request): ?array
    {
        $companyId = $request->user()?->companyUser?->company_id;
        if (! $companyId) {
            return null;
        }

        $signup = CompanyLandingSignup::query()
            ->where('company_id', $companyId)
            ->where('creator_id', $this->id)
            ->first();

        if (! $signup) {
            return null;
        }

        return [
            'id' => $signup->id,
            'status' => $signup->status?->value,
            'source' => 'company_landing_page',
            'reviewed_at' => $signup->reviewed_at?->toIso8601String(),
            'created_at' => $signup->created_at?->toIso8601String(),
        ];
    }
}
