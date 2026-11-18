<?php

namespace Tests\Feature;

use App\Enums\RecurringPaymentMode;
use App\Models\Company;
use App\Models\Creator;
use App\Models\FinancePayment;
use App\Models\RecurringContract;
use App\Models\RecurringContractCreator;
use App\Models\User;
use App\Services\FinancePaymentSync;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RecurringPaymentModeTest extends TestCase
{
    use RefreshDatabase;

    public function test_barter_contract_stores_a_different_trade_per_creator_and_skips_cash(): void
    {
        $admin = User::factory()->admin()->create();
        $company = Company::factory()->active()->create();
        $token = $admin->createToken('auth')->plainTextToken;
        $ana = Creator::factory()->active()->create();
        $bruno = Creator::factory()->active()->create();

        $id = $this->withToken($token)
            ->postJson('/api/recurring-contracts', [
                'company_id' => $company->id,
                'title' => 'Embaixadores permuta',
                'payment_mode' => 'barter',
                'monthly_fee' => 9000,
                'start_date' => now()->toDateString(),
            ])
            ->assertCreated()
            ->assertJsonPath('data.payment_mode', 'barter')
            ->assertJsonPath('data.monthly_fee', 0)
            ->json('data.id');

        $companyId = $company->id;

        $this->withToken($token)
            ->postJson("/api/recurring-contracts/{$id}/creators", [
                'creator_id' => $ana->id,
                'start_date' => now()->toDateString(),
                'monthly_cache' => 1500,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['barter_details']);

        $this->withToken($token)
            ->postJson("/api/recurring-contracts/{$id}/creators", [
                'creator_id' => $ana->id,
                'start_date' => now()->toDateString(),
                'barter_details' => 'Kit mensal de skincare',
            ])
            ->assertCreated()
            ->assertJsonPath('data.monthly_cache', '0.00')
            ->assertJsonPath('data.barter_details', 'Kit mensal de skincare');

        $this->withToken($token)
            ->postJson("/api/recurring-contracts/{$id}/creators", [
                'creator_id' => $bruno->id,
                'start_date' => now()->toDateString(),
                'barter_details' => 'Hospedagem no hotel da marca',
            ])
            ->assertCreated();

        $this->withToken($token)
            ->getJson("/api/recurring-contracts/{$id}")
            ->assertOk()
            ->assertJsonPath('data.payment_mode', 'barter')
            ->assertJsonFragment(['creator_id' => $ana->id, 'barter_details' => 'Kit mensal de skincare'])
            ->assertJsonFragment(['creator_id' => $bruno->id, 'barter_details' => 'Hospedagem no hotel da marca']);

        app(FinancePaymentSync::class)->sync($companyId, $ana->id);

        $this->assertSame(0, FinancePayment::query()->where('recurring_contract_id', $id)->count());
    }

    public function test_mixed_contract_accepts_cash_barter_or_both_per_creator(): void
    {
        $admin = User::factory()->admin()->create();
        $token = $admin->createToken('auth')->plainTextToken;
        $contract = RecurringContract::factory()->create([
            'payment_mode' => RecurringPaymentMode::Mixed,
            'monthly_fee' => 4000,
            'start_date' => now()->startOfMonth()->toDateString(),
            'end_date' => now()->startOfMonth()->toDateString(),
        ]);
        $cashOnly = Creator::factory()->active()->create();
        $barterOnly = Creator::factory()->active()->create();
        $both = Creator::factory()->active()->create();

        $this->withToken($token)
            ->postJson("/api/recurring-contracts/{$contract->id}/creators", [
                'creator_id' => $cashOnly->id,
                'start_date' => now()->toDateString(),
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['barter_details']);

        $this->withToken($token)
            ->postJson("/api/recurring-contracts/{$contract->id}/creators", [
                'creator_id' => $cashOnly->id,
                'start_date' => now()->toDateString(),
                'monthly_cache' => 1200,
            ])
            ->assertCreated()
            ->assertJsonPath('data.barter_details', null);

        $this->withToken($token)
            ->postJson("/api/recurring-contracts/{$contract->id}/creators", [
                'creator_id' => $barterOnly->id,
                'start_date' => now()->toDateString(),
                'barter_details' => 'Vale-experiência',
            ])
            ->assertCreated()
            ->assertJsonPath('data.monthly_cache', '0.00');

        $this->withToken($token)
            ->postJson("/api/recurring-contracts/{$contract->id}/creators", [
                'creator_id' => $both->id,
                'start_date' => now()->toDateString(),
                'monthly_cache' => 500,
                'barter_details' => 'Produto + cachê reduzido',
            ])
            ->assertCreated()
            ->assertJsonPath('data.barter_details', 'Produto + cachê reduzido');

        app(FinancePaymentSync::class)->sync($contract->company_id);

        $this->assertSame(1, FinancePayment::query()->where('recurring_contract_id', $contract->id)->where('creator_id', $cashOnly->id)->count());
        $this->assertSame(0, FinancePayment::query()->where('recurring_contract_id', $contract->id)->where('creator_id', $barterOnly->id)->count());
        $this->assertSame(1, FinancePayment::query()->where('recurring_contract_id', $contract->id)->where('creator_id', $both->id)->count());
    }

    public function test_cash_contract_clears_barter_details(): void
    {
        $admin = User::factory()->admin()->create();
        $contract = RecurringContract::factory()->create([
            'payment_mode' => RecurringPaymentMode::Cash,
        ]);
        $creator = Creator::factory()->active()->create();

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/recurring-contracts/{$contract->id}/creators", [
                'creator_id' => $creator->id,
                'start_date' => now()->toDateString(),
                'monthly_cache' => 900,
                'barter_details' => 'Não deve gravar',
            ])
            ->assertCreated()
            ->assertJsonPath('data.barter_details', null);

        $this->assertNull(RecurringContractCreator::query()->where('creator_id', $creator->id)->value('barter_details'));
    }
}
