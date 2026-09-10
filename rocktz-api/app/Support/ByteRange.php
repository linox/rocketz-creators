<?php

namespace App\Support;

class ByteRange
{
    public const CHUNK_BYTES = 8 * 1024 * 1024;

    public static function cap(?string $header, int $size, int $maxChunk = self::CHUNK_BYTES): string
    {
        $size = max(0, $size);
        if ($size === 0) {
            return 'bytes=0-0';
        }

        $start = 0;
        $end = min($size - 1, $maxChunk - 1);

        if (is_string($header) && preg_match('/bytes\s*=\s*(\d+)\s*-\s*(\d*)/i', $header, $match)) {
            $start = min(max(0, (int) $match[1]), $size - 1);
            $requestedEnd = $match[2] === '' ? $size - 1 : (int) $match[2];
            $end = min($size - 1, $requestedEnd, $start + $maxChunk - 1);
            if ($end < $start) {
                $end = $start;
            }
        }

        return 'bytes='.$start.'-'.$end;
    }
}
