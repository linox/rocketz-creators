<?php

namespace Tests\Feature;

use App\Enums\PostingProfile;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CampaignDeliveryScheduleTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_sets_general_delivery_date_and_who_posts(): void
    {
        $admin = User::factory()->admin()->create();
        $campaign = Campaign::factory()->create();

        $this->withToken($admin->createToken('auth')->plainTextToken)
            ->patchJson("/api/campaigns/{$campaign->id}", [
                'delivery_date' => '2026-10-20',
                'posting_profile' => PostingProfile::Brand->value,
            ])
            ->assertOk()
            ->assertJsonPath('data.delivery_date', '2026-10-20')
            ->assertJsonPath('data.posting_profile', 'brand');

        $this->assertSame('2026-10-20', $campaign->fresh()->delivery_date?->toDateString());
        $this->assertSame(PostingProfile::Brand, $campaign->fresh()->posting_profile);
    }

    public function test_creator_sees_general_date_personalized_date_and_posting_profile(): void
    {
        $campaign = Campaign::factory()->create([
            'delivery_date' => '2026-10-20',
            'posting_profile' => PostingProfile::Brand,
        ]);
        $row = CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
            'delivery_date' => '2026-10-28',
        ]);
        $token = $row->creator->user->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->getJson("/api/campaigns/{$campaign->id}")
            ->assertOk()
            ->assertJsonPath('data.delivery_date', '2026-10-20')
            ->assertJsonPath('data.posting_profile', 'brand')
            ->assertJsonPath('data.applications.0.delivery_date', '2026-10-28');
    }

    public function test_admin_can_set_a_personalized_delivery_date(): void
    {
        $admin = User::factory()->admin()->create();
        $row = CampaignCreator::factory()->approved()->create([
            'delivery_date' => null,
        ]);

        $this->withToken($admin->createToken('auth')->plainTextToken)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'delivery_date' => '2026-11-02',
                'post_date' => '2026-11-05',
            ])
            ->assertOk()
            ->assertJsonPath('data.delivery_date', '2026-11-02')
            ->assertJsonPath('data.post_date', '2026-11-05');
    }
}
