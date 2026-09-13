<?php

namespace App\Models;

use App\Enums\StorefrontEventType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'creator_id',
    'item_id',
    'type',
    'actor_key',
    'created_at',
])]
class CreatorStorefrontEvent extends Model
{
    public $timestamps = false;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => StorefrontEventType::class,
            'created_at' => 'datetime',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(Creator::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(CreatorStorefrontItem::class, 'item_id');
    }
}
