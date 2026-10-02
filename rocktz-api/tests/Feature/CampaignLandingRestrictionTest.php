<?php

namespace Tests\Feature;

use App\Enums\CampaignStatus;
use App\Enums\LandingSignupStatus;
use App\Models\Campaign;
use App\Models\Company;
use App\Models\CompanyLandingPage;
use App\Models\CompanyLandingSignup;
use App\Models\CompanyUser;
use App\Models\Creator;
use App\Models\CreatorContractAcceptance;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CampaignLandingRestrictionTest extends TestCase
{
    use RefreshDatabase;

    public function test_landing_restricted_campaign_is_hidden_from_unrelated_creators(): void
    {
        $campaign = $this->restrictedCampaign();
        $outsider = $this->applicant();
        $token = $outsider->user->createToken('auth')->plainTextToken;

        $available = $this->withToken($token)->getJson('/api/campaigns/available')->assertOk()->json('data');
        $this->assertFalse(collect($available)->contains(fn ($row) => (int) $row['id'] === $campaign->id));

        $this->withToken($token)
            ->getJson("/api/campaigns/{$campaign->id}")
            ->assertForbidden()
            ->assertJsonPath('message', __('auth.campaign_landing_restricted'));

        $this->withToken($token)
            ->postJson("/api/campaigns/{$campaign->id}/apply", ['notes' => 'Quero participar'])
            ->assertForbidden()
            ->assertJsonPath('message', __('auth.campaign_landing_restricted'));
    }

    public function test_landing_restricted_campaign_is_visible_to_landing_and_invite_creators(): void
    {
        $campaign = $this->restrictedCampaign();
        $page = CompanyLandingPage::factory()->create([
            'company_id' => $campaign->company_id,
        ]);

        $fromLanding = $this->applicant();
        CompanyLandingSignup::query()->create([
            'company_id' => $campaign->company_id,
            'company_landing_page_id' => $page->id,
            'creator_id' => $fromLanding->id,
            'status' => LandingSignupStatus::Approved,
        ]);

        $fromInvite = $this->applicant(['invited_by_company_id' => $campaign->company_id]);

        foreach ([$fromLanding, $fromInvite] as $creator) {
            $token = $creator->user->createToken('auth')->plainTextToken;
            $available = $this->withToken($token)->getJson('/api/campaigns/available')->assertOk()->json('data');
            $this->assertTrue(collect($available)->contains(fn ($row) => (int) $row['id'] === $campaign->id));

            $this->withToken($token)
                ->postJson("/api/campaigns/{$campaign->id}/apply", ['notes' => 'Quero participar'])
                ->assertCreated();
        }
    }

    public function test_campaign_can_target_one_landing_and_origin_can_be_set_manually(): void
    {
        $campaign = $this->restrictedCampaign();
        $page = CompanyLandingPage::factory()->create([
            'company_id' => $campaign->company_id,
            'display_name' => 'Estrelas da Cricut',
        ]);
        $otherPage = CompanyLandingPage::factory()->create([
            'company_id' => $campaign->company_id,
            'display_name' => 'Cricut Brasil',
        ]);
        $campaign->update([
            'company_landing_page_id' => $page->id,
            'restrict_to_landing' => true,
        ]);

        $fromPage = $this->applicant();
        CompanyLandingSignup::query()->create([
            'company_id' => $campaign->company_id,
            'company_landing_page_id' => $page->id,
            'creator_id' => $fromPage->id,
            'status' => LandingSignupStatus::Approved,
        ]);
        $fromOtherPage = $this->applicant();
        CompanyLandingSignup::query()->create([
            'company_id' => $campaign->company_id,
            'company_landing_page_id' => $otherPage->id,
            'creator_id' => $fromOtherPage->id,
            'status' => LandingSignupStatus::Approved,
        ]);
        $fromInvite = $this->applicant(['invited_by_company_id' => $campaign->company_id]);
        $outsider = $this->applicant();

        $this->assertTrue($this->seesCampaign($fromPage, $campaign));
        $this->assertFalse($this->seesCampaign($fromOtherPage, $campaign));
        $this->assertFalse($this->seesCampaign($fromInvite, $campaign));
        $this->assertFalse($this->seesCampaign($outsider, $campaign));

        $admin = User::factory()->admin()->create();
        $this->asUser($admin)
            ->postJson("/api/creators/{$outsider->id}/landing-origins", [
                'company_landing_page_id' => $page->id,
            ])
            ->assertOk()
            ->assertJsonPath('data.landing_origins.0.landing.display_name', 'Estrelas da Cricut');

        $this->assertTrue($this->seesCampaign($outsider, $campaign));

        $signupId = CompanyLandingSignup::query()
            ->where('creator_id', $outsider->id)
            ->where('company_landing_page_id', $page->id)
            ->value('id');
        $this->asUser($admin)
            ->deleteJson("/api/creators/{$outsider->id}/landing-origins/{$signupId}")
            ->assertOk();
        $this->assertFalse($this->seesCampaign($outsider, $campaign));

        $companyUser = User::factory()->company()->create();
        CompanyUser::factory()->active()->create([
            'user_id' => $companyUser->id,
            'company_id' => $campaign->company_id,
        ]);
        $this->asUser($companyUser)
            ->postJson("/api/creators/{$fromInvite->id}/landing-origins", [
                'company_landing_page_id' => $page->id,
            ])
            ->assertOk();
        $this->assertTrue($this->seesCampaign($fromInvite, $campaign));

        $otherCompany = Company::factory()->active()->create();
        $otherPageCompany = CompanyLandingPage::factory()->create(['company_id' => $otherCompany->id]);
        $this->asUser($companyUser)
            ->postJson("/api/creators/{$fromInvite->id}/landing-origins", [
                'company_landing_page_id' => $otherPageCompany->id,
            ])
            ->assertForbidden();

        $this->asUser($admin)
            ->patchJson("/api/campaigns/{$campaign->id}", [
                'company_landing_page_id' => $otherPageCompany->id,
            ])
            ->assertStatus(422);
    }

    private function seesCampaign(Creator $creator, Campaign $campaign): bool
    {
        $available = $this->asUser($creator->user)
            ->getJson('/api/campaigns/available')
            ->assertOk()
            ->json('data');

        return collect($available)->contains(fn ($row) => (int) $row['id'] === $campaign->id);
    }

    private function asUser(User $user): static
    {
        $this->flushHeaders();
        $this->app['auth']->forgetGuards();

        return $this->withToken($user->createToken('auth')->plainTextToken);
    }

    private function restrictedCampaign(): Campaign
    {
        return Campaign::factory()->create([
            'is_barter' => true,
            'is_secret' => false,
            'restrict_to_landing' => true,
            'status' => CampaignStatus::Briefing,
        ]);
    }

    /**
     * @param  array<string, mixed>  $attrs
     */
    private function applicant(array $attrs = []): Creator
    {
        $creator = Creator::factory()->active()->create([
            'country' => 'BR',
            ...$attrs,
        ]);
        CreatorContractAcceptance::factory()->valid()->create([
            'creator_id' => $creator->id,
            'full_name' => $creator->full_name,
            'email' => $creator->user?->email,
        ]);

        return $creator->load('user');
    }
}
