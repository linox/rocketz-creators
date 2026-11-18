<?php

namespace App\Models;

use App\Enums\CreatorVideoSource;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'creator_id',
    'company_id',
    'campaign_id',
    'recurring_contract_id',
    'campaign_demand_id',
    'content_planning_item_id',
    'campaign_creator_content_id',
    'content_type',
    'position',
    'title',
    'video_url',
    'video_file_size',
    'received_at',
    'source',
    'dismissed_fingerprints',
    'tags',
])]
class CreatorVideo extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'video_file_size' => 'integer',
            'received_at' => 'datetime',
            'source' => CreatorVideoSource::class,
            'dismissed_fingerprints' => 'array',
            'tags' => 'array',
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

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }

    public function recurringContract(): BelongsTo
    {
        return $this->belongsTo(RecurringContract::class);
    }

    public function usages(): HasMany
    {
        return $this->hasMany(CreatorVideoUsage::class)->orderByDesc('occurred_at')->orderByDesc('id');
    }
}
