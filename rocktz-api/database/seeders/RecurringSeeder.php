<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\ContentPlanningItem;
use App\Models\Creator;
use App\Models\RecurringContract;
use App\Models\RecurringContractCreator;
use Illuminate\Database\Seeder;

class RecurringSeeder extends Seeder
{
    public function run(): void
    {
        $aurora = Company::query()->where('name', 'Marca Aurora')->firstOrFail();
        $ana = Creator::query()
            ->whereHas('user', fn ($query) => $query->where('email', 'ana.creator@rocketz.test'))
            ->firstOrFail();

        $contract = RecurringContract::factory()->active()->create([
            'company_id' => $aurora->id,
            'title' => 'Conteúdo mensal Aurora + Ana',
            'objective' => 'Produção contínua de UGC e stories para a marca.',
            'start_date' => now()->startOfMonth()->toDateString(),
            'end_date' => now()->addMonths(6)->toDateString(),
            'monthly_fee' => 4500,
            'notes' => 'Contrato ativo com entregas mensais combinadas.',
        ]);

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

        $shared = [
            'recurring_contract_id' => $contract->id,
            'company_id' => $aurora->id,
            'creator_id' => $ana->id,
        ];

        ContentPlanningItem::factory()->planned()->create([
            ...$shared,
            'month' => now()->addMonth()->format('Y-m'),
            'content_type' => 'reel',
            'title' => 'Reel rotina glow',
            'briefing' => 'Mostrar a aplicação do sérum no início do dia.',
            'planned_date' => now()->addMonth()->startOfMonth()->addDays(4)->toDateString(),
        ]);

        ContentPlanningItem::factory()->review()->create([
            ...$shared,
            'month' => now()->format('Y-m'),
            'content_type' => 'story',
            'title' => 'Stories de prova social',
            'briefing' => 'Bastidores + print de resultados.',
            'planned_date' => now()->toDateString(),
            'submission_url' => 'https://example.com/submissions/ana-stories',
        ]);

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
