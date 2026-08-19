<?php

namespace Database\Seeders;

use App\Enums\StageApprovalStatus;
use App\Models\Campaign;
use App\Models\CampaignBriefing;
use App\Models\CampaignCreator;
use App\Models\CampaignCreatorContent;
use App\Models\CampaignDeliverable;
use App\Models\Company;
use App\Models\Creator;
use Illuminate\Database\Seeder;

class CampaignSeeder extends Seeder
{
    public function run(): void
    {
        $aurora = Company::query()->where('name', 'Marca Aurora')->firstOrFail();
        $ana = Creator::query()
            ->whereHas('user', fn ($query) => $query->where('email', 'ana.creator@rocketz.test'))
            ->firstOrFail();
        $bruno = Creator::query()
            ->whereHas('user', fn ($query) => $query->where('email', 'bruno.creator@rocketz.test'))
            ->firstOrFail();

        $briefing = Campaign::factory()->briefing()->create([
            'company_id' => $aurora->id,
            'name' => 'Lançamento Sérum Aurora Glow',
            'objective' => 'Gerar awareness e prova social para o novo sérum.',
            'total_budget' => 18000,
            'agency_fee' => 3000,
            'creators_budget' => 15000,
            'creator_cache' => 15000,
        ]);

        $this->attachBriefingAndDeliverables($briefing, 'Sérum facial Aurora Glow', 2, 4, 1);

        $selection = Campaign::factory()->selection()->create([
            'company_id' => $aurora->id,
            'name' => 'Campanha Verão Aurora',
            'objective' => 'Selecionar criadores para a linha verão.',
            'total_budget' => 12000,
            'agency_fee' => 2000,
            'creators_budget' => 10000,
            'creator_cache' => 10000,
        ]);

        $this->attachBriefingAndDeliverables($selection, 'Kit verão Aurora', 1, 3, 1);

        CampaignCreator::factory()->pendingApplication()->create([
            'campaign_id' => $selection->id,
            'creator_id' => $bruno->id,
            'delivery_type' => 'reel',
            'amount' => 1800,
            'notes' => 'Quero participar desta campanha e conectar minha audiência à marca.',
        ]);

        $production = Campaign::factory()->production()->create([
            'company_id' => $aurora->id,
            'name' => 'Rotina Glow 7 dias',
            'objective' => 'Produzir UGC de rotina com o sérum.',
            'total_budget' => 9000,
            'agency_fee' => 1500,
            'creators_budget' => 7500,
            'creator_cache' => 7500,
        ]);

        $this->attachBriefingAndDeliverables($production, 'Rotina de 7 dias com sérum', 3, 5, 0);

        $productionCreator = CampaignCreator::factory()->approved()->create([
            'campaign_id' => $production->id,
            'creator_id' => $ana->id,
            'delivery_type' => 'reel',
            'amount' => 2500,
            'script_status' => StageApprovalStatus::Submitted,
            'script_submitted_at' => now()->subHours(8),
        ]);

        CampaignCreatorContent::factory()->create([
            'campaign_creator_id' => $productionCreator->id,
            'script' => 'HOOK: pele cansada de manhã. Mostrar o sérum. Rotina de 3 passos. CTA: cupom AURORA10.',
            'video_url' => null,
            'published_link' => null,
        ]);

        $finished = Campaign::factory()->finished()->create([
            'company_id' => $aurora->id,
            'name' => 'Unboxing Aurora Kit',
            'objective' => 'Campanha encerrada com entrega publicada e paga.',
            'total_budget' => 6500,
            'agency_fee' => 1000,
            'creators_budget' => 5500,
            'creator_cache' => 5500,
            'start_date' => now()->subMonths(2)->toDateString(),
            'end_date' => now()->subWeeks(2)->toDateString(),
        ]);

        $this->attachBriefingAndDeliverables($finished, 'Kit unboxing Aurora', 1, 2, 0);

        $finishedCreator = CampaignCreator::factory()->paidAndSigned()->create([
            'campaign_id' => $finished->id,
            'creator_id' => $ana->id,
            'delivery_type' => 'ugc',
            'amount' => 2200,
            'delivery_date' => now()->subWeeks(3)->toDateString(),
            'post_date' => now()->subWeeks(2)->toDateString(),
        ]);

        CampaignCreatorContent::factory()->create([
            'campaign_creator_id' => $finishedCreator->id,
            'script' => 'Unboxing do kit com first impression e CTA.',
            'video_url' => 'https://example.com/videos/ana-unboxing-aurora.mp4',
            'published_link' => 'https://instagram.com/p/aurora-unboxing',
            'metrics' => [
                'views' => 28400,
                'likes' => 1920,
                'comments' => 86,
            ],
        ]);
    }

    private function attachBriefingAndDeliverables(
        Campaign $campaign,
        string $product,
        int $reels,
        int $stories,
        int $tiktok,
    ): void {
        CampaignBriefing::factory()->create([
            'campaign_id' => $campaign->id,
            'product' => $product,
            'key_message' => 'Pele iluminada com rotina simples.',
            'must_have' => 'Mostrar o produto na embalagem e na aplicação.',
            'donts' => 'Não comparar com concorrentes e não prometer resultado clínico.',
            'cta' => 'Use o cupom AURORA10',
            'hashtags' => '#AuroraGlow #UGCBrasil',
            'coupon' => 'AURORA10',
        ]);

        CampaignDeliverable::factory()->create([
            'campaign_id' => $campaign->id,
            'summary' => $reels.' reels + '.$stories.' stories',
            'reels' => $reels,
            'stories' => $stories,
            'tiktok' => $tiktok,
            'ugc' => 1,
            'posts' => 0,
            'youtube' => 0,
            'deadline_days' => 14,
        ]);
    }
}
