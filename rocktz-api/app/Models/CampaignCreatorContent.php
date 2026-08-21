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
    'video_file_size',
    'image_url',
    'published_link',
    'script_version',
    'video_version',
    'submission_versions',
    'revision_history',
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
            'video_file_size' => 'integer',
            'script_version' => 'integer',
            'video_version' => 'integer',
            'submission_versions' => 'array',
            'revision_history' => 'array',
        ];
    }

    public function campaignCreator(): BelongsTo
    {
        return $this->belongsTo(CampaignCreator::class);
    }
}
