<?php

namespace Tests\Unit;

use App\Support\BrowserVideo;
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
    }
}
