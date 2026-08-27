<?php

namespace App\Support;

class MediaKind
{
    public const MAX_VIDEO_BYTES = 1024 * 1024 * 1024;

    public const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

    public const CHUNK_BYTES = 4 * 1024 * 1024;

    public static function chunkBytes(): int
    {
        $bytes = (int) config('media.chunk_bytes', self::CHUNK_BYTES);

        return $bytes > 0 ? $bytes : self::CHUNK_BYTES;
    }

    /** @var list<string> */
    public const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v', 'qt'];

    /** @var list<string> */
    public const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

    public static function detect(string $detectedMime, string $clientMime, string $extension): ?string
    {
        $detected = strtolower($detectedMime);
        $client = strtolower($clientMime);
        $extension = strtolower($extension);

        if (self::isDangerousMime($detected) || self::isDangerousMime($client)) {
            return null;
        }

        if (str_starts_with($detected, 'video/')) {
            return 'video';
        }

        if (str_starts_with($detected, 'image/') && $detected !== 'image/svg+xml') {
            return 'image';
        }

        $ambiguous = $detected === '' || in_array($detected, ['application/octet-stream', 'application/download', 'binary/octet-stream'], true);
        if ($ambiguous) {
            if (in_array($extension, self::VIDEO_EXTENSIONS, true) || str_starts_with($client, 'video/')) {
                return 'video';
            }
            if (in_array($extension, self::IMAGE_EXTENSIONS, true) || (str_starts_with($client, 'image/') && $client !== 'image/svg+xml')) {
                return 'image';
            }
        }

        return null;
    }

    public static function isDangerousMime(string $mime): bool
    {
        return in_array($mime, [
            'text/html',
            'text/javascript',
            'application/javascript',
            'application/x-httpd-php',
            'image/svg+xml',
            'text/xml',
            'application/xml',
        ], true);
    }

    public static function rawExtension(string $filename): string
    {
        return strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    }

    public static function safeExtension(string $extension, string $kind): string
    {
        $extension = strtolower($extension);
        $allowed = $kind === 'video' ? self::VIDEO_EXTENSIONS : self::IMAGE_EXTENSIONS;

        if (in_array($extension, $allowed, true)) {
            return $extension === 'qt' ? 'mov' : $extension;
        }

        return $kind === 'video' ? 'mp4' : 'jpg';
    }

    public static function storedMime(string $detectedMime, string $kind, string $extension): string
    {
        if (str_starts_with($detectedMime, 'video/') || str_starts_with($detectedMime, 'image/')) {
            return $detectedMime;
        }

        return match ($extension) {
            'webm' => 'video/webm',
            'mov' => 'video/quicktime',
            'png' => 'image/png',
            'webp' => 'image/webp',
            'gif' => 'image/gif',
            default => $kind === 'video' ? 'video/mp4' : 'image/jpeg',
        };
    }
}
