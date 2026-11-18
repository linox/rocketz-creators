<?php

namespace Tests\Unit;

use App\Support\BrowserVideo;
use Illuminate\Support\Facades\Storage;
use ReflectionMethod;
use Tests\TestCase;

class BrowserVideoTest extends TestCase
{
    public function test_mov_preview_key_does_not_replace_the_original_path(): void
    {
        $this->assertTrue(BrowserVideo::needsTranscode('portfolio/video-iphone.mov'));
        $this->assertTrue(BrowserVideo::needsTranscode('portfolio/clip.m4v'));
        $this->assertFalse(BrowserVideo::needsTranscode('portfolio/video-iphone.mp4'));
        $this->assertSame('portfolio/video-iphone.mp4', BrowserVideo::mp4Key('portfolio/video-iphone.mov'));
        $this->assertSame('portfolio/video-iphone.mp4', BrowserVideo::mp4Key('portfolio/video-iphone.mp4'));
        $this->assertSame('portfolio/video-iphone.jpg', BrowserVideo::posterKey('portfolio/video-iphone.mov'));
        $this->assertSame('portfolio/video-iphone.jpg', BrowserVideo::posterKey('portfolio/video-iphone.mp4'));
    }

    public function test_existing_cover_is_reused_instead_of_rebuilt(): void
    {
        Storage::fake('uploads');
        Storage::fake('r2');
        config([
            'media.disk' => 'uploads',
            'filesystems.disks.r2.key' => '',
            'filesystems.disks.r2.secret' => '',
            'filesystems.disks.r2.bucket' => '',
            'filesystems.disks.r2.endpoint' => '',
        ]);

        $jpeg = str_repeat('cover', 20);
        Storage::disk('uploads')->put('portfolio/clip.mp4', str_repeat('video', 20));
        Storage::disk('uploads')->put('portfolio/clip.jpg', $jpeg);

        $this->assertTrue(BrowserVideo::posterReady('portfolio/clip.mp4'));
        $this->assertTrue(BrowserVideo::ensurePoster('portfolio/clip.mp4'));
        $this->assertSame($jpeg, Storage::disk('uploads')->get('portfolio/clip.jpg'));
        BrowserVideo::kickPoster('portfolio/clip.mp4');
        $this->assertSame($jpeg, Storage::disk('uploads')->get('portfolio/clip.jpg'));
    }

    public function test_ensure_poster_missing_source_sets_last_error(): void
    {
        Storage::fake('uploads');
        Storage::fake('r2');
        config([
            'media.disk' => 'uploads',
            'filesystems.disks.r2.key' => '',
            'filesystems.disks.r2.secret' => '',
            'filesystems.disks.r2.bucket' => '',
            'filesystems.disks.r2.endpoint' => '',
        ]);

        $this->assertFalse(BrowserVideo::ensurePoster('portfolio/missing.mp4'));
        $this->assertNotSame('', (string) BrowserVideo::lastError());
    }

    public function test_ensure_playable_missing_source_sets_last_error(): void
    {
        Storage::fake('uploads');
        Storage::fake('r2');
        config([
            'media.disk' => 'uploads',
            'filesystems.disks.r2.key' => '',
            'filesystems.disks.r2.secret' => '',
            'filesystems.disks.r2.bucket' => '',
            'filesystems.disks.r2.endpoint' => '',
        ]);

        $this->assertNull(BrowserVideo::ensurePlayable('portfolio/missing.mov'));
        $this->assertNotSame('', (string) BrowserVideo::lastError());
    }

    public function test_write_preview_succeeds_when_writestream_returns_void(): void
    {
        Storage::fake('uploads');
        $tmp = tempnam(sys_get_temp_dir(), 'rzvid');
        $this->assertNotFalse($tmp);
        file_put_contents($tmp, str_repeat('previewmp4x', 20));

        $method = new ReflectionMethod(BrowserVideo::class, 'writePreview');
        $ok = $method->invoke(null, Storage::disk('uploads'), 'portfolio/clip.mp4', $tmp);

        $this->assertTrue($ok);
        $this->assertTrue(Storage::disk('uploads')->exists('portfolio/clip.mp4'));
        $this->assertGreaterThan(32, Storage::disk('uploads')->size('portfolio/clip.mp4'));
        $this->assertFileDoesNotExist($tmp);
    }
}
