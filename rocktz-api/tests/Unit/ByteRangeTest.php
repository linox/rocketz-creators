<?php

namespace Tests\Unit;

use App\Support\ByteRange;
use Tests\TestCase;

class ByteRangeTest extends TestCase
{
    public function test_it_caps_open_ended_ranges_so_php_does_not_pull_the_whole_file(): void
    {
        $this->assertSame('bytes=0-8388607', ByteRange::cap(null, 50_000_000));
        $this->assertSame('bytes=0-8388607', ByteRange::cap('bytes=0-', 50_000_000));
        $this->assertSame('bytes=2000000-9000000', ByteRange::cap('bytes=2000000-9000000', 50_000_000));
        $this->assertSame('bytes=2000000-10388607', ByteRange::cap('bytes=2000000-20000000', 50_000_000));
        $this->assertSame('bytes=0-9', ByteRange::cap('bytes=0-9', 100, 50));
    }
}
