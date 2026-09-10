<?php

namespace Tests\Feature;

use App\Console\Commands\MediaMakePlayableCommand;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MediaMp4CommandTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('uploads');
        Storage::fake('r2');
        config([
            'media.disk' => 'uploads',
            'filesystems.disks.r2.key' => '',
            'filesystems.disks.r2.secret' => '',
            'filesystems.disks.r2.bucket' => '',
            'filesystems.disks.r2.endpoint' => '',
        ]);
    }

    public function test_media_mp4_alias_reports_missing_file(): void
    {
        $this->artisan('media:mp4', ['file' => 'nao-existe.mov'])
            ->expectsOutputToContain('File not found')
            ->assertFailed();
    }

    public function test_media_mp4_without_file_reports_when_nothing_is_pending(): void
    {
        Storage::fake('uploads');

        $this->artisan('media:mp4')
            ->expectsOutputToContain('No pending .mov files')
            ->assertSuccessful();
    }

    public function test_media_mp4_resolves_bare_filename_to_portfolio_key(): void
    {
        Storage::fake('uploads');
        Storage::disk('uploads')->put('portfolio/video-20260909181647-p5nv4ebq.mov', str_repeat('abcdefghij', 20));

        $key = app(MediaMakePlayableCommand::class)->resolveKey('video-20260909181647-p5nv4ebq.mov');

        $this->assertSame('portfolio/video-20260909181647-p5nv4ebq.mov', $key);
    }

    public function test_media_mp4_without_file_collects_every_pending_mov(): void
    {
        Storage::fake('uploads');
        Storage::disk('uploads')->put('portfolio/video-one.mov', str_repeat('abcdefghij', 20));
        Storage::disk('uploads')->put('portfolio/video-two.mov', str_repeat('abcdefghij', 20));
        Storage::disk('uploads')->put('portfolio/video-ready.mov', str_repeat('abcdefghij', 20));
        Storage::disk('uploads')->put('portfolio/video-ready.mp4', str_repeat('previewmp4x', 20));

        $keys = app(MediaMakePlayableCommand::class)->pendingKeys();

        $this->assertContains('portfolio/video-one.mov', $keys);
        $this->assertContains('portfolio/video-two.mov', $keys);
        $this->assertNotContains('portfolio/video-ready.mov', $keys);
    }
}
