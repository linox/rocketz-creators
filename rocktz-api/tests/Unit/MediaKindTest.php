<?php

namespace Tests\Unit;

use App\Support\MediaKind;
use Tests\TestCase;

class MediaKindTest extends TestCase
{
    public function test_mov_is_stored_as_mp4_for_browser_playback(): void
    {
        $this->assertSame('video/mp4', MediaKind::storedMime('video/quicktime', 'video', 'mov'));
        $this->assertSame('video/mp4', MediaKind::storedMime('', 'video', 'mov'));
        $this->assertSame('video/webm', MediaKind::storedMime('video/webm', 'video', 'webm'));
    }
}
