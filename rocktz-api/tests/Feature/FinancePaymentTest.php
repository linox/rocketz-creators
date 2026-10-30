<?php

namespace Tests\Feature;

use App\Enums\ApplicationStatus;
use App\Enums\MailTemplateKey;
use App\Enums\PaymentStatus;
use App\Enums\Permission;
use App\Enums\RecurringContractStatus;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Creator;
use App\Models\FinancePayment;
use App\Models\MailMessage;
use App\Models\MediaFile;
use App\Models\RecurringContract;
use App\Models\RecurringContractCreator;
use App\Models\User;
use App\Services\PermissionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class FinancePaymentTest extends TestCase
{
    use RefreshDatabase;

    public function test_finance_area_lists_payable_campaigns_and_recurring_months_by_company(): void
    {
        $this->travelTo('2026-10-28');
        [$company, $manager, $creator, $campaign, $participation] = $this->scene();
        $creator->update([
            'pix_key' => 'ana@pix.test',
            'bank_account' => [
                'holder_name' => 'Ana Silva',
                'bank_name' => 'Nubank',
                'agency' => '0001',
                'account' => '12345-6',
                'account_type' => 'checking',
                'pix_key' => '11999998888',
                'pix_type' => 'phone',
            ],
        ]);

        $barter = Campaign::factory()->create([
            'company_id' => $company->id,
            'is_barter' => true,
            'name' => 'Permuta',
        ]);
        CampaignCreator::factory()->approved()->create([
            'campaign_id' => $barter->id,
            'creator_id' => $creator->id,
            'amount' => 900,
        ]);
        CampaignCreator::factory()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => Creator::factory()->active()->create()->id,
            'application_status' => ApplicationStatus::Pending,
            'amount' => 700,
        ]);

        $contract = RecurringContract::factory()->create([
            'company_id' => $company->id,
            'title' => 'Pauta mensal',
            'status' => RecurringContractStatus::Active,
            'start_date' => '2026-10-01',
            'end_date' => '2026-12-31',
            'currency' => 'BRL',
        ]);
        RecurringContractCreator::factory()->create([
            'recurring_contract_id' => $contract->id,
            'creator_id' => $creator->id,
            'monthly_cache' => 800,
            'start_date' => '2026-10-01',
        ]);
        RecurringContractCreator::factory()->create([
            'recurring_contract_id' => $contract->id,
            'creator_id' => Creator::factory()->active()->create()->id,
            'monthly_cache' => 0,
        ]);

        $listed = $this->asUser($manager)
            ->getJson('/api/finance-payments?company_id='.$company->id)
            ->assertOk()
            ->assertJsonPath('meta.company.invoice_due_day', 5)
            ->assertJsonPath('meta.company.payment_due_day', 15)
            ->assertJsonPath('meta.company.invoice_data_campaign', null);

        $rows = collect($listed->json('data'));
        $this->assertCount(2, $rows);
        $campaignRow = $rows->firstWhere('campaign_id', $campaign->id);
        $recurringRow = $rows->firstWhere('recurring_contract_id', $contract->id);
        $this->assertNotNull($campaignRow);
        $this->assertSame('awaiting_invoice', $campaignRow['status']);
        $this->assertEquals(1500, $campaignRow['amount']);
        $this->assertSame('2026-11-05', $campaignRow['invoice_due_date']);
        $this->assertSame('2026-11-15', $campaignRow['payment_due_date']);
        $this->assertSame($participation->id, $campaignRow['campaign_creator_id']);
        $this->assertSame('2026-10-01', $recurringRow['reference_month']);
        $this->assertEquals(800, $recurringRow['amount']);
        $this->assertFalse($rows->contains(fn (array $row) => ($row['title'] ?? null) === 'Permuta'));
        $this->assertNull($campaignRow['invoice_data']);
        $this->assertSame('Ana Silva', $campaignRow['creator']['bank_account']['holder_name']);
        $this->assertSame('11999998888', $campaignRow['creator']['bank_account']['pix_key']);

        DB::table('creators')->where('id', $creator->id)->update([
            'pix_key' => 'legado@pix.test',
            'bank_account' => '',
        ]);
        $legacy = $this->asUser($manager)
            ->getJson('/api/finance-payments?company_id='.$company->id)
            ->assertOk();
        $legacyRow = collect($legacy->json('data'))->firstWhere('campaign_id', $campaign->id);
        $this->assertSame('legado@pix.test', $legacyRow['creator']['pix_key']);
        $this->assertNull($legacyRow['creator']['bank_account']);

        $own = $this->asUser($creator->user)
            ->getJson('/api/finance-payments')
            ->assertOk()
            ->assertJsonCount(2, 'data');
        $this->assertArrayNotHasKey('pix_key', $own->json('data.0.creator'));
        $this->assertArrayNotHasKey('bank_account', $own->json('data.0.creator'));

        $other = User::factory()->company()->create();
        $otherCompany = Company::factory()->active()->create();
        $other->forceFill(['active_company_id' => $otherCompany->id])->save();
        CompanyUser::factory()->active()->create([
            'user_id' => $other->id,
            'company_id' => $otherCompany->id,
        ]);
        $this->asUser($other)
            ->getJson('/api/finance-payments')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_finance_list_filters_by_the_months_of_existing_payments(): void
    {
        $this->travelTo('2026-10-28');
        [$company, $manager, $creator, $campaign] = $this->scene();
        $contract = RecurringContract::factory()->create([
            'company_id' => $company->id,
            'status' => RecurringContractStatus::Active,
            'start_date' => '2026-10-01',
            'end_date' => '2026-12-31',
        ]);
        RecurringContractCreator::factory()->create([
            'recurring_contract_id' => $contract->id,
            'creator_id' => $creator->id,
            'monthly_cache' => 800,
            'start_date' => '2026-10-01',
        ]);

        $listed = $this->asUser($manager)
            ->getJson('/api/finance-payments?company_id='.$company->id)
            ->assertOk();

        $campaignId = collect($listed->json('data'))->firstWhere('campaign_id', $campaign->id)['id'];
        FinancePayment::query()->whereKey($campaignId)->update(['reference_month' => '2026-09-01']);

        $filtered = $this->asUser($manager)
            ->getJson('/api/finance-payments?company_id='.$company->id.'&month=2026-09')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $campaignId)
            ->assertJsonPath('data.0.reference_month', '2026-09-01')
            ->assertJsonPath('meta.months', ['2026-10', '2026-09']);

        $this->assertEquals(1500, $filtered->json('meta.amounts.awaiting_invoice'));

        $this->asUser($creator->user)
            ->getJson('/api/finance-payments?month=2026-10')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.reference_month', '2026-10-01')
            ->assertJsonPath('meta.months', ['2026-10', '2026-09']);
    }

    public function test_invoice_is_reviewed_before_payment_is_released(): void
    {
        $this->travelTo('2026-10-28');
        [$company, $manager, $creator, $campaign] = $this->scene();
        $admin = User::factory()->admin()->create();
        app(PermissionService::class)->sync($admin, [
            ...Permission::defaultSlugsForRole($admin->role),
            Permission::FinanceAccess->value,
        ]);
        $outsider = User::factory()->admin()->create();
        $paymentId = $this->asUser($manager)
            ->getJson('/api/finance-payments?company_id='.$company->id)
            ->json('data.0.id');

        $foreign = MediaFile::factory()->create([
            'uploaded_by' => $admin->id,
            'filename' => 'nota.pdf',
            'mime_type' => 'application/pdf',
            'path' => 'documents/nota.pdf',
        ]);
        $this->asUser($creator->user)
            ->postJson("/api/finance-payments/{$paymentId}/invoice", ['media_id' => $foreign->id])
            ->assertUnprocessable()
            ->assertJsonPath('errors.media_id.0', 'Envie um arquivo da sua conta.');

        $media = MediaFile::factory()->create([
            'uploaded_by' => $creator->user_id,
            'filename' => 'nota-ana.pdf',
            'mime_type' => 'application/pdf',
            'path' => 'documents/nota-ana.pdf',
        ]);
        $this->asUser($creator->user)
            ->postJson("/api/finance-payments/{$paymentId}/invoice", ['media_id' => $media->id])
            ->assertOk()
            ->assertJsonPath('data.status', 'submitted');

        $this->assertDatabaseHas('notifications', [
            'user_id' => $manager->id,
            'title' => 'Nota fiscal enviada',
            'link' => '/finance',
        ]);
        $this->assertDatabaseHas('mail_messages', [
            'user_id' => $manager->id,
            'template_key' => MailTemplateKey::InvoiceSubmitted->value,
        ]);
        $this->assertDatabaseHas('mail_messages', [
            'user_id' => $admin->id,
            'template_key' => MailTemplateKey::InvoiceSubmitted->value,
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $admin->id,
            'link' => '/finance',
            'title' => 'Nota fiscal enviada',
        ]);
        $this->assertDatabaseMissing('mail_messages', [
            'user_id' => $outsider->id,
            'template_key' => MailTemplateKey::InvoiceSubmitted->value,
        ]);
        $this->assertDatabaseMissing('notifications', [
            'user_id' => $outsider->id,
            'link' => '/finance',
        ]);
        $this->asUser($outsider)->getJson('/api/finance-payments')->assertForbidden();
        $this->asUser($admin)->getJson('/api/finance-payments')->assertOk();

        $this->asUser($manager)
            ->postJson("/api/finance-payments/{$paymentId}/reject", ['reason' => 'Valor divergente'])
            ->assertOk()
            ->assertJsonPath('data.status', 'rejected');

        $this->assertDatabaseHas('notifications', [
            'creator_id' => $creator->id,
            'title' => 'Nota fiscal recusada',
        ]);

        $replacement = MediaFile::factory()->create([
            'uploaded_by' => $creator->user_id,
            'filename' => 'nota-corrigida.pdf',
            'mime_type' => 'application/pdf',
            'path' => 'documents/nota-corrigida.pdf',
        ]);
        $this->asUser($creator->user)
            ->postJson("/api/finance-payments/{$paymentId}/invoice", ['media_id' => $replacement->id])
            ->assertOk()
            ->assertJsonPath('data.status', 'submitted');

        FinancePayment::query()->whereKey($paymentId)->update(['payment_due_date' => '2026-10-01']);

        $this->asUser($manager)
            ->postJson("/api/finance-payments/{$paymentId}/approve", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('payment_due_date');

        $this->asUser($manager)
            ->postJson("/api/finance-payments/{$paymentId}/approve", [
                'payment_due_date' => '2026-11-20',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'released')
            ->assertJsonPath('data.payment_due_date', '2026-11-20');

        $this->assertDatabaseHas('mail_messages', [
            'user_id' => $creator->user_id,
            'template_key' => MailTemplateKey::PaymentReleased->value,
        ]);
        $this->assertSame(PaymentStatus::Scheduled, CampaignCreator::query()->where('campaign_id', $campaign->id)->first()->payment_status);

        $this->asUser($manager)
            ->postJson("/api/finance-payments/{$paymentId}/pay")
            ->assertOk()
            ->assertJsonPath('data.status', 'paid')
            ->assertJsonPath('data.paid_at', '2026-10-28');

        $paid = CampaignCreator::query()->where('campaign_id', $campaign->id)->first();
        $this->assertSame(PaymentStatus::Paid, $paid->payment_status);
        $this->assertSame('2026-10-28', $paid->payment_date?->toDateString());
    }

    public function test_overdue_invoice_email_repeats_daily_until_the_file_is_sent(): void
    {
        $this->travelTo('2026-10-28');
        [, , $creator] = $this->scene(deliveryDate: '2026-09-10');
        $this->asUser($creator->user)->getJson('/api/finance-payments')->assertOk();
        $payment = FinancePayment::query()->firstOrFail();
        $this->assertSame('2026-10-05', $payment->invoice_due_date->toDateString());
        $this->assertTrue($payment->invoice_due_date->lt(now()->startOfDay()));

        $this->artisan('mail:reminders')->assertSuccessful();
        $this->artisan('mail:reminders')->assertSuccessful();

        $this->assertSame(1, MailMessage::query()->where('template_key', MailTemplateKey::InvoiceOverdue)->count());

        $this->travelTo('2026-10-29');
        $this->artisan('mail:reminders')->assertSuccessful();
        $this->assertSame(2, MailMessage::query()->where('template_key', MailTemplateKey::InvoiceOverdue)->count());

        $media = MediaFile::factory()->create([
            'uploaded_by' => $creator->user_id,
            'filename' => 'nota.pdf',
            'mime_type' => 'application/pdf',
            'path' => 'documents/nota.pdf',
        ]);
        $this->asUser($creator->user)
            ->postJson("/api/finance-payments/{$payment->id}/invoice", ['media_id' => $media->id])
            ->assertOk();

        $this->travelTo('2026-10-30');
        $this->artisan('mail:reminders')->assertSuccessful();
        $this->assertSame(2, MailMessage::query()->where('template_key', MailTemplateKey::InvoiceOverdue)->count());
    }

    public function test_company_defines_the_invoice_and_payment_days(): void
    {
        [$company, $manager, $creator] = $this->scene();

        $campaignData = "Rocketz LTDA\nCNPJ 00.000.000/0001-00";
        $couponData = "Loja Ecommerce\nCNPJ 11.111.111/0001-11";

        $this->asUser($manager)
            ->patchJson('/api/finance-payments/settings', [
                'company_id' => $company->id,
                'invoice_due_day' => 8,
                'payment_due_day' => 3,
                'invoice_data_campaign' => $campaignData,
                'invoice_data_recurring' => 'Recorrente SA',
                'invoice_data_coupon' => $couponData,
            ])
            ->assertOk()
            ->assertJsonPath('data.invoice_due_day', 8)
            ->assertJsonPath('data.payment_due_day', 3)
            ->assertJsonPath('data.invoice_data_campaign', $campaignData)
            ->assertJsonPath('data.invoice_data_coupon', $couponData);

        $company->refresh();
        $this->assertSame(8, $company->invoice_due_day);
        $this->assertSame(3, $company->payment_due_day);
        $this->assertSame($campaignData, $company->invoice_data_campaign);
        $this->assertSame('Recorrente SA', $company->invoice_data_recurring);

        $listed = $this->asUser($creator->user)
            ->getJson('/api/finance-payments')
            ->assertOk();
        $campaignRow = collect($listed->json('data'))->firstWhere('source', 'campaign');
        $this->assertSame($campaignData, $campaignRow['invoice_data']);

        $this->asUser($manager)
            ->patchJson('/api/finance-payments/settings', [
                'company_id' => $company->id,
                'invoice_due_day' => 8,
                'payment_due_day' => 3,
                'invoice_data_coupon' => '   ',
            ])
            ->assertOk()
            ->assertJsonPath('data.invoice_data_coupon', null)
            ->assertJsonPath('data.invoice_data_campaign', $campaignData);
    }

    /**
     * @return array{0: Company, 1: User, 2: Creator, 3: Campaign, 4: CampaignCreator}
     */
    private function scene(?string $deliveryDate = null): array
    {
        $company = Company::factory()->active()->create([
            'invoice_due_day' => 5,
            'payment_due_day' => 15,
        ]);
        $manager = User::factory()->company()->create([
            'active_company_id' => $company->id,
        ]);
        CompanyUser::factory()->active()->create([
            'user_id' => $manager->id,
            'company_id' => $company->id,
        ]);
        $creator = Creator::factory()->active()->create();
        $campaign = Campaign::factory()->create([
            'company_id' => $company->id,
            'name' => 'Campanha paga',
            'is_barter' => false,
            'is_benefit_coupon' => false,
            'is_direct_contract' => false,
            'currency' => 'BRL',
        ]);
        $participation = CampaignCreator::factory()->approved()->create([
            'campaign_id' => $campaign->id,
            'creator_id' => $creator->id,
            'amount' => 1500,
            'delivery_date' => $deliveryDate,
            'post_date' => null,
        ]);

        return [$company, $manager, $creator, $campaign, $participation];
    }

    private function asUser(User $user): static
    {
        $this->flushHeaders();
        $this->app['auth']->forgetGuards();

        return $this->withHeaders(['Accept-Language' => 'pt-BR'])
            ->withToken($user->createToken('auth')->plainTextToken);
    }
}
