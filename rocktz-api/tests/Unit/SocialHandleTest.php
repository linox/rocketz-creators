<?php

namespace Tests\Unit;

use App\Support\SocialHandle;
use App\Support\SocialNumbers;
use PHPUnit\Framework\TestCase;

class SocialHandleTest extends TestCase
{
    public function test_it_normalizes_instagram_urls_and_handles(): void
    {
        $this->assertSame('ana.ugc', SocialHandle::instagram('@ana.ugc'));
        $this->assertSame('ana.ugc', SocialHandle::instagram('https://www.instagram.com/ana.ugc/'));
        $this->assertSame('ana.ugc', SocialHandle::instagram('instagram.com/ana.ugc?hl=pt'));
        $this->assertSame('instagram', SocialHandle::instagram('@instagram'));
        $this->assertSame('pausaprorole', SocialHandle::instagram('@pausaprorole'));
        $this->assertSame('', SocialHandle::instagram('https://www.instagram.com/'));
        $this->assertSame('', SocialHandle::instagram('instagram.com'));
        $this->assertSame('', SocialHandle::instagram('www.instagram.com'));
    }

    public function test_it_normalizes_tiktok_and_youtube(): void
    {
        $this->assertSame('ana.ugc', SocialHandle::tiktok('@ana.ugc'));
        $this->assertSame('ana.ugc', SocialHandle::tiktok('https://www.tiktok.com/@ana.ugc'));
        $this->assertSame('canal', SocialHandle::youtube('https://www.youtube.com/@canal'));
        $this->assertSame('UCabcdefghijklmnopqrstuv', SocialHandle::youtube('https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv'));
        $this->assertTrue(SocialHandle::isYoutubeChannelId('UCabcdefghijklmnopqrstuv'));
        $this->assertSame('https://www.youtube.com/@canal', SocialHandle::publicUrl('youtube', 'canal'));
    }

    public function test_it_parses_compact_social_numbers(): void
    {
        $this->assertSame(12300, SocialNumbers::parseCompact('12.3K Followers'));
        $this->assertSame(18200, SocialNumbers::parseCompact('18.2K subscribers'));
        $this->assertSame(45600, SocialNumbers::parseCompact('45,6 mil inscritos'));
        $this->assertSame(2192363, SocialNumbers::parseCompact('2.192.363 visualizações'));
        $this->assertSame(328, SocialNumbers::parseCompact('328 vídeos'));
        $this->assertSame(1234567, SocialNumbers::parseCompact('1.234.567 views'));
        $this->assertSame(1234567, SocialNumbers::parseCompact('1,234,567 views'));
        $this->assertSame(1500000, SocialNumbers::parseCompact('1.5M'));
        $this->assertSame(2.0, SocialNumbers::engagementPercent(50, 2500, 1));
        $this->assertSame(1500, SocialNumbers::average([1000, 2000]));
    }
}
