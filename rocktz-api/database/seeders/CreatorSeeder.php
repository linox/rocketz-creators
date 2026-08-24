<?php

namespace Database\Seeders;

use App\Enums\CreatorStatus;
use App\Enums\UserRole;
use App\Models\Creator;
use App\Models\CreatorContractAcceptance;
use App\Models\CreatorPortfolioVideo;
use Database\Seeders\Concerns\SeedsDemoAccounts;
use Illuminate\Database\Seeder;

class CreatorSeeder extends Seeder
{
    use SeedsDemoAccounts;

    public function run(): void
    {
        $anaUser = $this->ensureUser(DemoAccounts::CREATOR_ANA, UserRole::Creator, 'Ana UGC');

        $ana = Creator::query()->where('user_id', $anaUser->id)->first();
        if (! $ana) {
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
                'pix_key' => DemoAccounts::CREATOR_ANA,
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
        }

        if (! CreatorPortfolioVideo::query()->where('creator_id', $ana->id)->where('title', 'UGC skincare rotina noturna')->exists()) {
            CreatorPortfolioVideo::factory()->create([
                'creator_id' => $ana->id,
                'title' => 'UGC skincare rotina noturna',
                'url' => 'https://example.com/portfolio/ana-skincare',
                'description' => 'Vídeo UGC de 30s para marca de skincare.',
                'orientation' => 'vertical',
                'file_size' => 18_000_000,
                'uploaded_at' => now()->subMonths(2),
            ]);
        }

        if (! CreatorPortfolioVideo::query()->where('creator_id', $ana->id)->where('title', 'Unboxing + first impression')->exists()) {
            CreatorPortfolioVideo::factory()->create([
                'creator_id' => $ana->id,
                'title' => 'Unboxing + first impression',
                'url' => 'https://example.com/portfolio/ana-unboxing',
                'description' => 'Unboxing espontâneo com CTA de cupom.',
                'orientation' => 'horizontal',
                'file_size' => 42_000_000,
                'uploaded_at' => now()->subMonth(),
            ]);
        }

        if (! CreatorContractAcceptance::query()->where('creator_id', $ana->id)->exists()) {
            CreatorContractAcceptance::factory()->valid()->create([
                'creator_id' => $ana->id,
                'full_name' => 'Ana Beatriz Oliveira',
                'document' => '123.456.789-00',
                'email' => DemoAccounts::CREATOR_ANA,
            ]);
        }

        $this->ensureCreatorProfile(
            DemoAccounts::CREATOR_BRUNO,
            'Bruno Costa',
            CreatorStatus::Review,
            [
                'whatsapp' => '+55 21 97777-2002',
                'city' => 'Rio de Janeiro',
                'state' => 'RJ',
                'socials' => [
                    'instagram' => '@bruno.costa',
                    'tiktok' => '@bruno.costa',
                ],
            ],
        );

        $this->ensureCreatorProfile(
            DemoAccounts::CREATOR_CAMILA,
            'Camila Ferreira',
            CreatorStatus::Paused,
            [
                'whatsapp' => '+55 31 96666-3003',
                'city' => 'Belo Horizonte',
                'state' => 'MG',
                'socials' => [
                    'instagram' => '@camila.ferreira',
                    'tiktok' => '@camila.ferreira',
                ],
            ],
        );

        $this->ensureCreatorProfile(
            DemoAccounts::CREATOR_DIEGO,
            'Diego Santos',
            CreatorStatus::Rejected,
            [
                'whatsapp' => '+55 41 95555-4004',
                'city' => 'Curitiba',
                'state' => 'PR',
                'socials' => [
                    'instagram' => '@diego.santos',
                    'tiktok' => '@diego.santos',
                ],
                'internal_notes' => 'Cadastro rejeitado: documentos inconsistentes.',
            ],
        );
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function ensureCreatorProfile(
        string $email,
        string $name,
        CreatorStatus $status,
        array $attributes,
    ): Creator {
        $user = $this->ensureUser($email, UserRole::Creator, $name);
        $creator = Creator::query()->where('user_id', $user->id)->first();
        if ($creator) {
            return $creator;
        }

        return Creator::factory()->state(['status' => $status])->create([
            'user_id' => $user->id,
            'full_name' => $name,
            'artistic_name' => $name,
            ...$attributes,
        ]);
    }
}
