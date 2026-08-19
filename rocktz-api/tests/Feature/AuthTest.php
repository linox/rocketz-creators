<?php

namespace Tests\Feature;

use App\Enums\CompanyStatus;
use App\Enums\CreatorStatus;
use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_health_endpoint(): void
    {
        $this->getJson('/api/health')
            ->assertOk()
            ->assertJsonPath('status', 'ok');
    }

    public function test_creator_can_register_and_login(): void
    {
        $response = $this->postJson('/api/auth/register/creator', [
            'full_name' => 'Maria Silva',
            'artistic_name' => 'mariasilva',
            'email' => 'maria@example.com',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
            'whatsapp' => '11999999999',
            'city' => 'São Paulo',
            'state' => 'SP',
            'instagram' => 'mariasilva',
            'category' => 'UGC Content',
            'lgpd_accepted' => true,
        ]);

        $response->assertCreated()
            ->assertJsonPath('user.role', 'creator')
            ->assertJsonPath('user.creator.status', 'review');

        $this->assertDatabaseHas('users', [
            'email' => 'maria@example.com',
            'role' => UserRole::Creator->value,
        ]);

        $this->assertDatabaseHas('creators', [
            'artistic_name' => 'mariasilva',
            'status' => CreatorStatus::Review->value,
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'maria@example.com',
            'password' => 'secret123',
        ])->assertOk()->assertJsonPath('user.email', 'maria@example.com');
    }

    public function test_company_can_register(): void
    {
        $this->postJson('/api/auth/register/company', [
            'name' => 'Marca Teste',
            'responsible_name' => 'João Souza',
            'email' => 'joao@marca.com',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
            'whatsapp' => '11988887777',
            'city' => 'Curitiba',
            'state' => 'PR',
            'segment' => 'Varejo',
            'lgpd_accepted' => true,
        ])->assertCreated()->assertJsonPath('user.role', 'company');

        $this->assertDatabaseHas('companies', [
            'name' => 'Marca Teste',
            'status' => CompanyStatus::Pending->value,
        ]);
    }

    public function test_seeded_admin_can_login(): void
    {
        $this->seed();

        $this->postJson('/api/auth/login', [
            'email' => 'admin@rocketz.test',
            'password' => 'password',
        ])->assertOk()->assertJsonPath('user.role', 'admin');
    }

    public function test_me_requires_token(): void
    {
        $this->getJson('/api/auth/me')->assertUnauthorized();

        $user = User::factory()->admin()->create([
            'email' => 'admin.me@rocketz.test',
            'password' => 'password',
        ]);

        $token = $user->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('user.email', 'admin.me@rocketz.test');
    }
}
