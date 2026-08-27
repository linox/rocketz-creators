<?php

namespace Tests\Feature;

use App\Enums\CampaignStatus;
use App\Enums\CompanyStatus;
use App\Enums\CreatorStatus;
use App\Enums\LandingPageStatus;
use App\Enums\LandingSignupStatus;
use App\Models\Campaign;
use App\Models\Company;
use App\Models\CompanyLandingPage;
use App\Models\CompanyLandingSignup;
use App\Models\Creator;
use App\Models\CreatorContractAcceptance;
use App\Models\Notification;
use App\Models\RecurringContract;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CompanyLandingTest extends TestCase
{
    use RefreshDatabase;

    public function test_company_can_create_and_publish_landing_page(): void
    {
        $this->seed();

        $companyUser = User::query()->where('email', 'empresa@rocketz.test')->firstOrFail();
        $company = $companyUser->company;
        $token = $companyUser->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->getJson("/api/companies/{$company->id}/landing")
            ->assertOk()
            ->assertJsonPath('data.company_id', $company->id)
            ->assertJsonPath('data.status', LandingPageStatus::Draft->value);

        $this->withToken($token)
            ->patchJson("/api/companies/{$company->id}/landing", [
                'slug' => 'cricut',
                'display_name' => 'Cricut',
                'title' => 'Faça parte dos creators da Cricut',
                'description' => 'Cadastre seu perfil no Creatorz by Rocketz.',
                'cta_text' => 'Quero me cadastrar',
                'primary_color' => '#00A3E0',
                'button_color' => '#00A3E0',
                'logo_url' => 'https://example.com/logo.png',
                'banner_url' => 'https://example.com/banner.jpg',
            ])
            ->assertOk()
            ->assertJsonPath('data.slug', 'cricut')
            ->assertJsonPath('data.display_name', 'Cricut')
            ->assertJsonPath('data.logo_url', 'https://example.com/logo.png')
            ->assertJsonPath('data.banner_url', 'https://example.com/banner.jpg');

        $this->withToken($token)
            ->patchJson("/api/companies/{$company->id}/landing", [
                'banner_url' => 'https://example.com/banner-v2.jpg',
            ])
            ->assertOk()
            ->assertJsonPath('data.banner_url', 'https://example.com/banner-v2.jpg')
            ->assertJsonPath('data.logo_url', 'https://example.com/logo.png');

        $this->withToken($token)
            ->postJson("/api/companies/{$company->id}/landing/publish")
            ->assertOk()
            ->assertJsonPath('data.status', LandingPageStatus::Published->value);

        $this->getJson('/api/landings/cricut')
            ->assertOk()
            ->assertJsonPath('data.slug', 'cricut')
            ->assertJsonMissingPath('data.metrics');
    }

    public function test_slug_must_be_unique_and_cannot_be_reserved(): void
    {
        $this->seed();

        $companyUser = User::query()->where('email', 'empresa@rocketz.test')->firstOrFail();
        $company = $companyUser->company;
        $token = $companyUser->createToken('auth')->plainTextToken;

        $other = Company::factory()->active()->create();
        CompanyLandingPage::factory()->published()->create([
            'company_id' => $other->id,
            'slug' => 'marca-y',
            'display_name' => $other->name,
        ]);

        $this->withToken($token)->getJson("/api/companies/{$company->id}/landing")->assertOk();

        $this->withToken($token)
            ->patchJson("/api/companies/{$company->id}/landing", ['slug' => 'login'])
            ->assertUnprocessable();

        $this->withToken($token)
            ->patchJson("/api/companies/{$company->id}/landing", ['slug' => 'marca-y'])
            ->assertUnprocessable();
    }

    public function test_unpublished_landing_is_not_public(): void
    {
        $this->seed();

        $companyUser = User::query()->where('email', 'empresa@rocketz.test')->firstOrFail();
        $company = $companyUser->company;
        $token = $companyUser->createToken('auth')->plainTextToken;

        $this->withToken($token)->getJson("/api/companies/{$company->id}/landing")->assertOk();
        $this->withToken($token)
            ->patchJson("/api/companies/{$company->id}/landing", ['slug' => 'rascunho-marca'])
            ->assertOk();

        $this->getJson('/api/landings/rascunho-marca')->assertNotFound();
    }

    public function test_creator_register_via_landing_creates_company_review_without_global_ownership(): void
    {
        $this->seed();

        $companyUser = User::query()->where('email', 'empresa@rocketz.test')->firstOrFail();
        $company = $companyUser->company;
        $page = CompanyLandingPage::factory()->published()->create([
            'company_id' => $company->id,
            'slug' => 'cricut',
            'display_name' => 'Cricut',
        ]);

        $this->postJson('/api/auth/register/creator', [
            'full_name' => 'Ana Landing',
            'artistic_name' => 'analanding',
            'email' => 'ana.landing@example.com',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
            'whatsapp' => '11999999999',
            'city' => 'São Paulo',
            'state' => 'SP',
            'instagram' => 'analanding',
            'landing_slug' => 'cricut',
            'lgpd_accepted' => true,
        ])->assertCreated()
            ->assertJsonPath('user.creator.status', CreatorStatus::Review->value);

        $creator = Creator::query()->where('artistic_name', 'analanding')->firstOrFail();

        $this->assertDatabaseHas('company_landing_signups', [
            'company_id' => $company->id,
            'creator_id' => $creator->id,
            'company_landing_page_id' => $page->id,
            'status' => LandingSignupStatus::Pending->value,
        ]);

        $this->assertNull($creator->invited_by_company_id);
        $this->assertSame(1, $page->fresh()->signups_completed_count);
        $this->assertTrue(
            Notification::query()->where('user_id', $companyUser->id)->where('creator_id', $creator->id)->exists()
        );

        $companyToken = $companyUser->createToken('auth')->plainTextToken;
        $this->withToken($companyToken)
            ->getJson("/api/companies/{$company->id}/landing/signups")
            ->assertOk()
            ->assertJsonPath('data.0.creator.artistic_name', 'analanding')
            ->assertJsonPath('data.0.status', LandingSignupStatus::Pending->value);

        $signupId = CompanyLandingSignup::query()->where('creator_id', $creator->id)->value('id');

        $this->withToken($companyToken)
            ->patchJson("/api/companies/{$company->id}/landing/signups/{$signupId}", [
                'status' => LandingSignupStatus::Approved->value,
            ])
            ->assertOk()
            ->assertJsonPath('data.status', LandingSignupStatus::Approved->value);

        $this->assertSame(CreatorStatus::Review, $creator->fresh()->status);
        $this->assertSame(LandingSignupStatus::Approved, CompanyLandingSignup::query()->find($signupId)?->status);

        $this->withToken($companyToken)
            ->getJson("/api/creators/{$creator->id}")
            ->assertOk()
            ->assertJsonPath('data.can_moderate', true);

        $this->withToken($companyToken)
            ->postJson("/api/creators/{$creator->id}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', CreatorStatus::Active->value);

        $this->assertSame(CreatorStatus::Active, $creator->fresh()->status);
    }

    public function test_existing_creator_can_claim_landing_without_duplicating_profile(): void
    {
        $this->seed();

        $companyUser = User::query()->where('email', 'empresa@rocketz.test')->firstOrFail();
        $company = $companyUser->company;
        CompanyLandingPage::factory()->published()->create([
            'company_id' => $company->id,
            'slug' => 'cricut',
            'display_name' => 'Cricut',
        ]);

        $creatorUser = User::query()->where('email', 'ana.creator@rocketz.test')->firstOrFail();
        $token = $creatorUser->createToken('auth')->plainTextToken;
        $creatorId = $creatorUser->creator->id;

        $this->withToken($token)
            ->postJson('/api/landings/cricut/claim')
            ->assertOk()
            ->assertJsonPath('data.creator_id', $creatorId)
            ->assertJsonPath('data.status', LandingSignupStatus::Pending->value);

        $this->withToken($token)
            ->postJson('/api/landings/cricut/claim')
            ->assertOk();

        $this->assertSame(1, CompanyLandingSignup::query()->where('creator_id', $creatorId)->count());
        $this->assertSame(1, Creator::query()->where('id', $creatorId)->count());
    }

    public function test_company_cannot_see_another_company_landing_signups(): void
    {
        $this->seed();

        $companyUser = User::query()->where('email', 'empresa@rocketz.test')->firstOrFail();
        $other = Company::factory()->active()->create();
        $page = CompanyLandingPage::factory()->published()->create([
            'company_id' => $other->id,
            'slug' => 'outra-marca',
            'display_name' => $other->name,
        ]);
        $creator = Creator::factory()->active()->create();
        CompanyLandingSignup::query()->create([
            'company_id' => $other->id,
            'company_landing_page_id' => $page->id,
            'creator_id' => $creator->id,
            'status' => LandingSignupStatus::Pending,
        ]);

        $token = $companyUser->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->getJson("/api/companies/{$other->id}/landing/signups")
            ->assertForbidden();
    }

    public function test_company_rejection_does_not_change_global_creator(): void
    {
        $this->seed();

        $companyUser = User::query()->where('email', 'empresa@rocketz.test')->firstOrFail();
        $company = $companyUser->company;
        $page = CompanyLandingPage::factory()->published()->create([
            'company_id' => $company->id,
            'slug' => 'cricut',
            'display_name' => 'Cricut',
        ]);
        $creator = Creator::factory()->active()->create(['artistic_name' => 'GlobalAna']);
        $signup = CompanyLandingSignup::query()->create([
            'company_id' => $company->id,
            'company_landing_page_id' => $page->id,
            'creator_id' => $creator->id,
            'status' => LandingSignupStatus::Pending,
        ]);

        $token = $companyUser->createToken('auth')->plainTextToken;
        $this->withToken($token)
            ->patchJson("/api/companies/{$company->id}/landing/signups/{$signup->id}", [
                'status' => LandingSignupStatus::Rejected->value,
            ])
            ->assertOk();

        $this->assertSame(CreatorStatus::Active, $creator->fresh()->status);
        $this->assertSame(CompanyStatus::Active, $company->fresh()->status);
    }

    public function test_public_events_increment_metrics(): void
    {
        $this->seed();

        $companyUser = User::query()->where('email', 'empresa@rocketz.test')->firstOrFail();
        $page = CompanyLandingPage::factory()->published()->create([
            'company_id' => $companyUser->company->id,
            'slug' => 'cricut',
            'display_name' => 'Cricut',
        ]);

        $this->postJson('/api/landings/cricut/events', ['event' => 'view'])->assertOk();
        $this->postJson('/api/landings/cricut/events', ['event' => 'cta_click'])->assertOk();
        $this->postJson('/api/landings/cricut/events', ['event' => 'signup_started'])->assertOk();

        $page->refresh();
        $this->assertSame(1, $page->views_count);
        $this->assertSame(1, $page->cta_clicks_count);
        $this->assertSame(1, $page->signups_started_count);
    }

    public function test_disable_hides_public_landing(): void
    {
        $this->seed();

        $companyUser = User::query()->where('email', 'empresa@rocketz.test')->firstOrFail();
        $company = $companyUser->company;
        $token = $companyUser->createToken('auth')->plainTextToken;
        CompanyLandingPage::factory()->published()->create([
            'company_id' => $company->id,
            'slug' => 'cricut',
            'display_name' => 'Cricut',
        ]);

        $this->getJson('/api/landings/cricut')->assertOk();

        $this->withToken($token)
            ->postJson("/api/companies/{$company->id}/landing/disable")
            ->assertOk()
            ->assertJsonPath('data.status', LandingPageStatus::Disabled->value);

        $this->getJson('/api/landings/cricut')->assertNotFound();
    }

    public function test_company_sees_landing_creators_in_catalog_but_not_global_ones(): void
    {
        $this->seed();

        $companyUser = User::query()->where('email', 'empresa@rocketz.test')->firstOrFail();
        $company = $companyUser->company;
        $token = $companyUser->createToken('auth')->plainTextToken;
        $page = CompanyLandingPage::factory()->published()->create([
            'company_id' => $company->id,
            'slug' => 'cricut',
            'display_name' => 'Cricut',
        ]);

        $landingCreator = Creator::factory()->review()->create(['artistic_name' => 'Landing Pool']);
        $globalCreator = Creator::factory()->active()->create(['artistic_name' => 'Global Pool']);
        CompanyLandingSignup::query()->create([
            'company_id' => $company->id,
            'company_landing_page_id' => $page->id,
            'creator_id' => $landingCreator->id,
            'status' => LandingSignupStatus::Pending,
        ]);

        $this->withToken($token)->getJson('/api/creators')->assertOk()
            ->assertJsonFragment(['artistic_name' => 'Landing Pool'])
            ->assertJsonMissing(['artistic_name' => 'Global Pool'])
            ->assertJsonMissing(['artistic_name' => 'Ana UGC']);

        $this->withToken($token)
            ->getJson("/api/creators/{$landingCreator->id}")
            ->assertOk()
            ->assertJsonPath('data.artistic_name', 'Landing Pool');

        $this->withToken($token)
            ->getJson("/api/creators/{$globalCreator->id}")
            ->assertForbidden()
            ->assertJsonPath('message', __('auth.profile_unavailable'));
    }

    public function test_global_creator_can_see_and_apply_to_company_campaign_and_company_can_open_applicant_profile(): void
    {
        $this->seed();

        $companyUser = User::query()->where('email', 'empresa@rocketz.test')->firstOrFail();
        $company = $companyUser->company;
        $ana = User::query()->where('email', 'ana.creator@rocketz.test')->firstOrFail();
        $campaign = Campaign::query()
            ->where('company_id', $company->id)
            ->where('is_secret', false)
            ->whereNotIn('status', [CampaignStatus::Finished, CampaignStatus::PendingAgency])
            ->firstOrFail();

        $available = $this->actingAs($ana)
            ->getJson('/api/campaigns/available')
            ->assertOk()
            ->json('data');
        $this->assertTrue(collect($available)->contains(fn ($row) => (int) $row['id'] === (int) $campaign->id));

        $creator = Creator::factory()->active()->create([
            'artistic_name' => 'Fora Da Landing',
            'country' => $company->country ?: 'BR',
        ]);
        CreatorContractAcceptance::factory()->valid()->create([
            'creator_id' => $creator->id,
            'full_name' => $creator->full_name,
            'email' => $creator->user?->email,
        ]);

        $this->actingAs($creator->user)
            ->postJson("/api/campaigns/{$campaign->id}/apply", ['notes' => 'Quero participar'])
            ->assertCreated();

        $this->assertDatabaseHas('campaign_creators', [
            'campaign_id' => $campaign->id,
            'creator_id' => $creator->id,
        ]);

        $this->actingAs($companyUser)->getJson('/api/creators')->assertOk()
            ->assertJsonMissing(['artistic_name' => 'Fora Da Landing']);

        $this->actingAs($companyUser)
            ->getJson("/api/creators/{$creator->id}")
            ->assertOk()
            ->assertJsonPath('data.artistic_name', 'Fora Da Landing');
    }

    public function test_company_cannot_attach_global_creator_to_recurring_contract(): void
    {
        $this->seed();

        $companyUser = User::query()->where('email', 'empresa@rocketz.test')->firstOrFail();
        $contract = RecurringContract::query()->where('company_id', $companyUser->companyUser?->company_id)->firstOrFail();
        $outsider = Creator::factory()->active()->create(['artistic_name' => 'Fora Do Pool']);

        $this->withToken($companyUser->createToken('auth')->plainTextToken)
            ->postJson("/api/recurring-contracts/{$contract->id}/creators", [
                'creator_id' => $outsider->id,
            ])
            ->assertForbidden()
            ->assertJsonPath('message', __('auth.creator_not_in_company_pool'));
    }
}
