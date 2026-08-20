<?php

namespace Tests\Feature;

use App\Enums\CampaignStatus;
use App\Enums\CreatorStatus;
use App\Enums\NotificationTargetRole;
use App\Enums\NotificationType;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\ContentPlanningItem;
use App\Models\Creator;
use App\Models\Notification;
use App\Models\RecurringContract;
use App\Models\RecurringContractCreator;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DomainApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_load_dashboard_and_lists(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@rocketz.test')->first();
        $token = $admin->createToken('auth')->plainTextToken;

        $this->withToken($token)->getJson('/api/dashboard')->assertOk()
            ->assertJsonPath('total_creators', 4);

        $this->withToken($token)->getJson('/api/creators')->assertOk()
            ->assertJsonCount(4, 'data');

        $this->withToken($token)->getJson('/api/companies')->assertOk()
            ->assertJsonCount(2, 'data');

        $this->withToken($token)->getJson('/api/campaigns')->assertOk();
        $this->withToken($token)->getJson('/api/campaigns/available')->assertOk();
        $this->withToken($token)->getJson('/api/notifications')->assertOk();
        $this->withToken($token)->getJson('/api/recurring-contracts')->assertOk();
        $this->withToken($token)->getJson('/api/admin-users')->assertOk();
    }

    public function test_admin_can_approve_creator(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@rocketz.test')->first();
        $token = $admin->createToken('auth')->plainTextToken;
        $bruno = Creator::query()->where('status', CreatorStatus::Review)->first();

        $this->withToken($token)
            ->postJson("/api/creators/{$bruno->id}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'active');
    }

    public function test_creator_cannot_list_all_creators(): void
    {
        $this->seed();

        $creator = User::query()->where('email', 'ana.creator@rocketz.test')->first();
        $token = $creator->createToken('auth')->plainTextToken;

        $this->withToken($token)->getJson('/api/creators')->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_company_can_create_campaign_without_sending_company_id(): void
    {
        $this->seed();

        $company = User::query()->where('email', 'empresa@rocketz.test')->first();
        $token = $company->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/campaigns', ['name' => 'Campanha Aurora', 'is_barter' => true])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Campanha Aurora');
    }

    public function test_pending_company_cannot_create_campaign_or_recurring_contract(): void
    {
        $this->seed();

        $pendingUser = User::query()->where('email', 'pending.empresa@rocketz.test')->firstOrFail();
        $token = $pendingUser->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/campaigns', ['name' => 'Campanha Bloqueada', 'is_barter' => true])
            ->assertStatus(422)
            ->assertJsonPath('message', __('auth.company_not_approved'));

        $this->withToken($token)
            ->postJson('/api/recurring-contracts', ['title' => 'Contrato Bloqueado'])
            ->assertStatus(422)
            ->assertJsonPath('message', __('auth.company_not_approved'));
    }

    public function test_admin_cannot_create_campaign_or_recurring_for_pending_company(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@rocketz.test')->firstOrFail();
        $pendingCompany = \App\Models\Company::query()->where('email', 'pending.empresa@rocketz.test')->firstOrFail();
        $token = $admin->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/campaigns', [
                'name' => 'Campanha Bloqueada',
                'company_id' => $pendingCompany->id,
                'is_barter' => true,
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', __('auth.company_not_approved'));

        $this->withToken($token)
            ->postJson('/api/recurring-contracts', [
                'title' => 'Contrato Bloqueado',
                'company_id' => $pendingCompany->id,
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', __('auth.company_not_approved'));
    }

    public function test_active_creator_can_apply_to_available_campaign(): void
    {
        $this->seed();

        $creator = User::query()->where('email', 'ana.creator@rocketz.test')->first();
        $token = $creator->createToken('auth')->plainTextToken;

        $campaigns = $this->withToken($token)->getJson('/api/campaigns/available')->assertOk();
        $id = $campaigns->json('data.0.id');
        $this->assertNotEmpty($id);

        $expectedCache = (float) Campaign::query()->findOrFail($id)->creator_cache;

        $response = $this->withToken($token)
            ->postJson("/api/campaigns/{$id}/apply", ['notes' => 'Quero participar'])
            ->assertCreated();

        $this->assertSame($expectedCache, (float) $response->json('data.amount'));
    }

    public function test_active_creator_without_contract_cannot_apply(): void
    {
        $this->seed();

        $user = User::factory()->creator()->create([
            'email' => 'sem.contrato@rocketz.test',
            'password' => 'password',
        ]);
        $creator = \App\Models\Creator::factory()->create([
            'user_id' => $user->id,
            'full_name' => 'Sem Contrato',
            'artistic_name' => 'Sem Contrato',
            'status' => \App\Enums\CreatorStatus::Active,
        ]);
        $this->assertFalse($creator->contractAcceptances()->exists());

        $token = $user->createToken('auth')->plainTextToken;
        $campaignId = Campaign::query()->where('status', '!=', CampaignStatus::Finished)->value('id');
        $this->assertNotEmpty($campaignId);

        $this->withToken($token)
            ->postJson("/api/campaigns/{$campaignId}/apply", ['notes' => 'Quero participar'])
            ->assertForbidden()
            ->assertJsonPath('message', __('auth.creator_must_accept_contract'));
    }

    public function test_review_creator_cannot_access_or_apply_to_campaigns(): void
    {
        $this->seed();

        $reviewUser = User::query()->where('email', 'bruno.creator@rocketz.test')->first();
        $reviewToken = $reviewUser->createToken('auth')->plainTextToken;

        $this->withToken($reviewToken)->getJson('/api/campaigns/available')
            ->assertForbidden()
            ->assertJsonPath('message', __('auth.creator_must_be_approved'));

        $this->withToken($reviewToken)->getJson('/api/campaigns')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $campaignId = Campaign::query()->where('status', '!=', CampaignStatus::Finished)->value('id');
        $this->assertNotEmpty($campaignId);

        $this->withToken($reviewToken)
            ->postJson("/api/campaigns/{$campaignId}/apply", ['notes' => 'Quero participar'])
            ->assertForbidden();
    }

    public function test_admin_can_create_creator_from_casting_form(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@rocketz.test')->first();
        $token = $admin->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/creators', [
                'full_name' => 'Juliana Fit',
                'artistic_name' => 'juliana.fit',
                'email' => 'juliana.fit@rocketz.test',
                'category' => 'Fitness',
            ])
            ->assertCreated()
            ->assertJsonPath('data.artistic_name', 'juliana.fit')
            ->assertJsonPath('data.status', 'review')
            ->assertJsonPath('data.role', 'creator');
    }

    public function test_creator_can_add_portfolio_video_with_orientation(): void
    {
        $this->seed();

        $user = User::query()->where('email', 'ana.creator@rocketz.test')->first();
        $creator = Creator::query()->where('user_id', $user->id)->firstOrFail();
        $token = $user->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/portfolio", [
                'title' => 'Reel vertical',
                'url' => 'https://example.com/portfolio/reel.mp4',
                'description' => 'Teste de orientação',
                'orientation' => 'vertical',
                'file_size' => 220_000_000,
            ])
            ->assertCreated()
            ->assertJsonPath('data.orientation', 'vertical')
            ->assertJsonPath('data.file_size', 220000000);
    }

    public function test_admin_can_create_company_with_name_only(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@rocketz.test')->first();
        $token = $admin->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/companies', [
                'name' => 'Bia Ribeiro Beauty',
                'segment' => 'Beleza',
                'city' => 'Brasília',
            ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Bia Ribeiro Beauty')
            ->assertJsonPath('data.status', 'active');
    }

    public function test_admin_can_update_creator_password(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@rocketz.test')->first();
        $token = $admin->createToken('auth')->plainTextToken;
        $creator = Creator::query()->first();

        $this->withToken($token)
            ->postJson("/api/creators/{$creator->id}/password", ['password' => 'nova-senha'])
            ->assertOk();
    }

    public function test_admin_can_remove_creator_from_campaign(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@rocketz.test')->first();
        $token = $admin->createToken('auth')->plainTextToken;
        $row = CampaignCreator::query()->firstOrFail();

        $this->withToken($token)
            ->deleteJson("/api/campaign-creators/{$row->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Criador removido do casting.');

        $this->assertDatabaseMissing('campaign_creators', ['id' => $row->id]);
    }

    public function test_admin_can_approve_campaign_application_with_agreed_fee(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@rocketz.test')->first();
        $token = $admin->createToken('auth')->plainTextToken;
        $row = CampaignCreator::query()->where('application_status', 'pending')->firstOrFail();

        $this->withToken($token)
            ->getJson("/api/campaigns/{$row->campaign_id}")
            ->assertOk()
            ->assertJsonPath('data.applications.0.creator.id', $row->creator_id)
            ->assertJsonStructure(['data' => ['applications' => [['creator' => ['whatsapp', 'categories', 'metrics', 'pricing']]]]]);

        $this->withToken($token)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'application_status' => 'approved',
                'amount' => 3200,
                'delivery_status' => 'pending',
            ])
            ->assertOk()
            ->assertJsonPath('data.application_status', 'approved')
            ->assertJsonPath('data.amount', 3200);
    }

    public function test_admin_can_reject_campaign_application_with_reason(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@rocketz.test')->first();
        $token = $admin->createToken('auth')->plainTextToken;
        $row = CampaignCreator::query()->where('application_status', 'pending')->firstOrFail();

        $this->withToken($token)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'application_status' => 'rejected',
                'rejection_reason' => 'Perfil fora do nicho',
            ])
            ->assertOk()
            ->assertJsonPath('data.application_status', 'rejected')
            ->assertJsonPath('data.rejection_reason', 'Perfil fora do nicho');
    }

    public function test_admin_can_reset_recurring_contracts(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@rocketz.test')->first();
        $token = $admin->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/recurring-contracts/reset')
            ->assertOk()
            ->assertJsonPath('message', 'Recorrência zerada.');

        $this->assertDatabaseCount('recurring_contracts', 0);
        $this->assertDatabaseCount('content_planning_items', 0);
    }

    public function test_admin_can_remove_creator_from_recurring_contract(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@rocketz.test')->first();
        $token = $admin->createToken('auth')->plainTextToken;
        $row = RecurringContractCreator::query()->firstOrFail();

        $this->withToken($token)
            ->deleteJson("/api/recurring-contracts/{$row->recurring_contract_id}/creators/{$row->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Criador removido do contrato.');

        $this->assertDatabaseMissing('recurring_contract_creators', ['id' => $row->id]);
    }

    public function test_attaching_recurring_creator_generates_planned_demands_from_monthly_quota(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@rocketz.test')->firstOrFail();
        $contract = RecurringContract::query()->where('title', 'Conteúdo mensal Aurora + Ana')->firstOrFail();
        $creator = Creator::factory()->active()->create();
        $token = $admin->createToken('auth')->plainTextToken;
        $month = now()->startOfMonth()->format('Y-m');
        $before = ContentPlanningItem::query()
            ->where('recurring_contract_id', $contract->id)
            ->where('creator_id', $creator->id)
            ->where('month', $month)
            ->count();

        $this->withToken($token)
            ->postJson("/api/recurring-contracts/{$contract->id}/creators", [
                'creator_id' => $creator->id,
                'start_date' => now()->startOfMonth()->toDateString(),
                'monthly_cache' => 550,
                'monthly_deliverables' => [
                    'reels' => 4,
                    'stories' => 8,
                ],
            ])
            ->assertCreated();

        $this->assertSame($before + 12, ContentPlanningItem::query()
            ->where('recurring_contract_id', $contract->id)
            ->where('creator_id', $creator->id)
            ->where('month', $month)
            ->count());

        $this->assertSame(4, ContentPlanningItem::query()
            ->where('recurring_contract_id', $contract->id)
            ->where('creator_id', $creator->id)
            ->where('month', $month)
            ->where('content_type', 'reel')
            ->where('status', 'planned')
            ->count());

        $this->assertSame(8, ContentPlanningItem::query()
            ->where('recurring_contract_id', $contract->id)
            ->where('creator_id', $creator->id)
            ->where('month', $month)
            ->where('content_type', 'story')
            ->where('status', 'planned')
            ->count());
    }

    public function test_admin_can_generate_month_demands_for_another_month(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@rocketz.test')->firstOrFail();
        $contract = RecurringContract::query()->where('title', 'Conteúdo mensal Aurora + Ana')->firstOrFail();
        $ana = Creator::query()
            ->whereHas('user', fn ($query) => $query->where('email', 'ana.creator@rocketz.test'))
            ->firstOrFail();
        $token = $admin->createToken('auth')->plainTextToken;
        $targetMonth = now()->addMonths(2)->format('Y-m');

        $before = ContentPlanningItem::query()
            ->where('recurring_contract_id', $contract->id)
            ->where('creator_id', $ana->id)
            ->where('month', $targetMonth)
            ->count();

        $this->withToken($token)
            ->postJson("/api/recurring-contracts/{$contract->id}/generate-month-demands", [
                'creator_id' => $ana->id,
                'month' => $targetMonth,
            ])
            ->assertOk()
            ->assertJsonPath('created', 8);

        $this->assertSame($before + 8, ContentPlanningItem::query()
            ->where('recurring_contract_id', $contract->id)
            ->where('creator_id', $ana->id)
            ->where('month', $targetMonth)
            ->count());
    }

    public function test_creator_only_sees_own_recurring_demands_and_fees(): void
    {
        $this->seed();

        $ana = User::query()->where('email', 'ana.creator@rocketz.test')->firstOrFail();
        $contract = RecurringContract::query()->where('title', 'Conteúdo mensal Aurora + Ana')->firstOrFail();
        $other = Creator::factory()->active()->create();

        RecurringContractCreator::factory()->create([
            'recurring_contract_id' => $contract->id,
            'creator_id' => $other->id,
            'monthly_cache' => 9999,
        ]);

        ContentPlanningItem::factory()->planned()->create([
            'recurring_contract_id' => $contract->id,
            'company_id' => $contract->company_id,
            'creator_id' => $other->id,
            'title' => 'Pauta secreta de outro criador',
            'month' => now()->format('Y-m'),
        ]);

        $token = $ana->createToken('auth')->plainTextToken;
        $payload = $this->withToken($token)
            ->getJson("/api/recurring-contracts/{$contract->id}")
            ->assertOk()
            ->assertJsonPath('data.monthly_fee', null)
            ->assertJsonPath('data.notes', null)
            ->assertJsonCount(1, 'data.creators')
            ->assertJsonPath('data.creators.0.creator_id', $ana->creator->id)
            ->assertJsonPath('data.creators.0.monthly_cache', 3500)
            ->json('data');

        $this->assertNotContains('Pauta secreta de outro criador', array_column($payload['items'], 'title'));
        foreach ($payload['items'] as $item) {
            $this->assertSame($ana->creator->id, $item['creator_id']);
        }

        $otherItem = ContentPlanningItem::query()->where('title', 'Pauta secreta de outro criador')->firstOrFail();
        $this->withToken($token)
            ->patchJson("/api/content-planning-items/{$otherItem->id}", ['published_url' => 'https://example.com/live'])
            ->assertForbidden();
    }

    public function test_creator_receives_approval_and_revision_notifications(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@rocketz.test')->firstOrFail();
        $ana = User::query()->where('email', 'ana.creator@rocketz.test')->firstOrFail();
        $participation = CampaignCreator::query()
            ->where('creator_id', $ana->creator->id)
            ->where('application_status', 'approved')
            ->firstOrFail();
        $planningItem = ContentPlanningItem::query()
            ->where('creator_id', $ana->creator->id)
            ->where('status', 'review')
            ->firstOrFail();
        $adminToken = $admin->createToken('auth')->plainTextToken;
        $creatorToken = $ana->createToken('auth')->plainTextToken;

        Notification::factory()->unread()->create([
            'user_id' => $admin->id,
            'creator_id' => $ana->creator->id,
            'campaign_id' => $participation->campaign_id,
            'title' => 'Vídeo enviado',
            'message' => 'O criador enviou o vídeo.',
            'type' => NotificationType::DeliveryReview,
            'target_role' => NotificationTargetRole::Admin,
            'link' => '/campaigns/'.$participation->campaign_id,
        ]);

        $this->withToken($adminToken)
            ->patchJson("/api/campaign-creators/{$participation->id}", [
                'script_status' => 'approved',
                'script_feedback' => '',
            ])
            ->assertOk();

        $this->withToken($adminToken)
            ->patchJson("/api/campaign-creators/{$participation->id}", [
                'video_status' => 'revision',
                'delivery_status' => 'revision',
                'video_feedback' => 'Ajuste o gancho inicial.',
            ])
            ->assertOk();

        $this->withToken($adminToken)
            ->patchJson("/api/content-planning-items/{$planningItem->id}", [
                'video_status' => 'approved',
                'status' => 'approved',
            ])
            ->assertOk();

        $this->app['auth']->forgetGuards();

        $inbox = $this->withToken($creatorToken)
            ->getJson('/api/notifications')
            ->assertOk()
            ->json('data');

        $titles = array_column($inbox, 'title');
        $this->assertContains(__('auth.script_approved_title'), $titles);
        $this->assertContains(__('auth.material_revision_title'), $titles);
        $this->assertContains(__('auth.material_approved_title'), $titles);
        $this->assertNotContains('Vídeo enviado', $titles);
        $this->assertNotContains('Nova candidatura na Campanha Verão Aurora', $titles);

        foreach ($inbox as $notification) {
            $this->assertSame('creator', $notification['target_role']);
        }
    }
}
