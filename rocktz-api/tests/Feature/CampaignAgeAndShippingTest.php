<?php

namespace Tests\Feature;

use App\Enums\CampaignStatus;
use App\Models\Campaign;
use App\Models\Company;
use App\Models\Creator;
use App\Models\CreatorContractAcceptance;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CampaignAgeAndShippingTest extends TestCase
{
    use RefreshDatabase;

    public function test_creator_outside_age_range_cannot_see_or_apply(): void
    {
        $campaign = $this->campaign(['limit_by_age' => true, 'min_age' => 18, 'max_age' => 24]);
        $creator = $this->applicant(['birth_date' => '1990-01-01']);
        $token = $creator->user->createToken('auth')->plainTextToken;

        $available = $this->withToken($token)->getJson('/api/campaigns/available')->assertOk()->json('data');
        $this->assertFalse(collect($available)->contains(fn ($row) => (int) $row['id'] === $campaign->id));

        $this->withToken($token)
            ->getJson("/api/campaigns/{$campaign->id}")
            ->assertForbidden();

        $this->withToken($token)
            ->postJson("/api/campaigns/{$campaign->id}/apply", ['notes' => 'Quero participar'])
            ->assertForbidden()
            ->assertJsonPath('message', __('auth.campaign_age_restricted', [
                'requirement' => $campaign->ageRequirementLabel(),
            ]));
    }

    public function test_creator_without_birth_date_can_see_age_campaign_but_cannot_apply(): void
    {
        $campaign = $this->campaign(['limit_by_age' => true, 'min_age' => 18]);
        $creator = $this->applicant(['birth_date' => null]);
        $token = $creator->user->createToken('auth')->plainTextToken;

        $available = $this->withToken($token)->getJson('/api/campaigns/available')->assertOk()->json('data');
        $this->assertTrue(collect($available)->contains(fn ($row) => (int) $row['id'] === $campaign->id));

        $this->withToken($token)
            ->getJson("/api/campaigns/{$campaign->id}")
            ->assertOk()
            ->assertJsonPath('data.min_age', 18);

        $this->withToken($token)
            ->postJson("/api/campaigns/{$campaign->id}/apply", ['notes' => 'Quero participar'])
            ->assertForbidden()
            ->assertJsonPath('message', __('auth.campaign_birth_date_required'));
    }

    public function test_creator_inside_age_range_can_apply(): void
    {
        $campaign = $this->campaign(['limit_by_age' => true, 'min_age' => 18, 'is_barter' => false]);
        $creator = $this->applicant(['birth_date' => '2000-05-02']);

        $this->withToken($creator->user->createToken('auth')->plainTextToken)
            ->postJson("/api/campaigns/{$campaign->id}/apply", ['notes' => 'Quero participar'])
            ->assertCreated();
    }

    public function test_barter_apply_requires_shipping_address(): void
    {
        $campaign = $this->campaign(['is_barter' => true]);
        $creator = $this->applicant(['shipping_address' => null]);

        $this->withToken($creator->user->createToken('auth')->plainTextToken)
            ->postJson("/api/campaigns/{$campaign->id}/apply", ['notes' => 'Quero o kit'])
            ->assertForbidden()
            ->assertJsonPath('message', __('auth.campaign_shipping_required'));
    }

    public function test_company_sees_shipping_address_after_barter_application(): void
    {
        $campaign = $this->campaign(['is_barter' => true]);
        $creator = $this->applicant();
        $this->withToken($creator->user->createToken('auth')->plainTextToken)
            ->postJson("/api/campaigns/{$campaign->id}/apply", ['notes' => 'Quero o kit'])
            ->assertCreated();

        $admin = User::factory()->admin()->create();
        $this->flushHeaders();
        $this->app['auth']->forgetGuards();
        $this->withToken($admin->createToken('auth')->plainTextToken)
            ->getJson("/api/campaigns/{$campaign->id}")
            ->assertOk()
            ->assertJsonPath('data.applications.0.creator.shipping_address.street', 'Avenida Paulista')
            ->assertJsonPath('data.applications.0.creator.shipping_address.zip', '01310100');
    }

    public function test_age_limit_requires_a_range(): void
    {
        $admin = User::factory()->admin()->create();
        $company = Company::factory()->active()->create();

        $this->withToken($admin->createToken('auth')->plainTextToken)
            ->postJson('/api/campaigns', [
                'name' => 'Campanha 18+',
                'company_id' => $company->id,
                'is_barter' => true,
                'limit_by_age' => true,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['min_age']);

        $this->withToken($admin->createToken('auth')->plainTextToken)
            ->postJson('/api/campaigns', [
                'name' => 'Campanha faixa',
                'company_id' => $company->id,
                'is_barter' => true,
                'limit_by_age' => true,
                'min_age' => 25,
                'max_age' => 18,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['max_age']);
    }

    public function test_creator_can_save_birth_date_and_shipping_address(): void
    {
        $creator = $this->applicant([
            'birth_date' => null,
            'shipping_address' => null,
        ]);

        $this->withToken($creator->user->createToken('auth')->plainTextToken)
            ->patchJson("/api/creators/{$creator->id}", [
                'birth_date' => '1998-03-15',
                'shipping_address' => [
                    'zip' => '01310-100',
                    'street' => 'Avenida Paulista',
                    'number' => '1578',
                    'complement' => 'Apto 42',
                    'neighborhood' => 'Bela Vista',
                    'city' => 'São Paulo',
                    'state' => 'SP',
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.birth_date', '1998-03-15')
            ->assertJsonPath('data.shipping_address.zip', '01310100')
            ->assertJsonPath('data.shipping_address.number', '1578');
    }

    /**
     * @param  array<string, mixed>  $attrs
     */
    private function campaign(array $attrs = []): Campaign
    {
        return Campaign::factory()->create([
            'is_barter' => false,
            'is_secret' => false,
            'status' => CampaignStatus::Briefing,
            ...$attrs,
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
