<?php

namespace Tests\Feature;

use App\Enums\ApplicationStatus;
use App\Enums\CampaignStatus;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\Creator;
use App\Models\CreatorContractAcceptance;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CampaignApplicationBudgetTest extends TestCase
{
    use RefreshDatabase;

    public function test_apply_is_blocked_when_approved_creators_fill_budget(): void
    {
        $campaign = $this->paidCampaign(10000);
        CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
            'amount' => $campaign->creators_budget,
        ]);

        $applicant = $this->applicant();
        $token = $applicant->user->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->postJson("/api/campaigns/{$campaign->id}/apply", ['notes' => 'Quero participar'])
            ->assertForbidden()
            ->assertJsonPath('message', __('auth.campaign_budget_full'));

        $this->assertDatabaseMissing('campaign_creators', [
            'campaign_id' => $campaign->id,
            'creator_id' => $applicant->id,
        ]);

        $available = $this->withToken($token)->getJson('/api/campaigns/available')->assertOk()->json('data');
        $row = collect($available)->firstWhere('id', $campaign->id);
        $this->assertNotNull($row);
        $this->assertFalse($row['accepting_applications']);
    }

    public function test_apply_is_allowed_while_approved_amount_is_below_budget(): void
    {
        $campaign = $this->paidCampaign(10000);
        CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
            'amount' => 1000,
        ]);
        CampaignCreator::factory()->pendingApplication()->create([
            'campaign_id' => $campaign->id,
            'amount' => 9000,
        ]);

        $applicant = $this->applicant();
        $token = $applicant->user->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->postJson("/api/campaigns/{$campaign->id}/apply", ['notes' => 'Quero participar'])
            ->assertCreated();

        $available = $this->withToken($token)->getJson('/api/campaigns/available')->assertOk()->json('data');
        $row = collect($available)->firstWhere('id', $campaign->id);
        $this->assertTrue($row['accepting_applications']);
    }

    public function test_pending_applicant_can_resubmit_when_budget_is_full(): void
    {
        $campaign = $this->paidCampaign(10000);
        $applicant = $this->applicant();
        CampaignCreator::factory()->pendingApplication()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => $applicant->id,
            'amount' => 500,
            'notes' => 'Primeira nota',
        ]);
        CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
            'amount' => $campaign->creators_budget,
        ]);

        $token = $applicant->user->createToken('auth')->plainTextToken;
        $this->withToken($token)
            ->postJson("/api/campaigns/{$campaign->id}/apply", ['notes' => 'Atualizei a nota'])
            ->assertCreated()
            ->assertJsonPath('data.notes', 'Atualizei a nota')
            ->assertJsonPath('data.application_status', ApplicationStatus::Pending->value);
    }

    public function test_barter_campaign_stays_open_with_approved_creators(): void
    {
        $campaign = Campaign::factory()->create([
            'is_barter' => true,
            'is_secret' => false,
            'status' => CampaignStatus::Briefing,
            'total_budget' => 0,
            'creators_budget' => 0,
            'creator_cache' => 0,
        ]);
        CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
            'amount' => 0,
        ]);

        $applicant = $this->applicant();
        $token = $applicant->user->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->postJson("/api/campaigns/{$campaign->id}/apply", ['notes' => 'Quero participar'])
            ->assertCreated();
    }

    private function paidCampaign(float $totalBudget): Campaign
    {
        return Campaign::factory()->create([
            'is_barter' => false,
            'is_secret' => false,
            'status' => CampaignStatus::Briefing,
            'total_budget' => $totalBudget,
            ...Campaign::feeSplit($totalBudget, 20),
            'creator_cache' => 800,
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
