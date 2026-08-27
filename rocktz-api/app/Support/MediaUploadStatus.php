<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;

class MediaUploadStatus
{
    public const UPLOADING = 'uploading';

    public const PROCESSING = 'processing';

    public const DONE = 'done';

    public const FAILED = 'failed';

    /**
     * @param  array<string, mixed>  $extra
     */
    public static function put(string $uploadId, string $status, array $extra = []): void
    {
        Cache::put(self::key($uploadId), array_merge(['status' => $status], $extra), now()->addHours(6));
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function get(string $uploadId): ?array
    {
        $state = Cache::get(self::key($uploadId));

        return is_array($state) ? $state : null;
    }

    public static function key(string $uploadId): string
    {
        return 'media-upload:'.$uploadId;
    }
}
