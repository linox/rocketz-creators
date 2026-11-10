<?php

namespace App\Support;

class PersonName
{
    /**
     * Nome próprio com pelo menos um sobrenome. Partículas (de, da, do…) não contam como sobrenome.
     */
    public static function isComplete(?string $name): bool
    {
        $name = trim((string) preg_replace('/\s+/u', ' ', (string) $name));
        if ($name === '') {
            return false;
        }

        if (! preg_match("/^[\\p{L}\\p{M}][\\p{L}\\p{M}'’\\-]*(?:\\s+[\\p{L}\\p{M}][\\p{L}\\p{M}'’\\-]*)+$/u", $name)) {
            return false;
        }

        $significant = 0;
        foreach (preg_split('/\s+/u', $name) ?: [] as $token) {
            if (self::isParticle($token)) {
                continue;
            }

            $letters = preg_replace("/[^\\p{L}\\p{M}]/u", '', $token) ?? '';
            if (mb_strlen($letters) < 2) {
                return false;
            }

            $significant++;
        }

        return $significant >= 2;
    }

    private static function isParticle(string $token): bool
    {
        return in_array(mb_strtolower($token), [
            'de', 'da', 'do', 'dos', 'das', 'e', 'di', 'du', 'del', 'della',
            'van', 'von', 'y', 'la', 'le', 'los', 'las',
        ], true);
    }
}
