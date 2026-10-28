<?php

namespace Tests\Feature;

use App\Enums\CampaignStatus;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Creator;
use App\Models\CreatorContractAcceptance;
use App\Models\CreatorCoupon;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CampaignBenefitCouponTest extends TestCase
{
    use RefreshDatabase;

    public function test_company_can_create_a_benefit_coupon_campaign_without_cache(): void
    {
        [$user] = $this->companyUser();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/campaigns', [
                'name' => 'Campanha cupom',
                'is_benefit_coupon' => true,
                'benefit_coupon_code' => 'cricut 15',
                'benefit_discount_percent' => 15,
                'benefit_commission_percent' => 10,
            ])
            ->assertCreated()
            ->assertJsonPath('data.is_benefit_coupon', true)
            ->assertJsonPath('data.benefit_coupon_code', 'CRICUT15')
            ->assertJsonPath('data.benefit_discount_percent', 15)
            ->assertJsonPath('data.benefit_commission_percent', 10)
            ->assertJsonPath('data.total_budget', 0)
            ->assertJsonPath('data.creator_cache', 0);

        $this->assertDatabaseHas('campaigns', [
            'name' => 'Campanha cupom',
            'is_benefit_coupon' => true,
            'benefit_coupon_code' => 'CRICUT15',
            'is_barter' => false,
        ]);
    }

    public function test_benefit_coupon_requires_discount_and_commission(): void
    {
        [$user] = $this->companyUser();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/campaigns', [
                'name' => 'Campanha incompleta',
                'is_benefit_coupon' => true,
                'benefit_coupon_code' => 'AB',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('message', __('auth.benefit_coupon_required'));
    }

    public function test_benefit_coupon_cannot_be_combined_with_barter(): void
    {
        [$user] = $this->companyUser();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/campaigns', [
                'name' => 'Campanha mista',
                'is_barter' => true,
                'is_benefit_coupon' => true,
                'benefit_coupon_code' => 'MISTA10',
                'benefit_discount_percent' => 10,
                'benefit_commission_percent' => 5,
            ])
            ->assertUnprocessable()
            ->assertJsonPath('message', __('auth.benefit_coupon_exclusive'));
    }

    public function test_turning_the_coupon_off_clears_the_terms(): void
    {
        $campaign = Campaign::factory()->create([
            'is_benefit_coupon' => true,
            'benefit_coupon_code' => 'AURORA10',
            'benefit_discount_percent' => 10,
            'benefit_commission_percent' => 8,
            'total_budget' => 0,
            'creator_cache' => 0,
        ]);
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/campaigns/{$campaign->id}", [
                'is_benefit_coupon' => false,
                'creator_cache' => 500,
                'total_budget' => 2000,
            ])
            ->assertOk()
            ->assertJsonPath('data.is_benefit_coupon', false)
            ->assertJsonPath('data.benefit_coupon_code', null)
            ->assertJsonPath('data.benefit_discount_percent', null)
            ->assertJsonPath('data.benefit_commission_percent', null);

        $fresh = $campaign->fresh();
        $this->assertFalse($fresh->is_benefit_coupon);
        $this->assertNull($fresh->benefit_coupon_code);
        $this->assertSame('500.00', $fresh->creator_cache);
    }

    public function test_creators_see_the_coupon_offer_on_available_campaigns(): void
    {
        $campaign = Campaign::factory()->create([
            'is_secret' => false,
            'status' => CampaignStatus::Briefing,
            'is_benefit_coupon' => true,
            'benefit_coupon_code' => 'LOJA20',
            'benefit_discount_percent' => 20,
            'benefit_commission_percent' => 12.5,
            'total_budget' => 0,
            'creator_cache' => 0,
        ]);
        $applicant = $this->applicant();

        $available = $this->actingAs($applicant->user, 'sanctum')
            ->getJson('/api/campaigns/available')
            ->assertOk()
            ->json('data');

        $listed = collect($available)->firstWhere('id', $campaign->id);
        $this->assertTrue($listed['is_benefit_coupon']);
        $this->assertSame('LOJA20', $listed['benefit_coupon_code']);
        $this->assertEquals(20, $listed['benefit_discount_percent']);
        $this->assertEquals(12.5, $listed['benefit_commission_percent']);
    }

    public function test_approving_a_creator_builds_the_coupon_from_their_handle(): void
    {
        [$user, $company] = $this->companyUser();
        $created = $this->actingAs($user, 'sanctum')
            ->postJson('/api/campaigns', [
                'name' => 'Cupom automatico',
                'is_benefit_coupon' => true,
                'benefit_coupon_code' => 'black',
                'benefit_discount_percent' => 15,
                'benefit_commission_percent' => 10,
            ])
            ->assertCreated()
            ->assertJsonPath('data.benefit_coupon_code', 'BLACK');

        $creator = Creator::factory()->active()->create([
            'artistic_name' => 'Ana',
            'socials' => ['instagram' => '@ana.ugc'],
        ]);
        $participation = CampaignCreator::factory()->create([
            'campaign_id' => $created->json('data.id'),
            'creator_id' => $creator->id,
        ]);

        $this->actingAs($user, 'sanctum')
            ->patchJson('/api/campaign-creators/'.$participation->id, [
                'application_status' => 'approved',
            ])
            ->assertOk();

        $coupon = CreatorCoupon::query()->where('campaign_id', $created->json('data.id'))->first();
        $this->assertNotNull($coupon);
        $this->assertSame('@ana.ugcBLACK', $coupon->code);
        $this->assertSame($company->id, $coupon->company_id);
        $this->assertTrue($coupon->is_auto);
        $this->assertEquals(15, (float) $coupon->discount_percent);

        $this->actingAs($creator->user, 'sanctum')
            ->getJson('/api/coupons')
            ->assertOk()
            ->assertJsonPath('data.0.code', '@ana.ugcBLACK');
    }

    public function test_benefit_coupon_can_be_created_with_percentages_only(): void
    {
        [$user] = $this->companyUser();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/campaigns', [
                'name' => 'So porcentagem',
                'is_benefit_coupon' => true,
                'benefit_discount_percent' => 10,
                'benefit_commission_percent' => 5,
            ])
            ->assertCreated()
            ->assertJsonPath('data.benefit_coupon_code', null)
            ->assertJsonPath('data.benefit_discount_percent', 10);
    }

    /**
     * @return array{0: User, 1: Company}
     */
    private function companyUser(): array
    {
        $company = Company::factory()->active()->create();
        $user = User::factory()->company()->create();
        CompanyUser::factory()->active()->create([
            'user_id' => $user->id,
            'company_id' => $company->id,
        ]);

        return [$user, $company];
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
