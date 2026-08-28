<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;

class R2Cors
{
    /**
     * @return list<string>
     */
    public static function origins(): array
    {
        $fromEnv = array_map(
            fn (string $origin) => rtrim(trim($origin), '/'),
            explode(',', (string) config('media.r2_cors_origins', '')),
        );

        return array_values(array_unique(array_filter([
            rtrim((string) config('app.frontend_url'), '/'),
            ...$fromEnv,
        ])));
    }

    public static function apply(): void
    {
        R2Client::make()->putBucketCors([
            'Bucket' => (string) config('filesystems.disks.r2.bucket'),
            'CORSConfiguration' => [
                'CORSRules' => [[
                    'AllowedOrigins' => self::origins(),
                    'AllowedMethods' => ['GET', 'PUT', 'HEAD', 'POST'],
                    'AllowedHeaders' => ['*'],
                    'ExposeHeaders' => ['ETag', 'etag', 'Content-Type', 'Content-Length', 'Accept-Ranges', 'Content-Range'],
                    'MaxAgeSeconds' => 86400,
                ]],
            ],
        ]);

        Cache::put('r2-cors-ensured', true, now()->addHours(6));
    }
}
