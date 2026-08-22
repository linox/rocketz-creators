<?php

namespace App\Jobs;

use App\Exceptions\SocialMetricsException;
use App\Models\RecurringContract;
use App\Services\PostMetricsService;
use App\Support\MetricsSyncStatus;
use Illuminate\Foundation\Bus\Dispatchable;

class SyncRecurringPostMetricsJob
{
    use Dispatchable;

    public function __construct(
        public int $contractId,
        public ?string $month = null,
        public ?int $itemId = null,
        public bool $force = false,
    ) {}

    public function handle(PostMetricsService $postMetrics): void
    {
        $key = MetricsSyncStatus::recurringKey($this->contractId, $this->month, $this->itemId);
        MetricsSyncStatus::put($key, MetricsSyncStatus::RUNNING);

        try {
            $contract = RecurringContract::query()->findOrFail($this->contractId);
            $sync = $postMetrics->syncPlanning($contract, $this->month, $this->itemId, $this->force);
            MetricsSyncStatus::put($key, MetricsSyncStatus::DONE, ['sync' => $sync]);
        } catch (SocialMetricsException $e) {
            MetricsSyncStatus::put($key, MetricsSyncStatus::FAILED, ['message' => $e->getMessage()]);
        } catch (\Throwable $e) {
            report($e);
            MetricsSyncStatus::put($key, MetricsSyncStatus::FAILED, [
                'message' => __('auth.post_metrics_unavailable'),
            ]);
        }
    }
}
