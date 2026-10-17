<?php

namespace App\Services;

use App\Enums\ApplicationStatus;
use App\Enums\ApprovalFlowType;
use App\Enums\DeliveryStatus;
use App\Enums\StageApprovalStatus;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\CampaignDemand;
use App\Support\RevisionHistory;
use App\Support\SubmissionVersioning;
use Illuminate\Support\Collection;

class CampaignDemandSync
{
    /** @var list<string> */
    public const TYPES = ['reels', 'stories', 'tiktok', 'ugc', 'posts', 'youtube'];

    public function syncCampaign(Campaign $campaign): void
    {
        $campaign->loadMissing(['deliverable', 'campaignCreators']);

        foreach ($campaign->campaignCreators as $row) {
            $this->syncCreator($row);
        }
    }

    /**
     * @param  Collection<int, Campaign>|iterable<int, Campaign>  $campaigns
     */
    public function syncCampaigns(iterable $campaigns): void
    {
        foreach ($campaigns as $campaign) {
            $this->syncCampaign($campaign);
        }
    }

    public function syncCreator(CampaignCreator $row): int
    {
        if ($row->application_status !== ApplicationStatus::Approved) {
            return 0;
        }

        $row->loadMissing('campaign.deliverable');
        $deliverable = $row->campaign?->deliverable;
        if ($deliverable === null) {
            return 0;
        }

        $hadNone = ! $row->demands()->exists();
        $created = 0;
        $first = null;

        foreach (self::TYPES as $type) {
            $quota = max(0, (int) ($deliverable->{$type} ?? 0));
            if ($quota === 0) {
                continue;
            }

            $existing = $row->demands()->where('content_type', $type)->count();

            for ($position = $existing + 1; $position <= $quota; $position++) {
                $demand = $row->demands()->create([
                    'content_type' => $type,
                    'position' => $position,
                    'script_status' => StageApprovalStatus::Pending,
                    'video_status' => StageApprovalStatus::Pending,
                    'delivery_status' => DeliveryStatus::Pending,
                ]);
                $first ??= $demand;
                $created++;
            }
        }

        if ($hadNone && $first) {
            $this->absorbLegacyContent($row, $first);
            $this->rollup($row);
        }

        return $created;
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function fillSubmission(CampaignDemand $demand, array $attributes): void
    {
        $fields = array_intersect_key($attributes, array_flip([
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
            'pauta',
        ]));

        if (array_key_exists('pauta', $fields)) {
            $fields['pauta'] = trim((string) ($fields['pauta'] ?? '')) ?: null;
        }

        if (NotificationService::is($fields['script_status'] ?? null, StageApprovalStatus::Submitted)) {
            $fields['script_submitted_at'] = now();
        }
        if (NotificationService::is($fields['video_status'] ?? null, StageApprovalStatus::Submitted)) {
            $fields['video_submitted_at'] = now();
        }

        if (array_key_exists('pending_upload_id', $attributes)) {
            $fields['pending_upload_id'] = $attributes['pending_upload_id'];
            $fields['upload_progress'] = $attributes['upload_progress'] ?? null;
        }

        $demand->fill($fields)->save();

        if (NotificationService::is($fields['script_status'] ?? null, StageApprovalStatus::Revision)) {
            RevisionHistory::append(
                $demand,
                'script',
                (string) ($fields['script_feedback'] ?? $fields['revision_details'] ?? ''),
            );
            $demand->save();
        }

        if (NotificationService::is($fields['video_status'] ?? null, StageApprovalStatus::Revision)) {
            RevisionHistory::append(
                $demand,
                'video',
                (string) ($fields['video_feedback'] ?? $fields['revision_details'] ?? ''),
            );
            $demand->save();
        }

        if (NotificationService::is($fields['script_status'] ?? null, StageApprovalStatus::Submitted)) {
            SubmissionVersioning::append($demand, 'script', [
                'script' => $demand->script,
                'script_file_url' => $demand->script_file_url,
                'script_file_name' => $demand->script_file_name,
            ]);
        }

        if (NotificationService::is($fields['video_status'] ?? null, StageApprovalStatus::Submitted) && $demand->video_url) {
            SubmissionVersioning::append($demand, 'video', [
                'video_url' => $demand->video_url,
                'video_file_size' => $demand->video_file_size,
            ]);
        }

        $demand->loadMissing('campaignCreator');
        if ($demand->campaignCreator) {
            $this->rollup($demand->campaignCreator);
        }
    }

    public function rollup(CampaignCreator $row): void
    {
        $demands = $row->demands()->get();
        if ($demands->isEmpty()) {
            return;
        }

        $row->forceFill([
            'script_status' => $this->rollupStage($demands->map(fn (CampaignDemand $demand) => $demand->script_status)),
            'video_status' => $this->rollupStage($demands->map(fn (CampaignDemand $demand) => $demand->video_status)),
            'delivery_status' => $this->rollupDelivery($demands),
        ])->save();
    }

    public function contentReady(CampaignCreator $row): bool
    {
        $row->loadMissing(['campaign', 'demands']);
        if ($row->demands->isEmpty()) {
            return false;
        }

        return $row->demands->every(fn (CampaignDemand $demand) => $this->demandReady($row, $demand));
    }

    private function absorbLegacyContent(CampaignCreator $row, CampaignDemand $demand): void
    {
        $row->loadMissing('content');
        $content = $row->content;
        $hasWork = $content && (
            filled($content->script)
            || filled($content->script_file_url)
            || filled($content->video_url)
            || filled($content->image_url)
            || filled($content->published_link)
        );
        $hasStatus = $this->statusMoved($row->script_status)
            || $this->statusMoved($row->video_status)
            || $this->deliveryMoved($row->delivery_status);

        if (! $hasWork && ! $hasStatus) {
            return;
        }

        $demand->fill([
            'script' => $content?->script,
            'script_file_url' => $content?->script_file_url,
            'script_file_name' => $content?->script_file_name,
            'video_url' => $content?->video_url,
            'video_file_size' => $content?->video_file_size,
            'image_url' => $content?->image_url,
            'published_link' => $content?->published_link,
            'script_status' => $row->script_status ?? StageApprovalStatus::Pending,
            'video_status' => $row->video_status ?? StageApprovalStatus::Pending,
            'delivery_status' => $row->delivery_status ?? DeliveryStatus::Pending,
            'script_feedback' => $row->script_feedback,
            'video_feedback' => $row->video_feedback,
            'revision_details' => $row->revision_details,
            'script_submitted_at' => $row->script_submitted_at,
            'video_submitted_at' => $row->video_submitted_at,
            'script_version' => $content?->script_version ?? 0,
            'video_version' => $content?->video_version ?? 0,
            'submission_versions' => $content?->submission_versions,
            'revision_history' => $content?->revision_history,
            'story_prints' => $content?->story_prints,
            'metrics' => $content?->metrics,
        ])->save();
    }

    private function demandReady(CampaignCreator $row, CampaignDemand $demand): bool
    {
        $delivery = $demand->delivery_status instanceof DeliveryStatus
            ? $demand->delivery_status->value
            : (string) $demand->delivery_status;
        if (in_array($delivery, [DeliveryStatus::Approved->value, DeliveryStatus::Published->value], true)) {
            return true;
        }

        $flow = $row->campaign?->approval_flow;
        $flowValue = $flow instanceof ApprovalFlowType ? $flow->value : (string) ($flow ?? ApprovalFlowType::ScriptAndVideo->value);
        $script = $demand->script_status instanceof StageApprovalStatus ? $demand->script_status->value : (string) $demand->script_status;
        $video = $demand->video_status instanceof StageApprovalStatus ? $demand->video_status->value : (string) $demand->video_status;
        $scriptApproved = $script === StageApprovalStatus::Approved->value;
        $videoApproved = $video === StageApprovalStatus::Approved->value;
        $scriptOnly = $flowValue === 'script_only';
        $staged = $flowValue !== 'video_only';

        if ($videoApproved && (! $staged || $scriptApproved || $scriptOnly)) {
            return true;
        }

        return $scriptOnly && $scriptApproved;
    }

    /**
     * @param  Collection<int, mixed>  $statuses
     */
    private function rollupStage(Collection $statuses): StageApprovalStatus
    {
        $values = $statuses->map(fn ($status) => $status instanceof StageApprovalStatus ? $status->value : (string) $status);
        if ($values->contains(StageApprovalStatus::Revision->value)) {
            return StageApprovalStatus::Revision;
        }
        if ($values->contains(StageApprovalStatus::Submitted->value)) {
            return StageApprovalStatus::Submitted;
        }
        if ($values->isNotEmpty() && $values->every(fn ($value) => $value === StageApprovalStatus::Approved->value)) {
            return StageApprovalStatus::Approved;
        }

        return StageApprovalStatus::Pending;
    }

    /**
     * @param  Collection<int, CampaignDemand>  $demands
     */
    private function rollupDelivery(Collection $demands): DeliveryStatus
    {
        $values = $demands->map(fn (CampaignDemand $demand) => $demand->delivery_status instanceof DeliveryStatus
            ? $demand->delivery_status->value
            : (string) $demand->delivery_status);

        if ($values->contains(DeliveryStatus::Revision->value)) {
            return DeliveryStatus::Revision;
        }
        if ($values->contains(DeliveryStatus::Sent->value)) {
            return DeliveryStatus::Sent;
        }
        if ($values->isNotEmpty() && $values->every(fn ($value) => $value === DeliveryStatus::Published->value)) {
            return DeliveryStatus::Published;
        }
        if ($values->isNotEmpty() && $values->every(fn ($value) => in_array($value, [DeliveryStatus::Approved->value, DeliveryStatus::Published->value], true))) {
            return DeliveryStatus::Approved;
        }

        return DeliveryStatus::Pending;
    }

    private function statusMoved(mixed $status): bool
    {
        $value = $status instanceof StageApprovalStatus ? $status->value : (string) ($status ?? '');

        return $value !== '' && $value !== StageApprovalStatus::Pending->value;
    }

    private function deliveryMoved(mixed $status): bool
    {
        $value = $status instanceof DeliveryStatus ? $status->value : (string) ($status ?? '');

        return $value !== '' && $value !== DeliveryStatus::Pending->value;
    }
}
