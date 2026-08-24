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

    public function test_authenticated_user_can_upload_portfolio_video(): void
    {
        Storage::fake('uploads');

        $user = User::factory()->creator()->create();
        $token = $user->createToken('auth')->plainTextToken;

        $response = $this->withToken($token)->post('/api/media', [
            'file' => UploadedFile::fake()->create('reel.mp4', 2048, 'video/mp4'),
        ]);

        $response->assertCreated();
        $this->assertStringStartsWith('video-', (string) $response->json('data.filename'));
        $this->assertGreaterThan(0, (int) $response->json('data.size'));
    }

    public function test_portfolio_video_is_accepted_when_mime_is_octet_stream(): void
    {
        Storage::fake('uploads');

        $user = User::factory()->creator()->create();
        $token = $user->createToken('auth')->plainTextToken;

        $response = $this->withToken($token)->post('/api/media', [
            'file' => UploadedFile::fake()->create('clip-05-05-42-utc.mp4', 8192, 'application/octet-stream'),
        ]);

        $response->assertCreated();
        $this->assertStringEndsWith('.mp4', (string) $response->json('data.filename'));
    }

    public function test_portfolio_video_download_uses_attachment(): void
    {
        Storage::fake('uploads');
        Storage::disk('uploads')->put('portfolio/video-demo.mp4', 'video-bytes');

        $response = $this->get('/downloads/portfolio/video-demo.mp4');

        $response->assertOk();
        $this->assertStringContainsString('attachment', (string) $response->headers->get('content-disposition'));
    }

    public function test_user_can_update_own_avatar_url(): void
    {
        $user = User::factory()->admin()->create(['name' => 'Admin']);
        $token = $user->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->patchJson('/api/auth/me', [
                'name' => 'Diogo Rocketz',
                'avatar_url' => 'https://api.creatorz.digital/uploads/avatars/foto.jpg',
            ])
            ->assertOk()
            ->assertJsonPath('user.name', 'Diogo Rocketz')
            ->assertJsonPath('user.avatar_url', 'https://api.creatorz.digital/uploads/avatars/foto.jpg');
    }

    public function test_html_and_svg_uploads_are_rejected(): void
    {
        Storage::fake('uploads');

        $user = User::factory()->creator()->create();
        $token = $user->createToken('auth')->plainTextToken;

        $this->withToken($token)->post('/api/media', [
            'file' => UploadedFile::fake()->create('page.html', 12, 'text/html'),
        ])->assertUnprocessable();

        $this->withToken($token)->post('/api/media', [
            'file' => UploadedFile::fake()->create('icon.svg', 12, 'image/svg+xml'),
        ])->assertUnprocessable();
    }

    public function test_oversized_media_post_returns_json(): void
    {
        $user = User::factory()->creator()->create();
        $token = $user->createToken('auth')->plainTextToken;

        $this->withToken($token)
            ->call('POST', '/api/media', server: [
                'CONTENT_LENGTH' => 50 * 1024 * 1024,
                'HTTP_ACCEPT' => 'application/json',
                'HTTP_AUTHORIZATION' => 'Bearer '.$token,
            ])
            ->assertStatus(413)
            ->assertJsonPath('message', __('auth.post_too_large'));
    }
}
