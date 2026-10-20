<?php

namespace App\Http\Resources;

use App\Enums\ApplicationStatus;
use App\Enums\UserRole;
use App\Models\CampaignDemand;
use App\Support\CreatorPrivacy;
use App\Support\MediaUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CampaignCreatorResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $hideCreatorValues = CreatorPrivacy::hidesCreatorValues($request->user());

        return [
            'id' => $this->id,
            'campaign_id' => $this->campaign_id,
            'creator_id' => $this->creator_id,
            'creator' => $this->whenLoaded('creator', function () use ($request, $hideCreatorValues) {
                $canSeePersonal = CreatorPrivacy::canViewPersonalData($request->user(), (int) $this->creator->id);
                $creator = [
                    'id' => $this->creator->id,
                    'artistic_name' => $this->creator->artistic_name,
                    'photo_url' => MediaUrl::publicAbsolute($this->creator->photo_url),
                    'status' => $this->creator->status?->value,
                    'city' => $this->creator->city,
                    'country' => $this->creator->country,
                    'state' => $this->creator->state,
                ];

                if ($canSeePersonal) {
                    $creator['full_name'] = $this->creator->full_name;
                    $creator['whatsapp'] = $this->creator->whatsapp;
                }

                $role = $request->user()?->role;
                if (in_array($role, [UserRole::Admin, UserRole::Company], true)) {
                    $creator['age'] = $this->creator->age();
                    $creator['categories'] = $this->creator->categories ?? [];
                    $creator['metrics'] = $this->creator->metrics ?? [];
                    $creator['pricing'] = $hideCreatorValues ? [] : ($this->creator->pricing ?? []);
                    $creator['socials'] = $this->creator->socials ?? [];
                    if ($role === UserRole::Admin || $this->application_status === ApplicationStatus::Approved) {
                        $creator['pix_key'] = $this->creator->pix_key;
                        $creator['bank_account'] = $this->creator->bank_account;
                        $creator['shipping_address'] = $this->creator->shipping_address;
                    }
                }

                return $creator;
            }),
            'campaign' => $this->whenLoaded('campaign', fn () => [
                'id' => $this->campaign->id,
                'name' => $this->campaign->name,
                'status' => $this->campaign->status?->value,
                'image_url' => MediaUrl::publicAbsolute($this->campaign->image_url),
                'currency' => $this->campaign->currency,
            ]),
            'delivery_type' => $this->delivery_type,
            'amount' => $hideCreatorValues ? null : ($this->amount !== null ? (float) $this->amount : null),
            'delivery_date' => $this->delivery_date?->toDateString(),
            'post_date' => $this->post_date?->toDateString(),
            'delivery_status' => $this->delivery_status?->value,
            'payment_status' => $this->payment_status?->value,
            'payment_date' => $this->payment_date?->toDateString(),
            'notes' => $this->notes,
            'additional_briefing' => $this->additional_briefing,
            'application_status' => $this->application_status?->value,
            'rejection_reason' => $this->rejection_reason,
            'revision_details' => $this->revision_details,
            'script_status' => $this->script_status?->value,
            'video_status' => $this->video_status?->value,
            'script_feedback' => $this->script_feedback,
            'video_feedback' => $this->video_feedback,
            'script_submitted_at' => $this->script_submitted_at?->toIso8601String(),
            'video_submitted_at' => $this->video_submitted_at?->toIso8601String(),
            'pending_upload_id' => $this->pending_upload_id,
            'upload_progress' => $this->upload_progress !== null ? (int) $this->upload_progress : null,
            'signature_status' => $this->signature_status?->value,
            'contract_url' => $this->contract_url,
            'custom_contract_accepted_at' => $this->custom_contract_accepted_at?->toIso8601String(),
            'content' => $this->whenLoaded('content', fn () => $this->content ? $this->contentPayload($this->content) : null),
            'demands' => $this->whenLoaded('demands', function () {
                $totals = $this->demands->countBy('content_type');

                return $this->demands->map(fn (CampaignDemand $demand) => [
                    'id' => $demand->id,
                    'content_type' => $demand->content_type,
                    'position' => (int) $demand->position,
                    'total' => (int) ($totals[$demand->content_type] ?? 1),
                    'pauta' => $demand->pauta,
                    'delivery_status' => $demand->delivery_status?->value,
                    'script_status' => $demand->script_status?->value,
                    'video_status' => $demand->video_status?->value,
                    'script_feedback' => $demand->script_feedback,
                    'video_feedback' => $demand->video_feedback,
                    'revision_details' => $demand->revision_details,
                    'script_submitted_at' => $demand->script_submitted_at?->toIso8601String(),
                    'video_submitted_at' => $demand->video_submitted_at?->toIso8601String(),
                    'pending_upload_id' => $demand->pending_upload_id,
                    'upload_progress' => $demand->upload_progress !== null ? (int) $demand->upload_progress : null,
                    'content' => $this->contentPayload($demand),
                ])->values();
            }),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function contentPayload(object $content): array
    {
        return [
            'script' => $content->script,
            'script_file_url' => MediaUrl::publicAbsolute($content->script_file_url),
            'script_file_name' => $content->script_file_name,
            'video_url' => MediaUrl::publicAbsolute($content->video_url),
            'video_file_size' => (int) ($content->video_file_size ?? 0),
            'video_download_url' => MediaUrl::downloadFromPublicUrl($content->video_url),
            'image_url' => MediaUrl::publicAbsolute($content->image_url),
            'published_link' => $content->published_link,
            'script_version' => (int) ($content->script_version ?? 0),
            'video_version' => (int) ($content->video_version ?? 0),
            'submission_versions' => $content->submission_versions ?? [],
            'revision_history' => $content->revision_history ?? [],
            'story_prints' => $content->story_prints ?? [],
            'metrics' => $content->metrics ?? [],
        ];
    }
}
