<?php

namespace App\Services;

use App\Models\DeviceToken;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class FcmPushService
{
    private ?string $cachedAccessToken = null;

    public function configured(): bool
    {
        return $this->projectId() !== '' && $this->privateKey() !== '' && $this->clientEmail() !== '';
    }

    /**
     * @param  array<string, string>  $data
     */
    public function sendToUser(int $userId, string $title, string $body, array $data = []): void
    {
        if (! $this->configured()) {
            return;
        }

        $tokens = DeviceToken::query()->where('user_id', $userId)->get();
        foreach ($tokens as $device) {
            $this->sendToToken($device, $title, $body, $data);
        }
    }

    /**
     * @param  array<string, string>  $data
     */
    public function sendToToken(DeviceToken $device, string $title, string $body, array $data = []): void
    {
        if (! $this->configured()) {
            return;
        }

        try {
            $accessToken = $this->accessToken();
            $response = Http::withToken($accessToken)
                ->acceptJson()
                ->timeout(20)
                ->post($this->sendUrl(), [
                    'message' => [
                        'token' => $device->token,
                        'notification' => [
                            'title' => $title,
                            'body' => $body,
                        ],
                        'data' => $this->stringifyData($data),
                        'apns' => [
                            'payload' => [
                                'aps' => [
                                    'sound' => 'default',
                                ],
                            ],
                        ],
                    ],
                ]);
        } catch (Throwable $e) {
            report($e);

            return;
        }

        if ($this->tokenIsInvalid($response)) {
            $device->delete();

            return;
        }

        if (! $response->successful()) {
            Log::warning('fcm.push_failed', [
                'status' => $response->status(),
                'body' => mb_substr($response->body(), 0, 500),
                'device_token_id' => $device->id,
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, string>
     */
    private function stringifyData(array $data): array
    {
        $out = [];
        foreach ($data as $key => $value) {
            if ($value === null || $value === '') {
                continue;
            }
            $out[(string) $key] = is_scalar($value) ? (string) $value : json_encode($value, JSON_UNESCAPED_UNICODE);
        }

        return $out;
    }

    private function tokenIsInvalid(Response $response): bool
    {
        if ($response->status() !== 404 && $response->status() !== 400) {
            return false;
        }

        $status = (string) data_get($response->json(), 'error.status');
        $code = (string) data_get($response->json(), 'error.details.0.errorCode');

        return in_array($status, ['NOT_FOUND', 'INVALID_ARGUMENT'], true)
            || in_array($code, ['UNREGISTERED', 'INVALID_ARGUMENT'], true);
    }

    private function sendUrl(): string
    {
        return 'https://fcm.googleapis.com/v1/projects/'.$this->projectId().'/messages:send';
    }

    private function accessToken(): string
    {
        if ($this->cachedAccessToken) {
            return $this->cachedAccessToken;
        }

        $now = time();
        $jwt = $this->jwt([
            'iss' => $this->clientEmail(),
            'sub' => $this->clientEmail(),
            'aud' => 'https://oauth2.googleapis.com/token',
            'iat' => $now,
            'exp' => $now + 3600,
            'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
        ]);

        $response = Http::asForm()->timeout(20)->post('https://oauth2.googleapis.com/token', [
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $jwt,
        ]);

        $token = (string) $response->json('access_token');
        if ($token === '') {
            throw new \RuntimeException('FCM OAuth token missing');
        }

        return $this->cachedAccessToken = $token;
    }

    /**
     * @param  array<string, mixed>  $claims
     */
    private function jwt(array $claims): string
    {
        $header = $this->b64(json_encode(['alg' => 'RS256', 'typ' => 'JWT'], JSON_THROW_ON_ERROR));
        $payload = $this->b64(json_encode($claims, JSON_THROW_ON_ERROR));
        $input = $header.'.'.$payload;

        $ok = openssl_sign($input, $signature, $this->privateKey(), OPENSSL_ALGO_SHA256);
        if (! $ok || $signature === '') {
            throw new \RuntimeException('FCM JWT sign failed');
        }

        return $input.'.'.$this->b64($signature);
    }

    private function b64(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private function projectId(): string
    {
        return (string) config('services.fcm.project_id');
    }

    private function clientEmail(): string
    {
        return (string) config('services.fcm.client_email');
    }

    private function privateKey(): string
    {
        $key = (string) config('services.fcm.private_key');

        return str_replace('\\n', "\n", $key);
    }
}
