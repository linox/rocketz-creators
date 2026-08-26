<?php

namespace App\Support;

class Mp4Faststart
{
    /** @var list<string> */
    private const VIDEO_EXTENSIONS = ['mp4', 'm4v', 'mov', 'qt'];

    /** @var list<string> */
    private const CONTAINERS = ['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'dinf', 'udta', 'moof', 'traf'];

    /**
     * Move the moov atom before mdat so browsers can start playback without
     * downloading the whole file. Returns true when the file was rewritten.
     */
    public static function optimize(string $path): bool
    {
        $extension = strtolower((string) pathinfo($path, PATHINFO_EXTENSION));
        if (! in_array($extension, self::VIDEO_EXTENSIONS, true) || ! is_file($path)) {
            return false;
        }

        $layout = self::inspect($path);
        if ($layout === null) {
            return self::ffmpegFaststart($path);
        }
        if ($layout['ready']) {
            return false;
        }
        if (self::rewrite($path, $layout)) {
            return true;
        }

        return self::ffmpegFaststart($path);
    }

    /**
     * @return array{ready: bool, size: int, atoms: list<array{type: string, offset: int, size: int}>}|null
     */
    private static function inspect(string $path): ?array
    {
        $size = (int) filesize($path);
        if ($size < 16) {
            return null;
        }

        $handle = fopen($path, 'rb');
        if ($handle === false) {
            return null;
        }

        try {
            $atoms = self::indexAtoms($handle, $size);
        } finally {
            fclose($handle);
        }

        $moov = null;
        $mdat = null;
        foreach ($atoms as $atom) {
            if ($atom['type'] === 'moov') {
                $moov = $atom;
            }
            if ($atom['type'] === 'mdat') {
                $mdat = $atom;
            }
        }

        if ($moov === null || $mdat === null) {
            return null;
        }

        return [
            'ready' => $moov['offset'] < $mdat['offset'],
            'size' => $size,
            'atoms' => $atoms,
        ];
    }

    /**
     * @param  array{ready: bool, size: int, atoms: list<array{type: string, offset: int, size: int}>}  $layout
     */
    private static function rewrite(string $path, array $layout): bool
    {
        $moov = null;
        foreach ($layout['atoms'] as $atom) {
            if ($atom['type'] === 'moov') {
                $moov = $atom;
                break;
            }
        }
        if ($moov === null) {
            return false;
        }

        $source = fopen($path, 'rb');
        if ($source === false) {
            return false;
        }

        $moovPayload = self::readSlice($source, $moov['offset'], $moov['size']);
        if ($moovPayload === null || ! self::patchChunkOffsets($moovPayload, $moov['size'])) {
            fclose($source);

            return false;
        }

        $temp = $path.'.faststart';
        $out = fopen($temp, 'wb');
        if ($out === false) {
            fclose($source);

            return false;
        }

        try {
            foreach ($layout['atoms'] as $atom) {
                if ($atom['type'] === 'moov') {
                    continue;
                }
                if ($atom['type'] === 'mdat') {
                    fwrite($out, $moovPayload);
                }
                self::copySlice($source, $out, $atom['offset'], $atom['size']);
            }
        } finally {
            fclose($out);
            fclose($source);
        }

        if (! is_file($temp) || (int) filesize($temp) !== $layout['size']) {
            @unlink($temp);

            return false;
        }

        if (! rename($temp, $path)) {
            @unlink($temp);

            return false;
        }

        return true;
    }

    /**
     * @return list<array{type: string, offset: int, size: int}>
     */
    private static function indexAtoms($handle, int $fileSize): array
    {
        $atoms = [];
        $offset = 0;

        while ($offset + 8 <= $fileSize) {
            fseek($handle, $offset);
            $header = fread($handle, 8);
            if ($header === false || strlen($header) < 8) {
                break;
            }

            $size = unpack('N', substr($header, 0, 4))[1];
            $type = substr($header, 4, 4);
            $headerSize = 8;

            if ($size === 1) {
                $wide = fread($handle, 8);
                if ($wide === false || strlen($wide) < 8) {
                    break;
                }
                $high = unpack('N', substr($wide, 0, 4))[1];
                $low = unpack('N', substr($wide, 4, 4))[1];
                $size = ($high << 32) + $low;
                $headerSize = 16;
            } elseif ($size === 0) {
                $size = $fileSize - $offset;
            }

            if ($size < $headerSize || $offset + $size > $fileSize) {
                break;
            }

            $atoms[] = [
                'type' => $type,
                'offset' => $offset,
                'size' => $size,
            ];
            $offset += $size;
        }

        return $atoms;
    }

    private static function readSlice($handle, int $offset, int $size): ?string
    {
        fseek($handle, $offset);
        $data = fread($handle, $size);

        return is_string($data) && strlen($data) === $size ? $data : null;
    }

    private static function copySlice($source, $out, int $offset, int $size): void
    {
        fseek($source, $offset);
        $remaining = $size;
        while ($remaining > 0) {
            $chunk = fread($source, min(1024 * 1024, $remaining));
            if ($chunk === false || $chunk === '') {
                break;
            }
            fwrite($out, $chunk);
            $remaining -= strlen($chunk);
        }
    }

    private static function patchChunkOffsets(string &$moov, int $delta): bool
    {
        return self::walkAtoms($moov, 8, strlen($moov), $delta);
    }

    private static function walkAtoms(string &$data, int $start, int $end, int $delta): bool
    {
        $offset = $start;
        while ($offset + 8 <= $end) {
            $size = unpack('N', substr($data, $offset, 4))[1];
            $type = substr($data, $offset + 4, 4);
            if ($size < 8 || $offset + $size > $end) {
                return false;
            }

            if ($type === 'stco' || $type === 'co64') {
                if (! self::addOffsets($data, $offset, $size, $type, $delta)) {
                    return false;
                }
            } elseif (in_array($type, self::CONTAINERS, true)) {
                if (! self::walkAtoms($data, $offset + 8, $offset + $size, $delta)) {
                    return false;
                }
            }

            $offset += $size;
        }

        return true;
    }

    private static function addOffsets(string &$data, int $atomOffset, int $atomSize, string $type, int $delta): bool
    {
        $payload = $atomOffset + 8;
        if ($payload + 8 > $atomOffset + $atomSize) {
            return false;
        }

        $count = unpack('N', substr($data, $payload + 4, 4))[1];
        $entrySize = $type === 'co64' ? 8 : 4;
        $entriesOffset = $payload + 8;
        if ($entriesOffset + ($count * $entrySize) > $atomOffset + $atomSize) {
            return false;
        }

        for ($i = 0; $i < $count; $i++) {
            $at = $entriesOffset + ($i * $entrySize);
            if ($type === 'stco') {
                $value = unpack('N', substr($data, $at, 4))[1] + $delta;
                if ($value > 0xFFFFFFFF) {
                    return false;
                }
                $data = substr_replace($data, pack('N', $value), $at, 4);
            } else {
                $high = unpack('N', substr($data, $at, 4))[1];
                $low = unpack('N', substr($data, $at + 4, 4))[1];
                $value = (($high << 32) + $low) + $delta;
                $data = substr_replace($data, pack('NN', $value >> 32, $value & 0xFFFFFFFF), $at, 8);
            }
        }

        return true;
    }

    private static function ffmpegFaststart(string $path): bool
    {
        $ffmpeg = self::ffmpegBinary();
        if ($ffmpeg === null) {
            return false;
        }

        $temp = $path.'.ffmpeg-faststart';
        $command = escapeshellcmd($ffmpeg).' -y -i '.escapeshellarg($path)
            .' -map 0 -c copy -movflags +faststart -f mp4 '.escapeshellarg($temp).' 2>/dev/null';
        exec($command, $output, $code);
        if ($code !== 0 || ! is_file($temp) || filesize($temp) < 16) {
            @unlink($temp);

            return false;
        }

        if (! rename($temp, $path)) {
            @unlink($temp);

            return false;
        }

        return true;
    }

    private static function ffmpegBinary(): ?string
    {
        $found = trim((string) @shell_exec('command -v ffmpeg'));

        return $found !== '' && is_executable($found) ? $found : null;
    }
}
