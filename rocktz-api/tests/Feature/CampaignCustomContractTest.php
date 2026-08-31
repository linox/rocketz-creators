<?php

namespace Tests\Feature;

use App\Enums\CampaignStatus;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\Creator;
use App\Models\CreatorContractAcceptance;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CampaignCustomContractTest extends TestCase
{
    use RefreshDatabase;

    public function test_apply_requires_custom_contract_acceptance(): void
    {
        $campaign = $this->campaignWithCustomContract();
        $applicant = $this->applicant();
        $token = $applicant->user->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->postJson("/api/campaigns/{$campaign->id}/apply", ['notes' => 'Quero participar'])
            ->assertForbidden()
            ->assertJsonPath('message', __('auth.creator_must_accept_campaign_contract'));

        $this->assertDatabaseMissing('campaign_creators', [
            'campaign_id' => $campaign->id,
            'creator_id' => $applicant->id,
        ]);
    }

    public function test_apply_stores_custom_contract_acceptance(): void
    {
        $campaign = $this->campaignWithCustomContract();
        $applicant = $this->applicant();
        $token = $applicant->user->createToken('auth')->plainTextToken;

        $response = $this->withToken($token)
            ->postJson("/api/campaigns/{$campaign->id}/apply", [
                'notes' => 'Quero participar',
                'custom_contract_accepted' => true,
            ])
            ->assertCreated();

        $this->assertNotEmpty($response->json('data.custom_contract_accepted_at'));

        $row = CampaignCreator::query()
            ->where('campaign_id', $campaign->id)
            ->where('creator_id', $applicant->id)
            ->first();
        $this->assertNotNull($row?->custom_contract_accepted_at);

        $available = $this->withToken($token)->getJson('/api/campaigns/available')->assertOk()->json('data');
        $listed = collect($available)->firstWhere('id', $campaign->id);
        $this->assertTrue($listed['has_custom_contract']);
        $this->assertSame('Termos extras da marca parceira.', $listed['custom_contract_terms']);
    }

    public function test_campaign_without_custom_contract_does_not_require_acceptance(): void
    {
        $campaign = Campaign::factory()->create([
            'is_secret' => false,
            'status' => CampaignStatus::Briefing,
            'has_custom_contract' => false,
            'custom_contract_terms' => null,
        ]);
        $applicant = $this->applicant();
        $token = $applicant->user->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->postJson("/api/campaigns/{$campaign->id}/apply", ['notes' => 'Quero participar'])
            ->assertCreated();
    }

    private function campaignWithCustomContract(): Campaign
    {
        return Campaign::factory()->create([
            'is_secret' => false,
            'status' => CampaignStatus::Briefing,
            'has_custom_contract' => true,
            'custom_contract_terms' => 'Termos extras da marca parceira.',
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
