<?php

namespace App\Http\Resources;

use App\Models\Creator;
use App\Services\CreatorStorefrontService;
use App\Support\CreatorStorefrontSeo;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CreatorStorefrontResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Creator $creator */
        $creator = $this->resource;
        $includePrivate = (bool) ($this->additional['include_private'] ?? false);
        $eligibility = $this->additional['eligibility'] ?? app(CreatorStorefrontService::class)->eligibility($creator);
        $partners = $this->additional['partners'] ?? collect();
        $items = $creator->relationLoaded('storefrontItems') ? $creator->storefrontItems : collect();
        if (! $includePrivate) {
            $items = $items->where('is_published', true)->values();
        }

        return [
            'creator' => [
                'id' => $creator->id,
                'artistic_name' => $creator->artistic_name,
                'photo_url' => $creator->photo_url,
                'bio' => $creator->bio,
                'city' => $creator->city,
                'state' => $creator->state,
                'country' => $creator->country,
                'socials' => $creator->socials ?? [],
            ],
            'show_banner' => (bool) $creator->storefront_show_banner,
            'banner_url' => $creator->storefront_show_banner ? $creator->storefront_banner_url : null,
            'slug' => $creator->storefront_slug,
            'seo' => CreatorStorefrontSeo::for($creator),
            'eligibility' => $eligibility,
            'partners' => $this->when($includePrivate, $partners->map(fn ($company) => [
                'id' => $company->id,
                'name' => $company->name,
                'logo_url' => $company->logo_url,
            ])->values()->all()),
            'categories' => $creator->relationLoaded('storefrontCategories')
                ? $creator->storefrontCategories->map(fn ($category) => [
                    'id' => $category->id,
                    'name' => $category->name,
                    'sort_order' => (int) $category->sort_order,
                ])->values()->all()
                : [],
            'items' => CreatorStorefrontItemResource::collection($items)->resolve($request),
        ];
    }
}
