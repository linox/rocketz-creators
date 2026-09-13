<?php

namespace App\Http\Resources;

use App\Models\CreatorStorefrontItem;
use App\Models\CreatorStorefrontLike;
use App\Support\MediaUrl;
use App\Support\StorefrontActor;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CreatorStorefrontItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var CreatorStorefrontItem $item */
        $item = $this->resource;
        $likedIds = $request->attributes->get('storefront_liked_ids', []);
        $company = $item->relationLoaded('company') ? $item->company : null;
        $category = $item->relationLoaded('category') ? $item->category : null;
        $customName = filled($item->custom_company_name) ? (string) $item->custom_company_name : null;

        return [
            'id' => $item->id,
            'creator_id' => $item->creator_id,
            'company_id' => $item->company_id,
            'custom_company_name' => $customName,
            'company' => $company ? [
                'id' => $company->id,
                'name' => $company->name,
                'logo_url' => MediaUrl::publicAbsolute($company->logo_url),
            ] : ($customName ? [
                'id' => null,
                'name' => $customName,
                'logo_url' => null,
            ] : null),
            'category_id' => $item->category_id,
            'category' => $category ? [
                'id' => $category->id,
                'name' => $category->name,
            ] : null,
            'type' => $item->type?->value,
            'title' => $item->title,
            'description' => $item->description,
            'url' => $item->url,
            'coupon_code' => $item->coupon_code,
            'image_url' => MediaUrl::publicAbsolute($item->image_url),
            'is_published' => (bool) $item->is_published,
            'likes_count' => (int) $item->likes_count,
            'shares_count' => (int) $item->shares_count,
            'clicks_count' => (int) ($item->clicks_count ?? 0),
            'liked' => in_array((int) $item->id, $likedIds, true),
            'sort_order' => (int) $item->sort_order,
            'created_at' => $item->created_at?->toIso8601String(),
        ];
    }

    public static function likedIdsFor(Request $request, iterable $items): array
    {
        $ids = collect($items)->pluck('id')->filter()->map(fn ($id) => (int) $id)->all();
        if ($ids === []) {
            return [];
        }

        return CreatorStorefrontLike::query()
            ->whereIn('item_id', $ids)
            ->where('actor_key', StorefrontActor::key($request))
            ->pluck('item_id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }
}
