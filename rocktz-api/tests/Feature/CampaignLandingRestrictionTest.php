<?php

namespace Tests\Feature;

use App\Enums\CampaignStatus;
use App\Enums\LandingSignupStatus;
use App\Models\Campaign;
use App\Models\CompanyLandingPage;
use App\Models\CompanyLandingSignup;
use App\Models\Creator;
use App\Models\CreatorContractAcceptance;
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
