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

    public function test_public_absolute_rewrites_stream_and_keeps_external_https(): void
    {
        config(['app.url' => 'https://api.creatorz.digital']);

        $this->assertSame(
            'https://api.creatorz.digital/stream/avatars/banner.jpg',
            MediaUrl::publicAbsolute('http://localhost:8000/stream/avatars/banner.jpg'),
        );
        $this->assertSame(
            'https://cdn.example.com/banner.jpg',
            MediaUrl::publicAbsolute('https://cdn.example.com/banner.jpg'),
        );
        $this->assertNull(MediaUrl::publicAbsolute(''));
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
