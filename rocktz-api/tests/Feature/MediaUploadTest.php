<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MediaUploadTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_upload_media(): void
    {
        $this->postJson('/api/media')->assertUnauthorized();
    }

    public function test_authenticated_user_can_upload_avatar(): void
    {
        Storage::fake('uploads');

        $user = User::factory()->admin()->create();
        $token = $user->createToken('auth')->plainTextToken;

        $response = $this->withToken($token)->post('/api/media', [
            'file' => UploadedFile::fake()->image('foto.png', 400, 400),
        ]);

        $response->assertCreated()
            ->assertJsonStructure(['data' => ['id', 'url', 'filename', 'path']]);

        $this->assertStringStartsWith('avatar-', (string) $response->json('data.filename'));

        $this->assertDatabaseHas('media_files', [
            'uploaded_by' => $user->id,
            'disk' => 'uploads',
        ]);
    }

    public function test_user_can_update_own_avatar_url(): void
    {
        $user = User::factory()->admin()->create(['name' => 'Admin']);
        $token = $user->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->patchJson('/api/auth/me', [
                'name' => 'Diogo Rocketz',
                'avatar_url' => 'https://apicreators.rocketz.me/uploads/avatars/foto.jpg',
            ])
            ->assertOk()
            ->assertJsonPath('user.name', 'Diogo Rocketz')
            ->assertJsonPath('user.avatar_url', 'https://apicreators.rocketz.me/uploads/avatars/foto.jpg');
    }
}
