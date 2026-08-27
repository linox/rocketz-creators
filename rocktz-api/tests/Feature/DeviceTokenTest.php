<?php

namespace Tests\Feature;

use App\Enums\NotificationType;
use App\Jobs\SendPushNotificationJob;
use App\Models\DeviceToken;
use App\Models\Notification;
use App\Models\User;
use App\Services\FcmPushService;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DeviceTokenTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register_and_replace_device_token(): void
    {
        $user = User::factory()->creator()->create();
        $other = User::factory()->creator()->create();

        Sanctum::actingAs($user);
        $this->postJson('/api/device-tokens', [
            'token' => 'fcm-token-abc',
            'platform' => 'ios',
        ])->assertCreated()->assertJsonPath('data.platform', 'ios');

        $this->assertDatabaseHas('device_tokens', [
            'user_id' => $user->id,
            'token' => 'fcm-token-abc',
            'platform' => 'ios',
        ]);

        $this->postJson('/api/device-tokens', [
            'token' => 'fcm-token-abc',
            'platform' => 'android',
        ])->assertOk();

        $this->assertEquals(1, DeviceToken::query()->count());
        $this->assertDatabaseHas('device_tokens', [
            'user_id' => $user->id,
            'platform' => 'android',
        ]);

        Sanctum::actingAs($other);
        $this->postJson('/api/device-tokens', [
            'token' => 'fcm-token-abc',
            'platform' => 'android',
        ])->assertOk();

        $this->assertSame($other->id, DeviceToken::query()->where('token', 'fcm-token-abc')->value('user_id'));
        $this->assertEquals(1, DeviceToken::query()->count());
    }

    public function test_user_can_unregister_own_device_token(): void
    {
        $user = User::factory()->creator()->create();
        $token = $user->createToken('auth')->plainTextToken;
        DeviceToken::query()->create([
            'user_id' => $user->id,
            'token' => 'fcm-leave',
            'platform' => 'android',
        ]);

        $this->withToken($token)->deleteJson('/api/device-tokens', [
            'token' => 'fcm-leave',
        ])->assertOk();

        $this->assertDatabaseMissing('device_tokens', ['token' => 'fcm-leave']);
    }

    public function test_guest_cannot_register_device_token(): void
    {
        $this->postJson('/api/device-tokens', [
            'token' => 'fcm-token-abc',
            'platform' => 'ios',
        ])->assertUnauthorized();
    }

    public function test_creating_notification_dispatches_push_job(): void
    {
        Queue::fake();
        $user = User::factory()->creator()->create();

        app(NotificationService::class)->send([
            'user_id' => $user->id,
            'title' => 'Olá',
            'message' => 'Nova campanha',
            'type' => NotificationType::General,
        ]);

        Queue::assertPushed(SendPushNotificationJob::class);
    }

    public function test_push_job_sends_fcm_and_drops_invalid_tokens(): void
    {
        $user = User::factory()->creator()->create();
        $valid = DeviceToken::query()->create([
            'user_id' => $user->id,
            'token' => 'good-token',
            'platform' => 'ios',
        ]);
        DeviceToken::query()->create([
            'user_id' => $user->id,
            'token' => 'dead-token',
            'platform' => 'android',
        ]);

        $notification = Notification::factory()->create([
            'user_id' => $user->id,
            'title' => 'Aviso',
            'message' => 'Corpo',
            'type' => NotificationType::General,
        ]);

        config([
            'services.fcm.project_id' => 'rocketz-test',
            'services.fcm.client_email' => 'fcm@rocketz-test.iam.gserviceaccount.com',
            'services.fcm.private_key' => $this->testPrivateKey(),
        ]);

        Http::fake([
            'https://oauth2.googleapis.com/token' => Http::response(['access_token' => 'ya29.test', 'expires_in' => 3600]),
            'https://fcm.googleapis.com/v1/projects/rocketz-test/messages:send' => function ($request) {
                $token = data_get($request->data(), 'message.token');
                if ($token === 'dead-token') {
                    return Http::response([
                        'error' => [
                            'status' => 'NOT_FOUND',
                            'details' => [['errorCode' => 'UNREGISTERED']],
                        ],
                    ], 404);
                }

                return Http::response(['name' => 'projects/rocketz-test/messages/1']);
            },
        ]);

        (new SendPushNotificationJob($notification->id))->handle(app(FcmPushService::class));

        $this->assertDatabaseHas('device_tokens', ['id' => $valid->id]);
        $this->assertDatabaseMissing('device_tokens', ['token' => 'dead-token']);
        Http::assertSentCount(3);
    }

    private function testPrivateKey(): string
    {
        $key = openssl_pkey_new([
            'private_key_bits' => 2048,
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
        ]);
        openssl_pkey_export($key, $pem);

        return $pem;
    }
}
