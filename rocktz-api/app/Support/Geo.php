<?php

namespace App\Support;

use Illuminate\Validation\Rule;

class Geo
{
    public const DEFAULT_COUNTRY = 'BR';

    public const DEFAULT_CURRENCY = 'BRL';

    /** @var array<string, string>|null */
    private static ?array $countries = null;

    /** @var array<string, array<string, string>>|null */
    private static ?array $regions = null;

    /** @var array<string, float>|null */
    private static ?array $fx = null;

    /**
     * @return array<string, string> ISO2 => currency
     */
    public static function countries(): array
    {
        return self::$countries ??= self::loadMap('geo-countries.json');
    }

    /**
     * @return array<string, array<string, string>> ISO2 => [regionCode => name]
     */
    public static function regions(): array
    {
        return self::$regions ??= self::loadMap('geo-regions.json');
    }

    /**
     * @return array<string, string>
     */
    public static function regionsFor(string $country): array
    {
        return self::regions()[self::normalizeCountry($country)] ?? [];
    }

    public static function hasRegions(string $country): bool
    {
        return self::regionsFor($country) !== [];
    }

    /**
     * @return list<string>
     */
    public static function currencies(): array
    {
        $codes = array_values(array_unique(array_values(self::countries())));
        sort($codes);

        return $codes;
    }

    public static function defaultCurrency(?string $country): string
    {
        $normalized = self::normalizeCountry($country ?: self::DEFAULT_COUNTRY);

        return self::countries()[$normalized] ?? self::DEFAULT_CURRENCY;
    }

    public static function isValidCountry(?string $country): bool
    {
        $normalized = self::normalizeCountry((string) $country);

        return $normalized !== '' && isset(self::countries()[$normalized]);
    }

    public static function isValidCurrency(?string $currency): bool
    {
        $normalized = self::normalizeCurrency((string) $currency);

        return $normalized !== '' && in_array($normalized, self::currencies(), true);
    }

    public static function isValidRegion(?string $country, ?string $region): bool
    {
        $code = self::normalizeRegion((string) $region);
        if ($code === '') {
            return false;
        }

        $regions = self::regionsFor((string) $country);

        return $regions === [] || isset($regions[$code]);
    }

    public static function normalizeCountry(?string $country): string
    {
        return strtoupper(trim((string) $country));
    }

    public static function normalizeCurrency(?string $currency): string
    {
        return strtoupper(trim((string) $currency));
    }

    public static function normalizeRegion(?string $region): string
    {
        return strtoupper(trim((string) $region));
    }

    /**
     * @return array<string, float> units of currency per 1 USD
     */
    public static function fxPerUsd(): array
    {
        if (self::$fx !== null) {
            return self::$fx;
        }

        $loaded = self::loadMap('geo-fx.json');
        $rates = [];
        foreach ($loaded as $code => $rate) {
            $normalized = self::normalizeCurrency((string) $code);
            if ($normalized !== '' && is_numeric($rate) && (float) $rate > 0) {
                $rates[$normalized] = (float) $rate;
            }
        }

        return self::$fx = $rates;
    }

    public static function convertMoney(float|int|string|null $amount, ?string $from, ?string $to): float
    {
        $value = round((float) $amount, 2);
        $fromCode = self::normalizeCurrency($from ?: self::DEFAULT_CURRENCY);
        $toCode = self::normalizeCurrency($to ?: self::DEFAULT_CURRENCY);
        if ($fromCode === $toCode || $value == 0.0) {
            return $value;
        }

        $fromRate = self::fxPerUsd()[$fromCode] ?? null;
        $toRate = self::fxPerUsd()[$toCode] ?? null;
        if (! $fromRate || ! $toRate) {
            return $value;
        }

        return round(($value / $fromRate) * $toRate, 2);
    }

    /**
     * @return list<string|\Illuminate\Validation\Rules\In>
     */
    public static function countryRules(bool $required = true): array
    {
        return [
            $required ? 'required' : 'nullable',
            'string',
            'size:2',
            Rule::in(array_keys(self::countries())),
        ];
    }

    /**
     * @return list<string|\Illuminate\Validation\Rules\In>
     */
    public static function currencyRules(bool $required = true): array
    {
        return [
            $required ? 'required' : 'nullable',
            'string',
            'size:3',
            Rule::in(self::currencies()),
        ];
    }

    /**
     * @return list<string|\Illuminate\Validation\Rules\In>
     */
    public static function regionRules(?string $country, bool $required = true): array
    {
        $regions = $country ? self::regionsFor($country) : [];
        $mustHave = $required && $regions !== [];
        $rules = [
            $mustHave ? 'required' : 'nullable',
            'string',
            'max:12',
        ];
        if ($regions !== []) {
            $rules[] = Rule::in(array_keys($regions));
        }

        return $rules;
    }

    /**
     * @return array<string, mixed>
     */
    private static function loadMap(string $filename): array
    {
        $path = database_path('data/'.$filename);
        if (! is_file($path)) {
            return [];
        }

        $decoded = json_decode((string) file_get_contents($path), true);

        return is_array($decoded) ? $decoded : [];
    }
}
