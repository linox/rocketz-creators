<?php

namespace App\Support;

class ProhibitedStorefrontLink
{
    public static function blocked(?string ...$parts): bool
    {
        $haystack = self::normalize(implode(' ', array_values(array_filter(
            $parts,
            fn ($part) => is_string($part) && trim($part) !== '',
        ))));
        if ($haystack === '') {
            return false;
        }

        foreach (config('storefront.prohibited_keywords', []) as $keyword) {
            $needle = self::normalize((string) $keyword);
            if ($needle !== '' && str_contains($haystack, $needle)) {
                return true;
            }
        }

        return false;
    }

    public static function normalize(string $value): string
    {
        $value = mb_strtolower($value);
        $value = strtr($value, [
            'á' => 'a', 'à' => 'a', 'â' => 'a', 'ã' => 'a', 'ä' => 'a',
            'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e',
            'í' => 'i', 'ì' => 'i', 'î' => 'i', 'ï' => 'i',
            'ó' => 'o', 'ò' => 'o', 'ô' => 'o', 'õ' => 'o', 'ö' => 'o',
            'ú' => 'u', 'ù' => 'u', 'û' => 'u', 'ü' => 'u',
            'ç' => 'c', 'ñ' => 'n',
        ]);

        return preg_replace('/[^a-z0-9]+/', '', $value) ?? '';
    }
}
