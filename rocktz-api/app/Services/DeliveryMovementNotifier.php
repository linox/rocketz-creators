<?php

namespace App\Services;

use App\Enums\NotificationType;
use App\Models\CampaignCreator;
use App\Models\CampaignCreatorContent;
use App\Models\CampaignDemand;
use App\Models\ContentPlanningItem;
use Illuminate\Database\Eloquent\Model;

class DeliveryMovementNotifier
{
    public function __construct(private readonly NotificationService $notifications) {}

    public function received(Model $store, string $kind): void
    {
        if ($store instanceof CampaignDemand) {
            $store->loadMissing('campaignCreator.campaign');
            $this->campaign($store->campaignCreator, $kind);

            return;
        }

        if ($store instanceof CampaignCreatorContent) {
            $store->loadMissing('campaignCreator.campaign');
            $this->campaign($store->campaignCreator, $kind);

            return;
        }

        if ($store instanceof ContentPlanningItem) {
            $this->planning($store, $kind);
        }
    }

    private function campaign(?CampaignCreator $row, string $kind): void
    {
        $campaign = $row?->campaign;
        $companyId = (int) ($campaign?->company_id ?? 0);
        if (! $row || ! $campaign || $companyId <= 0) {
            return;
        }

        $name = (string) $campaign->name;
        [$title, $message] = $this->copy($kind, $name, $name);
        $link = '/campaigns/'.$campaign->id;
        $extra = [
            'creator_id' => $row->creator_id,
            'campaign_id' => $campaign->id,
        ];

        $this->notifications->notifyCompany($companyId, $extra + [
            'title' => $title,
            'message' => $message,
            'type' => NotificationType::DeliveryReview,
            'link' => $link,
        ]);
        $this->notifications->notifyAdmins($title, $message, NotificationType::DeliveryReview, $link, $extra);
    }

    private function planning(ContentPlanningItem $item, string $kind): void
    {
        $item->loadMissing('recurringContract');
        $companyId = (int) ($item->company_id ?: $item->recurringContract?->company_id);
        if ($companyId <= 0) {
            return;
        }

        $label = $item->notificationTitle();
        $project = (string) ($item->recurringContract?->title ?: $label);
        [$title, $message] = $this->copy($kind, $label, $project);
        $link = '/recurring/'.(int) $item->recurring_contract_id;
        $extra = [
            'creator_id' => $item->creator_id,
            'recurring_contract_id' => $item->recurring_contract_id,
        ];

        $this->notifications->notifyCompany($companyId, $extra + [
            'title' => $title,
            'message' => $message,
            'type' => NotificationType::DeliveryReview,
            'link' => $link,
        ]);
        $this->notifications->notifyAdmins($title, $message, NotificationType::DeliveryReview, $link, $extra);
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function copy(string $kind, string $title, string $project): array
    {
        $script = $kind === 'script';

        return [
            __($script ? 'auth.script_submitted_title' : 'auth.video_submitted_title'),
            __($script ? 'auth.script_submitted' : 'auth.video_submitted', [
                'title' => $title,
                'project' => $project,
            ]),
        ];
    }
}
