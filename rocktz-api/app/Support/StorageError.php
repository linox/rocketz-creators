<?php

namespace App\Support;

use Aws\Exception\AwsException;
use Throwable;

class StorageError
{
    public static function message(Throwable $e): string
    {
        $current = $e;
        while ($current) {
            if ($current instanceof AwsException) {
                $code = trim((string) $current->getAwsErrorCode());
                $aws = trim((string) ($current->getAwsErrorMessage() ?: $current->getMessage()));
                $combined = strtolower($code.' '.$aws);
                if (str_contains($combined, 'unauthorized') || str_contains($combined, 'invalidaccesskeyid') || str_contains($combined, 'signaturedoesnotmatch')) {
                    return __('auth.r2_unauthorized');
                }
                if (str_contains($combined, 'accessdenied') || str_contains($combined, 'access denied')) {
                    return __('auth.r2_access_denied');
                }
                if ($code !== '' && $aws !== '' && ! str_contains(strtolower($aws), strtolower($code))) {
                    return $code.': '.$aws;
                }

                return $aws !== '' ? $aws : __('auth.upload_failed');
            }
            $current = $current->getPrevious();
        }

        $message = trim($e->getMessage());
        $lower = strtolower($message);
        if ($message !== '' && (str_contains($lower, 'unauthorized') || str_contains($lower, 'invalidaccesskeyid') || str_contains($lower, 'signaturedoesnotmatch'))) {
            return __('auth.r2_unauthorized');
        }
        if ($message !== '' && (str_contains($lower, 'accessdenied') || str_contains($lower, 'access denied'))) {
            return __('auth.r2_access_denied');
        }

        return $message !== '' ? $message : __('auth.upload_failed');
    }
}
