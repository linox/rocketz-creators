<?php

namespace App\Services;

use App\Enums\DeliveryStatus;
use App\Enums\NotificationType;
use App\Enums\StageApprovalStatus;
use App\Enums\UserRole;
use App\Models\CampaignCreator;
use App\Models\CampaignCreatorContent;
use App\Models\ContentPlanningItem;
use App\Models\User;
use App\Support\SubmissionVersioning;
use Illuminate\Support\Facades\DB;

class MediaSubmissionService
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly Mail\MailNotifier $mail,
    ) {}

    /**
     * @param  array{type: string, id: int, payload: array<string, mixed>}  $submission
     */
    public function beginSubmission(User $user, string $uploadId, array $submission): void
    {
        $type = (string) ($submission['type'] ?? '');
        $id = (int) ($submission['id'] ?? 0);
        abort_unless(in_array($type, ['campaign_creator', 'content_planning_item'], true) && $id > 0, 422);

        if ($type === 'campaign_creator') {
            $row = CampaignCreator::query()->with('campaign')->findOrFail($id);
            abort_unless($user->role === UserRole::Creator && (int) $user->creator?->id === (int) $row->creator_id, 403);
            abort_if($row->pending_upload_id !== null, 422, __('auth.upload_already_in_progress'));
            $row->update(['pending_upload_id' => $uploadId, 'upload_progress' => 0]);

            return;
        }

        $item = ContentPlanningItem::query()->findOrFail($id);
        abort_unless($user->role === UserRole::Creator && (int) $user->creator?->id === (int) $item->creator_id, 403);
        abort_if($item->pending_upload_id !== null, 422, __('auth.upload_already_in_progress'));
        $item->update(['pending_upload_id' => $uploadId, 'upload_progress' => 0]);
    }

    public function updateLinkedProgress(string $uploadId, int $progress): void
    {
        $progress = max(0, min(100, $progress));

        CampaignCreator::query()
            ->where('pending_upload_id', $uploadId)
            ->update(['upload_progress' => $progress]);

        ContentPlanningItem::query()
            ->where('pending_upload_id', $uploadId)
            ->update(['upload_progress' => $progress]);
    }

    public function clearPending(string $uploadId): void
    {
        CampaignCreator::query()
            ->where('pending_upload_id', $uploadId)
            ->update(['pending_upload_id' => null, 'upload_progress' => null]);

        ContentPlanningItem::query()
            ->where('pending_upload_id', $uploadId)
            ->update(['pending_upload_id' => null, 'upload_progress' => null]);
    }

    public function userOwnsPendingUpload(User $user, string $uploadId): bool
    {
        if ($user->role !== UserRole::Creator || $user->creator === null) {
            return false;
        }

        $creatorId = (int) $user->creator->id;

        return CampaignCreator::query()
            ->where('creator_id', $creatorId)
            ->where('pending_upload_id', $uploadId)
            ->exists()
            || ContentPlanningItem::query()
                ->where('creator_id', $creatorId)
                ->where('pending_upload_id', $uploadId)
                ->exists();
    }

    /**
     * @param  array{type: string, id: int, payload: array<string, mixed>}  $submission
     * @param  array{id: int, url: string, filename: string, path: string, size: int}  $media
     */
    public function applySubmission(array $submission, array $media): void
    {
        $type = (string) ($submission['type'] ?? '');
        $id = (int) ($submission['id'] ?? 0);
        $payload = is_array($submission['payload'] ?? null) ? $submission['payload'] : [];

        $payload['video_url'] = $media['url'];
        $payload['video_file_size'] = $media['size'];

        if ($type === 'campaign_creator') {
            $this->applyCampaignCreator($id, $payload);

            return;
        }

        if ($type === 'content_planning_item') {
            $this->applyPlanningItem($id, $payload);
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function applyCampaignCreator(int $id, array $payload): void
    {
        [$row, $rowFields] = DB::transaction(function () use ($id, $payload) {
            $row = CampaignCreator::query()->with(['campaign', 'creator.user', 'content'])->findOrFail($id);
            $contentFields = array_intersect_key($payload, array_flip([
                'script', 'video_url', 'video_file_size', 'image_url', 'published_link',
            ]));
            $rowFields = array_intersect_key($payload, array_flip([
                'script_status', 'video_status', 'delivery_status', 'delivery_type',
            ]));

            if (NotificationService::is($rowFields['script_status'] ?? null, StageApprovalStatus::Submitted)) {
                $rowFields['script_submitted_at'] = now();
            }
            if (NotificationService::is($rowFields['video_status'] ?? null, StageApprovalStatus::Submitted)) {
                $rowFields['video_submitted_at'] = now();
            }

            $row->fill($rowFields);
            $row->pending_upload_id = null;
            $row->upload_progress = null;
            $row->save();

            if ($contentFields) {
                CampaignCreatorContent::query()->updateOrCreate(
                    ['campaign_creator_id' => $row->id],
                    $contentFields,
                );
            }

            $row->unsetRelation('content');
            $row->load('content');

            if (NotificationService::is($rowFields['video_status'] ?? null, StageApprovalStatus::Submitted)) {
                SubmissionVersioning::append($row->content ?? CampaignCreatorContent::query()->firstOrCreate(['campaign_creator_id' => $row->id]), 'video', [
                    'video_url' => $contentFields['video_url'] ?? null,
                    'video_file_size' => $contentFields['video_file_size'] ?? null,
                ]);
            }

            $row->load(['campaign', 'creator.user', 'content']);

            return [$row, $rowFields];
        });

        $this->notifyCampaignVideoSubmitted($row, $rowFields);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function applyPlanningItem(int $id, array $payload): void
    {
        [$item, $data] = DB::transaction(function () use ($id, $payload) {
            $item = ContentPlanningItem::query()->with(['creator.user', 'recurringContract'])->findOrFail($id);
            $mediaUrl = (string) ($payload['media_url'] ?? $payload['video_url'] ?? '');

            $data = array_intersect_key($payload, array_flip([
                'script', 'script_status', 'video_status', 'status', 'published_url',
            ]));

            if ($mediaUrl !== '') {
                $data['media_url'] = $mediaUrl;
                $data['submission_url'] = $mediaUrl;
            }

            if (NotificationService::is($data['script_status'] ?? null, StageApprovalStatus::Submitted)) {
                $data['script_submitted_at'] = now();
            }
            if (NotificationService::is($data['video_status'] ?? null, StageApprovalStatus::Submitted)) {
                $data['video_submitted_at'] = now();
            }

            $item->fill($data);
            $item->pending_upload_id = null;
            $item->upload_progress = null;
            $item->save();

            if (NotificationService::is($data['video_status'] ?? null, StageApprovalStatus::Submitted)) {
                SubmissionVersioning::append($item, 'video', [
                    'media_url' => $item->media_url,
                    'submission_url' => $item->submission_url,
                ]);
            }

            $item->load(['creator.user', 'recurringContract']);

            return [$item, $data];
        });

        $this->notifyPlanningVideoSubmitted($item, $data);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function notifyCampaignVideoSubmitted(CampaignCreator $row, array $data): void
    {
        $video = NotificationService::value($data['video_status'] ?? null);
        $delivery = NotificationService::value($data['delivery_status'] ?? null);
        if ($video !== StageApprovalStatus::Submitted->value && $delivery !== DeliveryStatus::Sent->value) {
            return;
        }

        $creatorId = (int) $row->creator_id;
        $campaignId = (int) $row->campaign_id;
        $companyId = (int) ($row->campaign?->company_id ?? 0);
        $campaignName = (string) ($row->campaign?->name ?? '');
        $companyLink = '/campaigns/'.$campaignId;

        if ($companyId) {
            $this->notifications->notifyCompany($companyId, [
                'creator_id' => $creatorId,
                'campaign_id' => $campaignId,
                'title' => __('auth.video_submitted_title'),
                'message' => __('auth.video_submitted', ['title' => $campaignName, 'project' => $campaignName]),
                'type' => NotificationType::DeliveryReview,
                'link' => $companyLink,
            ]);
            $this->notifications->notifyAdmins(
                __('auth.video_submitted_title'),
                __('auth.video_submitted', ['title' => $campaignName, 'project' => $campaignName]),
                NotificationType::DeliveryReview,
                $companyLink,
                ['creator_id' => $creatorId, 'campaign_id' => $campaignId],
            );
            if ($row->creator) {
                $this->mail->deliverySubmitted(
                    $companyId,
                    $row->creator,
                    $campaignName,
                    $companyLink,
                    ['campaign_id' => $campaignId, 'company_id' => $companyId, 'creator_id' => $creatorId],
                    $row->campaign,
                );
            }
        }
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function notifyPlanningVideoSubmitted(ContentPlanningItem $item, array $data): void
    {
        $video = NotificationService::value($data['video_status'] ?? null);
        if ($video !== StageApprovalStatus::Submitted->value) {
            return;
        }

        $companyId = (int) ($item->company_id ?? $item->recurringContract?->company_id ?? 0);
        $creatorId = (int) $item->creator_id;
        $itemTitle = (string) ($item->title ?? '');
        $projectTitle = (string) ($item->recurringContract?->title ?? $itemTitle);
        $companyLink = '/recurring/'.($item->recurring_contract_id ?? 0);

        if ($companyId && $item->creator) {
            $this->notifications->notifyCompany($companyId, [
                'creator_id' => $creatorId,
                'title' => __('auth.video_submitted_title'),
                'message' => __('auth.video_submitted', ['title' => $itemTitle, 'project' => $projectTitle]),
                'type' => NotificationType::DeliveryReview,
                'link' => $companyLink,
            ]);
            $this->notifications->notifyAdmins(
                __('auth.video_submitted_title'),
                __('auth.video_submitted', ['title' => $itemTitle, 'project' => $projectTitle]),
                NotificationType::DeliveryReview,
                $companyLink,
                ['creator_id' => $creatorId, 'recurring_contract_id' => $item->recurring_contract_id],
            );
            $this->mail->deliverySubmitted(
                $companyId,
                $item->creator,
                $itemTitle,
                $companyLink,
                ['creator_id' => $creatorId, 'company_id' => $companyId, 'recurring_contract_id' => $item->recurring_contract_id],
                $item->recurringContract,
            );
        }
    }
}
