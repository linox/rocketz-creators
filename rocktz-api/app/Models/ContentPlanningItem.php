<?php

namespace App\Models;

use App\Enums\ApprovalFlowType;
use App\Enums\ContentPlanningStatus;
use App\Enums\PostingProfile;
use App\Enums\ContentType;
use App\Enums\StageApprovalStatus;
use Database\Factories\ContentPlanningItemFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

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
    'pauta_script_file_url',
    'pauta_script_file_name',
    'script_file_url',
    'script_file_name',
    'caption',
    'planned_date',
    'post_date',
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
    'movements',
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
    use HasFactory, SoftDeletes;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'content_type' => ContentType::class,
            'planned_date' => 'date',
            'post_date' => 'date',
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
            'movements' => 'array',
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

    /** Briefing text, structured fields, or a script file from the brand. */
    public function hasDefinedPauta(): bool
    {
        if (trim((string) $this->briefing) !== '' || trim((string) $this->briefing_note) !== '') {
            return true;
        }

        if (filled($this->pauta_script_file_url)) {
            return true;
        }

        $fields = is_array($this->briefing_fields) ? $this->briefing_fields : [];
        foreach (['product', 'key_message', 'must_have', 'donts', 'cta', 'hashtags'] as $key) {
            if (trim((string) ($fields[$key] ?? '')) !== '') {
                return true;
            }
        }

        return false;
    }

    /**
     * Generated monthly slots stay hidden until the brief exists.
     * A demand already in production stays visible.
     */
    public function isVisibleToCreator(): bool
    {
        if ($this->status !== ContentPlanningStatus::Planned) {
            return true;
        }

        return $this->hasDefinedPauta();
    }

    /**
     * @param  Builder<ContentPlanningItem>  $query
     * @return Builder<ContentPlanningItem>
     */
    public function scopeVisibleToCreator(Builder $query): Builder
    {
        return $query->where(function (Builder $query) {
            $query->where('status', '!=', ContentPlanningStatus::Planned->value)
                ->orWhere(function (Builder $query) {
                    $query->whereRaw("trim(coalesce(briefing, '')) != ''")
                        ->orWhereRaw("trim(coalesce(briefing_note, '')) != ''")
                        ->orWhereRaw("trim(coalesce(pauta_script_file_url, '')) != ''")
                        ->orWhere(function (Builder $query) {
                            foreach (['product', 'key_message', 'must_have', 'donts', 'cta', 'hashtags'] as $key) {
                                $query->orWhereRaw(
                                    "trim(coalesce(json_extract(briefing_fields, ?), '')) != ''",
                                    ['$.'.$key],
                                );
                            }
                        });
                });
        });
    }
}
