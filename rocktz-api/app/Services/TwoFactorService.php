<?php

namespace App\Services;

use App\Enums\MailTemplateKey;
use App\Enums\TwoFactorPurpose;
use App\Models\TwoFactorChallenge;
use App\Models\User;
use App\Services\Mail\TransactionalMailService;
use App\Support\FrontendUrl;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use RuntimeException;

class TwoFactorService
{
    public const CODE_LENGTH = 6;

    public const EXPIRE_MINUTES = 10;

    public const MAX_ATTEMPTS = 5;

    public const RESEND_SECONDS = 60;

    public function __construct(private readonly TransactionalMailService $mail) {}

    /**
     * @return array{two_factor_required: true, challenge_token: string, email_hint: string, expires_in: int, message: string}
     */
    public function startChallenge(User $user, TwoFactorPurpose $purpose): array
    {
        if (! $this->mail->sendingEnabled()) {
            throw new RuntimeException(__('auth.mail_not_configured'), 503);
        }

        TwoFactorChallenge::query()
            ->where('user_id', $user->id)
            ->where('purpose', $purpose)
            ->whereNull('consumed_at')
            ->delete();

        $plainToken = Str::random(64);
        $code = str_pad((string) random_int(0, 999999), self::CODE_LENGTH, '0', STR_PAD_LEFT);

        $challenge = TwoFactorChallenge::query()->create([
            'user_id' => $user->id,
            'purpose' => $purpose,
            'token_hash' => hash('sha256', $plainToken),
            'code_hash' => Hash::make($code),
            'attempts' => 0,
            'expires_at' => now()->addMinutes(self::EXPIRE_MINUTES),
        ]);

        $message = $this->mail->send(
            MailTemplateKey::TwoFactorCode,
            $user,
            [
                'codigo' => $code,
                'nome_usuario' => $user->name,
                'cta_url' => FrontendUrl::to('/login'),
                'link_plataforma' => FrontendUrl::to('/login'),
            ],
            null,
            $purpose->value.':'.$challenge->id,
        );

        if (! $message) {
            $challenge->delete();

            throw new RuntimeException(__('auth.mail_failed'), 503);
        }

        return [
            'two_factor_required' => true,
            'challenge_token' => $plainToken,
            'email_hint' => $this->emailHint($user->email),
            'expires_in' => self::EXPIRE_MINUTES * 60,
            'message' => __('auth.two_factor_sent'),
        ];
    }

    public function resend(string $plainToken): array
    {
        $challenge = $this->findActiveChallenge($plainToken);

        if ($challenge->created_at?->gt(now()->subSeconds(self::RESEND_SECONDS))) {
            throw new RuntimeException(__('auth.mail_throttled'), 429);
        }

        return $this->startChallenge($challenge->user, $challenge->purpose);
    }

    public function verify(string $plainToken, string $code, TwoFactorPurpose $purpose): User
    {
        $challenge = $this->findActiveChallenge($plainToken);

        if ($challenge->purpose !== $purpose) {
            throw new RuntimeException(__('auth.two_factor_invalid'), 422);
        }

        if ($challenge->attempts >= self::MAX_ATTEMPTS) {
            $challenge->forceFill(['consumed_at' => now()])->save();

            throw new RuntimeException(__('auth.two_factor_locked'), 422);
        }

        $challenge->increment('attempts');
        $challenge->refresh();

        $normalized = preg_replace('/\D+/', '', $code) ?? '';

        if (strlen($normalized) !== self::CODE_LENGTH || ! Hash::check($normalized, $challenge->code_hash)) {
            throw new RuntimeException(__('auth.two_factor_invalid'), 422);
        }

        $challenge->forceFill(['consumed_at' => now()])->save();

        return $challenge->user;
    }

    public function emailHint(string $email): string
    {
        [$local, $domain] = array_pad(explode('@', Str::lower($email), 2), 2, '');
        if ($local === '' || $domain === '') {
            return '***';
        }

        $visible = Str::substr($local, 0, 1);

        return $visible.'***@'.$domain;
    }

    private function findActiveChallenge(string $plainToken): TwoFactorChallenge
    {
        $challenge = TwoFactorChallenge::query()
            ->with('user')
            ->where('token_hash', hash('sha256', $plainToken))
            ->first();

        if (! $challenge || $challenge->isConsumed() || $challenge->isExpired() || ! $challenge->user) {
            throw new RuntimeException(__('auth.two_factor_expired'), 422);
        }

        return $challenge;
    }
}
