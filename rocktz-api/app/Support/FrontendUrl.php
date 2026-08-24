<?php

namespace App\Support;

class FrontendUrl
{
    public static function origin(): string
    {
        return rtrim((string) config('app.frontend_url'), '/');
    }

    public static function to(string $path, array $query = []): string
    {
        $path = '/'.ltrim($path, '/');
        $url = self::origin().$path;
        if ($query === []) {
            return $url;
        }

        return $url.(str_contains($url, '?') ? '&' : '?').http_build_query($query);
    }

    public static function settings(): string
    {
        return self::to('/settings/notifications');
    }

    public static function supportMailto(): string
    {
        $address = (string) config('mail.support_address', 'contato@rocketzmkt.com.br');

        return 'mailto:'.$address;
    }
}
