<?php

namespace App\Console\Commands;

use App\Enums\ApplicationStatus;
use App\Enums\ContentPlanningStatus;
use App\Enums\DeliveryStatus;
use App\Enums\MailTemplateKey;
use App\Enums\StageApprovalStatus;
use App\Models\CampaignCreator;
use App\Models\ContentPlanningItem;
use App\Models\MailTemplate;
use App\Services\Mail\TransactionalMailService;
use App\Support\FrontendUrl;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class ProcessMailRemindersCommand extends Command
{
    protected $signature = 'mail:reminders';

    protected $description = 'Send transactional deadline and review reminders';

    public function handle(TransactionalMailService $mail): int
    {
        $offsets = MailTemplate::query()->where('key', MailTemplateKey::DemandReminder->value)->value('reminder_offsets')
            ?: MailTemplateKey::DemandReminder->defaultReminderOffsets();

        ContentPlanningItem::query()
            ->with(['creator.user', 'recurringContract.company'])
            ->whereNotNull('planned_date')
            ->whereNotIn('status', [
                ContentPlanningStatus::Approved,
                ContentPlanningStatus::Published,
                ContentPlanningStatus::Rejected,
            ])
            ->get()
            ->each(function (ContentPlanningItem $item) use ($mail, $offsets) {
                $user = $item->creator?->user;
                if (! $user || ! $item->planned_date) {
                    return;
                }
                foreach ($offsets as $offset) {
                    if (! $this->matchesOffset($item->planned_date, (int) $offset)) {
                        continue;
                    }
                    $mail->send(
                        MailTemplateKey::DemandReminder,
                        $user,
                        [
                            'nome_criador' => $item->creator?->artistic_name,
                            'nome_demanda' => $item->title ?: $item->recurringContract?->title,
                            'data_limite' => $item->planned_date->isoFormat('D MMM YYYY'),
                            'cta_url' => FrontendUrl::to('/creators/'.$item->creator_id.'?tab=recurring'),
                            'link_demanda' => FrontendUrl::to('/recurring/'.$item->recurring_contract_id),
                            'creator_id' => $item->creator_id,
                            'company_id' => $item->company_id,
                        ],
                        $item,
                        'reminder:'.$offset,
                    );
                }
            });

        CampaignCreator::query()
            ->with(['creator.user', 'campaign.company'])
            ->whereNotNull('delivery_date')
            ->whereNotIn('delivery_status', [DeliveryStatus::Approved, DeliveryStatus::Published])
            ->where('application_status', ApplicationStatus::Approved)
            ->get()
            ->each(function (CampaignCreator $row) use ($mail, $offsets) {
                $user = $row->creator?->user;
                if (! $user || ! $row->delivery_date) {
                    return;
                }
                foreach ($offsets as $offset) {
                    if (! $this->matchesOffset($row->delivery_date, (int) $offset)) {
                        continue;
                    }
                    $mail->send(
                        MailTemplateKey::DemandReminder,
                        $user,
                        [
                            'nome_criador' => $row->creator?->artistic_name,
                            'nome_demanda' => $row->campaign?->name,
                            'nome_campanha' => $row->campaign?->name,
                            'data_limite' => $row->delivery_date->isoFormat('D MMM YYYY'),
                            'cta_url' => FrontendUrl::to('/creators/'.$row->creator_id.'?tab=campaigns'),
                            'link_demanda' => FrontendUrl::to('/campaigns/'.$row->campaign_id),
                            'campaign_id' => $row->campaign_id,
                            'creator_id' => $row->creator_id,
                        ],
                        $row,
                        'reminder:'.$offset,
                    );
                }
            });

        $reviewOffsets = MailTemplate::query()->where('key', MailTemplateKey::DeliveryPendingReviewReminder->value)->value('reminder_offsets')
            ?: [1, 3];

        CampaignCreator::query()
            ->with(['creator.user', 'campaign.company.companyUsers.user'])
            ->where(function ($q) {
                $q->where('script_status', StageApprovalStatus::Submitted)
                    ->orWhere('video_status', StageApprovalStatus::Submitted)
                    ->orWhere('delivery_status', DeliveryStatus::Sent);
            })
            ->get()
            ->each(function (CampaignCreator $row) use ($mail, $reviewOffsets) {
                $submitted = $row->video_submitted_at ?? $row->script_submitted_at;
                if (! $submitted) {
                    return;
                }
                foreach ($reviewOffsets as $offset) {
                    if ($submitted->copy()->startOfDay()->addDays((int) $offset)->toDateString() !== now()->toDateString()) {
                        continue;
                    }
                    foreach ($row->campaign?->company?->companyUsers ?? [] as $companyUser) {
                        if (! $companyUser->user) {
                            continue;
                        }
                        $mail->send(
                            MailTemplateKey::DeliveryPendingReviewReminder,
                            $companyUser->user,
                            [
                                'nome_criador' => $row->creator?->artistic_name,
                                'nome_campanha' => $row->campaign?->name,
                                'nome_demanda' => $row->campaign?->name,
                                'cta_url' => FrontendUrl::to('/campaigns/'.$row->campaign_id),
                                'link_demanda' => FrontendUrl::to('/campaigns/'.$row->campaign_id),
                                'campaign_id' => $row->campaign_id,
                                'company_id' => $row->campaign?->company_id,
                                'creator_id' => $row->creator_id,
                            ],
                            $row,
                            'review:'.$offset,
                        );
                    }
                }
            });

        return self::SUCCESS;
    }

    private function matchesOffset(Carbon $date, int $offset): bool
    {
        return $date->copy()->startOfDay()->subDays($offset)->toDateString() === now()->toDateString();
    }
}
