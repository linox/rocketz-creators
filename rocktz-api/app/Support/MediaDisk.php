<?php

namespace App\Support;

class MediaDisk
{
    public static function name(): string
    {
        $disk = (string) config('media.disk', 'uploads');

        if ($disk === 'r2' && ! self::r2Configured()) {
            return 'uploads';
        }

        return $disk !== '' ? $disk : 'uploads';
    }

    public static function usesDirectUpload(): bool
    {
        return self::name() === 'r2' && self::r2Configured();
    }

    public static function chunkBytes(): int
    {
        $bytes = MediaKind::chunkBytes();
        if (! self::usesDirectUpload()) {
            return $bytes;
        }

        $min = (int) config('media.r2_min_part_bytes', 8 * 1024 * 1024);

        return max($bytes, $min > 0 ? $min : 8 * 1024 * 1024);
    }

    public static function r2Configured(): bool
    {
        $config = config('filesystems.disks.r2', []);

        return filled($config['bucket'] ?? null)
            && filled($config['key'] ?? null)
            && filled($config['secret'] ?? null)
            && filled($config['endpoint'] ?? null);
    }
}
