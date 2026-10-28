<?php

namespace Tests\Feature;

use App\Enums\FinancePaymentStatus;
use App\Models\Campaign;
use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Creator;
use App\Models\CreatorCoupon;
use App\Models\FinancePayment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CouponEarningTest extends TestCase
{
    use RefreshDatabase;

    public function test_company_posts_several_monthly_earnings_and_opens_invoices(): void
    {
        $this->travelTo('2026-10-28');
        [$company, $user, $campaign, $ana, $bia] = $this->scene();

        $this->asUser($user)
            ->getJson('/api/coupon-earnings?month=2026-09')
            ->assertOk()
            ->assertJsonPath('data.month', '2026-09')
            ->assertJsonPath('data.rows.0.creator_id', $ana->id)
            ->assertJsonPath('data.rows.0.codes.0', '@anaBLACK')
            ->assertJsonPath('data.rows.0.amount', null)
            ->assertJsonPath('data.rows.1.creator_id', $bia->id)
            ->assertJsonCount(2, 'data.rows');

        $this->asUser($user)
            ->postJson('/api/coupon-earnings', [
                'month' => '2026-09',
                'entries' => [
                    ['creator_id' => $ana->id, 'amount' => 180.5],
                    ['creator_id' => $bia->id, 'amount' => 90],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Ganhos do mês lançados. Os criadores já podem enviar a nota fiscal.')
            ->assertJsonPath('data.rows.0.amount', 180.5)
            ->assertJsonPath('data.rows.0.payment_status', 'awaiting_invoice')
            ->assertJsonPath('data.rows.0.locked', false)
            ->assertJsonPath('data.rows.1.amount', 90);

        $this->assertDatabaseHas('finance_payments', [
            'company_id' => $company->id,
            'creator_id' => $ana->id,
            'source' => 'coupon',
            'campaign_id' => null,
            'amount' => 180.5,
            'status' => 'awaiting_invoice',
            'dedupe_key' => 'coupon:'.$company->id.':'.$ana->id.':2026-09-01',
        ]);
        $this->assertDatabaseHas('notifications', [
            'creator_id' => $ana->id,
            'link' => '/finance',
            'title' => 'Ganhos de cupom disponíveis',
        ]);

        $this->asUser($ana->user)
            ->getJson('/api/finance-payments?source=coupon')
            ->assertOk()
            ->assertJsonPath('data.0.source', 'coupon')
            ->assertJsonPath('data.0.title', 'Ganhos de cupom')
            ->assertJsonPath('data.0.status', 'awaiting_invoice')
            ->assertJsonPath('data.0.amount', 180.5)
            ->assertJsonPath('data.0.campaign_id', null)
            ->assertJsonPath('data.0.invoice_due_date', '2026-10-05')
            ->assertJsonPath('data.0.payment_due_date', '2026-10-15');

        $this->asUser($user)
            ->postJson('/api/coupon-earnings', [
                'month' => '2026-09',
                'entries' => [
                    ['creator_id' => $ana->id, 'amount' => 200],
                    ['creator_id' => $bia->id, 'amount' => 90],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.rows.0.amount', 200);

        $this->assertSame(2, FinancePayment::query()->count());
        $this->assertDatabaseCount('notifications', 2);

        $this->asUser($user)
            ->postJson('/api/coupon-earnings', [
                'month' => '2026-09',
                'entries' => [
                    ['creator_id' => $ana->id, 'amount' => null],
                    ['creator_id' => $bia->id, 'amount' => 90],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.rows.0.amount', null)
            ->assertJsonPath('data.rows.0.payment_status', null);

        $this->assertDatabaseMissing('finance_payments', [
            'creator_id' => $ana->id,
        ]);
        $this->assertDatabaseHas('finance_payments', [
            'creator_id' => $bia->id,
            'amount' => 90,
        ]);

        $this->asUser($user)
            ->postJson('/api/coupon-earnings', [
                'month' => '2026-11',
                'entries' => [
                    ['creator_id' => $ana->id, 'amount' => 10],
                ],
            ])
            ->assertUnprocessable()
            ->assertJsonPath('errors.month.0', 'O mês ainda não pode ser lançado.');
    }

    public function test_earnings_lock_after_the_invoice_is_sent_and_can_change_while_rejected(): void
    {
        $this->travelTo('2026-10-28');
        [$company, $user, $campaign, $ana] = $this->scene();

        $this->asUser($user)
            ->postJson('/api/coupon-earnings', [
                'month' => '2026-09',
                'entries' => [
                    ['creator_id' => $ana->id, 'amount' => 150],
                ],
            ])
            ->assertOk();

        $payment = FinancePayment::query()->where('creator_id', $ana->id)->firstOrFail();
        $payment->update(['status' => FinancePaymentStatus::Rejected]);

        $this->asUser($user)
            ->postJson('/api/coupon-earnings', [
                'month' => '2026-09',
                'entries' => [
                    ['creator_id' => $ana->id, 'amount' => 175],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.rows.0.amount', 175)
            ->assertJsonPath('data.rows.0.payment_status', 'rejected')
            ->assertJsonPath('data.rows.0.locked', false);

        $payment->update(['status' => FinancePaymentStatus::Submitted]);

        $this->asUser($user)
            ->postJson('/api/coupon-earnings', [
                'month' => '2026-09',
                'entries' => [
                    ['creator_id' => $ana->id, 'amount' => 400],
                ],
            ])
            ->assertUnprocessable()
            ->assertJsonPath('errors.entries.0', 'O ganho de Ana Cupom já está no financeiro e não pode ser alterado.');

        $this->assertSame('175.00', FinancePayment::query()->find($payment->id)->amount);

        $this->asUser($user)
            ->postJson('/api/coupon-earnings', [
                'month' => '2026-09',
                'entries' => [
                    ['creator_id' => $ana->id, 'amount' => 175],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.rows.0.locked', true);
    }

    public function test_only_the_company_managers_can_post_its_coupon_earnings(): void
    {
        $this->travelTo('2026-10-28');
        [$company, $user, $campaign, $ana] = $this->scene();
        $other = User::factory()->company()->create();
        $otherCompany = Company::factory()->active()->create();
        CompanyUser::factory()->active()->create([
            'user_id' => $other->id,
            'company_id' => $otherCompany->id,
        ]);
        $stranger = Creator::factory()->active()->create();

        $this->asUser($ana->user)
            ->postJson('/api/coupon-earnings', [
                'month' => '2026-09',
                'entries' => [
                    ['creator_id' => $ana->id, 'amount' => 10],
                ],
            ])
            ->assertForbidden();

        $this->asUser($other)
            ->getJson('/api/coupon-earnings?month=2026-09&company_id='.$company->id)
            ->assertOk()
            ->assertJsonPath('data.company_id', $otherCompany->id)
            ->assertJsonCount(0, 'data.rows');

        $this->asUser($user)
            ->postJson('/api/coupon-earnings', [
                'month' => '2026-09',
                'entries' => [
                    ['creator_id' => $stranger->id, 'amount' => 10],
                ],
            ])
            ->assertUnprocessable()
            ->assertJsonPath('errors.entries.0', 'Este criador não tem cupom nesta empresa.');

        $admin = User::factory()->admin()->create();
        $this->asUser($admin)
            ->getJson('/api/coupon-earnings?month=2026-09&company_id='.$company->id)
            ->assertOk()
            ->assertJsonPath('data.rows.0.creator_id', $ana->id);
    }

    /**
     * @return array{0: Company, 1: User, 2: Campaign, 3: Creator, 4: Creator}
     */
    private function scene(): array
    {
        $company = Company::factory()->active()->create(['name' => 'Marca Aurora']);
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
            'benefit_coupon_code' => 'BLACK',
            'benefit_discount_percent' => 15,
            'benefit_commission_percent' => 10,
            'total_budget' => 0,
            'creator_cache' => 0,
        ]);
        $ana = Creator::factory()->active()->create(['artistic_name' => 'Ana Cupom']);
        $bia = Creator::factory()->active()->create(['artistic_name' => 'Bia Cupom']);
        CreatorCoupon::query()->create([
            'company_id' => $company->id,
            'campaign_id' => $campaign->id,
            'creator_id' => $ana->id,
            'code' => '@anaBLACK',
            'discount_percent' => 15,
            'commission_percent' => 10,
            'is_active' => true,
            'is_auto' => true,
            'created_by' => $user->id,
        ]);
        CreatorCoupon::query()->create([
            'company_id' => $company->id,
            'campaign_id' => $campaign->id,
            'creator_id' => $bia->id,
            'code' => '@biaBLACK',
            'discount_percent' => 15,
            'commission_percent' => 10,
            'is_active' => true,
            'is_auto' => true,
            'created_by' => $user->id,
        ]);

        return [$company, $user, $campaign, $ana, $bia];
    }

    private function asUser(User $user): static
    {
        $this->flushHeaders();
        $this->app['auth']->forgetGuards();

        return $this->withHeaders(['Accept-Language' => 'pt-BR'])
            ->withToken($user->createToken('auth')->plainTextToken);
    }
}
