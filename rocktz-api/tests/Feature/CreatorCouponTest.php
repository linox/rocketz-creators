<?php

namespace Tests\Feature;

use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Creator;
use App\Models\CreatorCoupon;
use App\Enums\MailTemplateKey;
use App\Models\MailMessage;
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
            ->patchJson('/api/coupons/'.$coupon->id, [
                'is_active' => false,
                'inactive_reason' => 'Campanha encerrada',
            ])
            ->assertOk()
            ->assertJsonPath('data.is_active', false)
            ->assertJsonPath('data.inactive_reason', 'Campanha encerrada')
            ->assertJsonPath('data.name_complete', true);

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

    public function test_company_and_agency_can_create_a_manual_coupon_without_a_campaign(): void
    {
        [$company, $user, , $creator] = $this->couponScene();
        $outside = Creator::factory()->active()->create();

        $this->asUser($creator->user)
            ->postJson('/api/coupons', [
                'manual' => true,
                'creator_id' => $creator->id,
                'code' => 'LIVRE10',
                'discount_percent' => 10,
                'commission_percent' => 5,
            ])
            ->assertForbidden();

        $this->asUser($user)
            ->postJson('/api/coupons', [
                'manual' => true,
                'creator_id' => $outside->id,
                'code' => 'FORA10',
                'discount_percent' => 10,
                'commission_percent' => 5,
            ])
            ->assertUnprocessable()
            ->assertJsonPath('errors.creator_id.0', 'Escolha um criador ativo disponível para esta empresa.');

        $created = $this->asUser($user)
            ->postJson('/api/coupons', [
                'manual' => true,
                'creator_id' => $creator->id,
                'code' => 'livre 10',
                'discount_percent' => 12,
                'commission_percent' => 6,
            ])
            ->assertCreated()
            ->assertJsonPath('data.code', 'LIVRE10')
            ->assertJsonPath('data.campaign_id', null)
            ->assertJsonPath('data.discount_percent', 12)
            ->assertJsonPath('data.commission_percent', 6);

        $this->assertDatabaseHas('creator_coupons', [
            'id' => $created->json('data.id'),
            'creator_id' => $creator->id,
            'code' => 'LIVRE10',
            'campaign_id' => null,
            'is_auto' => false,
        ]);

        $this->assertDatabaseHas('notifications', [
            'creator_id' => $creator->id,
            'title' => 'Você recebeu um cupom',
            'link' => '/coupons',
        ]);

        $this->asUser($creator->user)
            ->getJson('/api/coupons')
            ->assertOk()
            ->assertJsonFragment(['code' => 'LIVRE10']);

        $options = $this->asUser($user)
            ->getJson('/api/coupons/options?company_id='.$company->id)
            ->assertOk()
            ->json('data.creators');
        $this->assertContains($creator->id, collect($options)->pluck('id')->all());
        $this->assertNotContains($outside->id, collect($options)->pluck('id')->all());

        $admin = User::factory()->admin()->create();
        $this->asUser($admin)
            ->postJson('/api/coupons', [
                'manual' => true,
                'company_id' => $company->id,
                'creator_id' => $outside->id,
                'code' => 'AGENCIA20',
                'discount_percent' => 20,
                'commission_percent' => 8,
            ])
            ->assertCreated()
            ->assertJsonPath('data.campaign_id', null)
            ->assertJsonPath('data.code', 'AGENCIA20')
            ->assertJsonPath('data.creator_id', $outside->id);
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

    public function test_export_downloads_every_coupon_the_account_can_see(): void
    {
        [$company, $user, $campaign, $creator] = $this->couponScene();
        $company->forceFill(['name' => 'Loja Aurora'])->save();
        $other = Creator::factory()->active()->create([
            'artistic_name' => 'Zoe Cupom',
            'full_name' => 'Zoe Cupom',
            'invited_by_company_id' => $company->id,
        ]);
        CreatorCoupon::query()->create([
            'company_id' => $company->id,
            'campaign_id' => $campaign->id,
            'creator_id' => $creator->id,
            'code' => 'ANA15',
            'discount_percent' => 15,
            'commission_percent' => 10,
            'is_active' => true,
        ]);
        CreatorCoupon::query()->create([
            'company_id' => $company->id,
            'campaign_id' => null,
            'creator_id' => $other->id,
            'code' => 'MANUAL20',
            'discount_percent' => 10.5,
            'commission_percent' => 4,
            'is_active' => false,
            'suggested_code' => 'ZOE20',
            'change_status' => 'pending',
        ]);

        $otherCompany = Company::factory()->active()->create(['name' => 'Outra Loja']);
        $stranger = Creator::factory()->active()->create();
        CreatorCoupon::query()->create([
            'company_id' => $otherCompany->id,
            'creator_id' => $stranger->id,
            'code' => 'SEGREDO',
            'discount_percent' => 5,
            'commission_percent' => 1,
            'is_active' => true,
        ]);

        $csv = $this->asUser($user)
            ->get('/api/coupons/export')
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8')
            ->assertHeader('content-disposition', 'attachment; filename="cupons.csv"');

        $text = $csv->getContent();
        $this->assertStringStartsWith("\xEF\xBB\xBF", $text);
        $this->assertStringContainsString('codigo;criador;empresa;campanha;desconto;comissao;status;codigo_sugerido;criado_em;razao', $text);
        $this->assertStringContainsString('ANA15;"Ana Cupom";"Loja Aurora";"Cupom Aurora";15;10;Ativo;;', $text);
        $this->assertStringContainsString('MANUAL20;"Zoe Cupom";"Loja Aurora";Manual;10,50;4;Pausado;ZOE20;', $text);
        $this->assertStringNotContainsString('SEGREDO', $text);

        $own = $this->asUser($creator->user)
            ->get('/api/coupons/export')
            ->assertOk()
            ->getContent();
        $this->assertStringContainsString('ANA15', $own);
        $this->assertStringNotContainsString('MANUAL20', $own);
        $this->assertStringNotContainsString('SEGREDO', $own);

        $admin = User::factory()->admin()->create();
        $scoped = $this->asUser($admin)
            ->get('/api/coupons/export?company_id='.$company->id)
            ->assertOk()
            ->getContent();
        $this->assertStringContainsString('ANA15', $scoped);
        $this->assertStringContainsString('MANUAL20', $scoped);
        $this->assertStringNotContainsString('SEGREDO', $scoped);
    }

    public function test_incomplete_name_blocks_activation_and_emails_the_creator(): void
    {
        [$company, $user, $campaign] = $this->couponScene();
        $creator = Creator::factory()->active()->create([
            'artistic_name' => 'Ana',
            'full_name' => 'Ana',
            'invited_by_company_id' => $company->id,
        ]);
        CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => $creator->id,
        ]);

        $created = $this->asUser($user)
            ->postJson('/api/coupons', [
                'campaign_id' => $campaign->id,
                'creator_id' => $creator->id,
                'code' => 'ANA15',
            ])
            ->assertCreated()
            ->assertJsonPath('data.is_active', false)
            ->assertJsonPath('data.name_complete', false)
            ->assertJsonPath('data.inactive_reason', 'Nome incompleto. O cadastro precisa ter nome e pelo menos um sobrenome para participar.');

        $this->assertDatabaseMissing('notifications', [
            'creator_id' => $creator->id,
            'title' => 'Você recebeu um cupom',
        ]);
        $this->assertSame(1, MailMessage::query()->where('template_key', MailTemplateKey::CouponIncompleteName)->count());

        $couponId = $created->json('data.id');

        $this->asUser($user)
            ->patchJson('/api/coupons/'.$couponId, ['is_active' => true])
            ->assertUnprocessable()
            ->assertJsonPath('errors.is_active.0', 'O cupom só pode ser ativado com nome e pelo menos um sobrenome no cadastro.');

        $this->asUser($user)
            ->patchJson('/api/coupons/'.$couponId, ['is_active' => false])
            ->assertUnprocessable()
            ->assertJsonPath('errors.inactive_reason.0', 'Informe o motivo da inativação, com até 500 caracteres.');

        $this->asUser($user)
            ->patchJson('/api/coupons/'.$couponId, [
                'is_active' => false,
                'inactive_reason' => 'Falta o sobrenome para participar',
            ])
            ->assertOk()
            ->assertJsonPath('data.inactive_reason', 'Falta o sobrenome para participar');

        $this->assertSame(2, MailMessage::query()->where('template_key', MailTemplateKey::CouponIncompleteName)->count());
        $this->assertSame(
            $creator->user->email,
            MailMessage::query()->where('template_key', MailTemplateKey::CouponIncompleteName)->latest('id')->value('email'),
        );

        $creator->update(['full_name' => 'Ana Silva']);

        $this->asUser($user)
            ->patchJson('/api/coupons/'.$couponId, ['is_active' => true])
            ->assertOk()
            ->assertJsonPath('data.is_active', true)
            ->assertJsonPath('data.name_complete', true)
            ->assertJsonPath('data.inactive_reason', null);

        $issued = app(CreatorCouponIssuer::class)->issue($campaign->fresh(), $creator->fresh(['user']), false);
        $this->assertTrue($issued->is_active);

        $solo = Creator::factory()->active()->create([
            'full_name' => 'Zoe',
            'artistic_name' => 'Zoe',
        ]);
        CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => $solo->id,
        ]);
        $inactive = app(CreatorCouponIssuer::class)->issue($campaign->fresh(), $solo->fresh(['user']));
        $this->assertFalse($inactive->is_active);
        $this->assertSame(
            'Nome incompleto. O cadastro precisa ter nome e pelo menos um sobrenome para participar.',
            $inactive->inactive_reason,
        );
        $this->assertSame(3, MailMessage::query()->where('template_key', MailTemplateKey::CouponIncompleteName)->count());
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
            'full_name' => 'Ana Cupom',
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
