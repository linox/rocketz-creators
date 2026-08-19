<?php

namespace App\Models;

use Database\Factories\CampaignCreatorContentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'campaign_creator_id',
    'script',
    'video_url',
    'image_url',
    'published_link',
    'story_prints',
    'metrics',
])]
class CampaignCreatorContent extends Model
{
    /** @use HasFactory<CampaignCreatorContentFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'story_prints' => 'array',
            'metrics' => 'array',
        ];
    }

    public function campaignCreator(): BelongsTo
    {
        return $this->belongsTo(CampaignCreator::class);
    }
}
