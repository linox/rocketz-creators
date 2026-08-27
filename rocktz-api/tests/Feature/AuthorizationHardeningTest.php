<?php

namespace Tests\Feature;

use App\Enums\ApplicationStatus;
use App\Enums\CompanyStatus;
use App\Enums\ContentPlanningStatus;
use App\Enums\ContentType;
use App\Enums\DeliveryStatus;
use App\Enums\PostingProfile;
use App\Enums\StageApprovalStatus;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\ContentPlanningItem;
use App\Models\Creator;
use App\Models\RecurringContractCreator;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthorizationHardeningTest extends TestCase
{
    use RefreshDatabase;

    public function test_creator_cannot_approve_own_campaign_participation(): void
    {
        $creator = Creator::factory()->active()->create();
        $row = CampaignCreator::factory()->create([
            'creator_id' => $creator->id,
            'application_status' => ApplicationStatus::Pending,
            'amount' => 900,
        ]);

        $this->withToken($creator->user->createToken('auth')->plainTextToken)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'application_status' => ApplicationStatus::Approved->value,
                'amount' => 99999,
            ])
            ->assertForbidden();

        $this->assertSame(ApplicationStatus::Pending, $row->fresh()->application_status);
        $this->assertEquals(900, (float) $row->fresh()->amount);
    }

    public function test_creator_cannot_update_another_creators_participation(): void
    {
        $creator = Creator::factory()->active()->create();
        $row = CampaignCreator::factory()->create();

        $this->withToken($creator->user->createToken('auth')->plainTextToken)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'script' => 'Roteiro indevido',
                'script_status' => StageApprovalStatus::Submitted->value,
            ])
            ->assertForbidden();
    }

    public function test_company_cannot_update_another_companys_participation(): void
    {
        $company = Company::factory()->active()->create();
        $user = User::factory()->company()->create();
        CompanyUser::factory()->active()->create([
            'user_id' => $user->id,
            'company_id' => $company->id,
        ]);
        $row = CampaignCreator::factory()->create();

        $this->withToken($user->createToken('auth')->plainTextToken)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'application_status' => ApplicationStatus::Approved->value,
            ])
            ->assertForbidden();
    }

    public function test_creator_can_submit_own_script(): void
    {
        $creator = Creator::factory()->active()->create();
        $row = CampaignCreator::factory()->approved()->create([
            'creator_id' => $creator->id,
        ]);

        $this->withToken($creator->user->createToken('auth')->plainTextToken)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'script' => 'Roteiro enviado',
                'script_status' => StageApprovalStatus::Submitted->value,
                'delivery_status' => 'sent',
            ])
            ->assertOk()
            ->assertJsonPath('data.script_status', 'submitted');
    }

    public function test_creator_cannot_persist_javascript_published_link(): void
    {
        $creator = Creator::factory()->active()->create();
        $row = CampaignCreator::factory()->approved()->create([
            'creator_id' => $creator->id,
        ]);

        $this->withToken($creator->user->createToken('auth')->plainTextToken)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'published_link' => 'javascript:alert(1)',
            ])
            ->assertUnprocessable();
    }

    public function test_creator_cannot_update_or_see_private_company_data(): void
    {
        $creator = Creator::factory()->active()->create();
        $company = Company::factory()->active()->create([
            'observations' => 'nota interna secreta',
            'email' => 'financeiro@marca.test',
            'cnpj' => '12.345.678/0001-90',
        ]);
        $token = $creator->user->createToken('auth')->plainTextToken;

        $show = $this->withToken($token)->getJson("/api/companies/{$company->id}")->assertOk()->json('data');
        $this->assertArrayNotHasKey('email', $show);
        $this->assertArrayNotHasKey('cnpj', $show);
        $this->assertArrayNotHasKey('observations', $show);
        $this->assertArrayNotHasKey('users', $show);

        $this->withToken($token)
            ->patchJson("/api/companies/{$company->id}", ['name' => 'Marca invadida'])
            ->assertForbidden();

        $this->assertNotSame('Marca invadida', $company->fresh()->name);
    }

    public function test_creator_cannot_approve_own_planning_item(): void
    {
        $creator = Creator::factory()->active()->create();
        $item = ContentPlanningItem::factory()->create([
            'creator_id' => $creator->id,
            'status' => ContentPlanningStatus::Review,
        ]);
        RecurringContractCreator::factory()->create([
            'recurring_contract_id' => $item->recurring_contract_id,
            'creator_id' => $creator->id,
        ]);

        $this->withToken($creator->user->createToken('auth')->plainTextToken)
            ->patchJson("/api/content-planning-items/{$item->id}", [
                'status' => ContentPlanningStatus::Approved->value,
                'script_status' => StageApprovalStatus::Approved->value,
            ])
            ->assertForbidden();

        $this->assertSame(ContentPlanningStatus::Review, $item->fresh()->status);
    }

    public function test_company_cannot_delete_another_companys_planning_item(): void
    {
        $company = Company::factory()->active()->create();
        $user = User::factory()->company()->create();
        CompanyUser::factory()->active()->create([
            'user_id' => $user->id,
            'company_id' => $company->id,
        ]);
        $item = ContentPlanningItem::factory()->create();

        $this->withToken($user->createToken('auth')->plainTextToken)
            ->deleteJson("/api/content-planning-items/{$item->id}")
            ->assertForbidden();

        $this->assertDatabaseHas('content_planning_items', ['id' => $item->id]);
    }

    public function test_creator_cannot_send_published_link_when_campaign_posts_on_brand(): void
    {
        $creator = Creator::factory()->active()->create();
        $campaign = Campaign::factory()->create([
            'posting_profile' => PostingProfile::Brand,
        ]);
        $row = CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => $creator->id,
            'delivery_status' => DeliveryStatus::Approved,
        ]);

        $this->withToken($creator->user->createToken('auth')->plainTextToken)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'published_link' => 'https://instagram.com/reel/brand-post',
                'delivery_status' => DeliveryStatus::Published->value,
            ])
            ->assertForbidden();

        $this->assertNull($row->fresh()->content?->published_link);
    }

    public function test_company_can_send_published_link_when_campaign_posts_on_brand(): void
    {
        $company = Company::factory()->active()->create();
        $user = User::factory()->company()->create();
        CompanyUser::factory()->active()->create([
            'user_id' => $user->id,
            'company_id' => $company->id,
        ]);
        $campaign = Campaign::factory()->create([
            'company_id' => $company->id,
            'posting_profile' => PostingProfile::Brand,
        ]);
        $row = CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
            'delivery_status' => DeliveryStatus::Approved,
        ]);

        $this->withToken($user->createToken('auth')->plainTextToken)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'published_link' => 'https://instagram.com/reel/marca-oficial',
                'delivery_status' => DeliveryStatus::Published->value,
            ])
            ->assertOk()
            ->assertJsonPath('data.content.published_link', 'https://instagram.com/reel/marca-oficial')
            ->assertJsonPath('data.delivery_status', 'published');
    }

    public function test_creator_cannot_send_pauta_published_url_when_brand_posts(): void
    {
        $creator = Creator::factory()->active()->create();
        $item = ContentPlanningItem::factory()->create([
            'creator_id' => $creator->id,
            'status' => ContentPlanningStatus::Approved,
            'video_status' => StageApprovalStatus::Approved,
            'posting_profile' => PostingProfile::Brand,
        ]);
        RecurringContractCreator::factory()->create([
            'recurring_contract_id' => $item->recurring_contract_id,
            'creator_id' => $creator->id,
        ]);

        $this->withToken($creator->user->createToken('auth')->plainTextToken)
            ->patchJson("/api/content-planning-items/{$item->id}", [
                'published_url' => 'https://instagram.com/reel/marca-pauta',
            ])
            ->assertForbidden();

        $this->assertNull($item->fresh()->published_url);
    }

    public function test_creator_cannot_submit_script_before_pauta_briefing(): void
    {
        $creator = Creator::factory()->active()->create();
        $item = ContentPlanningItem::factory()->create([
            'creator_id' => $creator->id,
            'content_type' => ContentType::Reel,
            'title' => null,
            'briefing' => null,
            'briefing_note' => null,
            'briefing_fields' => null,
            'script' => null,
            'status' => ContentPlanningStatus::Planned,
            'script_status' => StageApprovalStatus::Pending,
        ]);
        RecurringContractCreator::factory()->create([
            'recurring_contract_id' => $item->recurring_contract_id,
            'creator_id' => $creator->id,
        ]);

        $this->withToken($creator->user->createToken('auth')->plainTextToken)
            ->patchJson("/api/content-planning-items/{$item->id}", [
                'script' => 'Hook e CTA do produto',
                'script_status' => StageApprovalStatus::Submitted->value,
            ])
            ->assertUnprocessable()
            ->assertJsonPath('message', __('auth.pauta_awaiting_briefing'));

        $this->assertNull($item->fresh()->script);
        $this->assertSame(StageApprovalStatus::Pending, $item->fresh()->script_status);
    }

    public function test_webhook_with_secret_rejects_unsigned_payload(): void
    {
        config(['services.resend.webhook_secret' => 'whsec_test_secret']);

        $this->postJson('/api/webhooks/resend', [
            'type' => 'email.delivered',
            'data' => ['email_id' => 're_abc'],
        ])->assertUnauthorized();
    }
}
