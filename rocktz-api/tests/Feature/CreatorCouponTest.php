<?php

namespace Tests\Feature;

use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Creator;
use App\Models\CreatorCoupon;
use App\Models\User;
use App\Services\CreatorCouponIssuer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CreatorCouponTest extends TestCase
{
    use RefreshDatabase;

    public function test_company_registers_a_personal_coupon_for_an_approved_creator(): void
    {
        [$company, $user, $campaign, $creator] = $this->couponScene();

        $created = $this->asUser($user)
            ->postJson('/api/coupons', [
                'campaign_id' => $campaign->id,
                'creator_id' => $creator->id,
                'code' => 'ana 15',
            ])
            ->assertCreated()
            ->assertJsonPath('data.code', 'ANA15')
            ->assertJsonPath('data.discount_percent', 15)
            ->assertJsonPath('data.commission_percent', 10)
            ->assertJsonPath('data.company_id', $company->id)
            ->assertJsonPath('data.creator.artistic_name', $creator->artistic_name);

        $this->assertDatabaseHas('notifications', [
            'creator_id' => $creator->id,
            'campaign_id' => $campaign->id,
            'link' => '/coupons',
            'title' => 'Você recebeu um cupom',
        ]);

        $this->asUser($user)
            ->getJson('/api/coupons')
            ->assertOk()
            ->assertJsonPath('data.0.id', $created->json('data.id'));

        $this->asUser($creator->user)
            ->getJson('/api/coupons')
            ->assertOk()
            ->assertJsonPath('data.0.code', 'ANA15')
            ->assertJsonPath('data.0.campaign.name', $campaign->name);
    }

    public function test_rejects_pending_creators_other_campaigns_and_duplicates(): void
    {
        [$company, $user, $campaign, $creator] = $this->couponScene();
        $pending = Creator::factory()->active()->create();
        CampaignCreator::factory()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => $pending->id,
        ]);
        $plain = Campaign::factory()->create([
            'company_id' => $company->id,
            'is_benefit_coupon' => false,
        ]);
        CampaignCreator::factory()->approved()->create([
            'campaign_id' => $plain->id,
            'creator_id' => $creator->id,
        ]);

        $this->asUser($user)
            ->postJson('/api/coupons', [
                'campaign_id' => $campaign->id,
                'creator_id' => $pending->id,
                'code' => 'PENDENTE',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('errors.creator_id.0', 'O criador precisa estar aprovado nessa campanha de cupom.');

        $this->asUser($user)
            ->postJson('/api/coupons', [
                'campaign_id' => $plain->id,
                'creator_id' => $creator->id,
                'code' => 'SEMCUPOM',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('errors.campaign_id.0', 'Escolha uma campanha de cupom de benefícios desta empresa.');

        $this->asUser($user)
            ->postJson('/api/coupons', [
                'campaign_id' => $campaign->id,
                'creator_id' => $creator->id,
                'code' => 'ANA15',
                'discount_percent' => 20,
                'commission_percent' => 8,
            ])
            ->assertCreated();

        $this->asUser($user)
            ->postJson('/api/coupons', [
                'campaign_id' => $campaign->id,
                'creator_id' => $creator->id,
                'code' => 'ANA16',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('errors.creator_id.0', 'Esse criador já tem um cupom nesta campanha.');

        $other = Creator::factory()->active()->create();
        CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => $other->id,
        ]);

        $this->asUser($user)
            ->postJson('/api/coupons', [
                'campaign_id' => $campaign->id,
                'creator_id' => $other->id,
                'code' => 'ana15',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('errors.code.0', 'Esta empresa já usa esse código em outro cupom.');
    }

    public function test_creator_cannot_manage_and_company_cannot_see_another_company(): void
    {
        [, $user, $campaign, $creator] = $this->couponScene();
        $coupon = CreatorCoupon::query()->create([
            'company_id' => $campaign->company_id,
            'campaign_id' => $campaign->id,
            'creator_id' => $creator->id,
            'code' => 'AURORA10',
            'discount_percent' => 10,
            'commission_percent' => 5,
            'is_active' => true,
        ]);

        $this->asUser($creator->user)
            ->postJson('/api/coupons', [
                'campaign_id' => $campaign->id,
                'creator_id' => $creator->id,
                'code' => 'NOPE',
            ])
            ->assertForbidden();

        $otherCompany = Company::factory()->active()->create();
        $otherUser = User::factory()->company()->create();
        CompanyUser::factory()->active()->create([
            'user_id' => $otherUser->id,
            'company_id' => $otherCompany->id,
        ]);

        $this->asUser($otherUser)
            ->getJson('/api/coupons?company_id='.$campaign->company_id)
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->asUser($otherUser)
            ->patchJson('/api/coupons/'.$coupon->id, ['is_active' => false])
            ->assertForbidden();

        $this->asUser($user)
            ->patchJson('/api/coupons/'.$coupon->id, ['is_active' => false])
            ->assertOk()
            ->assertJsonPath('data.is_active', false);

        $this->asUser($creator->user)
            ->getJson('/api/coupons')
            ->assertOk()
            ->assertJsonPath('data.0.is_active', false);
    }

    public function test_options_list_only_approved_creators_on_coupon_campaigns(): void
    {
        [$company, $user, $campaign, $creator] = $this->couponScene();
        $pending = Creator::factory()->active()->create();
        CampaignCreator::factory()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => $pending->id,
        ]);

        $options = $this->asUser($user)
            ->getJson('/api/coupons/options?company_id='.$company->id)
            ->assertOk()
            ->json('data.campaigns');

        $row = collect($options)->firstWhere('id', $campaign->id);
        $this->assertNotNull($row);
        $this->assertSame($campaign->name, $row['name']);
        $ids = collect($row['creators'])->pluck('id')->all();
        $this->assertContains($creator->id, $ids);
        $this->assertNotContains($pending->id, $ids);
    }

    public function test_creator_suggests_a_new_code_and_the_company_approval_replaces_it(): void
    {
        [$company, $user, $campaign, $creator] = $this->couponScene();
        $coupon = CreatorCoupon::query()->create([
            'company_id' => $company->id,
            'campaign_id' => $campaign->id,
            'creator_id' => $creator->id,
            'code' => 'ana.ugcAURORA',
            'discount_percent' => 15,
            'commission_percent' => 10,
            'is_active' => true,
            'is_auto' => true,
        ]);

        $this->asUser($user)
            ->postJson('/api/coupons/'.$coupon->id.'/change-request', [
                'suggested_code' => 'ANA15',
            ])
            ->assertForbidden();

        $this->asUser($creator->user)
            ->postJson('/api/coupons/'.$coupon->id.'/change-request', [
                'suggested_code' => 'ana.ugcAURORA',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('errors.suggested_code.0', 'A sugestão precisa ser diferente do código atual.');

        $this->asUser($creator->user)
            ->postJson('/api/coupons/'.$coupon->id.'/change-request', [
                'suggested_code' => '@ana 15',
                'note' => 'Fica mais curto para a bio.',
            ])
            ->assertOk()
            ->assertJsonPath('data.code', 'ana.ugcAURORA')
            ->assertJsonPath('data.change_request.status', 'pending')
            ->assertJsonPath('data.change_request.suggested_code', 'ANA15')
            ->assertJsonPath('data.change_request.note', 'Fica mais curto para a bio.');

        $this->assertDatabaseHas('notifications', [
            'user_id' => $user->id,
            'title' => 'Alteração de cupom',
            'link' => '/coupons',
        ]);

        $other = Creator::factory()->active()->create();
        $this->asUser($other->user)
            ->postJson('/api/coupons/'.$coupon->id.'/change-request', [
                'suggested_code' => 'OUTRO',
            ])
            ->assertForbidden();

        $this->asUser($user)
            ->postJson('/api/coupons/'.$coupon->id.'/change-request/approve')
            ->assertOk()
            ->assertJsonPath('data.code', 'ANA15')
            ->assertJsonPath('data.change_request', null);

        $coupon->refresh();
        $this->assertFalse($coupon->is_auto);
        $this->assertSame('ANA15', $coupon->code);

        app(CreatorCouponIssuer::class)->issue($campaign->fresh(), $creator->fresh(), false);
        $this->assertSame('ANA15', $coupon->fresh()->code);

        $this->assertDatabaseHas('notifications', [
            'creator_id' => $creator->id,
            'title' => 'Cupom atualizado',
        ]);
    }

    public function test_rejected_coupon_change_keeps_the_current_code(): void
    {
        [, $user, $campaign, $creator] = $this->couponScene();
        $coupon = CreatorCoupon::query()->create([
            'company_id' => $campaign->company_id,
            'campaign_id' => $campaign->id,
            'creator_id' => $creator->id,
            'code' => 'AURORA10',
            'discount_percent' => 10,
            'commission_percent' => 5,
            'is_active' => true,
            'is_auto' => true,
        ]);

        $this->asUser($creator->user)
            ->postJson('/api/coupons/'.$coupon->id.'/change-request', [
                'suggested_code' => 'ANA20',
            ])
            ->assertOk();

        $this->asUser($user)
            ->postJson('/api/coupons/'.$coupon->id.'/change-request/reject')
            ->assertOk()
            ->assertJsonPath('data.code', 'AURORA10')
            ->assertJsonPath('data.change_request.status', 'rejected')
            ->assertJsonPath('data.change_request.suggested_code', 'ANA20');

        $this->asUser($user)
            ->postJson('/api/coupons/'.$coupon->id.'/change-request/approve')
            ->assertUnprocessable();

        $this->asUser($creator->user)
            ->deleteJson('/api/coupons/'.$coupon->id.'/change-request')
            ->assertOk()
            ->assertJsonPath('data.change_request', null);

        $this->assertSame('AURORA10', $coupon->fresh()->code);
    }

    /**
     * @return array{0: Company, 1: User, 2: Campaign, 3: Creator}
     */
    private function couponScene(): array
    {
        $company = Company::factory()->active()->create();
        $user = User::factory()->company()->create();
        CompanyUser::factory()->active()->create([
            'user_id' => $user->id,
            'company_id' => $company->id,
        ]);
        $campaign = Campaign::factory()->create([
            'company_id' => $company->id,
            'name' => 'Cupom Aurora',
            'is_benefit_coupon' => true,
            'is_barter' => false,
            'benefit_coupon_code' => 'AURORA',
            'benefit_discount_percent' => 15,
            'benefit_commission_percent' => 10,
            'total_budget' => 0,
            'creator_cache' => 0,
            'agency_fee' => 0,
            'creators_budget' => 0,
        ]);
        $creator = Creator::factory()->active()->create([
            'artistic_name' => 'Ana Cupom',
            'invited_by_company_id' => $company->id,
        ]);
        CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => $creator->id,
        ]);

        return [$company, $user, $campaign, $creator];
    }

    private function asUser(User $user): static
    {
        $this->flushHeaders();
        $this->app['auth']->forgetGuards();

        return $this->withHeaders(['Accept-Language' => 'pt-BR'])
            ->withToken($user->createToken('auth')->plainTextToken);
    }
}
