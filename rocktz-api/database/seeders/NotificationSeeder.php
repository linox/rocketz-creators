<?php

namespace Database\Seeders;

use App\Enums\CampaignStatus;
use App\Enums\NotificationTargetRole;
use App\Enums\NotificationType;
use App\Models\Campaign;
use App\Models\Creator;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Database\Seeder;

class NotificationSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::query()->where('email', 'admin@rocketz.test')->firstOrFail();
        $anaUser = User::query()->where('email', 'ana.creator@rocketz.test')->firstOrFail();
        $ana = $anaUser->creator()->firstOrFail();
        $bruno = Creator::query()
            ->whereHas('user', fn ($query) => $query->where('email', 'bruno.creator@rocketz.test'))
            ->firstOrFail();

        $selection = Campaign::query()
            ->where('status', CampaignStatus::Selection)
            ->where('name', 'Campanha Verão Aurora')
            ->firstOrFail();

        $production = Campaign::query()
            ->where('status', CampaignStatus::Production)
            ->where('name', 'Rotina Glow 7 dias')
            ->firstOrFail();

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
