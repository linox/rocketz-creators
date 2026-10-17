<?php

namespace App\Models;

use App\Enums\DeliveryStatus;
use App\Enums\StageApprovalStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'campaign_creator_id',
    'content_type',
    'position',
    'pauta',
    'script',
    'script_file_url',
    'script_file_name',
    'video_url',
    'video_file_size',
    'image_url',
    'published_link',
    'script_status',
    'video_status',
    'delivery_status',
    'script_feedback',
    'video_feedback',
    'revision_details',
    'script_submitted_at',
    'video_submitted_at',
    'script_version',
    'video_version',
    'submission_versions',
    'revision_history',
    'story_prints',
    'metrics',
    'pending_upload_id',
    'upload_progress',
])]
class CampaignDemand extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'video_file_size' => 'integer',
            'script_status' => StageApprovalStatus::class,
            'video_status' => StageApprovalStatus::class,
            'delivery_status' => DeliveryStatus::class,
            'script_submitted_at' => 'datetime',
            'video_submitted_at' => 'datetime',
            'script_version' => 'integer',
            'video_version' => 'integer',
            'submission_versions' => 'array',
            'revision_history' => 'array',
            'story_prints' => 'array',
            'metrics' => 'array',
            'upload_progress' => 'integer',
        ];
    }

    public function campaignCreator(): BelongsTo
    {
        return $this->belongsTo(CampaignCreator::class);
    }

    public function label(): string
    {
        $format = __('auth.campaign_demand_formats.'.$this->content_type);

        return trim($format.' '.$this->position);
    }
}
