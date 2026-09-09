<?php

namespace App\Support;

class AppVersion
{
    /**
     * Mesma versão do rodapé do rocktz-web (package.json).
     * Em produção o Action grava APP_VERSION na raiz da API antes do FTP.
     */
    public static function current(): string
    {
        $stamped = base_path('APP_VERSION');
        if (is_readable($stamped)) {
            $value = trim((string) file_get_contents($stamped));
            if ($value !== '') {
                return $value;
            }
        }

        $webPackage = dirname(base_path()).DIRECTORY_SEPARATOR.'rocktz-web'.DIRECTORY_SEPARATOR.'package.json';
        if (is_readable($webPackage)) {
            $json = json_decode((string) file_get_contents($webPackage), true);
            if (is_array($json) && isset($json['version']) && is_string($json['version']) && $json['version'] !== '') {
                return $json['version'];
            }
        }

        return '0.0.0';
    }
}
