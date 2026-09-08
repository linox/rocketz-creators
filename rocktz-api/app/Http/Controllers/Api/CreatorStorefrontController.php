<?php

namespace App\Http\Controllers\Api;

use App\Enums\StorefrontItemType;
use App\Http\Controllers\Controller;
use App\Http\Resources\CreatorStorefrontItemResource;
use App\Http\Resources\CreatorStorefrontResource;
use App\Models\Creator;
use App\Models\CreatorStorefrontCategory;
use App\Models\CreatorStorefrontItem;
use App\Services\CreatorStorefrontService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CreatorStorefrontController extends Controller
{
    public function __construct(private readonly CreatorStorefrontService $storefronts) {}

    public function showPublic(Request $request, string $storefront): JsonResponse
    {
        $creator = $this->storefronts->publishedByKey($storefront);
        $creator->load(['storefrontCategories', 'storefrontItems.company:id,name,logo_url', 'storefrontItems.category']);
        $items = $creator->storefrontItems->where('is_published', true);
        $request->attributes->set('storefront_liked_ids', CreatorStorefrontItemResource::likedIdsFor($request, $items));

        return response()->json([
            'data' => (new CreatorStorefrontResource($creator))->additional([
                'eligibility' => $this->storefronts->eligibility($creator),
            ]),
        ]);
    }

    public function like(Request $request, string $storefront, CreatorStorefrontItem $item): JsonResponse
    {
        $creator = $this->storefronts->publishedByKey($storefront);
        $this->assertItemBelongs($creator, $item);

        return response()->json($this->storefronts->toggleLike($request, $item));
    }

    public function share(Request $request, string $storefront, CreatorStorefrontItem $item): JsonResponse
    {
        $creator = $this->storefronts->publishedByKey($storefront);
        $this->assertItemBelongs($creator, $item);

        return response()->json($this->storefronts->shareItem($item));
    }

    public function settings(): JsonResponse
    {
        return response()->json([
            'data' => [
                'min_completed_campaigns' => $this->storefronts->requiredCampaigns(),
            ],
        ]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'min_completed_campaigns' => ['required', 'integer', 'min:1', 'max:99'],
        ]);

        return response()->json([
            'data' => [
                'min_completed_campaigns' => $this->storefronts->setRequiredCampaigns((int) $data['min_completed_campaigns']),
            ],
            'message' => __('auth.storefront_settings_updated'),
        ]);
    }

    public function show(Request $request, Creator $creator): JsonResponse
    {
        $this->storefronts->assertCanManage($request, $creator);
        $creator->load(['storefrontCategories', 'storefrontItems.company:id,name,logo_url', 'storefrontItems.category']);
        $request->attributes->set('storefront_liked_ids', CreatorStorefrontItemResource::likedIdsFor($request, $creator->storefrontItems));

        return response()->json([
            'data' => (new CreatorStorefrontResource($creator))->additional([
                'include_private' => true,
                'eligibility' => $this->storefronts->eligibility($creator),
                'partners' => $this->storefronts->partnerCompanies($creator),
            ]),
        ]);
    }

    public function update(Request $request, Creator $creator): JsonResponse
    {
        $this->storefronts->assertCanManage($request, $creator);
        $data = $request->validate([
            'storefront_show_banner' => ['sometimes', 'boolean'],
            'storefront_banner_url' => ['nullable', 'string', 'max:2048'],
            'storefront_slug' => ['sometimes', 'string', 'max:64'],
        ]);
        $creator = $this->storefronts->updateSettings($creator, $data);

        return $this->show($request, $creator);
    }

    public function storeCategory(Request $request, Creator $creator): JsonResponse
    {
        $this->storefronts->assertCanManage($request, $creator);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80', Rule::unique('creator_storefront_categories', 'name')->where('creator_id', $creator->id)],
        ]);
        $category = $this->storefronts->createCategory($creator, $data['name']);

        return response()->json(['data' => [
            'id' => $category->id,
            'name' => $category->name,
            'sort_order' => $category->sort_order,
        ]], 201);
    }

    public function updateCategory(Request $request, Creator $creator, CreatorStorefrontCategory $category): JsonResponse
    {
        $this->storefronts->assertCanManage($request, $creator);
        $this->assertCategoryBelongs($creator, $category);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:80'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);
        $category = $this->storefronts->updateCategory($category, $data);

        return response()->json(['data' => [
            'id' => $category->id,
            'name' => $category->name,
            'sort_order' => $category->sort_order,
        ]]);
    }

    public function destroyCategory(Request $request, Creator $creator, CreatorStorefrontCategory $category): JsonResponse
    {
        $this->storefronts->assertCanManage($request, $creator);
        $this->assertCategoryBelongs($creator, $category);
        $this->storefronts->deleteCategory($category);

        return response()->json(['ok' => true]);
    }

    public function storeItem(Request $request, Creator $creator): JsonResponse
    {
        $this->storefronts->assertCanManage($request, $creator);
        $data = $this->itemRules($request, true);
        $item = $this->storefronts->createItem($creator, $data);

        return response()->json(['data' => new CreatorStorefrontItemResource($item)], 201);
    }

    public function updateItem(Request $request, Creator $creator, CreatorStorefrontItem $item): JsonResponse
    {
        $this->storefronts->assertCanManage($request, $creator);
        $this->assertItemBelongs($creator, $item);
        $data = $this->itemRules($request, false);
        $item = $this->storefronts->updateItem($item, $data);

        return response()->json(['data' => new CreatorStorefrontItemResource($item)]);
    }

    public function destroyItem(Request $request, Creator $creator, CreatorStorefrontItem $item): JsonResponse
    {
        $this->storefronts->assertCanManage($request, $creator);
        $this->assertItemBelongs($creator, $item);
        $this->storefronts->deleteItem($item);

        return response()->json(['ok' => true]);
    }

    /**
     * @return array<string, mixed>
     */
    private function itemRules(Request $request, bool $creating): array
    {
        $required = $creating ? 'required' : 'sometimes';

        return $request->validate([
            'company_id' => [$required, 'integer', 'exists:companies,id'],
            'category_id' => ['nullable', 'integer', 'exists:creator_storefront_categories,id'],
            'type' => [$required, Rule::enum(StorefrontItemType::class)],
            'title' => [$required, 'string', 'max:160'],
            'description' => ['nullable', 'string', 'max:1000'],
            'url' => [$required, 'string', 'max:2048'],
            'coupon_code' => ['nullable', 'string', 'max:80'],
            'image_url' => ['nullable', 'string', 'max:2048'],
            'is_published' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);
    }

    private function assertItemBelongs(Creator $creator, CreatorStorefrontItem $item): void
    {
        abort_unless((int) $item->creator_id === (int) $creator->id, 404);
    }

    private function assertCategoryBelongs(Creator $creator, CreatorStorefrontCategory $category): void
    {
        abort_unless((int) $category->creator_id === (int) $creator->id, 404);
    }
}
