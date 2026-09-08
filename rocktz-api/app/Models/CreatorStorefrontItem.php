<?php

namespace App\Models;

use App\Enums\StorefrontItemType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'creator_id',
    'company_id',
    'category_id',
    'type',
    'title',
    'description',
    'url',
    'coupon_code',
    'image_url',
    'is_published',
    'likes_count',
    'shares_count',
    'sort_order',
])]
class CreatorStorefrontItem extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => StorefrontItemType::class,
            'is_published' => 'boolean',
            'likes_count' => 'integer',
            'shares_count' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(Creator::class);
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(CreatorStorefrontCategory::class, 'category_id');
    }

    public function likes(): HasMany
    {
        return $this->hasMany(CreatorStorefrontLike::class, 'item_id');
    }
}
