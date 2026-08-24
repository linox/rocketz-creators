<?php

namespace App\Support;

use Illuminate\Validation\ValidationException;

class SafeHttpUrl
{
    public static function isValid(?string $value): bool
    {
        if ($value === null) {
            return true;
        }

        $value = trim($value);
        if ($value === '') {
            return true;
        }

        if (preg_match('/\s/', $value) || str_contains($value, '\\')) {
            return false;
        }

        $parts = parse_url($value);
        if (! is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) {
            return false;
        }

        $scheme = strtolower((string) $parts['scheme']);
        if (! in_array($scheme, ['http', 'https'], true)) {
            return false;
        }

        return filter_var($value, FILTER_VALIDATE_URL) !== false;
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  list<string>  $keys
     * @return array<string, mixed>
     */
    public static function validateFields(array $data, array $keys): array
    {
        $errors = [];
        foreach ($keys as $key) {
            if (! array_key_exists($key, $data) || $data[$key] === null || $data[$key] === '') {
                continue;
            }
            if (! self::isValid((string) $data[$key])) {
                $errors[$key] = [__('validation.active_url')];
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return $data;
    }
}
