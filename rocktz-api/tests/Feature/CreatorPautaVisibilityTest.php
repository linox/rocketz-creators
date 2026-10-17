<?php

namespace Tests\Feature;

use App\Enums\ContentPlanningStatus;
use App\Enums\MailTemplateKey;
use App\Models\CompanyUser;
use App\Models\ContentPlanningItem;
use App\Models\Creator;
use App\Models\RecurringContract;
use App\Models\RecurringContractCreator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class CreatorPautaVisibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_creator_does_not_see_recurring_demand_until_pauta_is_defined(): void
    {
        $creator = Creator::factory()->active()->create();
        $contract = RecurringContract::factory()->active()->create();
        RecurringContractCreator::factory()->create([
            'recurring_contract_id' => $contract->id,
            'creator_id' => $creator->id,
        ]);

        $hidden = $this->planningItem($contract, $creator, [
            'title' => 'Slot sem pauta',
            'briefing' => null,
            'briefing_note' => null,
            'briefing_fields' => null,
            'pauta_script_file_url' => null,
            'planned_date' => now()->startOfMonth()->toDateString(),
        ]);
        $withBrief = $this->planningItem($contract, $creator, [
            'title' => 'Pauta com briefing',
            'briefing' => null,
            'briefing_note' => null,
            'briefing_fields' => ['product' => 'Sérum'],
            'planned_date' => now()->toDateString(),
        ]);
        $withFile = $this->planningItem($contract, $creator, [
            'title' => 'Pauta com arquivo',
            'briefing' => null,
            'briefing_note' => null,
            'briefing_fields' => null,
            'pauta_script_file_url' => 'https://files.example/roteiro.pdf',
        ]);

        $token = $creator->user->createToken('auth')->plainTextToken;
        $titles = $this->withToken($token)
            ->getJson("/api/recurring-contracts/{$contract->id}")
            ->assertOk()
            ->json('data.items');
        $titles = array_column($titles, 'title');

        $this->assertNotContains('Slot sem pauta', $titles);
        $this->assertContains('Pauta com briefing', $titles);
        $this->assertContains('Pauta com arquivo', $titles);

        $month = now()->format('Y-m');
        $events = $this->withToken($token)
            ->getJson("/api/calendar?month={$month}&kind=delivery")
            ->assertOk()
            ->json('data');
        $eventIds = array_column($events, 'id');
        $this->assertNotContains('recurring:delivery:'.$hidden->id, $eventIds);
        $this->assertContains('recurring:delivery:'.$withBrief->id, $eventIds);

        $companyUser = CompanyUser::factory()->active()->create([
            'company_id' => $contract->company_id,
        ]);
        $this->app['auth']->forgetGuards();
        $companyTitles = $this->withToken($companyUser->user->createToken('auth')->plainTextToken)
            ->getJson("/api/recurring-contracts/{$contract->id}")
            ->assertOk()
            ->json('data.items');
        $this->assertContains('Slot sem pauta', array_column($companyTitles, 'title'));

        $hidden->update(['briefing' => 'Fale do produto nos primeiros segundos.']);
        $this->app['auth']->forgetGuards();
        $after = $this->withToken($token)
            ->getJson("/api/recurring-contracts/{$contract->id}")
            ->assertOk()
            ->json('data.items');
        $this->assertContains('Slot sem pauta', array_column($after, 'title'));
    }

    public function test_deadline_reminder_skips_demand_without_pauta(): void
    {
        Mail::fake();
        $hidden = ContentPlanningItem::factory()->planned()->create([
            'planned_date' => now()->addDays(3)->toDateString(),
            'briefing' => null,
            'briefing_note' => null,
            'briefing_fields' => null,
            'pauta_script_file_url' => null,
            'status' => ContentPlanningStatus::Planned,
        ]);
        $visible = ContentPlanningItem::factory()->planned()->create([
            'planned_date' => now()->addDays(3)->toDateString(),
            'briefing' => 'Fale do produto.',
            'status' => ContentPlanningStatus::Planned,
        ]);

        $this->artisan('mail:reminders')->assertSuccessful();

        $this->assertDatabaseMissing('mail_messages', [
            'template_key' => MailTemplateKey::DemandReminder->value,
            'related_id' => $hidden->id,
        ]);
        $this->assertDatabaseHas('mail_messages', [
            'template_key' => MailTemplateKey::DemandReminder->value,
            'related_id' => $visible->id,
        ]);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function planningItem(RecurringContract $contract, Creator $creator, array $overrides): ContentPlanningItem
    {
        return ContentPlanningItem::factory()->planned()->create([
            'recurring_contract_id' => $contract->id,
            'company_id' => $contract->company_id,
            'creator_id' => $creator->id,
            'month' => now()->format('Y-m'),
            'status' => ContentPlanningStatus::Planned,
            ...$overrides,
        ]);
    }
}
