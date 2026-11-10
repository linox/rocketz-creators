<?php

namespace App\Support;

use App\Enums\ApprovalFlowType;
use App\Enums\ContentPlanningStatus;
use App\Enums\DeliveryStatus;
use App\Enums\StageApprovalStatus;
use App\Models\CampaignCreator;
use App\Models\CampaignDemand;
use App\Models\ContentPlanningItem;

/**
 * Undoes a "concluded with link" publication and leaves the delivery open.
 * Approvals made in the same step as the publication are removed. Approvals
 * that already existed, and that have the submitted file, stay.
 */
class PublicationRevert
{
    private const WINDOW_SECONDS = 5;

    public static function demandIsConcluded(CampaignDemand $demand): bool
    {
        return self::enumValue($demand->delivery_status) === DeliveryStatus::Published->value;
    }

    public static function creatorIsConcluded(CampaignCreator $row): bool
    {
        return self::enumValue($row->delivery_status) === DeliveryStatus::Published->value;
    }

    public static function planningIsConcluded(ContentPlanningItem $item): bool
    {
        return self::enumValue($item->status) === ContentPlanningStatus::Published->value
            || filled($item->published_url);
    }

    public static function demand(CampaignDemand $demand): void
    {
        $movements = self::movements($demand->movements);
        $publishedAt = self::latestAt($movements, 'published');
        $hasScript = self::demandHasScript($demand);
        $hasVideo = self::demandHasVideo($demand);
        $scriptForced = self::stageForced($movements, 'script_approved', $publishedAt, $hasScript, self::isApproved($demand->script_status));
        $videoForced = self::stageForced($movements, 'video_approved', $publishedAt, $hasVideo, self::isApproved($demand->video_status));

        if ($scriptForced) {
            $demand->script_status = $hasScript ? StageApprovalStatus::Submitted : StageApprovalStatus::Pending;
        }
        if ($videoForced) {
            $demand->video_status = $hasVideo ? StageApprovalStatus::Submitted : StageApprovalStatus::Pending;
        }

        $demand->delivery_status = self::deliveryAfter($demand->script_status, $demand->video_status, $hasVideo);
        $demand->published_link = null;
        $demand->movements = self::withoutForced($movements, $scriptForced, $videoForced);
        $demand->save();
    }

    public static function creator(CampaignCreator $row): void
    {
        $row->loadMissing('content');
        $content = $row->content;
        $movements = self::movements($content?->movements);
        $publishedAt = self::latestAt($movements, 'published');
        $hasScript = filled($content?->script) || filled($content?->script_file_url) || filled($row->script_submitted_at);
        $hasVideo = filled($content?->video_url) || filled($content?->image_url) || filled($row->video_submitted_at);
        $scriptForced = self::stageForced($movements, 'script_approved', $publishedAt, $hasScript, self::isApproved($row->script_status));
        $videoForced = self::stageForced($movements, 'video_approved', $publishedAt, $hasVideo, self::isApproved($row->video_status));

        if ($scriptForced) {
            $row->script_status = $hasScript ? StageApprovalStatus::Submitted : StageApprovalStatus::Pending;
        }
        if ($videoForced) {
            $row->video_status = $hasVideo ? StageApprovalStatus::Submitted : StageApprovalStatus::Pending;
        }

        $row->delivery_status = self::deliveryAfter($row->script_status, $row->video_status, $hasVideo);
        $row->save();

        if ($content) {
            $content->forceFill([
                'published_link' => null,
                'movements' => self::withoutForced($movements, $scriptForced, $videoForced),
            ])->save();
        }
    }

    public static function planning(ContentPlanningItem $item): void
    {
        $movements = self::movements($item->movements);
        $publishedAt = self::latestAt($movements, 'published');
        $hasScript = filled($item->script) || filled($item->script_file_url) || filled($item->script_submitted_at);
        $hasVideo = filled($item->media_url) || filled($item->submission_url) || filled($item->video_submitted_at);
        $scriptForced = self::stageForced($movements, 'script_approved', $publishedAt, $hasScript, self::isApproved($item->script_status));
        $videoForced = self::stageForced($movements, 'video_approved', $publishedAt, $hasVideo, self::isApproved($item->video_status));

        if ($scriptForced) {
            $item->script_status = $hasScript ? StageApprovalStatus::Submitted : StageApprovalStatus::Pending;
        }
        if ($videoForced) {
            $item->video_status = $hasVideo ? StageApprovalStatus::Submitted : StageApprovalStatus::Pending;
        }

        $item->status = self::planningStatus($item, $hasVideo);
        $item->published_url = null;
        $item->movements = self::withoutForced($movements, $scriptForced, $videoForced);
        $item->save();
    }

    /**
     * @param  list<mixed>  $movements
     */
    private static function stageForced(array $movements, string $type, ?string $publishedAt, bool $hasMaterial, bool $approved): bool
    {
        if (! $approved) {
            return false;
        }
        if (! $hasMaterial) {
            return true;
        }
        if ($publishedAt === null) {
            return false;
        }

        $at = self::latestAt($movements, $type);
        if ($at === null) {
            return false;
        }
        $published = strtotime($publishedAt);
        $approval = strtotime($at);
        if ($published === false || $approval === false) {
            return false;
        }

        return abs($published - $approval) <= self::WINDOW_SECONDS;
    }

    private static function deliveryAfter(mixed $script, mixed $video, bool $hasVideo): DeliveryStatus
    {
        $scriptValue = self::enumValue($script);
        $videoValue = self::enumValue($video);
        if ($scriptValue === StageApprovalStatus::Revision->value || $videoValue === StageApprovalStatus::Revision->value) {
            return DeliveryStatus::Revision;
        }
        if ($videoValue === StageApprovalStatus::Approved->value && $hasVideo) {
            return DeliveryStatus::Approved;
        }
        if ($scriptValue === StageApprovalStatus::Submitted->value || $videoValue === StageApprovalStatus::Submitted->value) {
            return DeliveryStatus::Sent;
        }

        return DeliveryStatus::Pending;
    }

    private static function planningStatus(ContentPlanningItem $item, bool $hasVideo): ContentPlanningStatus
    {
        $flow = $item->approval_flow instanceof ApprovalFlowType
            ? $item->approval_flow->value
            : (string) $item->approval_flow;
        $script = self::enumValue($item->script_status);
        $video = self::enumValue($item->video_status);

        if ($script === StageApprovalStatus::Revision->value || $video === StageApprovalStatus::Revision->value) {
            return ContentPlanningStatus::InProduction;
        }
        if ($video === StageApprovalStatus::Approved->value && $hasVideo) {
            return ContentPlanningStatus::Approved;
        }
        if ($flow === ApprovalFlowType::ScriptOnly->value && $script === StageApprovalStatus::Approved->value) {
            return ContentPlanningStatus::Approved;
        }
        if ($script === StageApprovalStatus::Submitted->value || $video === StageApprovalStatus::Submitted->value) {
            return ContentPlanningStatus::Review;
        }
        if ($script === StageApprovalStatus::Approved->value && in_array($flow, [
            ApprovalFlowType::ScriptAndVideo->value,
            ApprovalFlowType::LiveLink->value,
        ], true)) {
            return ContentPlanningStatus::InProduction;
        }

        return ContentPlanningStatus::Planned;
    }

    private static function demandHasScript(CampaignDemand $demand): bool
    {
        return filled($demand->script) || filled($demand->script_file_url) || filled($demand->script_submitted_at);
    }

    private static function demandHasVideo(CampaignDemand $demand): bool
    {
        return filled($demand->video_url) || filled($demand->image_url) || filled($demand->video_submitted_at);
    }

    /**
     * @return list<mixed>
     */
    private static function movements(mixed $movements): array
    {
        return is_array($movements) ? array_values($movements) : [];
    }

    /**
     * @param  list<mixed>  $movements
     */
    private static function latestAt(array $movements, string $type): ?string
    {
        $at = null;
        foreach ($movements as $entry) {
            if (! is_array($entry) || ($entry['type'] ?? '') !== $type) {
                continue;
            }
            $candidate = trim((string) ($entry['at'] ?? ''));
            if ($candidate !== '') {
                $at = $candidate;
            }
        }

        return $at;
    }

    /**
     * @param  list<mixed>  $movements
     * @return list<mixed>
     */
    private static function withoutForced(array $movements, bool $scriptForced, bool $videoForced): array
    {
        $drop = ['published'];
        if ($scriptForced) {
            $drop[] = 'script_approved';
        }
        if ($videoForced) {
            $drop[] = 'video_approved';
        }

        return array_values(array_filter(
            $movements,
            fn ($entry) => ! is_array($entry) || ! in_array((string) ($entry['type'] ?? ''), $drop, true),
        ));
    }

    private static function isApproved(mixed $status): bool
    {
        return self::enumValue($status) === StageApprovalStatus::Approved->value;
    }

    private static function enumValue(mixed $status): string
    {
        if ($status instanceof \BackedEnum) {
            return (string) $status->value;
        }

        return (string) ($status ?? '');
    }
}
