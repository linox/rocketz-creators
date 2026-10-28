<?php

namespace App\Support;

class SensitiveIndex
{
    public static function normalized(?string $value): ?string
    {
        $normalized = mb_strtolower(trim((string) $value));

        return $normalized === '' ? null : hash('sha256', $normalized);
    }

    public static function digits(?string $value): ?string
    {
        $digits = preg_replace('/\D+/', '', (string) $value) ?? '';

        return $digits === '' ? null : hash('sha256', $digits);
    }

    public static function ip(?string $value): ?string
    {
        $ip = trim((string) $value);

        return $ip === '' ? null : hash('sha256', $ip);
    }

    public static function isCipher(?string $value): bool
    {
        return is_string($value) && str_starts_with($value, 'eyJpdiI6');
    }
}
