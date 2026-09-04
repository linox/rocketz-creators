<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;
use Throwable;

class MediaUrl
{
    public static function playback(string $path): string
    {
        return self::appPath('stream', $path);
    }

    public static function download(string $path): string
    {
        return self::appPath('downloads', $path);
    }

    public static function appPath(string $prefix, string $path): string
    {
        return rtrim((string) config('app.url'), '/').'/'.$prefix.'/'.ltrim($path, '/');
    }

    public static function publicAbsolute(?string $url): ?string
    {
        $url = trim((string) $url);
        if ($url === '') {
            return null;
        }

        $host = strtolower((string) (parse_url($url, PHP_URL_HOST) ?: ''));
        $needsStream = str_contains($host, 'r2.cloudflarestorage.com')
            || str_ends_with($host, '.r2.dev')
            || str_contains($url, '/stream/')
            || str_contains($url, '/uploads/')
            || str_contains($url, '/downloads/');

        if ($needsStream) {
            $key = self::objectKeyFromPublicUrl($url);
            if ($key) {
                return self::playback($key);
            }
        }

        if (str_starts_with($url, 'https://') || str_starts_with($url, 'http://')) {
            return $url;
        }

        if (str_starts_with($url, '/')) {
            return rtrim((string) config('app.url'), '/').$url;
        }

        return self::playback($url);
    }

    public static function objectKeyFromPublicUrl(?string $url): ?string
    {
        if (! $url) {
            return null;
        }

        $path = parse_url($url, PHP_URL_PATH);
        if (! is_string($path) || $path === '') {
            return null;
        }

        foreach (['/stream/', '/downloads/', '/uploads/'] as $marker) {
            if (str_contains($path, $marker)) {
                $relative = ltrim((string) substr($path, (int) strpos($path, $marker) + strlen($marker)), '/');

                return $relative !== '' ? $relative : null;
            }
        }

        $host = parse_url($url, PHP_URL_HOST);
        if (! is_string($host) || ! self::isRemoteMediaHost($host)) {
            return null;
        }

        $segments = array_values(array_filter(explode('/', $path), fn (string $part) => $part !== ''));
        $index = null;
        foreach ($segments as $i => $segment) {
            if (in_array($segment, ['portfolio', 'avatars'], true)) {
                $index = $i;
                break;
            }
        }

        if ($index === null) {
            return null;
        }

        return implode('/', array_slice($segments, $index));
    }

    public static function signedGet(string $path, bool $asAttachment = false): ?string
    {
        if (! MediaDisk::r2Configured()) {
            return null;
        }

        $storage = Storage::disk('r2');
        if (! $storage->exists($path)) {
            return null;
        }

        $expires = now()->addHours((int) config('media.r2_presign_hours', 6));
        $options = [];
        if ($asAttachment) {
            $options['ResponseContentDisposition'] = 'attachment; filename="'.basename($path).'"';
        }

        try {
            return $storage->temporaryUrl($path, $expires, $options);
        } catch (Throwable) {
            return $storage->url($path);
        }
    }

    private static function isRemoteMediaHost(string $host): bool
    {
        $host = strtolower($host);
        if (str_contains($host, 'r2.cloudflarestorage.com') || str_ends_with($host, '.r2.dev')) {
            return true;
        }

        $public = parse_url((string) config('filesystems.disks.r2.url'), PHP_URL_HOST);

        return is_string($public) && $public !== '' && strcasecmp($host, $public) === 0;
    }
}
