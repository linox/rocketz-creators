<?php

namespace App\Support;

use Illuminate\Validation\ValidationException;

class ShippingAddress
{
    /**
     * @param  array<string, mixed>  $raw
     * @return array{country: string, zip: string, street: string, number: string, complement: ?string, neighborhood: string, city: string, state: string}
     */
    public static function normalize(array $raw, string $fallbackCountry = 'BR'): array
    {
        $rawCountry = Geo::normalizeCountry($raw['country'] ?? '');
        if ($rawCountry !== '' && ! Geo::isValidCountry($rawCountry)) {
            throw ValidationException::withMessages([
                'address.country' => __('validation.in', ['attribute' => __('shipping.fields.country')]),
            ]);
        }

        $country = $rawCountry !== '' ? $rawCountry : Geo::normalizeCountry($fallbackCountry);
        if (! Geo::isValidCountry($country)) {
            $country = Geo::DEFAULT_COUNTRY;
        }

        $address = [
            'zip' => self::normalizeZip($country, $raw['zip'] ?? null),
            'street' => trim((string) ($raw['street'] ?? '')),
            'number' => trim((string) ($raw['number'] ?? '')),
            'complement' => trim((string) ($raw['complement'] ?? '')),
            'neighborhood' => trim((string) ($raw['neighborhood'] ?? '')),
            'city' => trim((string) ($raw['city'] ?? '')),
            'state' => trim((string) ($raw['state'] ?? '')),
        ];

        $errors = [];
        foreach (['zip', 'street', 'number', 'neighborhood', 'city'] as $key) {
            if ($address[$key] === '') {
                $errors["address.{$key}"] = __('validation.required', ['attribute' => __('shipping.fields.'.$key)]);
            }
        }

        if (Geo::hasRegions($country)) {
            if ($address['state'] === '') {
                $errors['address.state'] = __('validation.required', ['attribute' => __('shipping.fields.state')]);
            } elseif (! Geo::isValidRegion($country, $address['state'])) {
                $errors['address.state'] = __('validation.in', ['attribute' => __('shipping.fields.state')]);
            } else {
                $address['state'] = Geo::normalizeRegion($address['state']);
            }
        }

        if ($country === 'BR' && $address['zip'] !== '' && strlen($address['zip']) !== 8) {
            $errors['address.zip'] = __('auth.shipping_zip_invalid');
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return [
            'country' => $country,
            'zip' => $address['zip'],
            'street' => $address['street'],
            'number' => $address['number'],
            'complement' => $address['complement'] !== '' ? $address['complement'] : null,
            'neighborhood' => $address['neighborhood'],
            'city' => $address['city'],
            'state' => $address['state'],
        ];
    }

    /**
     * @param  array<string, mixed>|null  $address
     */
    public static function isComplete(?array $address, string $fallbackCountry = 'BR'): bool
    {
        $address = is_array($address) ? $address : [];
        foreach (['zip', 'street', 'number', 'neighborhood', 'city'] as $key) {
            if (! filled($address[$key] ?? null)) {
                return false;
            }
        }

        $country = Geo::isValidCountry($address['country'] ?? null)
            ? Geo::normalizeCountry($address['country'])
            : Geo::normalizeCountry($fallbackCountry);
        if (! Geo::isValidCountry($country)) {
            $country = Geo::DEFAULT_COUNTRY;
        }

        if (Geo::hasRegions($country) && ! filled($address['state'] ?? null)) {
            return false;
        }

        if ($country === 'BR') {
            $zip = preg_replace('/\D/', '', (string) ($address['zip'] ?? '')) ?? '';
            if (strlen($zip) !== 8) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param  array<string, mixed>  $address
     */
    public static function fingerprint(string $name, ?string $phone, array $address): string
    {
        $payload = [
            'name' => mb_strtolower(trim($name)),
            'phone' => preg_replace('/\D/', '', (string) $phone) ?? '',
            'address' => $address,
        ];

        return hash('sha256', (string) json_encode($payload, JSON_UNESCAPED_UNICODE));
    }

    public static function formatZip(string $country, mixed $zip): string
    {
        $value = trim((string) $zip);
        if ($country !== 'BR') {
            return $value;
        }

        $digits = preg_replace('/\D/', '', $value) ?? '';
        if (strlen($digits) !== 8) {
            return $digits;
        }

        return substr($digits, 0, 5).'-'.substr($digits, 5);
    }

    private static function normalizeZip(string $country, mixed $zip): string
    {
        $value = trim((string) $zip);
        if ($country === 'BR') {
            return preg_replace('/\D/', '', $value) ?? '';
        }

        return $value;
    }
}
