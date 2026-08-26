<?php

namespace Tests\Unit;

use App\Support\Mp4Faststart;
use PHPUnit\Framework\TestCase;

class Mp4FaststartTest extends TestCase
{
    public function test_it_moves_moov_before_mdat_and_patches_stco(): void
    {
        $ftyp = $this->atom('ftyp', 'isom'.pack('N', 0).'isom');
        $mdat = $this->atom('mdat', str_repeat('x', 32));
        $payloadOffset = strlen($ftyp) + 8;
        $stco = $this->atom('stco', pack('NNN', 0, 1, $payloadOffset));
        $stbl = $this->atom('stbl', $stco);
        $minf = $this->atom('minf', $stbl);
        $mdia = $this->atom('mdia', $minf);
        $trak = $this->atom('trak', $mdia);
        $moov = $this->atom('moov', $trak);
        $original = $ftyp.$mdat.$moov;

        $path = tempnam(sys_get_temp_dir(), 'mp4').'.mp4';
        file_put_contents($path, $original);

        try {
            $this->assertTrue(Mp4Faststart::optimize($path));
            $this->assertFalse(Mp4Faststart::optimize($path));

            $rewritten = (string) file_get_contents($path);
            $this->assertSame(strlen($original), strlen($rewritten));
            $this->assertSame($ftyp, substr($rewritten, 0, strlen($ftyp)));
            $this->assertSame('moov', substr($rewritten, strlen($ftyp) + 4, 4));
            $this->assertSame('mdat', substr($rewritten, strlen($ftyp) + strlen($moov) + 4, 4));

            $newOffset = unpack('N', substr($rewritten, strlen($ftyp) + strlen($moov) - 4, 4))[1];
            $this->assertSame($payloadOffset + strlen($moov), $newOffset);
        } finally {
            @unlink($path);
        }
    }

    private function atom(string $type, string $body): string
    {
        return pack('N', 8 + strlen($body)).$type.$body;
    }
}
