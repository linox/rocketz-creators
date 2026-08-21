<?php

namespace Tests\Feature;

use App\Enums\CampaignStatus;
use App\Enums\CreatorStatus;
use App\Enums\NotificationTargetRole;
use App\Enums\NotificationType;
use App\Enums\Permission;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\Company;
use App\Models\ContentPlanningItem;
use App\Models\Creator;
use App\Models\Notification;
use App\Models\RecurringContract;
use App\Models\RecurringContractCreator;
use App\Models\User;
use App\Services\PermissionService;
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
            ->assertJsonPath('data.name', 'Campanha Aurora')
            ->assertJsonPath('data.status', 'pending_agency');
    }

    public function test_privileged_company_user_creates_campaign_without_agency_approval(): void
    {
        $this->seed();

        $company = User::query()->where('email', 'empresa@rocketz.test')->firstOrFail();
        $company->companyUser()->update(['can_publish_without_approval' => true]);
        $token = $company->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/campaigns', ['name' => 'Campanha Direta', 'is_barter' => true])
            ->assertCreated()
            ->assertJsonPath('data.status', 'briefing');
    }

    public function test_company_cannot_self_approve_pending_campaign(): void
    {
        $this->seed();

        $company = User::query()->where('email', 'empresa@rocketz.test')->firstOrFail();
        $token = $company->createToken('auth')->plainTextToken;

        $id = $this->withToken($token)
            ->postJson('/api/campaigns', ['name' => 'Campanha Fila', 'is_barter' => true])
            ->assertCreated()
            ->json('data.id');

        $this->withToken($token)
            ->patchJson("/api/campaigns/{$id}", ['status' => 'briefing'])
            ->assertOk()
            ->assertJsonPath('data.status', 'pending_agency');
    }

    public function test_admin_approves_pending_campaign_and_creator_cannot_see_it_before(): void
    {
        $this->seed();

        $company = User::query()->where('email', 'empresa@rocketz.test')->firstOrFail();
        $companyToken = $company->createToken('auth')->plainTextToken;
        $id = $this->withToken($companyToken)
            ->postJson('/api/campaigns', ['name' => 'Campanha Revisão', 'is_barter' => true, 'is_secret' => false])
            ->assertCreated()
            ->json('data.id');

        $creator = User::query()->where('email', 'ana.creator@rocketz.test')->firstOrFail();
        $creatorToken = $creator->createToken('auth')->plainTextToken;
        $available = $this->withToken($creatorToken)->getJson('/api/campaigns/available')->assertOk()->json('data');
        $this->assertFalse(collect($available)->contains(fn ($row) => (int) $row['id'] === (int) $id));

        $admin = User::query()->where('email', 'admin@rocketz.test')->firstOrFail();
        $this->withoutToken()->actingAs($admin, 'sanctum')
            ->postJson("/api/campaigns/{$id}/approve-agency")
            ->assertOk()
            ->assertJsonPath('data.status', 'briefing');

        $availableAfter = $this->withToken($creatorToken)->getJson('/api/campaigns/available')->assertOk()->json('data');
        $this->assertTrue(collect($availableAfter)->contains(fn ($row) => (int) $row['id'] === (int) $id));
    }

    public function test_company_creates_recurring_pending_until_agency_or_privilege(): void
    {
        $this->seed();

        $company = User::query()->where('email', 'empresa@rocketz.test')->firstOrFail();
        $token = $company->createToken('auth')->plainTextToken;

        $id = $this->withToken($token)
            ->postJson('/api/recurring-contracts', ['title' => 'Contrato Fila', 'start_date' => now()->toDateString()])
            ->assertCreated()
            ->assertJsonPath('data.status', 'pending_agency')
            ->json('data.id');

        $this->withToken($token)
            ->patchJson("/api/recurring-contracts/{$id}", ['status' => 'active'])
            ->assertOk()
            ->assertJsonPath('data.status', 'pending_agency');

        $admin = User::query()->where('email', 'admin@rocketz.test')->firstOrFail();
        $this->withoutToken()->actingAs($admin, 'sanctum')
            ->postJson("/api/recurring-contracts/{$id}/approve-agency")
            ->assertOk()
            ->assertJsonPath('data.status', 'active');

        $company->companyUser()->update(['can_publish_without_approval' => true]);
        $company->unsetRelation('companyUser');
        $this->actingAs($company->fresh(['companyUser']), 'sanctum')
            ->postJson('/api/recurring-contracts', ['title' => 'Contrato Direto', 'start_date' => now()->toDateString()])
            ->assertCreated()
            ->assertJsonPath('data.status', 'active');
    }

    public function test_admin_can_toggle_company_user_publish_without_approval(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@rocketz.test')->firstOrFail();
        $company = User::query()->where('email', 'empresa@rocketz.test')->firstOrFail();
        $companyUser = $company->companyUser;

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/companies/{$companyUser->company_id}/users/{$companyUser->id}", [
                'can_publish_without_approval' => true,
            ])
            ->assertOk()
            ->assertJsonPath('data.can_publish_without_approval', true);
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
        $this->assertNotEmpty($campaigns->json('data.0.company.logo_url'));

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
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.country', 'BR')
            ->assertJsonPath('data.currency', 'BRL');
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
            ->assertJsonPath('data.company.logo_url', $contract->company?->logo_url)
            ->json('data');

        $this->assertNotEmpty($payload['company']['logo_url'] ?? null);
        $this->assertNotContains('Pauta secreta de outro criador', array_column($payload['items'], 'title'));
        $this->assertNotEmpty($payload['items']);
        $this->assertNotEmpty($payload['items'][0]['company']['logo_url'] ?? null);
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
            ->assertOk()
            ->assertJsonPath('data.video_feedback', 'Ajuste o gancho inicial.')
            ->assertJsonPath('data.content.revision_history.0.stage', 'video')
            ->assertJsonPath('data.content.revision_history.0.note', 'Ajuste o gancho inicial.');

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

    public function test_creator_is_notified_when_added_to_recurring_work_and_when_receiving_pauta(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@rocketz.test')->firstOrFail();
        $contract = RecurringContract::query()->where('title', 'Conteúdo mensal Aurora + Ana')->firstOrFail();
        $campaign = Campaign::query()->firstOrFail();
        $creator = Creator::factory()->active()->create();
        $adminToken = $admin->createToken('auth')->plainTextToken;
        $creatorToken = $creator->user->createToken('auth')->plainTextToken;

        $this->withToken($adminToken)
            ->postJson("/api/recurring-contracts/{$contract->id}/creators", [
                'creator_id' => $creator->id,
                'start_date' => now()->startOfMonth()->toDateString(),
                'monthly_deliverables' => ['reels' => 1],
            ])
            ->assertCreated();

        $this->app['auth']->forgetGuards();
        $inbox = $this->withToken($creatorToken)
            ->getJson('/api/notifications')
            ->assertOk()
            ->json('data');
        $titles = array_column($inbox, 'title');
        $this->assertContains(__('auth.recurring_assigned_title'), $titles);
        $this->assertSame(1, count(array_filter($titles, fn ($title) => $title === __('auth.recurring_assigned_title'))));

        $item = ContentPlanningItem::query()
            ->where('recurring_contract_id', $contract->id)
            ->where('creator_id', $creator->id)
            ->where('status', 'planned')
            ->firstOrFail();

        $this->app['auth']->forgetGuards();
        $this->withToken($adminToken)
            ->patchJson("/api/content-planning-items/{$item->id}", [
                'title' => 'Tutorial de produto',
                'briefing' => 'Fale dos 3 benefícios principais.',
            ])
            ->assertOk();

        $this->app['auth']->forgetGuards();
        $this->withToken($adminToken)
            ->postJson("/api/recurring-contracts/{$contract->id}/items", [
                'creator_id' => $creator->id,
                'month' => now()->format('Y-m'),
                'content_type' => 'post',
                'title' => 'Post da semana',
                'briefing' => 'Mostre o produto no feed.',
                'planned_date' => now()->toDateString(),
            ])
            ->assertCreated();

        $this->app['auth']->forgetGuards();
        $this->withToken($adminToken)
            ->patchJson("/api/content-planning-items/{$item->id}", [
                'briefing' => 'Atualize o gancho inicial.',
            ])
            ->assertOk();

        $this->app['auth']->forgetGuards();
        $this->withToken($adminToken)
            ->postJson("/api/recurring-contracts/{$contract->id}/creators", [
                'creator_id' => $creator->id,
                'monthly_cache' => 800,
            ])
            ->assertCreated();

        $this->app['auth']->forgetGuards();
        $this->withToken($adminToken)
            ->postJson("/api/campaigns/{$campaign->id}/assign", [
                'creator_id' => $creator->id,
            ])
            ->assertCreated();

        $this->app['auth']->forgetGuards();
        $inbox = $this->withToken($creatorToken)
            ->getJson('/api/notifications')
            ->assertOk()
            ->json('data');
        $titles = array_column($inbox, 'title');

        $this->assertContains(__('auth.pauta_ready_title'), $titles);
        $this->assertSame(2, count(array_filter($titles, fn ($title) => $title === __('auth.pauta_ready_title'))));
        $this->assertSame(1, count(array_filter($titles, fn ($title) => $title === __('auth.recurring_assigned_title'))));
        $this->assertContains(__('auth.campaign_assigned_title'), $titles);

        foreach ($inbox as $notification) {
            $this->assertSame('creator', $notification['target_role']);
        }
    }

    public function test_recurring_pauta_accepts_structured_briefing_and_published_url_after_approval(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@rocketz.test')->firstOrFail();
        $ana = User::query()->where('email', 'ana.creator@rocketz.test')->firstOrFail();
        $contract = RecurringContract::query()->where('title', 'Conteúdo mensal Aurora + Ana')->firstOrFail();
        $adminToken = $admin->createToken('auth')->plainTextToken;
        $creatorToken = $ana->createToken('auth')->plainTextToken;

        $created = $this->withToken($adminToken)
            ->postJson("/api/recurring-contracts/{$contract->id}/items", [
                'creator_id' => $ana->creator->id,
                'month' => now()->format('Y-m'),
                'content_type' => 'reel',
                'title' => 'Reels de rotina',
                'planned_date' => now()->toDateString(),
                'briefing_fields' => [
                    'product' => 'Sérum Aurora Glow',
                    'key_message' => 'Pele iluminada em 7 dias.',
                    'must_have' => 'Mostrar a embalagem nos primeiros 3 segundos.',
                    'donts' => 'Não citar concorrentes.',
                    'cta' => 'Link na bio',
                    'hashtags' => '#AuroraGlow',
                ],
            ])
            ->assertCreated()
            ->json('data');

        $this->assertSame('Sérum Aurora Glow', $created['briefing_fields']['product']);
        $this->assertStringContainsString('Sérum Aurora Glow', (string) $created['briefing']);

        $itemId = $created['id'];
        $this->app['auth']->forgetGuards();
        $this->withToken($adminToken)
            ->patchJson("/api/content-planning-items/{$itemId}", [
                'video_status' => 'approved',
                'status' => 'approved',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $this->app['auth']->forgetGuards();
        $this->withToken($creatorToken)
            ->patchJson("/api/content-planning-items/{$itemId}", [
                'published_url' => 'https://instagram.com/reel/aurora-glow',
            ])
            ->assertOk()
            ->assertJsonPath('data.published_url', 'https://instagram.com/reel/aurora-glow')
            ->assertJsonPath('data.status', 'published');
    }

    public function test_admin_can_list_all_users_and_manage_permissions(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@rocketz.test')->firstOrFail();
        $token = $admin->createToken('auth')->plainTextToken;
        $company = Company::query()->firstOrFail();

        $this->withToken($token)
            ->getJson('/api/users')
            ->assertOk()
            ->assertJsonStructure(['data' => [['id', 'name', 'email', 'role', 'permissions']]]);

        $created = $this->withToken($token)
            ->postJson('/api/users', [
                'name' => 'Ops Rocketz',
                'email' => 'ops@rocketz.test',
                'password' => 'password',
                'role' => 'admin',
                'permissions' => ['users.manage', 'creators.moderate'],
            ])
            ->assertCreated()
            ->json('data');

        $this->assertEqualsCanonicalizing(['users.manage', 'creators.moderate'], $created['permissions']);

        $this->withToken($token)
            ->patchJson("/api/users/{$created['id']}", [
                'permissions' => ['creators.moderate'],
            ])
            ->assertOk()
            ->assertJsonPath('data.permissions', ['creators.moderate']);

        $companyUser = $this->withToken($token)
            ->postJson('/api/users', [
                'name' => 'Editor Empresa',
                'email' => 'editor.empresa@rocketz.test',
                'password' => 'password',
                'role' => 'company',
                'company_id' => $company->id,
                'permissions' => ['campaigns.publish_without_approval'],
            ])
            ->assertCreated()
            ->json('data');

        $this->assertTrue($companyUser['can_publish_without_approval']);
        $this->assertContains('campaigns.publish_without_approval', $companyUser['permissions']);

        $this->withToken($token)
            ->deleteJson("/api/users/{$created['id']}")
            ->assertOk();
    }

    public function test_admin_without_users_manage_cannot_list_users(): void
    {
        $this->seed();

        $limited = User::factory()->admin()->create(['email' => 'limited@rocketz.test']);
        app(PermissionService::class)->sync($limited, [Permission::CreatorsModerate->value]);
        $token = $limited->createToken('auth')->plainTextToken;

        $this->withToken($token)->getJson('/api/users')->assertForbidden();

        $bruno = Creator::query()->where('status', CreatorStatus::Review)->firstOrFail();
        $this->withToken($token)
            ->postJson("/api/creators/{$bruno->id}/approve")
            ->assertOk();
    }

    public function test_admin_cannot_remove_own_users_manage_permission(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@rocketz.test')->firstOrFail();
        $token = $admin->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->patchJson("/api/users/{$admin->id}", [
                'permissions' => [Permission::CreatorsModerate->value],
            ])
            ->assertStatus(422);
    }

    public function test_campaign_and_recurring_inherit_company_currency(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@rocketz.test')->firstOrFail();
        $token = $admin->createToken('auth')->plainTextToken;

        $company = Company::factory()->active()->create([
            'name' => 'Marca México',
            'country' => 'MX',
            'currency' => 'MXN',
        ]);

        $campaign = $this->withToken($token)
            ->postJson('/api/campaigns', [
                'name' => 'Campanha MXN',
                'company_id' => $company->id,
                'is_barter' => true,
            ])
            ->assertCreated()
            ->json('data');

        $this->assertSame('MXN', $campaign['currency']);
        $this->assertSame('MX', $campaign['company']['country']);

        $recurring = $this->withToken($token)
            ->postJson('/api/recurring-contracts', [
                'title' => 'Retainer MXN',
                'company_id' => $company->id,
                'monthly_fee' => 1500,
                'start_date' => now()->toDateString(),
            ])
            ->assertCreated()
            ->json('data');

        $this->assertSame('MXN', $recurring['currency']);
    }

    public function test_sync_currencies_converts_existing_campaigns_to_company_currency(): void
    {
        $company = Company::factory()->active()->create([
            'country' => 'MX',
            'currency' => 'MXN',
        ]);

        $campaign = Campaign::query()->create([
            'company_id' => $company->id,
            'name' => 'Campanha em BRL',
            'total_budget' => 5450,
            'agency_fee' => 545,
            'creators_budget' => 4905,
            'creator_cache' => 4905,
            'currency' => 'BRL',
            'status' => CampaignStatus::Briefing,
            'is_barter' => true,
        ]);

        $this->artisan('geo:sync-currencies')->assertSuccessful();

        $campaign->refresh();
        $this->assertSame('MXN', $campaign->currency);
        $this->assertSame(18600.0, (float) $campaign->total_budget);
        $this->assertSame(1860.0, (float) $campaign->agency_fee);
    }

    public function test_sync_currencies_can_treat_existing_amounts_as_brl(): void
    {
        $company = Company::factory()->active()->create([
            'country' => 'MX',
            'currency' => 'MXN',
        ]);

        $campaign = Campaign::query()->create([
            'company_id' => $company->id,
            'name' => 'Já marcada MXN',
            'total_budget' => 5450,
            'agency_fee' => 0,
            'creators_budget' => 5450,
            'creator_cache' => 5450,
            'currency' => 'MXN',
            'status' => CampaignStatus::Briefing,
            'is_barter' => true,
        ]);

        $this->artisan('geo:sync-currencies', ['--from' => 'BRL'])->assertSuccessful();

        $campaign->refresh();
        $this->assertSame('MXN', $campaign->currency);
        $this->assertSame(18600.0, (float) $campaign->total_budget);
    }

    public function test_creator_only_sees_campaigns_from_own_country_unless_unlocked(): void
    {
        $this->seed();

        $admin = User::query()->where('email', 'admin@rocketz.test')->firstOrFail();
        $adminToken = $admin->createToken('auth')->plainTextToken;

        $foreign = Company::factory()->active()->create([
            'name' => 'US Brand',
            'country' => 'US',
            'currency' => 'USD',
        ]);
        $this->assertSame('US', $foreign->fresh()->country);

        $campaign = Campaign::query()->create([
            'company_id' => $foreign->id,
            'name' => 'US Only Campaign',
            'is_barter' => true,
            'is_secret' => false,
            'status' => CampaignStatus::Briefing,
            'currency' => 'USD',
            'creator_cache' => 0,
        ]);
        $campaignId = $campaign->id;

        $creator = User::query()->where('email', 'ana.creator@rocketz.test')->firstOrFail();
        $creator->load('creator');
        $this->assertFalse($creator->creator->canAccessAllCountries());
        $this->assertSame('BR', $creator->creator->countryCode());
        $creatorToken = $creator->createToken('auth')->plainTextToken;

        $available = $this->withToken($creatorToken)->getJson('/api/campaigns/available')->assertOk()->json('data');
        $this->assertFalse(collect($available)->contains(fn ($row) => (int) $row['id'] === (int) $campaignId));

        $this->withToken($creatorToken)
            ->postJson("/api/campaigns/{$campaignId}/apply", ['notes' => 'Quero participar'])
            ->assertForbidden()
            ->assertJsonPath('message', __('auth.campaign_country_restricted'));

        $this->app['auth']->forgetGuards();
        $this->withToken($adminToken)
            ->patchJson("/api/creators/{$creator->creator->id}", ['can_access_all_countries' => true])
            ->assertOk()
            ->assertJsonPath('data.can_access_all_countries', true);

        $this->app['auth']->forgetGuards();
        $availableAfter = $this->withToken($creatorToken)->getJson('/api/campaigns/available')->assertOk()->json('data');
        $this->assertTrue(collect($availableAfter)->contains(fn ($row) => (int) $row['id'] === (int) $campaignId));
    }
}
