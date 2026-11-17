<?php

namespace Tests\Feature;

use App\Models\CampaignCreator;
use App\Models\ContentPlanningItem;
use App\Models\User;
use App\Services\CampaignDemandSync;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ContentReactionTest extends TestCase
{
    use RefreshDatabase;

    public function test_approving_a_campaign_demand_can_like_it_and_leave_a_note(): void
    {
        $admin = User::factory()->admin()->create();
        $row = CampaignCreator::factory()->approved()->create();
        $row->campaign->deliverable()->create(['reels' => 2]);
        app(CampaignDemandSync::class)->syncCreator($row);
        $row = $row->fresh();
        $demands = $row->demands()->orderBy('id')->get();
        $demands[0]->update([
            'script_status' => 'submitted',
            'script_submitted_at' => now(),
            'delivery_status' => 'sent',
        ]);

        $this->withToken($admin->createToken('auth')->plainTextToken)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'demand_id' => $demands[0]->id,
                'script_status' => 'approved',
                'script_feedback' => '',
                'script_liked' => true,
                'script_reaction' => 'Adoramos a abertura.',
            ])
            ->assertOk()
            ->assertJsonPath('data.demands.0.script_status', 'approved')
            ->assertJsonPath('data.demands.0.script_liked', true)
            ->assertJsonPath('data.demands.0.script_reaction', 'Adoramos a abertura.')
            ->assertJsonPath('data.demands.1.script_liked', false)
            ->assertJsonPath('data.demands.1.script_reaction', null);

        $this->assertDatabaseHas('notifications', [
            'creator_id' => $row->creator_id,
            'title' => 'A marca curtiu seu conteúdo',
            'message' => 'Adoramos a abertura.',
        ]);
    }

    public function test_creator_cannot_react_to_their_own_campaign_content(): void
    {
        $row = CampaignCreator::factory()->approved()->create();
        $row->campaign->deliverable()->create(['reels' => 1]);
        app(CampaignDemandSync::class)->syncCreator($row);
        $demand = $row->fresh()->demands()->first();

        $this->withToken($row->creator->user->createToken('auth')->plainTextToken)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'demand_id' => $demand->id,
                'script_liked' => true,
            ])
            ->assertForbidden();
    }

    public function test_a_new_submission_clears_the_previous_reaction(): void
    {
        $row = CampaignCreator::factory()->approved()->create();
        $row->campaign->deliverable()->create(['reels' => 1]);
        app(CampaignDemandSync::class)->syncCreator($row);
        $demand = $row->fresh()->demands()->first();
        $demand->update([
            'script_status' => 'approved',
            'script_liked' => true,
            'script_reaction' => 'Top',
            'script' => 'Versão antiga',
        ]);

        $this->withToken($row->creator->user->createToken('auth')->plainTextToken)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'demand_id' => $demand->id,
                'script' => 'Versão nova',
                'script_status' => 'submitted',
            ])
            ->assertOk();

        $demand->refresh();
        $this->assertFalse($demand->script_liked);
        $this->assertNull($demand->script_reaction);
        $this->assertSame('submitted', $demand->script_status->value);
    }

    public function test_approving_a_recurring_video_stores_the_reaction_for_the_creator(): void
    {
        $admin = User::factory()->admin()->create();
        $item = ContentPlanningItem::factory()->create([
            'status' => 'review',
            'video_status' => 'submitted',
            'media_url' => 'https://example.com/video.mp4',
            'video_submitted_at' => now(),
        ]);

        $this->withToken($admin->createToken('auth')->plainTextToken)
            ->patchJson("/api/content-planning-items/{$item->id}", [
                'video_status' => 'approved',
                'status' => 'approved',
                'video_liked' => true,
                'video_reaction' => 'Ficou lindo.',
            ])
            ->assertOk()
            ->assertJsonPath('data.video_liked', true)
            ->assertJsonPath('data.video_reaction', 'Ficou lindo.')
            ->assertJsonPath('data.video_status', 'approved');

        $this->assertDatabaseHas('notifications', [
            'creator_id' => $item->creator_id,
            'recurring_contract_id' => $item->recurring_contract_id,
            'message' => 'Ficou lindo.',
        ]);
    }

    public function test_creator_cannot_react_to_a_recurring_pauta(): void
    {
        $item = ContentPlanningItem::factory()->create();

        $this->withToken($item->creator->user->createToken('auth')->plainTextToken)
            ->patchJson("/api/content-planning-items/{$item->id}", [
                'video_liked' => true,
            ])
            ->assertForbidden();
    }
}
