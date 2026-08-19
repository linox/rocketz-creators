<?php

namespace App\Models;

use Database\Factories\CampaignDeliverableFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'campaign_id',
    'summary',
    'reels',
    'stories',
    'tiktok',
    'ugc',
    'posts',
    'youtube',
    'deadline_days',
    'guidelines',
])]
class CampaignDeliverable extends Model
{
    /** @use HasFactory<CampaignDeliverableFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'reels' => 'integer',
            'stories' => 'integer',
            'tiktok' => 'integer',
            'ugc' => 'integer',
            'posts' => 'integer',
            'youtube' => 'integer',
            'deadline_days' => 'integer',
        ];
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }
}
