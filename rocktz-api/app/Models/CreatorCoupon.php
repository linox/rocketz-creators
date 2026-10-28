<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'company_id',
    'campaign_id',
    'creator_id',
    'code',
    'discount_percent',
    'commission_percent',
    'is_active',
    'is_auto',
    'created_by',
])]
class CreatorCoupon extends Model
{
    protected function casts(): array
    {
        return [
            'discount_percent' => 'decimal:2',
            'commission_percent' => 'decimal:2',
            'is_active' => 'boolean',
            'is_auto' => 'boolean',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(Creator::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
