<?php

namespace Tests\Feature;

use App\Enums\CampaignStatus;
use App\Models\Campaign;
use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Creator;
use App\Models\CreatorContractAcceptance;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CampaignApplicationQuestionTest extends TestCase
{
    use RefreshDatabase;

    public function test_company_can_save_a_custom_application_question(): void
    {
        $company = Company::factory()->active()->create();
        $user = User::factory()->company()->create();
        CompanyUser::factory()->active()->create([
            'user_id' => $user->id,
            'company_id' => $company->id,
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/campaigns', [
                'name' => 'Campanha com pergunta',
                'is_barter' => true,
                'application_question' => '  Por que você deve fazer parte desta campanha?  ',
            ])
            ->assertCreated()
            ->assertJsonPath('data.application_question', 'Por que você deve fazer parte desta campanha?');

        $this->assertDatabaseHas('campaigns', [
            'name' => 'Campanha com pergunta',
            'application_question' => 'Por que você deve fazer parte desta campanha?',
        ]);
    }

    public function test_blank_application_question_is_stored_as_null(): void
    {
        $campaign = Campaign::factory()->create([
            'application_question' => 'Pergunta antiga',
        ]);
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/campaigns/{$campaign->id}", [
                'application_question' => '   ',
            ])
            ->assertOk()
            ->assertJsonPath('data.application_question', null);

        $this->assertNull($campaign->fresh()->application_question);
    }

    public function test_creators_see_the_question_on_available_campaigns(): void
    {
        $question = 'Conte um exemplo recente do seu conteúdo no nosso nicho.';
        $campaign = Campaign::factory()->create([
            'is_secret' => false,
            'status' => CampaignStatus::Briefing,
            'application_question' => $question,
        ]);
        $applicant = $this->applicant();

        $available = $this->actingAs($applicant->user, 'sanctum')
            ->getJson('/api/campaigns/available')
            ->assertOk()
            ->json('data');

        $listed = collect($available)->firstWhere('id', $campaign->id);
        $this->assertSame($question, $listed['application_question']);
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
