<?php

namespace Tests\Unit;

use App\Support\MediaUrl;
use Tests\TestCase;

class MediaUrlTest extends TestCase
{
    public function test_playback_url_uses_app_stream_path(): void
    {
        config(['app.url' => 'http://localhost:8000']);

        $this->assertSame(
            'http://localhost:8000/stream/portfolio/video-demo.mp4',
            MediaUrl::playback('portfolio/video-demo.mp4'),
        );
    }

    public function test_object_key_from_stream_uploads_and_r2_urls(): void
    {
        $this->assertSame(
            'portfolio/video-demo.mp4',
            MediaUrl::objectKeyFromPublicUrl('http://localhost:8000/stream/portfolio/video-demo.mp4'),
        );
        $this->assertSame(
            'portfolio/video-demo.mp4',
            MediaUrl::objectKeyFromPublicUrl('http://localhost:8000/uploads/portfolio/video-demo.mp4'),
        );
        $this->assertSame(
            'portfolio/video-demo.mp4',
            MediaUrl::objectKeyFromPublicUrl('https://acct.r2.cloudflarestorage.com/creatorz/portfolio/video-demo.mp4'),
        );
        $this->assertNull(MediaUrl::objectKeyFromPublicUrl('https://youtube.com/watch?v=abc'));
    }
}
