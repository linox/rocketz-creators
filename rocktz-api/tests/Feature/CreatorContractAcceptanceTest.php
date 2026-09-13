<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\CompanyUser;
use App\Models\Creator;
use App\Models\CreatorContractAcceptance;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CreatorContractAcceptanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_creators_index_includes_acceptance_personal_data(): void
    {
        $admin = User::factory()->admin()->create();
        $creator = Creator::factory()->active()->create([
            'full_name' => 'Marina Alves',
            'document' => '123.456.789-00',
        ]);
        CreatorContractAcceptance::factory()->valid()->create([
            'creator_id' => $creator->id,
            'full_name' => 'Marina Alves',
            'document' => '123.456.789-00',
            'email' => 'marina@example.com',
            'term_id' => 'rocketz-2026',
            'version' => '1.0 (2026)',
        ]);

        $row = $this->withToken($admin->createToken('auth')->plainTextToken)
            ->getJson('/api/creators')
            ->assertOk()
            ->json('data.0');

        $this->assertSame($creator->id, $row['id']);
        $this->assertSame('Marina Alves', $row['full_name']);
        $this->assertSame('marina@example.com', $row['contract_acceptance']['email']);
        $this->assertSame('123.456.789-00', $row['contract_acceptance']['document']);
        $this->assertSame('rocketz-2026', $row['contract_acceptance']['term_id']);
        $this->assertNotEmpty($row['contract_acceptance']['accepted_at']);
    }

    public function test_company_creators_index_hides_contract_acceptance(): void
    {
        $company = Company::factory()->active()->create();
        $user = User::factory()->company()->create();
        CompanyUser::factory()->active()->create([
            'user_id' => $user->id,
            'company_id' => $company->id,
        ]);
        $creator = Creator::factory()->review()->create([
            'invited_by_company_id' => $company->id,
            'full_name' => 'Nome Oculto',
        ]);
        CreatorContractAcceptance::factory()->valid()->create([
            'creator_id' => $creator->id,
            'full_name' => 'Nome Oculto',
            'email' => 'oculto@example.com',
        ]);

        $this->withToken($user->createToken('auth')->plainTextToken)
            ->getJson('/api/creators')
            ->assertOk()
            ->assertJsonFragment(['artistic_name' => $creator->artistic_name])
            ->assertJsonMissingPath('data.0.contract_acceptance')
            ->assertJsonMissingPath('data.0.full_name')
            ->assertJsonMissingPath('data.0.email');
    }
}
