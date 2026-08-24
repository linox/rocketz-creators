<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\Company;
use App\Models\CompanyContact;
use App\Models\CompanyUser;
use Database\Seeders\Concerns\SeedsDemoAccounts;
use Illuminate\Database\Seeder;

class CompanySeeder extends Seeder
{
    use SeedsDemoAccounts;

    public function run(): void
    {
        $ana = $this->demoCreator(DemoAccounts::CREATOR_ANA);

        $auroraUser = $this->ensureUser(DemoAccounts::COMPANY_AURORA, UserRole::Company, 'Marca Aurora');

        $aurora = Company::query()
            ->where('email', DemoAccounts::COMPANY_AURORA)
            ->orWhere('cnpj', '12.345.678/0001-90')
            ->first();
        if (! $aurora) {
            $aurora = Company::factory()->active()->create([
                'name' => 'Marca Aurora',
                'cnpj' => '12.345.678/0001-90',
                'segment' => 'beleza',
                'responsible_name' => 'Marina Alves',
                'whatsapp' => '+55 11 4000-1000',
                'email' => DemoAccounts::COMPANY_AURORA,
                'city' => 'São Paulo',
                'country' => 'BR',
                'currency' => 'BRL',
                'objective' => 'Escalar UGC para lançamentos de skincare.',
                'logo_url' => 'https://placehold.co/200x200?text=Aurora',
            ]);
        }

        if (! CompanyUser::query()->where('user_id', $auroraUser->id)->exists()) {
            CompanyUser::factory()->active()->create([
                'user_id' => $auroraUser->id,
                'company_id' => $aurora->id,
            ]);
        }

        if (! CompanyContact::query()->where('company_id', $aurora->id)->where('email', 'marina@aurora.test')->exists()) {
            CompanyContact::factory()->create([
                'company_id' => $aurora->id,
                'name' => 'Marina Alves',
                'role' => 'Head de Marketing',
                'email' => 'marina@aurora.test',
                'whatsapp' => '+55 11 4000-1001',
            ]);
        }

        if (! CompanyContact::query()->where('company_id', $aurora->id)->where('email', 'pedro@aurora.test')->exists()) {
            CompanyContact::factory()->create([
                'company_id' => $aurora->id,
                'name' => 'Pedro Lima',
                'role' => 'Analista de Influência',
                'email' => 'pedro@aurora.test',
                'whatsapp' => '+55 11 4000-1002',
            ]);
        }

        if (! $aurora->favoriteCreators()->where('creators.id', $ana->id)->exists()) {
            $aurora->favoriteCreators()->attach($ana->id);
        }

        $lumenUser = $this->ensureUser(DemoAccounts::COMPANY_LUMEN, UserRole::Company, 'Studio Lumen');

        $lumen = Company::query()
            ->where('email', DemoAccounts::COMPANY_LUMEN)
            ->orWhere('cnpj', '98.765.432/0001-10')
            ->first();
        if (! $lumen) {
            $lumen = Company::factory()->pending()->create([
                'name' => 'Studio Lumen',
                'cnpj' => '98.765.432/0001-10',
                'segment' => 'serviços',
                'responsible_name' => 'Letícia Moraes',
                'whatsapp' => '+55 21 3000-2000',
                'email' => DemoAccounts::COMPANY_LUMEN,
                'city' => 'Rio de Janeiro',
                'country' => 'BR',
                'currency' => 'BRL',
                'objective' => 'Campanhas pontuais de conteúdo para clientes do estúdio.',
            ]);
        }

        if (! CompanyUser::query()->where('user_id', $lumenUser->id)->exists()) {
            CompanyUser::factory()->pending()->create([
                'user_id' => $lumenUser->id,
                'company_id' => $lumen->id,
            ]);
        }
    }
}
