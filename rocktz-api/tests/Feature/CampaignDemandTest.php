<?php

namespace Tests\Feature;

use App\Models\CampaignCreator;
use App\Models\CampaignCreatorContent;
use App\Models\CampaignDemand;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CampaignDemandTest extends TestCase
{
    use RefreshDatabase;

    public function test_approved_creator_gets_one_demand_per_deliverable(): void
    {
        $admin = User::factory()->admin()->create();
        $row = CampaignCreator::factory()->pendingApplication()->create();
        $row->campaign->deliverable()->create([
            'reels' => 5,
            'stories' => 2,
        ]);

        $this->withToken($admin->createToken('auth')->plainTextToken)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'application_status' => 'approved',
            ])
            ->assertOk()
            ->assertJsonCount(7, 'data.demands');

        $this->assertSame(5, CampaignDemand::query()->where('campaign_creator_id', $row->id)->where('content_type', 'reels')->count());
        $this->assertSame(2, CampaignDemand::query()->where('campaign_creator_id', $row->id)->where('content_type', 'stories')->count());
    }

    public function test_creator_submits_each_demand_without_a_pauta(): void
    {
        $row = $this->approvedWithReels(5);
        $demands = $row->demands()->orderBy('id')->get();

        $this->withToken($row->creator->user->createToken('auth')->plainTextToken)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'demand_id' => $demands[1]->id,
                'script' => 'Roteiro do segundo reel',
                'script_status' => 'submitted',
                'delivery_status' => 'sent',
            ])
            ->assertOk()
            ->assertJsonPath('data.demands.1.content.script', 'Roteiro do segundo reel')
            ->assertJsonPath('data.demands.0.content.script', null);

        $this->assertNull($demands[0]->fresh()->script);
        $this->assertSame('Roteiro do segundo reel', $demands[1]->fresh()->script);
        $this->assertSame('pending', $demands[0]->fresh()->delivery_status->value);
    }

    public function test_submission_without_demand_is_rejected_when_quota_exists(): void
    {
        $row = $this->approvedWithReels(3);

        $this->withToken($row->creator->user->createToken('auth')->plainTextToken)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'script' => 'Sem escolher a entrega',
                'script_status' => 'submitted',
                'delivery_status' => 'sent',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['demand_id']);
    }

    public function test_pauta_is_optional_and_only_managers_can_set_it(): void
    {
        $admin = User::factory()->admin()->create();
        $row = $this->approvedWithReels(2);
        $demand = $row->demands()->first();

        $this->withToken($admin->createToken('auth')->plainTextToken)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'demand_id' => $demand->id,
                'pauta' => 'Comece pelo unboxing.',
            ])
            ->assertOk()
            ->assertJsonPath('data.demands.0.pauta', 'Comece pelo unboxing.');

        $this->assertDatabaseHas('notifications', [
            'creator_id' => $row->creator_id,
            'title' => __('auth.campaign_demand_pauta_title'),
        ]);

        $this->flushHeaders();
        auth()->forgetGuards();

        $this->withToken($row->creator->user->createToken('creator')->plainTextToken)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'demand_id' => $demand->id,
                'pauta' => 'Alterado pelo criador',
            ])
            ->assertForbidden();

        $this->assertSame('Comece pelo unboxing.', $demand->fresh()->pauta);
    }

    public function test_campaign_without_quantities_keeps_a_single_submission(): void
    {
        $row = CampaignCreator::factory()->approved()->create();

        $this->withToken($row->creator->user->createToken('auth')->plainTextToken)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'script' => 'Envio único',
                'script_status' => 'submitted',
                'delivery_status' => 'sent',
            ])
            ->assertOk()
            ->assertJsonPath('data.content.script', 'Envio único');

        $this->assertSame(0, CampaignDemand::query()->where('campaign_creator_id', $row->id)->count());
        $this->assertSame('Envio único', CampaignCreatorContent::query()->where('campaign_creator_id', $row->id)->value('script'));
    }

    public function test_raising_the_quota_adds_the_missing_demands(): void
    {
        $admin = User::factory()->admin()->create();
        $row = $this->approvedWithReels(5);

        $this->withToken($admin->createToken('auth')->plainTextToken)
            ->patchJson("/api/campaigns/{$row->campaign_id}", [
                'deliverables' => [
                    'reels' => 6,
                    'stories' => 0,
                    'tiktok' => 0,
                    'ugc' => 0,
                    'posts' => 0,
                    'youtube' => 0,
                ],
            ])
            ->assertOk();

        $this->assertSame(6, CampaignDemand::query()->where('campaign_creator_id', $row->id)->count());
    }

    public function test_existing_submission_is_kept_on_the_first_demand(): void
    {
        $row = CampaignCreator::factory()->approved()->create([
            'script_status' => 'approved',
            'video_status' => 'approved',
            'delivery_status' => 'approved',
        ]);
        $row->campaign->deliverable()->create(['reels' => 2]);
        CampaignCreatorContent::factory()->create([
            'campaign_creator_id' => $row->id,
            'script' => 'Roteiro que já existia',
        ]);

        $this->withToken($row->creator->user->createToken('auth')->plainTextToken)
            ->getJson("/api/campaigns/{$row->campaign_id}")
            ->assertOk()
            ->assertJsonCount(2, 'data.applications.0.demands')
            ->assertJsonPath('data.applications.0.demands.0.content.script', 'Roteiro que já existia')
            ->assertJsonPath('data.applications.0.demands.0.script_status', 'approved')
            ->assertJsonPath('data.applications.0.demands.1.content.script', null);
    }

    public function test_inbox_approval_updates_only_the_chosen_demand(): void
    {
        $admin = User::factory()->admin()->create();
        $row = $this->approvedWithReels(2);
        $demands = $row->demands()->orderBy('id')->get();
        $demands[0]->update([
            'script_status' => 'submitted',
            'delivery_status' => 'sent',
            'script_submitted_at' => now(),
        ]);

        $this->withToken($admin->createToken('auth')->plainTextToken)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'demand_id' => $demands[0]->id,
                'script_status' => 'approved',
                'script_feedback' => '',
            ])
            ->assertOk()
            ->assertJsonPath('data.demands.0.script_status', 'approved')
            ->assertJsonPath('data.demands.1.script_status', 'pending')
            ->assertJsonPath('data.script_status', 'pending');

        $this->flushHeaders();
        auth()->forgetGuards();

        $demands[0]->update([
            'video_status' => 'submitted',
            'delivery_status' => 'sent',
        ]);

        $this->withToken($admin->createToken('auth')->plainTextToken)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'demand_id' => $demands[0]->id,
                'delivery_status' => 'approved',
                'video_status' => 'approved',
                'script_status' => 'approved',
                'revision_details' => '',
                'script_feedback' => '',
                'video_feedback' => '',
            ])
            ->assertOk()
            ->assertJsonPath('data.demands.0.video_status', 'approved')
            ->assertJsonPath('data.demands.0.delivery_status', 'approved')
            ->assertJsonPath('data.demands.1.delivery_status', 'pending')
            ->assertJsonPath('data.delivery_status', 'pending');
    }

    private function approvedWithReels(int $reels): CampaignCreator
    {
        $row = CampaignCreator::factory()->approved()->create();
        $row->campaign->deliverable()->create(['reels' => $reels]);
        app(\App\Services\CampaignDemandSync::class)->syncCreator($row);

        return $row->fresh();
    }
}
