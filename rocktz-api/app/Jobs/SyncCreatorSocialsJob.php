<?php

namespace App\Jobs;

use App\Exceptions\SocialMetricsException;
use App\Models\Creator;
use App\Services\SocialMetricsService;
use App\Support\MetricsSyncStatus;
use Illuminate\Foundation\Bus\Dispatchable;

class SyncCreatorSocialsJob
{
    use Dispatchable;

    /**
     * @param  array<string, string|null>  $handles
     */
    public function __construct(
        public int $creatorId,
        public ?string $network = null,
        public array $handles = [],
        public bool $force = false,
    ) {}

    public function handle(SocialMetricsService $socialMetrics): void
    {
        $key = MetricsSyncStatus::creatorKey($this->creatorId, $this->network);
        MetricsSyncStatus::put($key, MetricsSyncStatus::RUNNING);

        try {
            $creator = Creator::query()->findOrFail($this->creatorId);
            $sync = $socialMetrics->sync($creator, $this->network, $this->handles, $this->force);
            MetricsSyncStatus::put($key, MetricsSyncStatus::DONE, ['sync' => $sync]);
        } catch (SocialMetricsException $e) {
            MetricsSyncStatus::put($key, MetricsSyncStatus::FAILED, ['message' => $e->getMessage()]);
        } catch (\Throwable $e) {
            report($e);
            MetricsSyncStatus::put($key, MetricsSyncStatus::FAILED, [
                'message' => __('auth.social_profile_unavailable'),
            ]);
        }
    }
}
