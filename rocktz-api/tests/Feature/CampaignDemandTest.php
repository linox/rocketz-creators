<?php

namespace Tests\Feature;

use App\Models\CampaignCreator;
use App\Models\CampaignCreatorContent;
use App\Models\CampaignDemand;
use App\Models\User;
use App\Services\CampaignDemandSync;
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
            ->assertJsonPath('data.demands.0.content.movements.0.type', 'script_approved')
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

        $movements = $demands[0]->fresh()->movements;
        $this->assertSame(['script_approved', 'video_approved'], array_column($movements, 'type'));
        $this->assertNotEmpty($movements[0]['at'] ?? null);
        $this->assertNotEmpty($movements[1]['at'] ?? null);
    }

    public function test_concluding_with_a_link_records_publication_movement(): void
    {
        $admin = User::factory()->admin()->create();
        $row = $this->approvedWithReels(1);
        $demand = $row->demands()->first();
        $demand->update([
            'script_status' => 'approved',
            'movements' => [[
                'type' => 'script_approved',
                'at' => '2026-10-01T12:00:00+00:00',
            ]],
        ]);

        $this->withToken($admin->createToken('auth')->plainTextToken)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'demand_id' => $demand->id,
                'published_link' => 'https://instagram.com/p/abc',
                'delivery_status' => 'published',
                'video_status' => 'approved',
                'script_status' => 'approved',
            ])
            ->assertOk()
            ->assertJsonPath('data.demands.0.delivery_status', 'published');

        $types = array_column($demand->fresh()->movements, 'type');
        $this->assertSame(['script_approved', 'video_approved', 'published'], $types);
    }

    public function test_note_without_a_submitted_video_is_stored_as_pauta(): void
    {
        $admin = User::factory()->admin()->create();
        $row = $this->approvedWithReels(1);
        $demand = $row->demands()->first();
        $demand->update(['script_status' => 'approved']);
        $note = 'Oie, queríamos só adicionar um detalhe ao roteiro.';

        $this->withToken($admin->createToken('auth')->plainTextToken)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'demand_id' => $demand->id,
                'delivery_status' => 'revision',
                'revision_details' => $note,
                'video_status' => 'revision',
                'video_feedback' => $note,
            ])
            ->assertOk()
            ->assertJsonPath('data.demands.0.pauta', $note)
            ->assertJsonPath('data.demands.0.video_status', 'pending')
            ->assertJsonPath('data.demands.0.script_status', 'pending')
            ->assertJsonPath('data.demands.0.delivery_status', 'pending')
            ->assertJsonPath('data.demands.0.video_feedback', null);

        $fresh = $demand->fresh();
        $this->assertSame($note, $fresh->pauta);
        $this->assertSame([], $fresh->revision_history ?? []);
        $this->assertDatabaseMissing('notifications', [
            'creator_id' => $row->creator_id,
            'title' => __('auth.material_revision_title'),
        ]);
    }

    public function test_video_revision_stays_when_a_video_was_sent(): void
    {
        $admin = User::factory()->admin()->create();
        $row = $this->approvedWithReels(1);
        $demand = $row->demands()->first();
        $demand->update([
            'script_status' => 'approved',
            'video_url' => 'https://cdn.example/video.mp4',
            'video_submitted_at' => now(),
            'video_status' => 'submitted',
            'delivery_status' => 'sent',
        ]);
        $note = 'Cortar o final.';

        $this->withToken($admin->createToken('auth')->plainTextToken)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'demand_id' => $demand->id,
                'delivery_status' => 'revision',
                'revision_details' => $note,
                'video_status' => 'revision',
                'video_feedback' => $note,
            ])
            ->assertOk()
            ->assertJsonPath('data.demands.0.video_status', 'revision')
            ->assertJsonPath('data.demands.0.script_status', 'approved')
            ->assertJsonPath('data.demands.0.pauta', null)
            ->assertJsonPath('data.demands.0.video_feedback', $note);

        $history = $demand->fresh()->revision_history;
        $this->assertSame('video', $history[0]['stage'] ?? null);
        $this->assertSame($note, $history[0]['note'] ?? null);
    }

    public function test_pauta_notes_saved_as_empty_video_revisions_are_released(): void
    {
        $row = $this->approvedWithReels(2);
        $demands = $row->demands()->orderBy('id')->get();
        $note = 'Destacar frete grátis na loja oficial.';
        $demands[0]->update([
            'script_status' => 'approved',
            'video_status' => 'revision',
            'delivery_status' => 'revision',
            'video_feedback' => $note,
            'revision_details' => $note,
            'revision_history' => [[
                'stage' => 'video',
                'note' => $note,
                'requested_at' => '2026-10-20T14:07:44+00:00',
            ]],
        ]);
        $demands[1]->update([
            'video_url' => 'https://cdn.example/real.mp4',
            'video_submitted_at' => now(),
            'video_status' => 'revision',
            'delivery_status' => 'revision',
            'video_feedback' => 'Cortar o final.',
            'revision_history' => [[
                'stage' => 'video',
                'note' => 'Cortar o final.',
                'requested_at' => '2026-10-20T15:00:00+00:00',
            ]],
        ]);

        app(CampaignDemandSync::class)->releaseBriefNotesStoredAsRevision();

        $brief = $demands[0]->fresh();
        $this->assertSame($note, $brief->pauta);
        $this->assertSame('pending', $brief->video_status->value);
        $this->assertSame('pending', $brief->script_status->value);
        $this->assertSame('pending', $brief->delivery_status->value);
        $this->assertNull($brief->video_feedback);
        $this->assertSame([], $brief->revision_history ?? []);

        $real = $demands[1]->fresh();
        $this->assertSame('revision', $real->video_status->value);
        $this->assertNull($real->pauta);
        $this->assertSame('Cortar o final.', $real->revision_history[0]['note'] ?? null);
        $this->assertSame('revision', $row->fresh()->video_status->value);
    }

    private function approvedWithReels(int $reels): CampaignCreator
    {
        $row = CampaignCreator::factory()->approved()->create();
        $row->campaign->deliverable()->create(['reels' => $reels]);
        app(\App\Services\CampaignDemandSync::class)->syncCreator($row);

        return $row->fresh();
    }
}
