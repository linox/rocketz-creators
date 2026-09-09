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

    public static function deliveryUrl(string $path): string
    {
        $path = ltrim($path, '/');
        if (str_starts_with($path, 'documents/') || str_ends_with(strtolower($path), '.pdf')) {
            return self::download($path);
        }

        return self::playback($path);
    }

    public static function publicAbsolute(?string $url): ?string
    {
        $url = trim((string) $url);
        if ($url === '') {
            return null;
        }

        $host = strtolower((string) (parse_url($url, PHP_URL_HOST) ?: ''));
        $needsStream = $host === ''
            || self::isRemoteMediaHost($host)
            || str_contains($url, '/stream/')
            || str_contains($url, '/uploads/')
            || str_contains($url, '/downloads/');

        if ($needsStream) {
            $key = self::objectKeyFromPublicUrl($url);
            if ($key) {
                return self::deliveryUrl($key);
            }
        }

        if (str_starts_with($url, 'https://') || str_starts_with($url, 'http://')) {
            return $url;
        }

        if (str_starts_with($url, '/')) {
            return rtrim((string) config('app.url'), '/').$url;
        }

        return self::deliveryUrl($url);
    }

    public static function objectKeyFromPublicUrl(?string $url): ?string
    {
        if (! $url) {
            return null;
        }

        $path = parse_url($url, PHP_URL_PATH);
        if (! is_string($path) || $path === '') {
            $path = $url;
        }

        foreach (['/stream/', '/downloads/', '/uploads/'] as $marker) {
            if (str_contains($path, $marker)) {
                $relative = ltrim((string) substr($path, (int) strpos($path, $marker) + strlen($marker)), '/');

                return $relative !== '' ? $relative : null;
            }
        }

        $host = parse_url(str_contains($url, '://') ? $url : 'http://local/'.$url, PHP_URL_HOST);
        if (is_string($host) && $host !== '' && ! self::isRemoteMediaHost($host) && str_contains($url, '://')) {
            return null;
        }

        $segments = array_values(array_filter(explode('/', $path), fn (string $part) => $part !== ''));
        $index = null;
        foreach ($segments as $i => $segment) {
            if (in_array($segment, ['portfolio', 'avatars', 'documents'], true)) {
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
        $expires = now()->addHours((int) config('media.r2_presign_hours', 6));
        $options = [];
        if ($asAttachment) {
            $options['ResponseContentDisposition'] = 'attachment; filename="'.basename($path).'"';
        }

        try {
            return $storage->temporaryUrl($path, $expires, $options);
        } catch (Throwable) {
            return null;
        }
    }

    private static function isRemoteMediaHost(string $host): bool
    {
        $host = strtolower($host);
        if (
            $host === 'media.creatorz.digital'
            || str_contains($host, 'r2.cloudflarestorage.com')
            || str_ends_with($host, '.r2.dev')
        ) {
            return true;
        }

        $public = parse_url((string) config('filesystems.disks.r2.url'), PHP_URL_HOST);

        return is_string($public) && $public !== '' && strcasecmp($host, $public) === 0;
    }
}
