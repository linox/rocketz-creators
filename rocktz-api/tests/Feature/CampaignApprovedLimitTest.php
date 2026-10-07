<?php

namespace Tests\Feature;

use App\Enums\ApplicationStatus;
use App\Enums\CampaignStatus;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Creator;
use App\Models\CreatorContractAcceptance;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CampaignApprovedLimitTest extends TestCase
{
    use RefreshDatabase;

    public function test_campaign_closes_when_approved_people_reach_the_limit(): void
    {
        $campaign = $this->paidCampaign(1);
        $pending = CampaignCreator::factory()->pendingApplication()->create([
            'campaign_id' => $campaign->id,
            'amount' => 500,
        ]);
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/campaign-creators/{$pending->id}", [
                'application_status' => ApplicationStatus::Approved->value,
            ])
            ->assertOk()
            ->assertJsonPath('data.application_status', ApplicationStatus::Approved->value);

        $campaign->refresh();
        $this->assertSame(CampaignStatus::Finished, $campaign->status);

        $applicant = $this->applicant();
        $this->actingAs($applicant->user, 'sanctum')
            ->postJson("/api/campaigns/{$campaign->id}/apply", ['notes' => 'Quero participar'])
            ->assertForbidden()
            ->assertJsonPath('message', __('auth.campaign_approved_limit_full'));

        $available = $this->actingAs($applicant->user, 'sanctum')
            ->getJson('/api/campaigns/available')
            ->assertOk()
            ->json('data');
        $this->assertNull(collect($available)->firstWhere('id', $campaign->id));
    }

    public function test_undoing_an_approval_reopens_a_campaign_closed_by_the_limit(): void
    {
        $campaign = $this->paidCampaign(1);
        $approved = CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
            'amount' => 500,
        ]);
        $campaign->forceFill(['status' => CampaignStatus::Finished])->save();
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/campaign-creators/{$approved->id}", [
                'application_status' => ApplicationStatus::Rejected->value,
            ])
            ->assertOk();

        $campaign->refresh();
        $this->assertSame(CampaignStatus::Selection, $campaign->status);

        $applicant = $this->applicant();
        $this->actingAs($applicant->user, 'sanctum')
            ->postJson("/api/campaigns/{$campaign->id}/apply", ['notes' => 'Quero participar'])
            ->assertCreated();
    }

    public function test_approval_past_the_limit_is_rejected(): void
    {
        $campaign = $this->paidCampaign(1);
        CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
            'amount' => 500,
        ]);
        $pending = CampaignCreator::factory()->pendingApplication()->create([
            'campaign_id' => $campaign->id,
            'amount' => 500,
        ]);
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/campaign-creators/{$pending->id}", [
                'application_status' => ApplicationStatus::Approved->value,
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', __('auth.campaign_approved_limit_full'));

        $this->assertSame(ApplicationStatus::Pending, $pending->refresh()->application_status);
    }

    public function test_assigning_the_last_creator_closes_the_campaign(): void
    {
        $campaign = $this->paidCampaign(1);
        $creator = Creator::factory()->active()->create(['country' => 'BR']);
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/campaigns/{$campaign->id}/assign", [
                'creator_id' => $creator->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.application_status', ApplicationStatus::Approved->value);

        $this->assertSame(CampaignStatus::Finished, $campaign->refresh()->status);
    }

    public function test_barter_campaign_closes_when_the_approved_limit_is_reached(): void
    {
        $campaign = Campaign::factory()->create([
            'is_barter' => true,
            'is_secret' => false,
            'status' => CampaignStatus::Briefing,
            'total_budget' => 0,
            'creators_budget' => 0,
            'creator_cache' => 0,
            'max_approved_creators' => 1,
        ]);
        $pending = CampaignCreator::factory()->pendingApplication()->create([
            'campaign_id' => $campaign->id,
            'amount' => 0,
        ]);
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/campaign-creators/{$pending->id}", [
                'application_status' => ApplicationStatus::Approved->value,
            ])
            ->assertOk();

        $this->assertSame(CampaignStatus::Finished, $campaign->refresh()->status);
    }

    public function test_campaign_without_a_limit_stays_open_after_an_approval(): void
    {
        $campaign = $this->paidCampaign(null);
        $pending = CampaignCreator::factory()->pendingApplication()->create([
            'campaign_id' => $campaign->id,
            'amount' => 500,
        ]);
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/campaign-creators/{$pending->id}", [
                'application_status' => ApplicationStatus::Approved->value,
            ])
            ->assertOk();

        $this->assertSame(CampaignStatus::Briefing, $campaign->refresh()->status);
    }

    public function test_saving_a_limit_already_reached_closes_the_campaign(): void
    {
        $campaign = $this->paidCampaign(null);
        CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
            'amount' => 500,
        ]);
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/campaigns/{$campaign->id}", [
                'max_approved_creators' => 1,
            ])
            ->assertOk()
            ->assertJsonPath('data.max_approved_creators', 1)
            ->assertJsonPath('data.status', CampaignStatus::Finished->value)
            ->assertJsonPath('data.approved_creators_count', 1)
            ->assertJsonPath('data.accepting_applications', false);
    }

    public function test_company_can_create_a_campaign_with_an_approved_people_limit(): void
    {
        $company = Company::factory()->active()->create();
        $user = User::factory()->company()->create();
        CompanyUser::factory()->active()->create([
            'user_id' => $user->id,
            'company_id' => $company->id,
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/campaigns', [
                'name' => 'Campanha com vagas',
                'creator_cache' => 800,
                'total_budget' => 8000,
                'max_approved_creators' => 5,
            ])
            ->assertCreated()
            ->assertJsonPath('data.max_approved_creators', 5)
            ->assertJsonPath('data.status', CampaignStatus::PendingAgency->value);
    }

    private function paidCampaign(?int $limit): Campaign
    {
        return Campaign::factory()->create([
            'is_barter' => false,
            'is_secret' => false,
            'status' => CampaignStatus::Briefing,
            'total_budget' => 10000,
            ...Campaign::feeSplit(10000, 20),
            'creator_cache' => 800,
            'max_approved_creators' => $limit,
        ]);
    }

    private function applicant(): Creator
    {
        $creator = Creator::factory()->active()->create([
            'country' => 'BR',
        ]);
        CreatorContractAcceptance::factory()->valid()->create([
            'creator_id' => $creator->id,
            'full_name' => $creator->full_name,
            'email' => $creator->user?->email,
        ]);

        return $creator->load('user');
    }
}
