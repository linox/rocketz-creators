<?php

namespace App\Models;

use App\Enums\ApprovalFlowType;
use App\Enums\ContentPlanningStatus;
use App\Enums\PostingProfile;
use App\Enums\ContentType;
use App\Enums\StageApprovalStatus;
use Database\Factories\ContentPlanningItemFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'recurring_contract_id',
    'company_id',
    'creator_id',
    'month',
    'content_type',
    'title',
    'description',
    'briefing_note',
    'briefing',
    'briefing_fields',
    'references',
    'script',
    'caption',
    'planned_date',
    'status',
    'approval_flow',
    'posting_profile',
    'script_status',
    'video_status',
    'script_feedback',
    'video_feedback',
    'script_submitted_at',
    'video_submitted_at',
    'pending_upload_id',
    'upload_progress',
    'script_version',
    'video_version',
    'submission_versions',
    'revision_history',
    'published_url',
    'metrics',
    'media_url',
    'submission_url',
    'submission_notes',
    'feedback_note',
    'submitted_at',
    'reviewed_at',
])]
class ContentPlanningItem extends Model
{
    /** @use HasFactory<ContentPlanningItemFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'content_type' => ContentType::class,
            'planned_date' => 'date',
            'status' => ContentPlanningStatus::class,
            'approval_flow' => ApprovalFlowType::class,
            'posting_profile' => PostingProfile::class,
            'script_status' => StageApprovalStatus::class,
            'video_status' => StageApprovalStatus::class,
            'script_submitted_at' => 'datetime',
            'video_submitted_at' => 'datetime',
            'script_version' => 'integer',
            'video_version' => 'integer',
            'submission_versions' => 'array',
            'revision_history' => 'array',
            'briefing_fields' => 'array',
            'metrics' => 'array',
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    public function recurringContract(): BelongsTo
    {
        return $this->belongsTo(RecurringContract::class);
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(Creator::class);
    }
}
