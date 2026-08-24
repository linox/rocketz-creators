<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\ContentPlanningItem;
use App\Models\RecurringContract;
use App\Models\RecurringContractCreator;
use Database\Seeders\Concerns\SeedsDemoAccounts;
use Illuminate\Database\Seeder;

class RecurringSeeder extends Seeder
{
    use SeedsDemoAccounts;

    public function run(): void
    {
        $aurora = Company::query()->where('name', 'Marca Aurora')->firstOrFail();
        $ana = $this->demoCreator(DemoAccounts::CREATOR_ANA);

        $contract = RecurringContract::query()
            ->where('company_id', $aurora->id)
            ->where('title', 'Conteúdo mensal Aurora + Ana')
            ->first();

        if (! $contract) {
            $contract = RecurringContract::factory()->active()->create([
                'company_id' => $aurora->id,
                'title' => 'Conteúdo mensal Aurora + Ana',
                'objective' => 'Produção contínua de UGC e stories para a marca.',
                'start_date' => now()->startOfMonth()->toDateString(),
                'end_date' => now()->addMonths(6)->toDateString(),
                'monthly_fee' => 4500,
                'currency' => $aurora->currency,
                'notes' => 'Contrato ativo com entregas mensais combinadas.',
            ]);
        }

        if (! RecurringContractCreator::query()
            ->where('recurring_contract_id', $contract->id)
            ->where('creator_id', $ana->id)
            ->exists()) {
            RecurringContractCreator::factory()->create([
                'recurring_contract_id' => $contract->id,
                'creator_id' => $ana->id,
                'monthly_cache' => 3500,
                'monthly_fee' => 500,
                'deliverables_fee' => 500,
                'monthly_deliverables' => [
                    'reels' => 2,
                    'stories' => 6,
                ],
            ]);
        }

        $shared = [
            'recurring_contract_id' => $contract->id,
            'company_id' => $aurora->id,
            'creator_id' => $ana->id,
        ];

        if (! ContentPlanningItem::query()->where($shared)->where('title', 'Reel rotina glow')->exists()) {
            ContentPlanningItem::factory()->planned()->create([
                ...$shared,
                'month' => now()->addMonth()->format('Y-m'),
                'content_type' => 'reel',
                'title' => 'Reel rotina glow',
                'briefing' => 'Mostrar a aplicação do sérum no início do dia.',
                'planned_date' => now()->addMonth()->startOfMonth()->addDays(4)->toDateString(),
            ]);
        }

        if (! ContentPlanningItem::query()->where($shared)->where('title', 'Stories de prova social')->exists()) {
            ContentPlanningItem::factory()->review()->create([
                ...$shared,
                'month' => now()->format('Y-m'),
                'content_type' => 'story',
                'title' => 'Stories de prova social',
                'briefing' => 'Bastidores + print de resultados.',
                'planned_date' => now()->toDateString(),
                'submission_url' => 'https://example.com/submissions/ana-stories',
            ]);
        }

        if (! ContentPlanningItem::query()->where($shared)->where('title', 'UGC unboxing kit')->exists()) {
            ContentPlanningItem::factory()->published()->create([
                ...$shared,
                'month' => now()->subMonth()->format('Y-m'),
                'content_type' => 'ugc',
                'title' => 'UGC unboxing kit',
                'briefing' => 'Unboxing completo do kit mensal.',
                'planned_date' => now()->subMonth()->startOfMonth()->addDays(10)->toDateString(),
                'published_url' => 'https://instagram.com/p/aurora-kit-mensal',
            ]);
        }
    }
}
