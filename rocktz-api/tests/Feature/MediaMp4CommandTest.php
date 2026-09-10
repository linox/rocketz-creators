<?php

namespace Tests\Feature;

use App\Console\Commands\MediaMakePlayableCommand;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MediaMp4CommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_media_mp4_alias_reports_missing_file(): void
    {
        $this->artisan('media:mp4', ['file' => 'nao-existe.mov'])
            ->expectsOutputToContain('File not found')
            ->assertFailed();
    }

    public function test_media_mp4_resolves_bare_filename_to_portfolio_key(): void
    {
        Storage::fake('uploads');
        Storage::disk('uploads')->put('portfolio/video-20260909181647-p5nv4ebq.mov', str_repeat('abcdefghij', 20));

        $key = app(MediaMakePlayableCommand::class)->resolveKey('video-20260909181647-p5nv4ebq.mov');

        $this->assertSame('portfolio/video-20260909181647-p5nv4ebq.mov', $key);
    }
}
