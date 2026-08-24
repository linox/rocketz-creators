<?php

namespace Database\Seeders;

use App\Enums\CampaignStatus;
use App\Enums\NotificationTargetRole;
use App\Enums\NotificationType;
use App\Models\Campaign;
use App\Models\Notification;
use Database\Seeders\Concerns\SeedsDemoAccounts;
use Illuminate\Database\Seeder;

class NotificationSeeder extends Seeder
{
    use SeedsDemoAccounts;

    public function run(): void
    {
        $admin = $this->demoUser(DemoAccounts::ADMIN);
        $anaUser = $this->demoUser(DemoAccounts::CREATOR_ANA);
        $ana = $anaUser->creator()->firstOrFail();
        $bruno = $this->demoCreator(DemoAccounts::CREATOR_BRUNO);

        $selection = Campaign::query()
            ->where('status', CampaignStatus::Selection)
            ->where('name', 'Campanha Verão Aurora')
            ->firstOrFail();

        $production = Campaign::query()
            ->where('status', CampaignStatus::Production)
            ->where('name', 'Rotina Glow 7 dias')
            ->firstOrFail();

        if (! Notification::query()->where('user_id', $admin->id)->where('title', 'Nova candidatura na Campanha Verão Aurora')->exists()) {
            Notification::factory()->unread()->create([
                'user_id' => $admin->id,
                'creator_id' => $bruno->id,
                'campaign_id' => $selection->id,
                'title' => 'Nova candidatura na Campanha Verão Aurora',
                'message' => 'Bruno Costa se candidatou e aguarda análise da equipe.',
                'type' => NotificationType::Application,
                'target_role' => NotificationTargetRole::Admin,
                'link' => '/admin/campaigns/'.$selection->id.'/applications',
            ]);
        }

        if (! Notification::query()->where('user_id', $anaUser->id)->where('title', 'Você foi aprovada na campanha')->exists()) {
            Notification::factory()->unread()->create([
                'user_id' => $anaUser->id,
                'creator_id' => $ana->id,
                'campaign_id' => $production->id,
                'title' => 'Você foi aprovada na campanha',
                'message' => 'Sua candidatura para Rotina Glow 7 dias foi aprovada. Envie o roteiro para seguir.',
                'type' => NotificationType::Approval,
                'target_role' => NotificationTargetRole::Creator,
                'link' => '/creator/campaigns/'.$production->id,
            ]);
        }
    }
}
