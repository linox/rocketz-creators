<?php

namespace Database\Seeders;

use App\Models\Creator;
use App\Models\CreatorContractAcceptance;
use App\Models\CreatorPortfolioVideo;
use App\Models\User;
use Illuminate\Database\Seeder;

class CreatorSeeder extends Seeder
{
    public function run(): void
    {
        $anaUser = User::factory()->creator()->create([
            'name' => 'Ana UGC',
            'email' => 'ana.creator@rocketz.test',
            'password' => 'password',
        ]);

        $ana = Creator::factory()->active()->create([
            'user_id' => $anaUser->id,
            'full_name' => 'Ana Beatriz Oliveira',
            'artistic_name' => 'Ana UGC',
            'photo_url' => 'https://i.pravatar.cc/400?u=ana-ugc',
            'document' => '123.456.789-00',
            'cpf' => '123.456.789-00',
            'whatsapp' => '+55 11 98888-1001',
            'city' => 'São Paulo',
            'state' => 'SP',
            'birth_date' => '1996-04-18',
            'pix_key' => 'ana.creator@rocketz.test',
            'bank_details' => 'Banco Nubank / agência 0001 / conta 12345-6',
            'socials' => [
                'instagram' => '@ana.ugc',
                'tiktok' => '@ana.ugc',
                'youtube' => null,
            ],
            'metrics' => [
                'instagram_followers' => 82000,
                'tiktok_followers' => 145000,
                'engagement_rate' => 4.8,
            ],
            'categories' => ['ugc', 'beleza', 'lifestyle'],
            'pricing' => [
                'reel' => 1200,
                'story' => 350,
                'tiktok' => 1100,
            ],
            'accepts_exchange' => false,
            'accepts_paid_traffic' => true,
            'accepts_exclusivity' => true,
            'bio' => 'Criadora de UGC focada em beleza, skincare e lifestyle. Roteiro + captação + edição.',
            'work_affinities' => ['skincare', 'moda', 'bem-estar'],
            'internal_notes' => 'Perfil completo, entrega rápida e boa comunicação.',
        ]);

        CreatorPortfolioVideo::factory()->create([
            'creator_id' => $ana->id,
            'title' => 'UGC skincare rotina noturna',
            'url' => 'https://example.com/portfolio/ana-skincare',
            'description' => 'Vídeo UGC de 30s para marca de skincare.',
            'orientation' => 'vertical',
            'file_size' => 18_000_000,
            'uploaded_at' => now()->subMonths(2),
        ]);

        CreatorPortfolioVideo::factory()->create([
            'creator_id' => $ana->id,
            'title' => 'Unboxing + first impression',
            'url' => 'https://example.com/portfolio/ana-unboxing',
            'description' => 'Unboxing espontâneo com CTA de cupom.',
            'orientation' => 'horizontal',
            'file_size' => 42_000_000,
            'uploaded_at' => now()->subMonth(),
        ]);

        CreatorContractAcceptance::factory()->valid()->create([
            'creator_id' => $ana->id,
            'full_name' => 'Ana Beatriz Oliveira',
            'document' => '123.456.789-00',
            'email' => 'ana.creator@rocketz.test',
        ]);

        $brunoUser = User::factory()->creator()->create([
            'name' => 'Bruno Costa',
            'email' => 'bruno.creator@rocketz.test',
            'password' => 'password',
        ]);

        Creator::factory()->review()->create([
            'user_id' => $brunoUser->id,
            'full_name' => 'Bruno Costa',
            'artistic_name' => 'Bruno Costa',
            'whatsapp' => '+55 21 97777-2002',
            'city' => 'Rio de Janeiro',
            'state' => 'RJ',
            'socials' => [
                'instagram' => '@bruno.costa',
                'tiktok' => '@bruno.costa',
            ],
        ]);

        $camilaUser = User::factory()->creator()->create([
            'name' => 'Camila Ferreira',
            'email' => 'camila.creator@rocketz.test',
            'password' => 'password',
        ]);

        Creator::factory()->paused()->create([
            'user_id' => $camilaUser->id,
            'full_name' => 'Camila Ferreira',
            'artistic_name' => 'Camila Ferreira',
            'whatsapp' => '+55 31 96666-3003',
            'city' => 'Belo Horizonte',
            'state' => 'MG',
            'socials' => [
                'instagram' => '@camila.ferreira',
                'tiktok' => '@camila.ferreira',
            ],
        ]);

        $diegoUser = User::factory()->creator()->create([
            'name' => 'Diego Santos',
            'email' => 'diego.creator@rocketz.test',
            'password' => 'password',
        ]);

        Creator::factory()->rejected()->create([
            'user_id' => $diegoUser->id,
            'full_name' => 'Diego Santos',
            'artistic_name' => 'Diego Santos',
            'whatsapp' => '+55 41 95555-4004',
            'city' => 'Curitiba',
            'state' => 'PR',
            'socials' => [
                'instagram' => '@diego.santos',
                'tiktok' => '@diego.santos',
            ],
            'internal_notes' => 'Cadastro rejeitado: documentos inconsistentes.',
        ]);
    }
}
