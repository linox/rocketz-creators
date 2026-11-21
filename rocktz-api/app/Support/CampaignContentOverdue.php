<?php

namespace App\Support;

use App\Enums\ApprovalFlowType;
use App\Enums\DeliveryStatus;
use App\Enums\StageApprovalStatus;
use App\Models\CampaignCreator;
use App\Models\CampaignDemand;
use App\Services\NotificationService;

class CampaignContentOverdue
{
    /**
     * Script-and-video campaign whose script was sent and whose video is still missing.
     * The delivery date is checked by the caller.
     */
    public static function missingAfterScript(CampaignCreator $row): bool
    {
        $row->loadMissing(['campaign', 'demands', 'content']);
        if ($row->campaign?->approval_flow !== ApprovalFlowType::ScriptAndVideo) {
            return false;
        }

        if ($row->demands->isNotEmpty()) {
            return $row->demands->contains(fn (CampaignDemand $demand) => self::demandMissing($demand));
        }

        return self::creatorMissing($row);
    }

    /**
     * @param  array<string, mixed>  $work
     */
    public static function fromAlertWork(array $work): bool
    {
        if (($work['source'] ?? null) !== 'campaign' || ! empty($work['script_only_slice'])) {
            return false;
        }

        $flow = $work['flow'] instanceof ApprovalFlowType
            ? $work['flow']
            : ApprovalFlowType::tryFrom((string) ($work['flow'] ?? ''));

        return self::unitMissing(
            $flow,
            $work['script_status'] ?? null,
            $work['video_status'] ?? null,
            $work['delivery_status'] ?? null,
            $work['script_at'] ?? null,
            $work['video_at'] ?? null,
            false,
        );
    }

    private static function demandMissing(CampaignDemand $demand): bool
    {
        return self::unitMissing(
            ApprovalFlowType::ScriptAndVideo,
            $demand->script_status,
            $demand->video_status,
            $demand->delivery_status,
            $demand->script_submitted_at,
            $demand->video_submitted_at,
            self::hasMedia($demand->video_url, $demand->image_url, $demand->published_link, $demand->submission_versions),
        );
    }

    private static function creatorMissing(CampaignCreator $row): bool
    {
        $content = $row->content;

        return self::unitMissing(
            ApprovalFlowType::ScriptAndVideo,
            $row->script_status,
            $row->video_status,
            $row->delivery_status,
            $row->script_submitted_at,
            $row->video_submitted_at,
            self::hasMedia($content?->video_url, $content?->image_url, $content?->published_link, $content?->submission_versions),
        );
    }

    private static function unitMissing(
        ?ApprovalFlowType $flow,
        mixed $scriptStatus,
        mixed $videoStatus,
        mixed $deliveryStatus,
        mixed $scriptAt,
        mixed $videoAt,
        bool $hasMedia,
    ): bool {
        if ($flow !== ApprovalFlowType::ScriptAndVideo) {
            return false;
        }
        if (NotificationService::is($deliveryStatus, DeliveryStatus::Approved) || NotificationService::is($deliveryStatus, DeliveryStatus::Published)) {
            return false;
        }
        if ($hasMedia || $videoAt || self::videoDelivered($videoStatus)) {
            return false;
        }

        return self::scriptWasSent($scriptStatus, $scriptAt);
    }

    private static function scriptWasSent(mixed $status, mixed $submittedAt): bool
    {
        if (NotificationService::is($status, StageApprovalStatus::Revision)) {
            return false;
        }

        return NotificationService::is($status, StageApprovalStatus::Submitted)
            || NotificationService::is($status, StageApprovalStatus::Approved)
            || ($submittedAt !== null && ! NotificationService::is($status, StageApprovalStatus::Pending));
    }

    private static function videoDelivered(mixed $status): bool
    {
        return NotificationService::is($status, StageApprovalStatus::Submitted)
            || NotificationService::is($status, StageApprovalStatus::Approved)
            || NotificationService::is($status, StageApprovalStatus::Revision);
    }

    private static function hasMedia(mixed $videoUrl, mixed $imageUrl, mixed $publishedLink, mixed $versions): bool
    {
        if (self::filled($videoUrl) || self::filled($imageUrl) || self::filled($publishedLink)) {
            return true;
        }
        if (! is_array($versions)) {
            return false;
        }
        foreach ($versions as $entry) {
            if (! is_array($entry) || ($entry['stage'] ?? null) !== 'video') {
                continue;
            }
            if (self::filled($entry['video_url'] ?? null) || self::filled($entry['media_url'] ?? null) || self::filled($entry['submission_url'] ?? null)) {
                return true;
            }
        }

        return false;
    }

    private static function filled(mixed $value): bool
    {
        return is_string($value) && trim($value) !== '';
    }
}
