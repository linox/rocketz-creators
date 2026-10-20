<?php

namespace Tests\Feature;

use App\Enums\ApplicationStatus;
use App\Models\CampaignCreator;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CampaignCastingFavoriteTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_favorite_an_applicant_without_changing_the_decision(): void
    {
        $row = CampaignCreator::factory()->pendingApplication()->create();
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/campaign-creators/{$row->id}", ['favorited' => true])
            ->assertOk()
            ->assertJsonPath('data.favorited', true)
            ->assertJsonPath('data.application_status', ApplicationStatus::Pending->value);

        $this->assertTrue($row->refresh()->favorited);

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/campaign-creators/{$row->id}", ['favorited' => false])
            ->assertOk()
            ->assertJsonPath('data.favorited', false);

        $this->assertFalse($row->refresh()->favorited);
    }

    public function test_creator_cannot_favorite_their_own_application(): void
    {
        $row = CampaignCreator::factory()->pendingApplication()->create();
        $row->load('creator.user');

        $this->actingAs($row->creator->user, 'sanctum')
            ->patchJson("/api/campaign-creators/{$row->id}", ['favorited' => true])
            ->assertForbidden();

        $this->assertFalse($row->refresh()->favorited);
    }
}
