<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Http\Client\RequestException;
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
            throw new RuntimeException('Login com Google não está configurado.');
        }

        $params = http_build_query([
            'client_id' => config('services.google.client_id'),
            'redirect_uri' => config('services.google.redirect'),
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'access_type' => 'online',
            'prompt' => 'select_account',
            'state' => $intent,
        ]);

        return 'https://accounts.google.com/o/oauth2/v2/auth?'.$params;
    }

    /**
     * @return array{id: string, email: string, name: string}
     */
    public function userFromCode(string $code): array
    {
        if (! $this->isConfigured()) {
            throw new RuntimeException('Login com Google não está configurado.');
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
            throw new RuntimeException('Não foi possível validar o código do Google.', 0, $e);
        }

        $accessToken = $tokenResponse['access_token'] ?? null;

        if (! is_string($accessToken) || $accessToken === '') {
            throw new RuntimeException('Token do Google inválido.');
        }

        try {
            $profile = Http::withToken($accessToken)
                ->get('https://www.googleapis.com/oauth2/v2/userinfo')
                ->throw()
                ->json();
        } catch (RequestException $e) {
            throw new RuntimeException('Não foi possível ler o perfil do Google.', 0, $e);
        }

        $id = (string) ($profile['id'] ?? '');
        $email = Str::lower((string) ($profile['email'] ?? ''));
        $name = (string) ($profile['name'] ?? $email);

        if ($id === '' || $email === '') {
            throw new RuntimeException('O Google não retornou e-mail.');
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
}
