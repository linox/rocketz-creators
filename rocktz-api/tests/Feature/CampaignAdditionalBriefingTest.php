<?php

namespace Tests\Feature;

use App\Models\CampaignCreator;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CampaignAdditionalBriefingTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_sets_additional_briefing_after_allocation(): void
    {
        $admin = User::factory()->admin()->create();
        $row = CampaignCreator::factory()->approved()->create([
            'additional_briefing' => null,
        ]);
        $briefing = "Mostre o produto no setup do quarto e feche com o cupom.";

        $this->withToken($admin->createToken('auth')->plainTextToken)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'additional_briefing' => $briefing,
            ])
            ->assertOk()
            ->assertJsonPath('data.additional_briefing', $briefing);

        $this->assertSame($briefing, $row->fresh()->additional_briefing);
        $this->assertDatabaseHas('notifications', [
            'creator_id' => $row->creator_id,
            'campaign_id' => $row->campaign_id,
            'title' => __('auth.additional_briefing_title'),
        ]);
    }

    public function test_creator_sees_the_additional_briefing(): void
    {
        $row = CampaignCreator::factory()->approved()->create([
            'additional_briefing' => 'Fale da sua rotina de treino.',
        ]);
        $token = $row->creator->user->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->getJson("/api/campaigns/{$row->campaign_id}")
            ->assertOk()
            ->assertJsonPath('data.applications.0.additional_briefing', 'Fale da sua rotina de treino.');
    }

    public function test_additional_briefing_requires_allocation(): void
    {
        $admin = User::factory()->admin()->create();
        $row = CampaignCreator::factory()->pendingApplication()->create();

        $this->withToken($admin->createToken('auth')->plainTextToken)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'additional_briefing' => 'Ainda não alocado.',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['additional_briefing']);

        $this->assertNull($row->fresh()->additional_briefing);
    }

    public function test_creator_cannot_edit_the_additional_briefing(): void
    {
        $row = CampaignCreator::factory()->approved()->create([
            'additional_briefing' => 'Direção original.',
        ]);

        $this->withToken($row->creator->user->createToken('auth')->plainTextToken)
            ->patchJson("/api/campaign-creators/{$row->id}", [
                'additional_briefing' => 'Alterado pelo criador.',
            ])
            ->assertForbidden();

        $this->assertSame('Direção original.', $row->fresh()->additional_briefing);
    }
}
