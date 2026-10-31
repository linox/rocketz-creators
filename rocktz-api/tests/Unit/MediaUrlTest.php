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
            'https://api.creatorz.digital/stream/avatars/banner.jpg',
            MediaUrl::publicAbsolute('http://localhost:8000/uploads/avatars/banner.jpg'),
        );
        $this->assertSame(
            'https://api.creatorz.digital/stream/avatars/banner.jpg',
            MediaUrl::publicAbsolute('https://media.creatorz.digital/avatars/banner.jpg'),
        );
        $document = MediaUrl::publicAbsolute('http://localhost:8000/downloads/documents/document-roteiro.pdf');
        $this->assertStringStartsWith(
            'https://api.creatorz.digital/downloads/documents/document-roteiro.pdf?',
            $document,
        );
        $this->assertStringContainsString('signature=', (string) $document);
        $this->assertSame(
            'https://cdn.example.com/banner.jpg',
            MediaUrl::publicAbsolute('https://cdn.example.com/banner.jpg'),
        );
        $this->assertNull(MediaUrl::publicAbsolute(''));
    }

    public function test_stored_document_link_is_resigned_for_two_weeks(): void
    {
        config(['app.url' => 'https://api.creatorz.digital']);

        $url = MediaUrl::publicAbsolute(
            'https://api.creatorz.digital/downloads/documents/document-roteiro.pdf?expires=1&signature=dead',
        );

        $this->assertIsString($url);
        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);
        $this->assertArrayHasKey('signature', $query);
        $this->assertNotSame('dead', $query['signature']);
        $this->assertGreaterThan(now()->addDays(13)->getTimestamp(), (int) $query['expires']);
        $this->assertLessThan(now()->addDays(15)->getTimestamp(), (int) $query['expires']);
    }

    public function test_submission_versions_refresh_expired_document_links(): void
    {
        config(['app.url' => 'https://api.creatorz.digital']);

        $versions = MediaUrl::freshSubmissionVersions([
            [
                'version' => 1,
                'stage' => 'script',
                'script' => 'Hook e CTA',
                'script_file_url' => 'https://api.creatorz.digital/downloads/documents/document-roteiro.pdf?expires=1&signature=dead',
                'script_file_name' => 'roteiro.pdf',
            ],
        ]);

        $this->assertSame('Hook e CTA', $versions[0]['script']);
        $this->assertSame('roteiro.pdf', $versions[0]['script_file_name']);
        $this->assertStringContainsString('/downloads/documents/document-roteiro.pdf?', $versions[0]['script_file_url']);
        $this->assertStringNotContainsString('signature=dead', $versions[0]['script_file_url']);
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
        $this->assertSame(
            'documents/document-roteiro.pdf',
            MediaUrl::objectKeyFromPublicUrl('http://localhost:8000/downloads/documents/document-roteiro.pdf'),
        );
        $this->assertSame(
            'avatars/banner.jpg',
            MediaUrl::objectKeyFromPublicUrl('https://media.creatorz.digital/avatars/banner.jpg'),
        );
        $this->assertNull(MediaUrl::objectKeyFromPublicUrl('https://youtube.com/watch?v=abc'));
    }
}
