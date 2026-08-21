<?php

namespace Tests\Feature;

use App\Enums\CompanyStatus;
use App\Enums\CreatorStatus;
use App\Enums\UserRole;
use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
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
            ->assertJsonPath('user.creator.status', 'review')
            ->assertJsonPath('user.locale', 'pt-BR');

        $this->assertDatabaseHas('users', [
            'email' => 'maria@example.com',
            'role' => UserRole::Creator->value,
        ]);

        $this->assertDatabaseHas('creators', [
            'artistic_name' => 'mariasilva',
            'status' => CreatorStatus::Review->value,
            'country' => 'BR',
            'state' => 'SP',
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
            'country' => 'BR',
            'currency' => 'BRL',
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
        $this->getJson('/api/auth/me')
            ->assertUnauthorized()
            ->assertJsonPath('message', 'Não autenticado.');

        $user = User::factory()->admin()->create([
            'email' => 'admin.me@rocketz.test',
            'password' => 'password',
        ]);

        $token = $user->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('user.email', 'admin.me@rocketz.test')
            ->assertJsonPath('user.locale', 'pt-BR');
    }

    public function test_unauthenticated_message_follows_accept_language(): void
    {
        $this->withHeaders(['Accept-Language' => 'en'])
            ->getJson('/api/auth/me')
            ->assertUnauthorized()
            ->assertJsonPath('message', 'Unauthenticated.');
    }

    public function test_me_accepts_x_auth_token_when_authorization_is_stripped(): void
    {
        $user = User::factory()->admin()->create([
            'email' => 'admin.header@rocketz.test',
            'password' => 'password',
        ]);

        $token = $user->createToken('auth')->plainTextToken;

        $this->withHeaders(['X-Auth-Token' => $token])
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('user.email', 'admin.header@rocketz.test');
    }

    public function test_forgot_password_sends_notification_for_existing_user(): void
    {
        Notification::fake();

        $user = User::factory()->create([
            'email' => 'reset@example.com',
        ]);

        $this->postJson('/api/auth/forgot-password', [
            'email' => 'Reset@example.com',
        ])
            ->assertOk()
            ->assertJsonPath('message', 'Se o e-mail existir, enviaremos o link de redefinição.');

        Notification::assertSentTo($user, ResetPasswordNotification::class);
    }

    public function test_forgot_password_message_follows_accept_language(): void
    {
        Notification::fake();

        User::factory()->create([
            'email' => 'reset.en@example.com',
        ]);

        $this->withHeaders(['Accept-Language' => 'en'])
            ->postJson('/api/auth/forgot-password', [
                'email' => 'reset.en@example.com',
            ])
            ->assertOk()
            ->assertJsonPath('message', 'If the email exists, we will send the reset link.');
    }

    public function test_authenticated_user_can_update_locale(): void
    {
        $user = User::factory()->admin()->create([
            'email' => 'locale@rocketz.test',
            'locale' => 'pt-BR',
        ]);
        $token = $user->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->patchJson('/api/auth/locale', ['locale' => 'es'])
            ->assertOk()
            ->assertJsonPath('user.locale', 'es');

        $this->assertDatabaseHas('users', [
            'email' => 'locale@rocketz.test',
            'locale' => 'es',
        ]);
    }

    public function test_register_persists_requested_locale(): void
    {
        $this->withHeaders(['Accept-Language' => 'en'])
            ->postJson('/api/auth/register/company', [
                'name' => 'Brand Locale',
                'responsible_name' => 'Alex Brand',
                'email' => 'alex@brand.com',
                'password' => 'secret123',
                'password_confirmation' => 'secret123',
                'whatsapp' => '11988887777',
                'lgpd_accepted' => true,
                'locale' => 'es',
            ])
            ->assertCreated()
            ->assertJsonPath('user.locale', 'es');
    }

    public function test_forgot_password_does_not_leak_unknown_email(): void
    {
        Notification::fake();

        $this->postJson('/api/auth/forgot-password', [
            'email' => 'nobody@example.com',
        ])->assertOk();

        Notification::assertNothingSent();
    }

    public function test_forgot_password_requires_email(): void
    {
        $this->postJson('/api/auth/forgot-password', [])->assertUnprocessable();
    }
}
