<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\CompanyContact;
use App\Models\CompanyUser;
use App\Models\Creator;
use App\Models\User;
use Illuminate\Database\Seeder;

class CompanySeeder extends Seeder
{
    public function run(): void
    {
        $ana = Creator::query()
            ->whereHas('user', fn ($query) => $query->where('email', 'ana.creator@rocketz.test'))
            ->firstOrFail();

        $auroraUser = User::factory()->company()->create([
            'name' => 'Marca Aurora',
            'email' => 'empresa@rocketz.test',
            'password' => 'password',
        ]);

        $aurora = Company::factory()->active()->create([
            'name' => 'Marca Aurora',
            'cnpj' => '12.345.678/0001-90',
            'segment' => 'beleza',
            'responsible_name' => 'Marina Alves',
            'whatsapp' => '+55 11 4000-1000',
            'email' => 'empresa@rocketz.test',
            'city' => 'São Paulo',
            'country' => 'BR',
            'currency' => 'BRL',
            'objective' => 'Escalar UGC para lançamentos de skincare.',
            'logo_url' => 'https://placehold.co/200x200?text=Aurora',
        ]);

        CompanyUser::factory()->active()->create([
            'user_id' => $auroraUser->id,
            'company_id' => $aurora->id,
        ]);

        CompanyContact::factory()->create([
            'company_id' => $aurora->id,
            'name' => 'Marina Alves',
            'role' => 'Head de Marketing',
            'email' => 'marina@aurora.test',
            'whatsapp' => '+55 11 4000-1001',
        ]);

        CompanyContact::factory()->create([
            'company_id' => $aurora->id,
            'name' => 'Pedro Lima',
            'role' => 'Analista de Influência',
            'email' => 'pedro@aurora.test',
            'whatsapp' => '+55 11 4000-1002',
        ]);

        $aurora->favoriteCreators()->attach($ana->id);

        $lumenUser = User::factory()->company()->create([
            'name' => 'Studio Lumen',
            'email' => 'pending.empresa@rocketz.test',
            'password' => 'password',
        ]);

        $lumen = Company::factory()->pending()->create([
            'name' => 'Studio Lumen',
            'cnpj' => '98.765.432/0001-10',
            'segment' => 'serviços',
            'responsible_name' => 'Letícia Moraes',
            'whatsapp' => '+55 21 3000-2000',
            'email' => 'pending.empresa@rocketz.test',
            'city' => 'Rio de Janeiro',
            'country' => 'BR',
            'currency' => 'BRL',
            'objective' => 'Campanhas pontuais de conteúdo para clientes do estúdio.',
        ]);

        CompanyUser::factory()->pending()->create([
            'user_id' => $lumenUser->id,
            'company_id' => $lumen->id,
        ]);
    }
}
