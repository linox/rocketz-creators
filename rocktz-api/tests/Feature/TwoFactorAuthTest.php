<?php

namespace Tests\Feature;

use App\Enums\MailTemplateKey;
use App\Jobs\SendTransactionalMailJob;
use App\Mail\TransactionalMailable;
use App\Models\MailTemplate;
use App\Models\User;
use App\Services\Mail\TransactionalMailService;
use Database\Seeders\MailTemplateSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Mail\Events\MessageSending;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class TwoFactorAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_without_two_factor_still_issues_token(): void
    {
        $user = User::factory()->create([
            'email' => 'plain@example.com',
            'password' => 'secret123',
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'plain@example.com',
            'password' => 'secret123',
        ])->assertOk()
            ->assertJsonPath('user.email', $user->email)
            ->assertJsonMissingPath('two_factor_required')
            ->assertJsonStructure(['token', 'user']);
    }

    public function test_login_with_two_factor_sends_code_and_does_not_issue_token(): void
    {
        Mail::fake();
        $user = $this->userWithTwoFactor();

        $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'secret123',
        ])->assertOk()
            ->assertJsonPath('two_factor_required', true)
            ->assertJsonMissingPath('token')
            ->assertJsonStructure(['challenge_token', 'email_hint']);

        $this->assertDatabaseHas('mail_messages', [
            'email' => $user->email,
            'template_key' => MailTemplateKey::TwoFactorCode->value,
        ]);

        Mail::assertSent(TransactionalMailable::class, function (TransactionalMailable $mail) use ($user) {
            $code = (string) ($mail->mailMessage->payload['variables']['codigo'] ?? '');

            return $mail->hasTo($user->email)
                && preg_match('/^\d{6}$/', $code) === 1
                && $mail->mailMessage->subject === app(TransactionalMailService::class)->defaultCopy(MailTemplateKey::TwoFactorCode, 'pt_BR')['subject']
                && ! str_contains($mail->mailMessage->subject, 'mail.templates');
        });
    }

    public function test_valid_code_issues_token(): void
    {
        Mail::fake();
        $user = $this->userWithTwoFactor();
        [$token, $code] = $this->challengeFor($user);

        $this->postJson('/api/auth/two-factor/verify', [
            'challenge_token' => $token,
            'code' => $code,
        ])->assertOk()
            ->assertJsonPath('user.email', $user->email)
            ->assertJsonStructure(['token', 'user']);
    }

    public function test_two_factor_email_sends_even_when_queue_is_database(): void
    {
        Mail::fake();
        Queue::fake();
        config(['queue.default' => 'database']);
        $user = $this->userWithTwoFactor();

        $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'secret123',
        ])->assertOk();

        Mail::assertSent(TransactionalMailable::class);
        Queue::assertNotPushed(SendTransactionalMailJob::class);
        $this->assertDatabaseHas('mail_messages', [
            'email' => $user->email,
            'template_key' => MailTemplateKey::TwoFactorCode->value,
            'status' => 'sent',
        ]);
    }

    public function test_two_factor_sends_even_when_template_is_disabled(): void
    {
        Mail::fake();
        $this->seed(MailTemplateSeeder::class);
        MailTemplate::query()->where('key', MailTemplateKey::TwoFactorCode->value)->update(['enabled' => false]);
        $user = $this->userWithTwoFactor();

        $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'secret123',
        ])->assertOk()
            ->assertJsonPath('two_factor_required', true);

        Mail::assertSent(TransactionalMailable::class);
    }

    public function test_two_factor_login_fails_when_mail_provider_throws(): void
    {
        Event::listen(MessageSending::class, function () {
            throw new \RuntimeException('provider down');
        });
        $user = $this->userWithTwoFactor();

        $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'secret123',
        ])->assertStatus(503)
            ->assertJsonPath('message', __('auth.mail_failed'));
    }

    public function test_two_factor_login_fails_when_resend_key_is_missing(): void
    {
        config(['mail.default' => 'resend', 'services.resend.key' => '']);
        $user = $this->userWithTwoFactor();

        $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'secret123',
        ])->assertStatus(503)
            ->assertJsonPath('message', __('auth.mail_not_configured'));
    }

    public function test_resend_is_throttled_within_one_minute(): void
    {
        Mail::fake();
        $user = $this->userWithTwoFactor();
        [$token] = $this->challengeFor($user);

        $this->postJson('/api/auth/two-factor/resend', [
            'challenge_token' => $token,
        ])->assertStatus(429)
            ->assertJsonPath('message', __('auth.mail_throttled'));
    }

    public function test_resend_issues_new_code_after_cooldown(): void
    {
        Mail::fake();
        $user = $this->userWithTwoFactor();
        [$oldToken, $oldCode] = $this->challengeFor($user);

        $this->travel(61)->seconds();

        $resend = $this->postJson('/api/auth/two-factor/resend', [
            'challenge_token' => $oldToken,
        ])->assertOk()
            ->assertJsonPath('two_factor_required', true);

        $newToken = $resend->json('challenge_token');
        $this->assertNotSame($oldToken, $newToken);

        $newCode = $this->lastCodeFor($user);
        $this->assertNotSame($oldCode, $newCode);

        $this->postJson('/api/auth/two-factor/verify', [
            'challenge_token' => $oldToken,
            'code' => $oldCode,
        ])->assertUnprocessable();

        $this->postJson('/api/auth/two-factor/verify', [
            'challenge_token' => $newToken,
            'code' => $oldCode,
        ])->assertUnprocessable();

        $this->postJson('/api/auth/two-factor/verify', [
            'challenge_token' => $newToken,
            'code' => $newCode,
        ])->assertOk()
            ->assertJsonStructure(['token', 'user']);
    }

    public function test_invalid_code_is_rejected(): void
    {
        Mail::fake();
        $user = $this->userWithTwoFactor();
        [$token] = $this->challengeFor($user);

        $this->postJson('/api/auth/two-factor/verify', [
            'challenge_token' => $token,
            'code' => '000000',
        ])->assertUnprocessable()
            ->assertJsonPath('message', __('auth.two_factor_invalid'));
    }

    public function test_code_cannot_be_reused(): void
    {
        Mail::fake();
        $user = $this->userWithTwoFactor();
        [$token, $code] = $this->challengeFor($user);

        $this->postJson('/api/auth/two-factor/verify', [
            'challenge_token' => $token,
            'code' => $code,
        ])->assertOk();

        $this->postJson('/api/auth/two-factor/verify', [
            'challenge_token' => $token,
            'code' => $code,
        ])->assertUnprocessable()
            ->assertJsonPath('message', __('auth.two_factor_expired'));
    }

    public function test_user_can_enable_and_disable_two_factor(): void
    {
        Mail::fake();
        $user = User::factory()->create([
            'email' => 'enable@example.com',
            'password' => 'secret123',
        ]);
        $auth = $user->createToken('auth')->plainTextToken;

        $enable = $this->withToken($auth)
            ->postJson('/api/auth/two-factor/enable')
            ->assertOk()
            ->assertJsonPath('two_factor_required', true);

        $code = $this->lastCodeFor($user);

        $this->withToken($auth)
            ->postJson('/api/auth/two-factor/confirm', [
                'challenge_token' => $enable->json('challenge_token'),
                'code' => $code,
            ])
            ->assertOk()
            ->assertJsonPath('user.two_factor_enabled', true);

        $this->assertTrue($user->fresh()->two_factor_enabled);

        $this->withToken($auth)
            ->postJson('/api/auth/two-factor/disable', [
                'password' => 'secret123',
            ])
            ->assertOk()
            ->assertJsonPath('user.two_factor_enabled', false);

        $this->assertFalse($user->fresh()->two_factor_enabled);
    }

    public function test_google_only_user_disables_two_factor_with_email_code(): void
    {
        Mail::fake();
        $user = User::factory()->create([
            'email' => 'google2fa@example.com',
            'password' => null,
            'google_id' => 'gid-1',
            'two_factor_enabled' => true,
        ]);
        $auth = $user->createToken('auth')->plainTextToken;

        $challenge = $this->withToken($auth)
            ->postJson('/api/auth/two-factor/disable-challenge')
            ->assertOk();

        $code = $this->lastCodeFor($user);

        $this->withToken($auth)
            ->postJson('/api/auth/two-factor/disable', [
                'challenge_token' => $challenge->json('challenge_token'),
                'code' => $code,
            ])
            ->assertOk()
            ->assertJsonPath('user.two_factor_enabled', false);
    }

    public function test_me_exposes_two_factor_flag(): void
    {
        $user = $this->userWithTwoFactor();
        $token = $user->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('user.two_factor_enabled', true)
            ->assertJsonPath('user.has_password', true);
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function challengeFor(User $user): array
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'secret123',
        ])->assertOk();

        return [$response->json('challenge_token'), $this->lastCodeFor($user)];
    }

    private function lastCodeFor(User $user): string
    {
        $code = '';
        Mail::assertSent(TransactionalMailable::class, function (TransactionalMailable $mail) use ($user, &$code) {
            if (! $mail->hasTo($user->email)) {
                return false;
            }
            $code = (string) ($mail->mailMessage->payload['variables']['codigo'] ?? '');

            return $code !== '';
        });

        $this->assertMatchesRegularExpression('/^\d{6}$/', $code);

        return $code;
    }

    private function userWithTwoFactor(): User
    {
        return User::factory()->create([
            'email' => 'secure@example.com',
            'password' => 'secret123',
            'two_factor_enabled' => true,
        ]);
    }
}
