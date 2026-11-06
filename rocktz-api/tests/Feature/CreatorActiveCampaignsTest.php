<?php

namespace Tests\Feature;

use App\Enums\ApplicationStatus;
use App\Enums\CampaignStatus;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Creator;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CreatorActiveCampaignsTest extends TestCase
{
    use RefreshDatabase;

    public function test_creator_index_lists_approved_campaigns_still_running(): void
    {
        $admin = User::factory()->admin()->create();
        $creator = Creator::factory()->active()->create();
        $live = Campaign::factory()->create([
            'name' => 'Campanha Viva',
            'status' => CampaignStatus::Production,
        ]);
        $finished = Campaign::factory()->create([
            'name' => 'Campanha Encerrada',
            'status' => CampaignStatus::Finished,
        ]);
        $pending = Campaign::factory()->create([
            'name' => 'Campanha Pendente',
            'status' => CampaignStatus::Selection,
        ]);

        CampaignCreator::factory()->approved()->create([
            'campaign_id' => $live->id,
            'creator_id' => $creator->id,
        ]);
        CampaignCreator::factory()->approved()->create([
            'campaign_id' => $finished->id,
            'creator_id' => $creator->id,
        ]);
        CampaignCreator::factory()->create([
            'campaign_id' => $pending->id,
            'creator_id' => $creator->id,
            'application_status' => ApplicationStatus::Pending,
        ]);

        $this->actingAs($admin)
            ->getJson('/api/creators')
            ->assertOk()
            ->assertJsonPath('data.0.id', $creator->id)
            ->assertJsonCount(1, 'data.0.active_campaigns')
            ->assertJsonPath('data.0.active_campaigns.0.id', $live->id)
            ->assertJsonPath('data.0.active_campaigns.0.name', 'Campanha Viva')
            ->assertJsonPath('data.0.active_campaigns.0.status', CampaignStatus::Production->value)
            ->assertJsonMissing(['name' => 'Campanha Encerrada'])
            ->assertJsonMissing(['name' => 'Campanha Pendente']);
    }

    public function test_company_only_sees_campaigns_from_the_acting_company(): void
    {
        $user = User::factory()->company()->create();
        $company = Company::factory()->active()->create();
        $other = Company::factory()->active()->create();
        CompanyUser::factory()->active()->create([
            'user_id' => $user->id,
            'company_id' => $company->id,
        ]);
        $user->forceFill(['active_company_id' => $company->id])->save();

        $creator = Creator::factory()->active()->create([
            'invited_by_company_id' => $company->id,
        ]);
        $mine = Campaign::factory()->create([
            'company_id' => $company->id,
            'name' => 'Minha Campanha',
            'status' => CampaignStatus::Production,
        ]);
        $foreign = Campaign::factory()->create([
            'company_id' => $other->id,
            'name' => 'Campanha Alheia',
            'status' => CampaignStatus::Production,
        ]);
        CampaignCreator::factory()->approved()->create([
            'campaign_id' => $mine->id,
            'creator_id' => $creator->id,
        ]);
        CampaignCreator::factory()->approved()->create([
            'campaign_id' => $foreign->id,
            'creator_id' => $creator->id,
        ]);

        $this->actingAs($user)
            ->getJson('/api/creators')
            ->assertOk()
            ->assertJsonCount(1, 'data.0.active_campaigns')
            ->assertJsonPath('data.0.active_campaigns.0.name', 'Minha Campanha')
            ->assertJsonMissing(['name' => 'Campanha Alheia']);
    }
}
