<?php

namespace App\Support;

use Aws\S3\S3Client;

class R2Client
{
    public static function make(): S3Client
    {
        $config = config('filesystems.disks.r2', []);
        $region = (string) ($config['region'] ?? 'us-east-1');
        if ($region === '' || strtolower($region) === 'auto') {
            $region = 'us-east-1';
        }

        return new S3Client([
            'version' => 'latest',
            'region' => $region,
            'endpoint' => $config['endpoint'] ?? null,
            'use_path_style_endpoint' => (bool) ($config['use_path_style_endpoint'] ?? false),
            'credentials' => [
                'key' => trim((string) ($config['key'] ?? '')),
                'secret' => trim((string) ($config['secret'] ?? '')),
            ],
            'request_checksum_calculation' => 'when_required',
            'response_checksum_validation' => 'when_required',
            'use_aws_shared_config_files' => false,
        ]);
    }
}
