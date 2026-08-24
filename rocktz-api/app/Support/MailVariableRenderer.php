<?php

namespace App\Support;

class MailVariableRenderer
{
    /**
     * @param  array<string, scalar|null>  $variables
     */
    public function render(string $template, array $variables): string
    {
        return (string) preg_replace_callback('/\{\{\s*([a-z0-9_]+)\s*\}\}/i', function (array $matches) use ($variables) {
            $key = $matches[1];
            if (! array_key_exists($key, $variables) || $variables[$key] === null || $variables[$key] === '') {
                return '';
            }

            return e((string) $variables[$key]);
        }, $template);
    }

    /**
     * @param  array<string, scalar|null>  $variables
     * @param  list<string>  $keys
     * @return list<array{label: string, value: string}>
     */
    public function highlights(array $keys, array $variables, string $locale): array
    {
        $rows = [];
        foreach ($keys as $key) {
            $value = $variables[$key] ?? null;
            if ($value === null || $value === '') {
                continue;
            }
            $rows[] = [
                'label' => trans('mail.variables.'.$key, [], $locale),
                'value' => (string) $value,
            ];
        }

        return $rows;
    }

    /**
     * @param  array<string, scalar|null>  $variables
     * @param  list<string>  $required
     */
    public function missingRequired(array $required, array $variables): array
    {
        $missing = [];
        foreach ($required as $key) {
            if (! isset($variables[$key]) || trim((string) $variables[$key]) === '') {
                $missing[] = $key;
            }
        }

        return $missing;
    }
}
