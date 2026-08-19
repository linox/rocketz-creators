<?php

namespace App\Support;

class AppLocale
{
    public const DEFAULT = 'pt-BR';

    /** @var list<string> */
    public const SUPPORTED = ['pt-BR', 'en', 'es'];

    public static function laravelLocale(string $locale): string
    {
        return match ($locale) {
            'pt-BR', 'pt_BR', 'pt' => 'pt_BR',
            'es', 'es-ES', 'es_ES' => 'es',
            default => 'en',
        };
    }

    public static function fromLaravel(string $laravel): string
    {
        return match ($laravel) {
            'pt_BR' => 'pt-BR',
            'es' => 'es',
            default => 'en',
        };
    }

    public static function fromRequest(?\Illuminate\Http\Request $request = null): string
    {
        $request ??= request();

        return self::fromRequestHeader($request?->header('Accept-Language'));
    }

    public static function normalize(?string $value): string
    {
        if (! is_string($value) || $value === '') {
            return self::DEFAULT;
        }

        $value = str_replace('_', '-', $value);

        if (in_array($value, self::SUPPORTED, true)) {
            return $value;
        }

        $lower = strtolower($value);

        return match (true) {
            str_starts_with($lower, 'pt') => 'pt-BR',
            str_starts_with($lower, 'es') => 'es',
            str_starts_with($lower, 'en') => 'en',
            default => self::DEFAULT,
        };
    }

    public static function fromRequestHeader(?string $header): string
    {
        if (! $header) {
            return self::DEFAULT;
        }

        $first = trim(explode(',', $header)[0]);
        $first = trim(explode(';', $first)[0]);

        return self::normalize($first);
    }
}
