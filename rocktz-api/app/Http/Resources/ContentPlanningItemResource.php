<?php

namespace App\Http\Resources;

use App\Support\CreatorPrivacy;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ContentPlanningItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'recurring_contract_id' => $this->recurring_contract_id,
            'company_id' => $this->company_id,
            'creator_id' => $this->creator_id,
            'creator' => $this->whenLoaded('creator', fn () => $this->creator ? [
                'id' => $this->creator->id,
                'artistic_name' => $this->creator->artistic_name,
                'full_name' => CreatorPrivacy::canViewPersonalData($request->user(), (int) $this->creator->id)
                    ? $this->creator->full_name
                    : null,
                'photo_url' => $this->creator->photo_url,
            ] : null),
            'company' => $this->whenLoaded('company', fn () => $this->company ? [
                'id' => $this->company->id,
                'name' => $this->company->name,
                'logo_url' => $this->company->logo_url,
            ] : null),
            'month' => $this->month,
            'content_type' => $this->content_type?->value,
            'title' => $this->title,
            'description' => $this->description,
            'briefing_note' => $this->briefing_note,
            'briefing' => $this->briefing,
            'briefing_fields' => $this->briefing_fields ?? [],
            'references' => $this->references,
            'script' => $this->script,
            'caption' => $this->caption,
            'planned_date' => $this->planned_date?->toDateString(),
            'status' => $this->status?->value,
            'approval_flow' => $this->approval_flow?->value,
            'script_status' => $this->script_status?->value,
            'video_status' => $this->video_status?->value,
            'script_feedback' => $this->script_feedback,
            'video_feedback' => $this->video_feedback,
            'script_submitted_at' => $this->script_submitted_at?->toIso8601String(),
            'video_submitted_at' => $this->video_submitted_at?->toIso8601String(),
            'script_version' => (int) ($this->script_version ?? 0),
            'video_version' => (int) ($this->video_version ?? 0),
            'submission_versions' => $this->submission_versions ?? [],
            'revision_history' => $this->revision_history ?? [],
            'published_url' => $this->published_url,
            'metrics' => $this->metrics ?? [],
            'media_url' => $this->media_url,
            'submission_url' => $this->submission_url,
            'submission_notes' => $this->submission_notes,
            'feedback_note' => $this->feedback_note,
            'submitted_at' => $this->submitted_at?->toIso8601String(),
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
        ];
    }
}
