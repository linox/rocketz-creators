<?php

namespace Tests\Feature;

use App\Enums\ApplicationStatus;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\Creator;
use App\Models\RecurringContract;
use App\Models\RecurringContractCreator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CreatorWorkHistoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_creator_campaigns_index_keeps_finished_assigned_campaigns(): void
    {
        $creator = Creator::factory()->active()->create();
        $token = $creator->user->createToken('auth')->plainTextToken;
        $campaign = Campaign::factory()->finished()->create([
            'is_secret' => false,
            'start_date' => now()->startOfMonth()->toDateString(),
            'end_date' => now()->endOfMonth()->toDateString(),
        ]);
        CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => $creator->id,
            'application_status' => ApplicationStatus::Approved,
            'delivery_date' => now()->toDateString(),
            'post_date' => now()->toDateString(),
        ]);

        $mine = $this->withToken($token)
            ->getJson('/api/campaigns?include=content')
            ->assertOk()
            ->json('data');

        $row = collect($mine)->firstWhere('id', $campaign->id);
        $this->assertNotNull($row);
        $this->assertSame('finished', $row['status']);
        $this->assertNotEmpty($row['applications']);
        $this->assertSame($creator->id, $row['applications'][0]['creator_id']);

        $available = $this->withToken($token)
            ->getJson('/api/campaigns/available')
            ->assertOk()
            ->json('data');

        $this->assertFalse(collect($available)->contains(fn ($item) => (int) $item['id'] === $campaign->id));
    }

    public function test_creator_recurring_index_keeps_finished_contracts(): void
    {
        $creator = Creator::factory()->active()->create();
        $token = $creator->user->createToken('auth')->plainTextToken;
        $contract = RecurringContract::factory()->finished()->create();
        RecurringContractCreator::factory()->create([
            'recurring_contract_id' => $contract->id,
            'creator_id' => $creator->id,
        ]);

        $mine = $this->withToken($token)
            ->getJson('/api/recurring-contracts?include=items')
            ->assertOk()
            ->json('data');

        $row = collect($mine)->firstWhere('id', $contract->id);
        $this->assertNotNull($row);
        $this->assertSame('finished', $row['status']);
    }
}
