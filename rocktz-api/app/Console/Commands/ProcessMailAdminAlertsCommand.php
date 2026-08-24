<?php

namespace App\Console\Commands;

use App\Enums\ApplicationStatus;
use App\Enums\CampaignStatus;
use App\Enums\ContentPlanningStatus;
use App\Enums\DeliveryStatus;
use App\Enums\MailMessageStatus;
use App\Enums\MailTemplateKey;
use App\Enums\StageApprovalStatus;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\ContentPlanningItem;
use App\Models\MailMessage;
use App\Services\Mail\MailNotifier;
use App\Support\FrontendUrl;
use Illuminate\Console\Command;

class ProcessMailAdminAlertsCommand extends Command
{
    protected $signature = 'mail:admin-alerts';

    protected $description = 'Send daily admin alert emails for stuck work and mail failures';

    public function handle(MailNotifier $notifier): int
    {
        $stuck = CampaignCreator::query()
            ->where(function ($q) {
                $q->where('script_status', StageApprovalStatus::Submitted)
                    ->orWhere('video_status', StageApprovalStatus::Submitted)
                    ->orWhere('delivery_status', DeliveryStatus::Sent);
            })
            ->where(function ($q) {
                $q->where('script_submitted_at', '<=', now()->subDays(2))
                    ->orWhere('video_submitted_at', '<=', now()->subDays(2));
            })
            ->count();

        if ($stuck > 0) {
            $notifier->notifyAdmins(MailTemplateKey::AdminDeliveryStuck, [
                'cta_url' => FrontendUrl::to('/campaign-deliveries'),
            ], null, now()->toDateString());
        }

        $overdue = ContentPlanningItem::query()
            ->whereNotNull('planned_date')
            ->whereDate('planned_date', '<', now()->toDateString())
            ->whereNotIn('status', [
                ContentPlanningStatus::Approved,
                ContentPlanningStatus::Published,
                ContentPlanningStatus::Rejected,
            ])
            ->count();

        if ($overdue > 0) {
            $notifier->notifyAdmins(MailTemplateKey::AdminDemandOverdue, [
                'cta_url' => FrontendUrl::to('/campaign-deliveries?tab=recurring'),
            ], null, now()->toDateString());
        }

        Campaign::query()
            ->whereNotNull('start_date')
            ->whereDate('start_date', '<=', now()->addDays(3)->toDateString())
            ->whereDate('start_date', '>=', now()->toDateString())
            ->whereNotIn('status', [CampaignStatus::Finished, CampaignStatus::PendingAgency])
            ->get()
            ->each(function (Campaign $campaign) use ($notifier) {
                $approved = $campaign->campaignCreators()
                    ->where('application_status', ApplicationStatus::Approved)
                    ->count();
                if ($approved > 0) {
                    return;
                }
                $notifier->notifyAdmins(MailTemplateKey::AdminCampaignStartingEmpty, [
                    'nome_campanha' => $campaign->name,
                    'cta_url' => FrontendUrl::to('/campaigns/'.$campaign->id),
                    'campaign_id' => $campaign->id,
                    'company_id' => $campaign->company_id,
                ], $campaign, now()->toDateString());
            });

        $failures = MailMessage::query()
            ->where('created_at', '>=', now()->subHour())
            ->whereIn('status', [
                MailMessageStatus::PermanentFailed,
                MailMessageStatus::TemporaryFailed,
                MailMessageStatus::Bounced,
                MailMessageStatus::Complained,
            ])
            ->count();

        if ($failures >= 10) {
            $notifier->notifyAdmins(MailTemplateKey::AdminFailureVolume, [
                'cta_url' => FrontendUrl::to('/mail/log'),
            ], null, now()->format('Y-m-d-H'));
        }

        return self::SUCCESS;
    }
}
