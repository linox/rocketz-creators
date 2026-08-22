<?php

namespace App\Support;

class SocialNumbers
{
    public static function parseCompact(?string $value): ?int
    {
        if ($value === null) {
            return null;
        }

        $value = trim(html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        $value = str_replace("\u{00A0}", ' ', $value);

        if ($value === '' || strcasecmp($value, 'hidden') === 0) {
            return null;
        }

        if (! preg_match('/([\d][\d.,]*)(?:\s*)(bilh[oõ]es|billions?|billion|milh[oõ]es|millions?|million|thousand|milh[aã]o|mil|bi|mm|mi|k|m|b)?/iu', $value, $match)) {
            return null;
        }

        $number = $match[1];
        $suffix = mb_strtolower($match[2] ?? '');
        $multiplier = match (true) {
            in_array($suffix, ['b', 'bi', 'billion', 'billions', 'bilhao', 'bilhão', 'bilhoes', 'bilhões'], true) => 1_000_000_000,
            in_array($suffix, ['m', 'mi', 'mm', 'million', 'millions', 'milhao', 'milhão', 'milhoes', 'milhões'], true) => 1_000_000,
            in_array($suffix, ['k', 'mil', 'thousand'], true) => 1_000,
            default => 1,
        };

        if ($multiplier > 1) {
            $normalized = str_replace(',', '.', $number);
            if (substr_count($normalized, '.') > 1) {
                $parts = explode('.', $normalized);
                $decimals = array_pop($parts);

                return (int) round(((float) (implode('', $parts).'.'.$decimals)) * $multiplier);
            }

            return (int) round(((float) $normalized) * $multiplier);
        }

        if (preg_match('/^\d{1,3}(\.\d{3})+$/', $number)) {
            return (int) str_replace('.', '', $number);
        }

        if (preg_match('/^\d{1,3}(,\d{3})+$/', $number)) {
            return (int) str_replace(',', '', $number);
        }

        if (preg_match('/^\d+$/', $number)) {
            return (int) $number;
        }

        return null;
    }

    public static function intOrNull(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            return (int) $value;
        }

        return self::parseCompact(is_string($value) ? $value : null);
    }

    public static function average(array $values): ?int
    {
        $numbers = array_values(array_filter(
            array_map(fn ($value) => self::intOrNull($value), $values),
            fn ($value) => $value !== null && $value > 0,
        ));

        if ($numbers === []) {
            return null;
        }

        return (int) round(array_sum($numbers) / count($numbers));
    }

    public static function engagementPercent(?int $interactions, ?int $followers, ?int $posts = 1): ?float
    {
        if (! $followers || $followers <= 0 || $interactions === null || $interactions < 0) {
            return null;
        }

        $posts = max(1, $posts ?? 1);

        return round(($interactions / $posts) / $followers * 100, 2);
    }
}
