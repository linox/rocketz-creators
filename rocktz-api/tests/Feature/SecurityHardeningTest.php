<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\ApiRateLimit;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class SecurityHardeningTest extends TestCase
{
    use RefreshDatabase;

    public function test_password_reset_revokes_existing_api_tokens(): void
    {
        $user = User::factory()->create();
        $plain = $user->createToken('phone')->plainTextToken;
        $reset = Password::broker()->createToken($user);

        $this->postJson('/api/auth/reset-password', [
            'token' => $reset,
            'email' => $user->email,
            'password' => 'senha-nova-1',
            'password_confirmation' => 'senha-nova-1',
        ])->assertOk();

        $this->assertSame(0, $user->fresh()->tokens()->count());
        $this->withToken($plain)->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_changing_another_users_password_revokes_only_that_users_tokens(): void
    {
        $admin = User::factory()->admin()->create();
        $adminToken = $admin->createToken('auth')->plainTextToken;
        $target = User::factory()->create();
        $targetToken = $target->createToken('phone')->plainTextToken;

        $this->withToken($adminToken)
            ->patchJson("/api/users/{$target->id}", ['password' => 'senha-nova-1'])
            ->assertOk();

        $this->assertSame(0, $target->fresh()->tokens()->count());
        $this->forgetAuth();
        $this->withToken($targetToken)->getJson('/api/auth/me')->assertUnauthorized();
        $this->forgetAuth();
        $this->withToken($adminToken)->getJson('/api/auth/me')->assertOk();
    }

    public function test_profile_update_keeps_api_tokens(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->patchJson('/api/auth/me', ['name' => 'Nome Novo'])
            ->assertOk();

        $this->forgetAuth();
        $this->assertSame(1, $user->fresh()->tokens()->count());
        $this->withToken($token)->getJson('/api/auth/me')->assertOk();
    }

    public function test_changing_own_password_keeps_the_current_token(): void
    {
        $admin = User::factory()->admin()->create();
        $current = $admin->createToken('auth')->plainTextToken;
        $other = $admin->createToken('laptop')->plainTextToken;

        $this->withToken($current)
            ->patchJson("/api/users/{$admin->id}", ['password' => 'senha-nova-1'])
            ->assertOk();

        $this->assertSame(1, $admin->fresh()->tokens()->count());
        $this->forgetAuth();
        $this->withToken($current)->getJson('/api/auth/me')->assertOk();
        $this->forgetAuth();
        $this->withToken($other)->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_authenticated_writes_stop_after_their_own_ceiling(): void
    {
        RateLimiter::for('api-write', function (Request $request) {
            return Limit::perMinute(2)->by(ApiRateLimit::actorKey($request));
        });

        $user = User::factory()->create();
        $token = $user->createToken('auth')->plainTextToken;

        $this->withToken($token)->patchJson('/api/auth/locale', ['locale' => 'en'])->assertOk();
        $this->withToken($token)->patchJson('/api/auth/locale', ['locale' => 'es'])->assertOk();
        $this->withToken($token)
            ->patchJson('/api/auth/locale', ['locale' => 'pt-BR'])
            ->assertStatus(429)
            ->assertJsonPath('message', __('auth.too_many_attempts'));
    }

    public function test_media_uploads_do_not_share_the_write_ceiling(): void
    {
        RateLimiter::for('api-write', function () {
            return Limit::perMinute(1)->by('writes');
        });
        RateLimiter::for('media-upload', function (Request $request) {
            return Limit::perMinute(3)->by(ApiRateLimit::actorKey($request));
        });

        $user = User::factory()->create();
        $token = $user->createToken('auth')->plainTextToken;

        $this->withToken($token)->postJson('/api/media', [])->assertUnprocessable();
        $this->withToken($token)->postJson('/api/media', [])->assertUnprocessable();
    }

    public function test_public_landing_reads_are_capped_per_ip(): void
    {
        RateLimiter::for('public-read', function (Request $request) {
            return Limit::perMinute(2)->by('ip:'.(string) $request->ip());
        });

        $this->getJson('/api/landings/nao-existe')->assertNotFound();
        $this->getJson('/api/landings/nao-existe')->assertNotFound();
        $this->getJson('/api/landings/nao-existe')->assertStatus(429);
    }

    public function test_google_redirect_is_capped_per_ip(): void
    {
        RateLimiter::for('oauth', function (Request $request) {
            return Limit::perMinute(1)->by('ip:'.(string) $request->ip());
        });

        $this->getJson('/api/auth/google/redirect?json=1');
        $this->getJson('/api/auth/google/redirect?json=1')->assertStatus(429);
    }

    public function test_health_stays_open_and_sends_security_headers(): void
    {
        $this->getJson('/api/health')
            ->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('Content-Security-Policy', "frame-ancestors 'none'")
            ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
            ->assertHeaderMissing('Strict-Transport-Security');
    }

    private function forgetAuth(): void
    {
        $this->flushSession();
        $this->app['auth']->forgetGuards();
    }
}
