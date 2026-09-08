<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'item_id',
    'user_id',
    'actor_key',
])]
class CreatorStorefrontLike extends Model
{
    public function item(): BelongsTo
    {
        return $this->belongsTo(CreatorStorefrontItem::class, 'item_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
