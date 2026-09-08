<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'creator_id',
    'name',
    'sort_order',
])]
class CreatorStorefrontCategory extends Model
{
    public function creator(): BelongsTo
    {
        return $this->belongsTo(Creator::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(CreatorStorefrontItem::class, 'category_id');
    }
}
