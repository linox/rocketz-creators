<?php

namespace App\Jobs;

use App\Exceptions\SocialMetricsException;
use App\Models\Campaign;
use App\Services\PostMetricsService;
use App\Support\MetricsSyncStatus;
use Illuminate\Foundation\Bus\Dispatchable;

class SyncCampaignPostMetricsJob
{
    use Dispatchable;

    public function __construct(
        public int $campaignId,
        public ?int $campaignCreatorId = null,
        public bool $force = false,
    ) {}

    public function handle(PostMetricsService $postMetrics): void
    {
        $key = MetricsSyncStatus::campaignKey($this->campaignId, $this->campaignCreatorId);
        MetricsSyncStatus::put($key, MetricsSyncStatus::RUNNING);

        try {
            $campaign = Campaign::query()->findOrFail($this->campaignId);
            $sync = $postMetrics->sync($campaign, $this->campaignCreatorId, $this->force);
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
