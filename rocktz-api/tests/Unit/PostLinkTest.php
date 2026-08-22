<?php

namespace Tests\Unit;

use App\Support\PostLink;
use PHPUnit\Framework\TestCase;

class PostLinkTest extends TestCase
{
    public function test_it_parses_instagram_reel_and_post_urls(): void
    {
        $post = PostLink::parse('https://www.instagram.com/p/DbopAZ5BLWL/');
        $this->assertSame('instagram', $post?->network);
        $this->assertSame('DbopAZ5BLWL', $post?->id);
        $this->assertSame('', $post?->handle);

        $reel = PostLink::parse('instagram.com/mihpocket/reel/DbopAZ5BLWL/?igsh=abc');
        $this->assertSame('instagram', $reel?->network);
        $this->assertSame('DbopAZ5BLWL', $reel?->id);
        $this->assertSame('mihpocket', $reel?->handle);

        $this->assertNull(PostLink::parse('https://www.instagram.com/mihpocket/'));
        $this->assertNull(PostLink::parse('https://www.instagram.com/stories/mihpocket/123'));
    }

    public function test_it_parses_tiktok_and_youtube_urls(): void
    {
        $tiktok = PostLink::parse('https://www.tiktok.com/@mihpocket/video/7123456789012345678');
        $this->assertSame('tiktok', $tiktok?->network);
        $this->assertSame('7123456789012345678', $tiktok?->id);
        $this->assertSame('mihpocket', $tiktok?->handle);

        $short = PostLink::parse('https://vm.tiktok.com/ZMabcdef/');
        $this->assertSame('tiktok', $short?->network);
        $this->assertSame('ZMabcdef', $short?->id);

        $vt = PostLink::parse('https://vt.tiktok.com/ZSabcdef/');
        $this->assertSame('tiktok', $vt?->network);
        $this->assertSame('ZSabcdef', $vt?->id);

        $photo = PostLink::parse('https://www.tiktok.com/@oivivi/photo/7123456789012345678');
        $this->assertSame('tiktok', $photo?->network);
        $this->assertSame('7123456789012345678', $photo?->id);
        $this->assertSame('https://www.tiktok.com/@oivivi/photo/7123456789012345678', $photo?->canonicalUrl());

        $youtube = PostLink::parse('https://youtu.be/dQw4w9WgXcQ');
        $this->assertSame('youtube', $youtube?->network);
        $this->assertSame('dQw4w9WgXcQ', $youtube?->id);
        $this->assertSame('https://www.youtube.com/watch?v=dQw4w9WgXcQ', $youtube?->canonicalUrl());

        $shorts = PostLink::parse('https://www.youtube.com/shorts/AbCdEfGhIjK');
        $this->assertSame('youtube', $shorts?->network);
        $this->assertSame('AbCdEfGhIjK', $shorts?->id);

        $share = PostLink::parse('https://youtu.be/dQw4w9WgXcQ?si=abc123');
        $this->assertSame('dQw4w9WgXcQ', $share?->id);

        $legacy = PostLink::parse('https://www.youtube.com/v/dQw4w9WgXcQ');
        $this->assertSame('dQw4w9WgXcQ', $legacy?->id);

        $music = PostLink::parse('https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RD');
        $this->assertSame('youtube', $music?->network);
        $this->assertSame('dQw4w9WgXcQ', $music?->id);

        $this->assertNull(PostLink::parse('https://www.kwai.com/@user/video/1'));
        $this->assertNull(PostLink::parse(''));
    }
}
