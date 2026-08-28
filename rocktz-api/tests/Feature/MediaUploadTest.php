<?php

namespace Tests\Feature;

use App\Enums\DeliveryStatus;
use App\Enums\StageApprovalStatus;
use App\Models\CampaignCreator;
use App\Models\Creator;
use App\Models\User;
use App\Services\R2MultipartUploader;
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

    public function test_video_stream_supports_byte_range(): void
    {
        Storage::fake('uploads');
        Storage::disk('uploads')->put('portfolio/video-demo.mp4', str_repeat('abcdefghij', 20));

        $this->get('/stream/portfolio/video-demo.mp4')
            ->assertOk()
            ->assertHeader('Accept-Ranges', 'bytes')
            ->assertHeader('Content-Type', 'video/mp4');

        $partial = $this->get('/stream/portfolio/video-demo.mp4', ['Range' => 'bytes=0-9']);
        $partial->assertStatus(206)
            ->assertHeader('Accept-Ranges', 'bytes')
            ->assertHeader('Content-Range', 'bytes 0-9/200')
            ->assertHeader('Content-Length', '10');
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

    public function test_guest_cannot_init_chunked_upload(): void
    {
        $this->postJson('/api/media/uploads', [
            'filename' => 'reel.mp4',
            'size' => 2048,
            'mime_type' => 'video/mp4',
        ])->assertUnauthorized();
    }

    public function test_authenticated_user_can_upload_video_in_chunks(): void
    {
        Storage::fake('uploads');
        Storage::fake('local');

        $user = User::factory()->creator()->create();
        $token = $user->createToken('auth')->plainTextToken;
        $payload = hex2bin('000000186674797069736f6d0000000069736f6d').str_repeat("\0", 2476);

        $init = $this->withToken($token)->postJson('/api/media/uploads', [
            'filename' => 'reel.mp4',
            'size' => strlen($payload),
            'mime_type' => 'video/mp4',
        ]);

        $init->assertCreated()
            ->assertJsonPath('data.total_chunks', 3)
            ->assertJsonPath('data.destination', 'api');

        $uploadId = (string) $init->json('data.id');
        $chunkSize = (int) $init->json('data.chunk_size');

        for ($index = 0; $index < 3; $index++) {
            $chunk = substr($payload, $index * $chunkSize, $chunkSize);
            $this->withToken($token)
                ->call('POST', '/api/media/uploads/'.$uploadId.'/chunks/'.$index, content: $chunk, server: [
                    'CONTENT_TYPE' => 'application/octet-stream',
                    'HTTP_ACCEPT' => 'application/json',
                    'HTTP_AUTHORIZATION' => 'Bearer '.$token,
                ])
                ->assertOk();
        }

        $this->withToken($token)
            ->postJson('/api/media/uploads/'.$uploadId)
            ->assertCreated()
            ->assertJsonPath('data.size', strlen($payload));

        $this->assertDatabaseHas('media_files', [
            'uploaded_by' => $user->id,
            'size' => strlen($payload),
        ]);
    }

    public function test_complete_chunked_upload_requires_all_chunks(): void
    {
        Storage::fake('uploads');
        Storage::fake('local');

        $user = User::factory()->creator()->create();
        $token = $user->createToken('auth')->plainTextToken;

        $init = $this->withToken($token)->postJson('/api/media/uploads', [
            'filename' => 'reel.mp4',
            'size' => 2048,
            'mime_type' => 'video/mp4',
        ]);

        $uploadId = (string) $init->json('data.id');

        $this->withToken($token)
            ->postJson('/api/media/uploads/'.$uploadId)
            ->assertUnprocessable()
            ->assertJsonPath('message', __('auth.upload_incomplete'));
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

    public function test_submission_chunked_upload_finalizes_participation(): void
    {
        Storage::fake('uploads');
        Storage::fake('local');

        $creator = Creator::factory()->active()->create();
        $campaignCreator = CampaignCreator::factory()->create([
            'creator_id' => $creator->id,
            'video_status' => StageApprovalStatus::Pending,
            'delivery_status' => DeliveryStatus::Pending,
        ]);
        $token = $creator->user->createToken('auth')->plainTextToken;
        $payload = hex2bin('000000186674797069736f6d0000000069736f6d').str_repeat("\0", 2476);

        $init = $this->withToken($token)->postJson('/api/media/uploads', [
            'filename' => 'reel.mp4',
            'size' => strlen($payload),
            'mime_type' => 'video/mp4',
            'submission' => [
                'type' => 'campaign_creator',
                'id' => $campaignCreator->id,
                'payload' => [
                    'video_status' => 'submitted',
                    'delivery_status' => 'sent',
                ],
            ],
        ]);

        $init->assertCreated();
        $uploadId = (string) $init->json('data.id');
        $chunkSize = (int) $init->json('data.chunk_size');
        $totalChunks = (int) $init->json('data.total_chunks');

        for ($index = 0; $index < $totalChunks; $index++) {
            $chunk = substr($payload, $index * $chunkSize, $chunkSize);
            $this->withToken($token)
                ->call('POST', '/api/media/uploads/'.$uploadId.'/chunks/'.$index, content: $chunk, server: [
                    'CONTENT_TYPE' => 'application/octet-stream',
                    'HTTP_ACCEPT' => 'application/json',
                    'HTTP_AUTHORIZATION' => 'Bearer '.$token,
                ])
                ->assertOk();
        }

        $this->withToken($token)
            ->postJson('/api/media/uploads/'.$uploadId)
            ->assertCreated()
            ->assertJsonPath('data.status', 'done');

        $campaignCreator->refresh();
        $this->assertSame('submitted', $campaignCreator->video_status?->value);
        $this->assertSame('sent', $campaignCreator->delivery_status?->value);
        $this->assertNull($campaignCreator->pending_upload_id);
        $this->assertNotNull($campaignCreator->content?->video_url);
    }

    public function test_chunked_video_upload_goes_direct_to_r2_when_configured(): void
    {
        config([
            'media.disk' => 'r2',
            'media.r2_min_part_bytes' => 1024,
            'filesystems.disks.r2.key' => 'key',
            'filesystems.disks.r2.secret' => 'secret',
            'filesystems.disks.r2.bucket' => 'media',
            'filesystems.disks.r2.endpoint' => 'https://example.r2.cloudflarestorage.com',
            'filesystems.disks.r2.url' => 'https://cdn.test',
        ]);
        Storage::fake('r2');
        Storage::fake('local');

        $payload = hex2bin('000000186674797069736f6d0000000069736f6d').str_repeat("\0", 2476);
        $size = strlen($payload);

        $this->mock(R2MultipartUploader::class, function ($mock) use ($size) {
            $mock->shouldReceive('create')->once()->andReturn('mpu-1');
            $mock->shouldReceive('presignedPartUrls')->once()->andReturnUsing(
                fn (string $key, string $id, int $total) => array_map(
                    fn (int $index) => 'https://r2.test/part-'.$index,
                    range(0, $total - 1),
                ),
            );
            $mock->shouldReceive('complete')->once();
            $mock->shouldReceive('objectSize')->once()->andReturn($size);
            $mock->shouldReceive('listParts')->never();
            $mock->shouldReceive('abort')->never();
        });

        $user = User::factory()->creator()->create();
        $token = $user->createToken('auth')->plainTextToken;

        $init = $this->withToken($token)->postJson('/api/media/uploads', [
            'filename' => 'reel.mp4',
            'size' => $size,
            'mime_type' => 'video/mp4',
        ]);

        $init->assertCreated()->assertJsonPath('data.destination', 'r2');
        $partUrls = $init->json('data.part_urls');
        $this->assertIsArray($partUrls);
        $this->assertNotEmpty($partUrls);

        $parts = [];
        foreach (array_keys($partUrls) as $index) {
            $parts[] = ['index' => (int) $index, 'etag' => '"etag-'.$index.'"'];
        }

        $complete = $this->withToken($token)
            ->postJson('/api/media/uploads/'.(string) $init->json('data.id'), ['parts' => $parts]);

        $complete->assertCreated()
            ->assertJsonPath('data.size', $size);
        $this->assertStringContainsString('/stream/portfolio/', (string) $complete->json('data.url'));

        $this->assertDatabaseHas('media_files', [
            'uploaded_by' => $user->id,
            'disk' => 'r2',
            'size' => $size,
        ]);
    }

    public function test_r2_complete_lists_parts_when_browser_omits_etags(): void
    {
        config([
            'media.disk' => 'r2',
            'media.r2_min_part_bytes' => 1024,
            'filesystems.disks.r2.key' => 'key',
            'filesystems.disks.r2.secret' => 'secret',
            'filesystems.disks.r2.bucket' => 'media',
            'filesystems.disks.r2.endpoint' => 'https://example.r2.cloudflarestorage.com',
            'filesystems.disks.r2.url' => 'https://cdn.test',
        ]);
        Storage::fake('r2');
        Storage::fake('local');

        $payload = hex2bin('000000186674797069736f6d0000000069736f6d').str_repeat("\0", 2476);
        $size = strlen($payload);

        $totalParts = 0;
        $this->mock(R2MultipartUploader::class, function ($mock) use ($size, &$totalParts) {
            $mock->shouldReceive('create')->once()->andReturn('mpu-1');
            $mock->shouldReceive('presignedPartUrls')->once()->andReturnUsing(
                function (string $key, string $id, int $total) use (&$totalParts) {
                    $totalParts = $total;

                    return array_map(
                        fn (int $index) => 'https://r2.test/part-'.$index,
                        range(0, $total - 1),
                    );
                },
            );
            $mock->shouldReceive('listParts')->once()->andReturnUsing(function () use (&$totalParts) {
                return array_map(
                    fn (int $index) => ['PartNumber' => $index + 1, 'ETag' => '"etag-'.$index.'"'],
                    range(0, max(0, $totalParts - 1)),
                );
            });
            $mock->shouldReceive('complete')->once();
            $mock->shouldReceive('objectSize')->once()->andReturn($size);
            $mock->shouldReceive('abort')->never();
        });

        $user = User::factory()->creator()->create();
        $token = $user->createToken('auth')->plainTextToken;

        $init = $this->withToken($token)->postJson('/api/media/uploads', [
            'filename' => 'reel.mp4',
            'size' => $size,
            'mime_type' => 'video/mp4',
        ]);
        $init->assertCreated();
        $partUrls = $init->json('data.part_urls');
        $this->assertIsArray($partUrls);
        $parts = array_map(fn (int $index) => ['index' => $index, 'etag' => ''], array_keys($partUrls));

        $this->withToken($token)
            ->postJson('/api/media/uploads/'.(string) $init->json('data.id'), ['parts' => $parts])
            ->assertCreated()
            ->assertJsonPath('data.size', $size);
    }

    public function test_video_stream_serves_file_when_on_r2(): void
    {
        config([
            'media.disk' => 'r2',
            'filesystems.disks.r2.key' => 'key',
            'filesystems.disks.r2.secret' => 'secret',
            'filesystems.disks.r2.bucket' => 'media',
            'filesystems.disks.r2.endpoint' => 'https://example.r2.cloudflarestorage.com',
            'filesystems.disks.r2.url' => 'https://cdn.test',
        ]);
        Storage::fake('r2');
        Storage::disk('r2')->put('portfolio/video-r2.mp4', 'video-bytes');

        $this->get('/stream/portfolio/video-r2.mp4')
            ->assertOk()
            ->assertHeader('Content-Type', 'video/mp4')
            ->assertHeader('Accept-Ranges', 'bytes');
    }

    public function test_video_stream_uses_r2_even_when_default_disk_is_uploads(): void
    {
        config([
            'media.disk' => 'uploads',
            'filesystems.disks.r2.key' => 'key',
            'filesystems.disks.r2.secret' => 'secret',
            'filesystems.disks.r2.bucket' => 'media',
            'filesystems.disks.r2.endpoint' => 'https://example.r2.cloudflarestorage.com',
            'filesystems.disks.r2.url' => 'https://cdn.test',
        ]);
        Storage::fake('uploads');
        Storage::fake('r2');
        Storage::disk('r2')->put('portfolio/video-r2.mp4', 'video-bytes');

        $this->get('/stream/portfolio/video-r2.mp4')
            ->assertOk()
            ->assertHeader('Content-Type', 'video/mp4');
    }
}
