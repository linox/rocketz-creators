<?php

namespace App\Support;

class SocialHandle
{
    public static function instagram(?string $value): string
    {
        $handle = trim((string) $value);
        if ($handle === '') {
            return '';
        }

        $handle = ltrim($handle, '@');

        try {
            $candidate = preg_match('#^https?://#i', $handle) ? $handle : 'https://'.$handle;
            $url = parse_url($candidate);
            $host = strtolower((string) ($url['host'] ?? ''));
            if (str_ends_with($host, 'instagram.com')) {
                $handle = ltrim((string) explode('/', trim((string) ($url['path'] ?? ''), '/'))[0], '@');
            }
        } catch (\Throwable) {
            // keep handle
        }

        $handle = (string) preg_replace('#^https?://#i', '', $handle);
        $handle = (string) preg_replace('#^(www\.)?instagram\.com/?#i', '', $handle);
        $handle = self::beforeQuery($handle);
        $handle = ltrim($handle, '@');
        $handle = (string) preg_replace('/\s+/', '', $handle);
        $handle = (string) preg_replace('/[^a-zA-Z0-9._]/', '', $handle);

        if ($handle === '' || in_array(strtolower($handle), ['http', 'https', 'www', 'instagramcom', 'instagram'], true)) {
            return '';
        }

        return substr($handle, 0, 30);
    }

    public static function tiktok(?string $value): string
    {
        $handle = trim((string) $value);
        if ($handle === '') {
            return '';
        }

        $handle = (string) preg_replace('#^https?://(www\.)?(tiktok\.com|vm\.tiktok\.com)/#i', '', $handle);
        $handle = ltrim($handle, '@');
        $handle = self::beforeQuery($handle);
        $handle = (string) preg_replace('/[^a-zA-Z0-9._]/', '', $handle);

        return $handle === '' ? '' : substr($handle, 0, 24);
    }

    public static function youtube(?string $value): string
    {
        $handle = trim((string) $value);
        if ($handle === '') {
            return '';
        }

        if (preg_match('#(?:youtube\.com|youtu\.be)/channel/([A-Za-z0-9_-]+)#i', $handle, $match)) {
            return $match[1];
        }

        if (preg_match('#(?:youtube\.com|youtu\.be)/@([A-Za-z0-9._-]+)#i', $handle, $match)) {
            return $match[1];
        }

        if (preg_match('#(?:youtube\.com|youtu\.be)/(?:c|user)/([A-Za-z0-9._-]+)#i', $handle, $match)) {
            return $match[1];
        }

        $handle = ltrim($handle, '@');
        $handle = (string) preg_replace('#^https?://(www\.)?(youtube\.com|youtu\.be)/#i', '', $handle);
        $handle = (string) preg_replace('#^(c|user|channel)/#i', '', $handle);
        $handle = self::beforeQuery($handle);
        $handle = preg_replace('/\s+/', '', $handle) ?? '';

        return $handle;
    }

    public static function normalize(string $network, ?string $value): string
    {
        return match ($network) {
            'instagram' => self::instagram($value),
            'tiktok' => self::tiktok($value),
            'youtube' => self::youtube($value),
            default => '',
        };
    }

    public static function isYoutubeChannelId(string $handle): bool
    {
        return (bool) preg_match('/^UC[A-Za-z0-9_-]{20,}$/', $handle);
    }

    public static function publicUrl(string $network, string $handle): string
    {
        return match ($network) {
            'instagram' => 'https://www.instagram.com/'.$handle.'/',
            'tiktok' => 'https://www.tiktok.com/@'.$handle,
            'youtube' => self::isYoutubeChannelId($handle)
                ? 'https://www.youtube.com/channel/'.$handle
                : 'https://www.youtube.com/@'.$handle,
            default => '',
        };
    }

    private static function beforeQuery(string $value): string
    {
        $cut = strcspn($value, '/?#');

        return $cut === strlen($value) ? $value : substr($value, 0, $cut);
    }
}
