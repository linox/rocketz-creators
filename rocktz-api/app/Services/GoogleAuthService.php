<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Models\User;
use App\Support\AppLocale;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class GoogleAuthService
{
    public function isConfigured(): bool
    {
        return filled(config('services.google.client_id'))
            && filled(config('services.google.client_secret'));
    }

    public function redirectUrl(string $intent = 'login'): string
    {
        if (! $this->isConfigured()) {
            throw new RuntimeException(__('auth.google_not_configured'));
        }

        $params = http_build_query([
            'client_id' => config('services.google.client_id'),
            'redirect_uri' => config('services.google.redirect'),
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'access_type' => 'online',
            'prompt' => 'select_account',
            'state' => $this->encodeState($intent),
        ]);

        return 'https://accounts.google.com/o/oauth2/v2/auth?'.$params;
    }

    /**
     * @return array{id: string, email: string, name: string}
     */
    public function userFromCode(string $code): array
    {
        if (! $this->isConfigured()) {
            throw new RuntimeException(__('auth.google_not_configured'));
        }

        try {
            $tokenResponse = Http::asForm()->post('https://oauth2.googleapis.com/token', [
                'code' => $code,
                'client_id' => config('services.google.client_id'),
                'client_secret' => config('services.google.client_secret'),
                'redirect_uri' => config('services.google.redirect'),
                'grant_type' => 'authorization_code',
            ])->throw()->json();
        } catch (RequestException $e) {
            throw new RuntimeException(__('auth.google_code_invalid'), 0, $e);
        }

        $accessToken = $tokenResponse['access_token'] ?? null;

        if (! is_string($accessToken) || $accessToken === '') {
            throw new RuntimeException(__('auth.google_token_invalid'));
        }

        try {
            $profile = Http::withToken($accessToken)
                ->get('https://www.googleapis.com/oauth2/v2/userinfo')
                ->throw()
                ->json();
        } catch (RequestException $e) {
            throw new RuntimeException(__('auth.google_profile_failed'), 0, $e);
        }

        $id = (string) ($profile['id'] ?? '');
        $email = Str::lower((string) ($profile['email'] ?? ''));
        $name = (string) ($profile['name'] ?? $email);

        if ($id === '' || $email === '') {
            throw new RuntimeException(__('auth.google_no_email'));
        }

        if (($profile['verified_email'] ?? true) === false) {
            throw new RuntimeException(__('auth.google_no_email'));
        }

        return [
            'id' => $id,
            'email' => $email,
            'name' => $name,
        ];
    }

    public function findOrNewUser(array $googleUser): User
    {
        $user = User::query()->where('google_id', $googleUser['id'])->first()
            ?? User::query()->where('email', $googleUser['email'])->first();

        if ($user) {
            if (! $user->google_id) {
                $user->forceFill(['google_id' => $googleUser['id']])->save();
            }

            return $user;
        }

        return User::query()->create([
            'name' => $googleUser['name'],
            'email' => $googleUser['email'],
            'password' => null,
            'google_id' => $googleUser['id'],
            'role' => UserRole::Creator,
            'email_verified_at' => now(),
            'locale' => AppLocale::fromLaravel(app()->getLocale()),
        ]);
    }

    public function needsProfile(User $user): bool
    {
        return match ($user->role) {
            UserRole::Admin => false,
            UserRole::Creator => $user->creator()->doesntExist(),
            UserRole::Company => $user->companyUser()->doesntExist(),
        };
    }

    public function consumeState(?string $state): string
    {
        if (! is_string($state) || ! str_contains($state, '.')) {
            throw new RuntimeException(__('auth.google_state_invalid'));
        }

        [$payload, $provided] = explode('.', $state, 2);
        $expected = hash_hmac('sha256', $payload, (string) config('app.key'));
        if (! hash_equals($expected, $provided)) {
            throw new RuntimeException(__('auth.google_state_invalid'));
        }

        $padded = strtr($payload, '-_', '+/');
        $padded .= str_repeat('=', (4 - strlen($padded) % 4) % 4);
        $json = json_decode((string) base64_decode($padded, true), true);
        if (! is_array($json) || (int) ($json['exp'] ?? 0) < time()) {
            throw new RuntimeException(__('auth.google_state_invalid'));
        }

        $nonce = (string) ($json['n'] ?? '');
        if ($nonce === '' || ! Cache::pull('google_oauth:'.$nonce)) {
            throw new RuntimeException(__('auth.google_state_invalid'));
        }

        $intent = (string) ($json['intent'] ?? 'login');

        return in_array($intent, ['login', 'creator', 'company'], true) ? $intent : 'login';
    }

    private function encodeState(string $intent): string
    {
        $nonce = Str::random(32);
        Cache::put('google_oauth:'.$nonce, true, now()->addMinutes(10));
        $payload = rtrim(strtr(base64_encode((string) json_encode([
            'intent' => $intent,
            'n' => $nonce,
            'exp' => time() + 600,
        ])), '+/', '-_'), '=');

        return $payload.'.'.hash_hmac('sha256', $payload, (string) config('app.key'));
    }
}
