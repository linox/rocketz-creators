<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;

class MetricsSyncStatus
{
    public const QUEUED = 'queued';

    public const RUNNING = 'running';

    public const DONE = 'done';

    public const FAILED = 'failed';

    /**
     * @param  array<string, mixed>  $extra
     */
    public static function put(string $key, string $status, array $extra = []): void
    {
        Cache::put($key, array_merge(['status' => $status], $extra), now()->addMinutes(10));
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function get(string $key): ?array
    {
        $state = Cache::get($key);

        return is_array($state) ? $state : null;
    }

    public static function busy(string $key): bool
    {
        $status = self::get($key)['status'] ?? null;

        return in_array($status, [self::RUNNING], true);
    }

    public static function creatorKey(int $creatorId, ?string $network = null): string
    {
        return 'metrics-sync:creator:'.$creatorId.':'.($network ?: 'all');
    }

    public static function campaignKey(int $campaignId, ?int $campaignCreatorId = null): string
    {
        return 'metrics-sync:campaign:'.$campaignId.':'.($campaignCreatorId ?: 'all');
    }

    public static function recurringKey(int $contractId, ?string $month = null, ?int $itemId = null): string
    {
        if ($itemId) {
            return 'metrics-sync:recurring:'.$contractId.':item:'.$itemId;
        }

        return 'metrics-sync:recurring:'.$contractId.':'.($month ?: 'all');
    }
}
