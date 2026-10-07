<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;

class PostalLookup
{
    /**
     * @return array{country: string, zip: string, street: ?string, neighborhood: ?string, city: ?string, state: ?string}|null
     */
    public function find(string $country, string $code): ?array
    {
        $country = Geo::normalizeCountry($country);
        $code = trim($code);
        if ($code === '' || ! Geo::isValidCountry($country)) {
            return null;
        }

        if ($country === Geo::DEFAULT_COUNTRY) {
            return $this->viaCep($code);
        }

        return $this->international($country, $code);
    }

    /**
     * @return array{country: string, zip: string, street: ?string, neighborhood: ?string, city: ?string, state: ?string}|null
     */
    private function viaCep(string $code): ?array
    {
        $digits = preg_replace('/\D/', '', $code) ?? '';
        if (strlen($digits) !== 8) {
            return null;
        }

        $response = Http::timeout(8)
            ->acceptJson()
            ->get("https://viacep.com.br/ws/{$digits}/json/");

        if (! $response->successful()) {
            return null;
        }

        $json = $response->json();
        if (! is_array($json) || ($json['erro'] ?? false) === true) {
            return null;
        }

        return [
            'country' => Geo::DEFAULT_COUNTRY,
            'zip' => $digits,
            'street' => $this->text($json['logradouro'] ?? null),
            'neighborhood' => $this->text($json['bairro'] ?? null),
            'city' => $this->text($json['localidade'] ?? null),
            'state' => $this->resolveRegion(Geo::DEFAULT_COUNTRY, $json['uf'] ?? null, null),
        ];
    }

    /**
     * @return array{country: string, zip: string, street: ?string, neighborhood: ?string, city: ?string, state: ?string}|null
     */
    private function international(string $country, string $code): ?array
    {
        $zippo = $this->zippopotam($country, $code);
        $nominatim = $this->nominatim($country, $code);
        if ($zippo === null && $nominatim === null) {
            return null;
        }

        $resolved = Geo::normalizeCountry($nominatim['country'] ?? $zippo['country'] ?? $country);
        if (! Geo::isValidCountry($resolved)) {
            $resolved = $country;
        }

        return [
            'country' => $resolved,
            'zip' => $zippo['zip'] ?? $nominatim['zip'] ?? $code,
            'street' => $nominatim['street'] ?? null,
            'neighborhood' => $nominatim['neighborhood'] ?? null,
            'city' => $zippo['city'] ?? $nominatim['city'] ?? null,
            'state' => $zippo['state'] ?? $nominatim['state'] ?? null,
        ];
    }

    /**
     * @return array{country: string, zip: string, city: ?string, state: ?string}|null
     */
    private function zippopotam(string $country, string $code): ?array
    {
        $response = Http::timeout(8)
            ->acceptJson()
            ->get('https://api.zippopotam.us/'.strtolower($country).'/'.rawurlencode($code));

        if (! $response->successful()) {
            return null;
        }

        $json = $response->json();
        $place = is_array($json) ? ($json['places'][0] ?? null) : null;
        if (! is_array($place)) {
            return null;
        }

        $resolved = Geo::normalizeCountry((string) ($json['country abbreviation'] ?? $country));
        if (! Geo::isValidCountry($resolved)) {
            $resolved = $country;
        }

        return [
            'country' => $resolved,
            'zip' => $this->text($json['post code'] ?? null) ?? $code,
            'city' => $this->text($place['place name'] ?? null),
            'state' => $this->resolveRegion($resolved, $place['state abbreviation'] ?? null, $place['state'] ?? null),
        ];
    }

    /**
     * @return array{country: string, zip: ?string, street: ?string, neighborhood: ?string, city: ?string, state: ?string}|null
     */
    private function nominatim(string $country, string $code): ?array
    {
        $response = Http::timeout(8)
            ->withHeaders([
                'User-Agent' => 'RocketzCreators/1.0 (postal-code lookup)',
            ])
            ->acceptJson()
            ->get('https://nominatim.openstreetmap.org/search', [
                'postalcode' => $code,
                'countrycodes' => strtolower($country),
                'format' => 'jsonv2',
                'addressdetails' => 1,
                'limit' => 1,
            ]);

        if (! $response->successful()) {
            return null;
        }

        $rows = $response->json();
        $address = is_array($rows) ? ($rows[0]['address'] ?? null) : null;
        if (! is_array($address)) {
            return null;
        }

        $resolved = Geo::normalizeCountry((string) ($address['country_code'] ?? $country));
        if (! Geo::isValidCountry($resolved)) {
            $resolved = $country;
        }

        $iso = (string) ($address['ISO3166-2-lvl4'] ?? $address['ISO3166-2-lvl6'] ?? '');
        $isoCode = str_contains($iso, '-') ? substr($iso, (int) strrpos($iso, '-') + 1) : null;

        return [
            'country' => $resolved,
            'zip' => $this->text($address['postcode'] ?? null),
            'street' => $this->text($address['road'] ?? $address['pedestrian'] ?? null),
            'neighborhood' => $this->text($address['suburb'] ?? $address['neighbourhood'] ?? $address['city_district'] ?? null),
            'city' => $this->text($address['city'] ?? $address['town'] ?? $address['village'] ?? $address['municipality'] ?? null),
            'state' => $this->resolveRegion($resolved, $isoCode, $address['state'] ?? null),
        ];
    }

    private function resolveRegion(string $country, mixed $code, mixed $name): ?string
    {
        $candidate = Geo::normalizeRegion(is_string($code) ? $code : null);
        if ($candidate !== '' && Geo::isValidRegion($country, $candidate)) {
            return $candidate;
        }

        $needle = mb_strtolower(trim((string) $name));
        if ($needle === '') {
            return null;
        }

        foreach (Geo::regionsFor($country) as $key => $label) {
            if (mb_strtolower($label) === $needle || mb_strtolower($key) === $needle) {
                return $key;
            }
        }

        return null;
    }

    private function text(mixed $value): ?string
    {
        $text = trim((string) $value);

        return $text !== '' ? $text : null;
    }
}
