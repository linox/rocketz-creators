<?php

namespace App\Services;

use App\Enums\ApplicationStatus;
use App\Enums\CampaignStatus;
use App\Enums\DeliveryStatus;
use App\Enums\StorefrontEventType;
use App\Enums\StorefrontItemType;
use App\Enums\UserRole;
use App\Models\Company;
use App\Models\Creator;
use App\Models\CreatorStorefrontCategory;
use App\Models\CreatorStorefrontEvent;
use App\Models\CreatorStorefrontItem;
use App\Models\CreatorStorefrontLike;
use App\Models\StorefrontSetting;
use App\Support\FrontendUrl;
use App\Support\ProhibitedStorefrontLink;
use App\Support\SafeHttpUrl;
use App\Support\StorefrontActor;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class CreatorStorefrontService
{
    public function requiredCampaigns(): int
    {
        return max(1, (int) StorefrontSetting::current()->min_completed_campaigns);
    }

    public function setRequiredCampaigns(int $count): int
    {
        $row = StorefrontSetting::current();
        $row->min_completed_campaigns = max(1, min(99, $count));
        $row->save();

        return $this->requiredCampaigns();
    }

    public function completedCampaignsCount(Creator $creator): int
    {
        return (int) $creator->campaignCreators()
            ->where('application_status', ApplicationStatus::Approved)
            ->where(function ($query) {
                $query->whereIn('delivery_status', [DeliveryStatus::Published, DeliveryStatus::Approved])
                    ->orWhereHas('campaign', fn ($campaign) => $campaign->where('status', CampaignStatus::Finished));
            })
            ->distinct()
            ->count('campaign_id');
    }

    public function isUnlocked(Creator $creator): bool
    {
        if ($creator->storefront_enabled) {
            return true;
        }

        return $this->completedCampaignsCount($creator) >= $this->requiredCampaigns();
    }

    /**
     * @return list<int>
     */
    public function partnerCompanyIds(Creator $creator): array
    {
        $fromCampaigns = $creator->campaignCreators()
            ->where('application_status', ApplicationStatus::Approved)
            ->join('campaigns', 'campaigns.id', '=', 'campaign_creators.campaign_id')
            ->pluck('campaigns.company_id')
            ->all();

        $fromRecurring = $creator->recurringContractCreators()
            ->join('recurring_contracts', 'recurring_contracts.id', '=', 'recurring_contract_creators.recurring_contract_id')
            ->pluck('recurring_contracts.company_id')
            ->all();

        return array_values(array_unique(array_map('intval', array_merge($fromCampaigns, $fromRecurring))));
    }

    /**
     * @return Collection<int, Company>
     */
    public function partnerCompanies(Creator $creator): Collection
    {
        $ids = $this->partnerCompanyIds($creator);
        if ($ids === []) {
            return collect();
        }

        return Company::query()
            ->whereIn('id', $ids)
            ->orderBy('name')
            ->get(['id', 'name', 'logo_url', 'status']);
    }

    public function assertCanManage(Request $request, Creator $creator): void
    {
        $user = $request->user();
        if (! $user) {
            throw new AccessDeniedHttpException(__('auth.forbidden'));
        }

        if ($user->role === UserRole::Admin) {
            return;
        }

        if ($user->role === UserRole::Creator && $user->creator?->id === $creator->id) {
            return;
        }

        throw new AccessDeniedHttpException(__('auth.forbidden'));
    }

    public function assertUnlocked(Creator $creator): void
    {
        if (! $this->isUnlocked($creator)) {
            throw ValidationException::withMessages([
                'storefront' => [__('auth.storefront_locked', ['count' => $this->requiredCampaigns()])],
            ]);
        }
    }

    public function assertPublished(Creator $creator): void
    {
        if (! $this->isUnlocked($creator)) {
            throw new NotFoundHttpException(__('auth.storefront_unavailable'));
        }
    }

    public function findByPublicKey(string $key): ?Creator
    {
        $key = trim($key);
        if ($key === '') {
            return null;
        }

        if (ctype_digit($key)) {
            return Creator::query()->find((int) $key);
        }

        $slug = Creator::normalizeStorefrontSlug($key);
        if ($slug === '') {
            return null;
        }

        return Creator::query()->where('storefront_slug', $slug)->first();
    }

    public function publishedByKey(string $key): Creator
    {
        $creator = $this->findByPublicKey($key);
        if (! $creator) {
            throw new NotFoundHttpException(__('auth.storefront_unavailable'));
        }

        $this->assertPublished($creator);
        $this->ensureStorefrontSlug($creator);

        return $creator;
    }

    public function ensureStorefrontSlug(Creator $creator): string
    {
        if (filled($creator->storefront_slug)) {
            return (string) $creator->storefront_slug;
        }

        $source = (string) ($creator->artistic_name ?: $creator->full_name ?: 'creator');
        $slug = $this->uniqueStorefrontSlug($source, $creator->id);
        $creator->forceFill(['storefront_slug' => $slug])->save();

        return $slug;
    }

    public function uniqueStorefrontSlug(string $source, ?int $ignoreCreatorId = null): string
    {
        $base = Creator::normalizeStorefrontSlug($source);
        if ($base === '' || strlen($base) < 3 || ctype_digit($base) || Creator::isReservedStorefrontSlug($base)) {
            $base = 'creator-'.($ignoreCreatorId ?: 'page');
        }

        $candidate = $base;
        $suffix = 2;
        while (! $this->storefrontSlugIsFree($candidate, $ignoreCreatorId)) {
            $candidate = $base.'-'.$suffix;
            $suffix++;
        }

        return $candidate;
    }

    public function assertStorefrontSlugAvailable(string $slug, ?int $ignoreCreatorId = null): void
    {
        $normalized = Creator::normalizeStorefrontSlug($slug);

        if ($normalized === '' || strlen($normalized) < 3 || ctype_digit($normalized)) {
            throw ValidationException::withMessages([
                'storefront_slug' => [__('auth.storefront_slug_invalid')],
            ]);
        }

        if (Creator::isReservedStorefrontSlug($normalized)) {
            throw ValidationException::withMessages([
                'storefront_slug' => [__('auth.storefront_slug_reserved')],
            ]);
        }

        if (! $this->storefrontSlugIsFree($normalized, $ignoreCreatorId)) {
            throw ValidationException::withMessages([
                'storefront_slug' => [__('auth.storefront_slug_taken')],
            ]);
        }
    }

    public function publicPath(Creator $creator): string
    {
        $slug = $this->ensureStorefrontSlug($creator);

        return 'c/'.$slug.'/';
    }

    /**
     * @return array<string, mixed>
     */
    public function eligibility(Creator $creator): array
    {
        $completed = $this->completedCampaignsCount($creator);
        $required = $this->requiredCampaigns();
        $unlocked = $this->isUnlocked($creator);
        $slug = filled($creator->storefront_slug) ? (string) $creator->storefront_slug : null;
        if ($slug === null) {
            try {
                $slug = $this->ensureStorefrontSlug($creator);
            } catch (\Throwable) {
                $slug = null;
            }
        }

        return [
            'unlocked' => $unlocked,
            'enabled_by_admin' => (bool) $creator->storefront_enabled,
            'completed_campaigns' => $completed,
            'required_campaigns' => $required,
            'remaining_campaigns' => max(0, $required - $completed),
            'slug' => $slug,
            'public_url' => $unlocked ? FrontendUrl::to('c/'.($slug ?: $creator->id).'/') : null,
            'show_banner' => (bool) $creator->storefront_show_banner,
            'banner_url' => $creator->storefront_banner_url,
        ];
    }

    public function updateSettings(Creator $creator, array $data): Creator
    {
        $this->assertUnlocked($creator);
        if (array_key_exists('storefront_slug', $data)) {
            $this->assertStorefrontSlugAvailable((string) $data['storefront_slug'], $creator->id);
            $data['storefront_slug'] = Creator::normalizeStorefrontSlug((string) $data['storefront_slug']);
        }
        $data = SafeHttpUrl::validateFields($data, ['storefront_banner_url']);
        $creator->fill($data)->save();

        return $creator->fresh() ?? $creator;
    }

    private function storefrontSlugIsFree(string $slug, ?int $ignoreCreatorId = null): bool
    {
        if (Creator::isReservedStorefrontSlug($slug) || ctype_digit($slug) || strlen($slug) < 3) {
            return false;
        }

        return ! Creator::query()
            ->where('storefront_slug', $slug)
            ->when($ignoreCreatorId, fn ($query) => $query->where('id', '!=', $ignoreCreatorId))
            ->exists();
    }

    public function createCategory(Creator $creator, string $name): CreatorStorefrontCategory
    {
        $this->assertUnlocked($creator);
        $name = trim($name);
        $next = (int) $creator->storefrontCategories()->max('sort_order') + 1;

        return $creator->storefrontCategories()->create([
            'name' => $name,
            'sort_order' => $next,
        ]);
    }

    public function updateCategory(CreatorStorefrontCategory $category, array $data): CreatorStorefrontCategory
    {
        $this->assertUnlocked($category->creator);
        if (isset($data['name'])) {
            $data['name'] = trim((string) $data['name']);
        }
        $category->fill($data)->save();

        return $category->fresh() ?? $category;
    }

    public function deleteCategory(CreatorStorefrontCategory $category): void
    {
        $this->assertUnlocked($category->creator);
        $category->delete();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function createItem(Creator $creator, array $data): CreatorStorefrontItem
    {
        $this->assertUnlocked($creator);
        $data = $this->normalizeItem($creator, $data);
        $data['creator_id'] = $creator->id;
        $data['sort_order'] = (int) $creator->storefrontItems()->max('sort_order') + 1;
        $data['likes_count'] = 0;
        $data['shares_count'] = 0;
        $data['clicks_count'] = 0;

        return $creator->storefrontItems()->create($data)->load(['company:id,name,logo_url', 'category']);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function updateItem(CreatorStorefrontItem $item, array $data): CreatorStorefrontItem
    {
        $creator = $item->creator;
        $this->assertUnlocked($creator);
        $merged = array_merge($item->only([
            'company_id', 'custom_company_name', 'category_id', 'type', 'title', 'description', 'url', 'coupon_code', 'image_url', 'is_published', 'sort_order',
        ]), $data);
        if (isset($merged['type']) && $merged['type'] instanceof StorefrontItemType) {
            $merged['type'] = $merged['type']->value;
        }
        $normalized = $this->normalizeItem($creator, $merged, $item);
        $item->fill($normalized)->save();

        return $item->fresh(['company:id,name,logo_url', 'category']) ?? $item;
    }

    public function deleteItem(CreatorStorefrontItem $item): void
    {
        $this->assertUnlocked($item->creator);
        $item->delete();
    }

    /**
     * @return array{liked: bool, likes_count: int}
     */
    public function toggleLike(Request $request, CreatorStorefrontItem $item): array
    {
        $this->assertPublished($item->creator);
        abort_unless($item->is_published, 404, __('auth.storefront_unavailable'));

        $actorKey = StorefrontActor::key($request);
        $user = StorefrontActor::user($request);

        return DB::transaction(function () use ($item, $actorKey, $user) {
            $existing = CreatorStorefrontLike::query()
                ->where('item_id', $item->id)
                ->where('actor_key', $actorKey)
                ->lockForUpdate()
                ->first();

            if ($existing) {
                $existing->delete();
                $item->decrement('likes_count');

                return [
                    'liked' => false,
                    'likes_count' => max(0, (int) $item->fresh()?->likes_count),
                ];
            }

            CreatorStorefrontLike::query()->create([
                'item_id' => $item->id,
                'user_id' => $user?->id,
                'actor_key' => $actorKey,
            ]);
            $item->increment('likes_count');

            return [
                'liked' => true,
                'likes_count' => (int) $item->fresh()?->likes_count,
            ];
        });
    }

    /**
     * @return array{shares_count: int}
     */
    public function shareItem(CreatorStorefrontItem $item): array
    {
        $this->assertPublished($item->creator);
        abort_unless($item->is_published, 404, __('auth.storefront_unavailable'));
        $item->increment('shares_count');

        return ['shares_count' => (int) $item->fresh()?->shares_count];
    }

    /**
     * @return array{ok: bool, counted: bool}
     */
    public function trackEvent(Request $request, Creator $creator, StorefrontEventType $type, ?CreatorStorefrontItem $item = null): array
    {
        $this->assertPublished($creator);
        if (! Schema::hasTable('creator_storefront_events')) {
            return ['ok' => true, 'counted' => false];
        }
        $user = StorefrontActor::user($request);
        if ($user?->creator?->id === $creator->id) {
            return ['ok' => true, 'counted' => false];
        }

        if ($type === StorefrontEventType::Click) {
            abort_unless($item && (int) $item->creator_id === (int) $creator->id && $item->is_published, 404, __('auth.storefront_unavailable'));
        } else {
            $item = null;
        }

        $actorKey = StorefrontActor::key($request);
        $windowMinutes = $type === StorefrontEventType::View ? 360 : 2;
        $duplicate = CreatorStorefrontEvent::query()
            ->where('creator_id', $creator->id)
            ->where('type', $type)
            ->where('actor_key', $actorKey)
            ->when($item, fn ($query) => $query->where('item_id', $item->id), fn ($query) => $query->whereNull('item_id'))
            ->where('created_at', '>=', now()->subMinutes($windowMinutes))
            ->exists();

        if ($duplicate) {
            return ['ok' => true, 'counted' => false];
        }

        CreatorStorefrontEvent::query()->create([
            'creator_id' => $creator->id,
            'item_id' => $item?->id,
            'type' => $type,
            'actor_key' => $actorKey,
            'created_at' => now(),
        ]);

        if ($item && $type === StorefrontEventType::Click) {
            $item->increment('clicks_count');
        }

        return ['ok' => true, 'counted' => true];
    }

    /**
     * @return array<string, mixed>
     */
    public function stats(Creator $creator): array
    {
        $items = $creator->relationLoaded('storefrontItems') ? $creator->storefrontItems : $creator->storefrontItems()->get();
        $emptyDays = [];
        for ($i = 13; $i >= 0; $i--) {
            $emptyDays[] = [
                'date' => now()->subDays($i)->toDateString(),
                'views' => 0,
                'clicks' => 0,
            ];
        }

        $empty = [
            'views' => 0,
            'unique_visitors' => 0,
            'clicks' => 0,
            'unique_clickers' => 0,
            'likes' => (int) $items->sum('likes_count'),
            'shares' => (int) $items->sum('shares_count'),
            'ctr' => 0,
            'days' => $emptyDays,
            'items' => $items
                ->sortByDesc(fn (CreatorStorefrontItem $item) => (int) ($item->clicks_count ?? 0))
                ->take(8)
                ->map(fn (CreatorStorefrontItem $item) => [
                    'id' => $item->id,
                    'title' => $item->title,
                    'clicks' => (int) ($item->clicks_count ?? 0),
                    'likes' => (int) $item->likes_count,
                    'shares' => (int) $item->shares_count,
                ])
                ->values()
                ->all(),
        ];

        if (! Schema::hasTable('creator_storefront_events')) {
            return $empty;
        }

        $events = CreatorStorefrontEvent::query()
            ->where('creator_id', $creator->id)
            ->get(['type', 'item_id', 'actor_key', 'created_at']);

        $views = $events->filter(fn (CreatorStorefrontEvent $event) => $event->type === StorefrontEventType::View);
        $clicks = $events->filter(fn (CreatorStorefrontEvent $event) => $event->type === StorefrontEventType::Click);
        $viewCount = $views->count();
        $clickCount = $clicks->count();

        $days = [];
        for ($i = 13; $i >= 0; $i--) {
            $date = now()->subDays($i)->toDateString();
            $dayEvents = $events->filter(fn (CreatorStorefrontEvent $event) => $event->created_at?->toDateString() === $date);
            $days[] = [
                'date' => $date,
                'views' => $dayEvents->filter(fn (CreatorStorefrontEvent $event) => $event->type === StorefrontEventType::View)->count(),
                'clicks' => $dayEvents->filter(fn (CreatorStorefrontEvent $event) => $event->type === StorefrontEventType::Click)->count(),
            ];
        }

        return [
            'views' => $viewCount,
            'unique_visitors' => $views->pluck('actor_key')->unique()->count(),
            'clicks' => $clickCount,
            'unique_clickers' => $clicks->pluck('actor_key')->unique()->count(),
            'likes' => (int) $items->sum('likes_count'),
            'shares' => (int) $items->sum('shares_count'),
            'ctr' => $viewCount > 0 ? round(($clickCount / $viewCount) * 100, 1) : 0,
            'days' => $days,
            'items' => $items
                ->sortByDesc(fn (CreatorStorefrontItem $item) => (int) $item->clicks_count)
                ->take(8)
                ->map(fn (CreatorStorefrontItem $item) => [
                    'id' => $item->id,
                    'title' => $item->title,
                    'clicks' => (int) $item->clicks_count,
                    'likes' => (int) $item->likes_count,
                    'shares' => (int) $item->shares_count,
                ])
                ->values()
                ->all(),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function normalizeItem(Creator $creator, array $data, ?CreatorStorefrontItem $existing = null): array
    {
        $partnerIds = $this->partnerCompanyIds($creator);
        $companyId = isset($data['company_id']) && $data['company_id'] !== null && $data['company_id'] !== ''
            ? (int) $data['company_id']
            : null;
        $customCompany = isset($data['custom_company_name']) ? trim((string) $data['custom_company_name']) : '';

        if ($companyId !== null && $companyId > 0) {
            if (! in_array($companyId, $partnerIds, true)) {
                throw ValidationException::withMessages([
                    'company_id' => [__('auth.storefront_company_not_partner')],
                ]);
            }
            $customCompany = '';
        } else {
            $companyId = null;
            if ($customCompany === '') {
                throw ValidationException::withMessages([
                    'custom_company_name' => [__('auth.storefront_custom_company_required')],
                ]);
            }
        }

        $type = StorefrontItemType::from((string) $data['type']);
        $coupon = isset($data['coupon_code']) ? trim((string) $data['coupon_code']) : null;
        if ($type === StorefrontItemType::Coupon && ($coupon === null || $coupon === '')) {
            throw ValidationException::withMessages([
                'coupon_code' => [__('auth.storefront_coupon_required')],
            ]);
        }
        if ($type === StorefrontItemType::Link) {
            $coupon = null;
        }

        $categoryId = $data['category_id'] ?? null;
        if ($categoryId) {
            $belongs = $creator->storefrontCategories()->where('id', $categoryId)->exists();
            if (! $belongs) {
                throw ValidationException::withMessages([
                    'category_id' => [__('auth.storefront_category_invalid')],
                ]);
            }
        } else {
            $categoryId = null;
        }

        $title = trim((string) $data['title']);
        $description = isset($data['description']) ? (trim((string) $data['description']) ?: null) : null;
        $url = trim((string) $data['url']);
        $companyName = $customCompany !== ''
            ? $customCompany
            : (string) (Company::query()->where('id', $companyId)->value('name') ?? '');

        if (ProhibitedStorefrontLink::blocked($url, $title, $description, $customCompany, $companyName, $coupon)) {
            throw ValidationException::withMessages([
                'url' => [__('auth.storefront_prohibited_link')],
            ]);
        }

        $payload = [
            'company_id' => $companyId,
            'custom_company_name' => $customCompany !== '' ? $customCompany : null,
            'category_id' => $categoryId,
            'type' => $type->value,
            'title' => $title,
            'description' => $description,
            'url' => $url,
            'coupon_code' => $coupon ?: null,
            'image_url' => isset($data['image_url']) ? (trim((string) $data['image_url']) ?: null) : null,
            'is_published' => array_key_exists('is_published', $data)
                ? filter_var($data['is_published'], FILTER_VALIDATE_BOOLEAN)
                : ($existing?->is_published ?? true),
        ];

        if (array_key_exists('sort_order', $data) && $data['sort_order'] !== null) {
            $payload['sort_order'] = (int) $data['sort_order'];
        }

        return SafeHttpUrl::validateFields($payload, ['url', 'image_url']);
    }
}
