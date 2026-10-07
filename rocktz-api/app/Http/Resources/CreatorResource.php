<?php

namespace App\Http\Resources;

use App\Models\CompanyLandingSignup;
use App\Models\CreatorContractAcceptance;
use App\Services\CreatorStorefrontService;
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
            'photo_url' => MediaUrl::publicAbsolute($this->photo_url),
            'document' => $this->when($canSeePersonal, $this->document),
            'cpf' => $this->when($canSeePersonal, $this->cpf),
            'whatsapp' => $this->when($canSeePersonal, $this->whatsapp),
            'email' => $this->when($canSeePersonal, $this->user?->email),
            'city' => $this->city,
            'country' => $this->country,
            'currency' => $this->currencyCode(),
            'state' => $this->state,
            'birth_date' => $this->when($canSeePersonal, $this->birth_date?->toDateString()),
            'shipping_address' => $this->when($canSeePersonal, $this->shipping_address),
            'pix_key' => $this->when($canSeePersonal, $this->pix_key),
            'bank_account' => $this->when($canSeePersonal, $this->bank_account),
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
            'storefront_enabled' => $this->when($request->user()?->role?->value === 'admin' || $request->user()?->creator?->id === (int) $this->id, (bool) $this->storefront_enabled),
            'storefront' => $this->when(
                (bool) $request->route('creator'),
                function () {
                    try {
                        return app(CreatorStorefrontService::class)->eligibility($this->resource);
                    } catch (\Throwable) {
                        return null;
                    }
                },
            ),
            'invited_by_company_id' => $this->invited_by_company_id,
            'can_moderate' => $this->canBeModeratedBy($request->user()),
            'invited_by_company' => $this->whenLoaded('invitedByCompany', fn () => $this->invitedByCompany ? [
                'id' => $this->invitedByCompany->id,
                'name' => $this->invitedByCompany->name,
            ] : null),
            'landing_origins' => $this->whenLoaded('landingSignups', fn () => $this->landingSignups
                ->map(fn (CompanyLandingSignup $signup) => [
                    'id' => $signup->id,
                    'landing' => $signup->relationLoaded('landingPage') && $signup->landingPage ? [
                        'id' => $signup->landingPage->id,
                        'display_name' => $signup->landingPage->display_name,
                        'slug' => $signup->landingPage->slug,
                    ] : null,
                    'company' => $signup->relationLoaded('company') && $signup->company ? [
                        'id' => $signup->company->id,
                        'name' => $signup->company->name,
                    ] : null,
                ])
                ->values()),
            'landing_review' => $this->when(
                $request->user()?->role?->value === 'company' && $request->route('creator'),
                fn () => $this->landingReviewsForViewer($request)[0] ?? null,
            ),
            'landing_reviews' => $this->when(
                $request->user()?->role?->value === 'company' && $request->route('creator'),
                fn () => $this->landingReviewsForViewer($request),
            ),
            'portfolio' => $this->whenLoaded('portfolioVideos', fn () => $this->portfolioVideos->map(fn ($video) => [
                'id' => $video->id,
                'title' => $video->title,
                'url' => MediaUrl::publicAbsolute($video->url),
                'download_url' => $this->portfolioDownloadUrl($video->url),
                'description' => $video->description,
                'orientation' => $video->orientation,
                'file_size' => (int) $video->file_size,
                'uploaded_at' => $video->uploaded_at?->toIso8601String(),
            ])),
            'contract_acceptance' => $this->when($canSeePersonal && $this->hasLoadedContractAcceptance(), function () {
                $latest = $this->resolvedContractAcceptance();

                return $latest ? [
                    'id' => $latest->id,
                    'term_id' => $latest->term_id,
                    'version' => $latest->version,
                    'status' => $latest->status?->value,
                    'accepted_at' => $latest->accepted_at?->toIso8601String(),
                    'full_name' => $latest->full_name,
                    'document' => $latest->document,
                    'email' => $latest->email,
                    'ip' => $latest->ip,
                    'user_agent' => $latest->user_agent,
                    'declarations' => $latest->declarations,
                    'all_accepted' => (bool) $latest->all_accepted,
                ] : null;
            }),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    private function hasLoadedContractAcceptance(): bool
    {
        return $this->relationLoaded('latestContractAcceptance') || $this->relationLoaded('contractAcceptances');
    }

    private function resolvedContractAcceptance(): ?CreatorContractAcceptance
    {
        if ($this->relationLoaded('latestContractAcceptance') && $this->latestContractAcceptance) {
            return $this->latestContractAcceptance;
        }

        if ($this->relationLoaded('contractAcceptances')) {
            return $this->contractAcceptances->first();
        }

        return null;
    }

    private function portfolioDownloadUrl(?string $url): string
    {
        $path = MediaUrl::objectKeyFromPublicUrl($url);

        return $path ? MediaUrl::download($path) : (string) $url;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function landingReviewsForViewer(Request $request): array
    {
        $companyId = $request->user()?->actingCompanyId();
        if (! $companyId) {
            return [];
        }

        return CompanyLandingSignup::query()
            ->with('landingPage')
            ->where('company_id', $companyId)
            ->where('creator_id', $this->id)
            ->orderByRaw("case when status in ('pending', 'reviewing') then 0 else 1 end")
            ->latest()
            ->get()
            ->map(function (CompanyLandingSignup $signup) {
                return [
                    'id' => $signup->id,
                    'status' => $signup->status?->value,
                    'source' => 'company_landing_page',
                    'reviewed_at' => $signup->reviewed_at?->toIso8601String(),
                    'created_at' => $signup->created_at?->toIso8601String(),
                    'landing' => $signup->landingPage ? [
                        'id' => $signup->landingPage->id,
                        'display_name' => $signup->landingPage->display_name,
                        'slug' => $signup->landingPage->slug,
                    ] : null,
                ];
            })
            ->all();
    }
}
