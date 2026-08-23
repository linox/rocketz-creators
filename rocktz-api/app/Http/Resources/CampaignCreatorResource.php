<?php

namespace App\Http\Resources;

use App\Support\CreatorPrivacy;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

class CampaignCreatorResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'campaign_id' => $this->campaign_id,
            'creator_id' => $this->creator_id,
            'creator' => $this->whenLoaded('creator', function () use ($request) {
                $canSeePersonal = CreatorPrivacy::canViewPersonalData($request->user(), (int) $this->creator->id);
                $creator = [
                    'id' => $this->creator->id,
                    'artistic_name' => $this->creator->artistic_name,
                    'photo_url' => $this->creator->photo_url,
                    'status' => $this->creator->status?->value,
                    'city' => $this->creator->city,
                    'country' => $this->creator->country,
                    'state' => $this->creator->state,
                ];

                if ($canSeePersonal) {
                    $creator['full_name'] = $this->creator->full_name;
                    $creator['whatsapp'] = $this->creator->whatsapp;
                }

                if (in_array($request->user()?->role?->value, ['admin', 'company'], true)) {
                    $creator['pix_key'] = $this->creator->pix_key;
                    $creator['categories'] = $this->creator->categories ?? [];
                    $creator['metrics'] = $this->creator->metrics ?? [];
                    $creator['pricing'] = $this->creator->pricing ?? [];
                    $creator['socials'] = $this->creator->socials ?? [];
                }

                return $creator;
            }),
            'campaign' => $this->whenLoaded('campaign', fn () => [
                'id' => $this->campaign->id,
                'name' => $this->campaign->name,
                'status' => $this->campaign->status?->value,
                'image_url' => $this->campaign->image_url,
                'currency' => $this->campaign->currency,
            ]),
            'delivery_type' => $this->delivery_type,
            'amount' => $this->amount !== null ? (float) $this->amount : null,
            'delivery_date' => $this->delivery_date?->toDateString(),
            'post_date' => $this->post_date?->toDateString(),
            'delivery_status' => $this->delivery_status?->value,
            'payment_status' => $this->payment_status?->value,
            'payment_date' => $this->payment_date?->toDateString(),
            'notes' => $this->notes,
            'application_status' => $this->application_status?->value,
            'rejection_reason' => $this->rejection_reason,
            'revision_details' => $this->revision_details,
            'script_status' => $this->script_status?->value,
            'video_status' => $this->video_status?->value,
            'script_feedback' => $this->script_feedback,
            'video_feedback' => $this->video_feedback,
            'script_submitted_at' => $this->script_submitted_at?->toIso8601String(),
            'video_submitted_at' => $this->video_submitted_at?->toIso8601String(),
            'signature_status' => $this->signature_status?->value,
            'contract_url' => $this->contract_url,
            'content' => $this->whenLoaded('content', fn () => $this->content ? [
                'script' => $this->content->script,
                'video_url' => $this->content->video_url,
                'video_file_size' => (int) ($this->content->video_file_size ?? 0),
                'video_download_url' => $this->mediaDownloadUrl($this->content->video_url),
                'image_url' => $this->content->image_url,
                'published_link' => $this->content->published_link,
                'script_version' => (int) ($this->content->script_version ?? 0),
                'video_version' => (int) ($this->content->video_version ?? 0),
                'submission_versions' => $this->content->submission_versions ?? [],
                'revision_history' => $this->content->revision_history ?? [],
                'story_prints' => $this->content->story_prints ?? [],
                'metrics' => $this->content->metrics ?? [],
            ] : null),
        ];
    }

    private function mediaDownloadUrl(?string $url): ?string
    {
        if (! $url) {
            return null;
        }

        $path = parse_url($url, PHP_URL_PATH) ?: '';
        if (! is_string($path) || ! str_contains($path, '/uploads/')) {
            return $url;
        }

        $relative = ltrim(Str::after($path, '/uploads/'), '/');

        return rtrim((string) config('app.url'), '/').'/downloads/'.$relative;
    }
}
