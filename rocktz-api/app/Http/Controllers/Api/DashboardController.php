<?php

namespace App\Http\Controllers\Api;

use App\Enums\ApplicationStatus;
use App\Enums\CampaignStatus;
use App\Enums\CreatorStatus;
use App\Enums\DeliveryStatus;
use App\Enums\PaymentStatus;
use App\Enums\SignatureStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\Company;
use App\Models\Creator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->role === UserRole::Admin) {
            return response()->json($this->adminStats());
        }

        if ($user->role === UserRole::Company) {
            return response()->json($this->companyStats((int) $user->actingCompanyId()));
        }

        return response()->json($this->creatorStats((int) $user->creator?->id));
    }

    /**
     * @return array<string, mixed>
     */
    private function adminStats(): array
    {
        $running = [CampaignStatus::Briefing, CampaignStatus::Selection, CampaignStatus::Approval, CampaignStatus::Production, CampaignStatus::Published];

        $signatureQuery = CampaignCreator::query()
            ->with(['creator', 'campaign'])
            ->whereIn('signature_status', [SignatureStatus::Pending, SignatureStatus::Sent])
            ->where('application_status', ApplicationStatus::Approved);

        $deliveryQuery = CampaignCreator::query()
            ->with(['creator', 'campaign'])
            ->where('application_status', ApplicationStatus::Approved)
            ->where('delivery_status', '!=', DeliveryStatus::Published);

        $pendingSignatures = (clone $signatureQuery)->latest()->limit(5)->get();
        $upcoming = (clone $deliveryQuery)->orderByRaw('delivery_date is null')->orderBy('delivery_date')->limit(5)->get();

        $runningCampaigns = Campaign::query()->whereIn('status', $running);

        return [
            'total_creators' => Creator::query()->count(),
            'active_creators' => Creator::query()->where('status', CreatorStatus::Active)->count(),
            'pending_approval_creators' => Creator::query()->where('status', CreatorStatus::Review)->count(),
            'running_campaigns' => (clone $runningCampaigns)->count(),
            'finished_campaigns' => Campaign::query()->where('status', CampaignStatus::Finished)->count(),
            'total_campaign_value' => (float) (clone $runningCampaigns)->sum('total_budget'),
            'pending_signatures' => (clone $signatureQuery)->count(),
            'upcoming_deliveries' => (clone $deliveryQuery)->count(),
            'pending_applications' => CampaignCreator::query()->where('application_status', ApplicationStatus::Pending)->count(),
            'revenue' => $this->revenueSeries(),
            'signatures' => $pendingSignatures->map(fn (CampaignCreator $row) => [
                'id' => $row->id,
                'creator_name' => $row->creator?->full_name,
                'creator_artistic' => $row->creator?->artistic_name,
                'campaign_name' => $row->campaign?->name,
                'status' => $row->signature_status?->value,
            ]),
            'deliveries' => $upcoming->map(fn (CampaignCreator $row) => [
                'id' => $row->id,
                'creator_artistic' => $row->creator?->artistic_name,
                'campaign_name' => $row->campaign?->name,
                'type' => $row->delivery_type ?: 'Vídeo / Conteúdo',
                'delivery_status' => $row->delivery_status?->value,
                'date' => $row->delivery_date?->format('d/m'),
            ]),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function companyStats(int $companyId): array
    {
        $campaigns = Campaign::query()->where('company_id', $companyId);

        return [
            'campaigns' => (clone $campaigns)->count(),
            'running_campaigns' => (clone $campaigns)->whereNotIn('status', [CampaignStatus::Finished, CampaignStatus::PendingAgency])->count(),
            'total_campaign_value' => (float) (clone $campaigns)->sum('total_budget'),
            'currency' => Company::query()->find($companyId)?->currencyCode(),
            'pending_applications' => CampaignCreator::query()
                ->whereHas('campaign', fn ($q) => $q->where('company_id', $companyId))
                ->where('application_status', ApplicationStatus::Pending)
                ->count(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function creatorStats(int $creatorId): array
    {
        $rows = CampaignCreator::query()->where('creator_id', $creatorId);
        $creator = $creatorId > 0 ? Creator::query()->find($creatorId) : null;
        $metrics = is_array($creator?->metrics) ? $creator->metrics : [];

        return [
            'campaigns' => (clone $rows)->count(),
            'approved_campaigns' => (clone $rows)->where('application_status', ApplicationStatus::Approved)->count(),
            'pending_applications' => (clone $rows)->where('application_status', ApplicationStatus::Pending)->count(),
            'status' => $creator?->status?->value,
            'audience' => $this->creatorAudience($metrics),
            'fees' => [
                'paid' => (float) (clone $rows)->where('payment_status', PaymentStatus::Paid)->sum('amount'),
                'pending' => (float) (clone $rows)->whereIn('payment_status', [PaymentStatus::Pending, PaymentStatus::Scheduled])->sum('amount'),
            ],
            'activity' => $this->creatorActivitySeries($creatorId),
        ];
    }

    /**
     * @param  array<string, mixed>  $metrics
     * @return list<array{network: string, followers: float, views: float, engagement: float}>
     */
    private function creatorAudience(array $metrics): array
    {
        $networks = [
            'instagram' => [
                'followers' => ['instagram_followers', 'followers'],
                'views' => ['instagram_views', 'avgViews', 'avg_views'],
                'engagement' => ['instagram_engagement', 'avgEngagement', 'engagement_rate'],
            ],
            'tiktok' => [
                'followers' => ['tiktok_followers'],
                'views' => ['tiktok_views'],
                'engagement' => ['tiktok_engagement'],
            ],
            'youtube' => [
                'followers' => ['youtube_followers', 'youtube_subscribers'],
                'views' => ['youtube_views'],
                'engagement' => ['youtube_engagement'],
            ],
            'kwai' => [
                'followers' => ['kwai_followers'],
                'views' => ['kwai_views'],
                'engagement' => ['kwai_engagement'],
            ],
        ];

        $audience = [];
        foreach ($networks as $network => $keys) {
            $audience[] = [
                'network' => $network,
                'followers' => $this->metricNumber($metrics, $keys['followers']),
                'views' => $this->metricNumber($metrics, $keys['views']),
                'engagement' => $this->metricNumber($metrics, $keys['engagement']),
            ];
        }

        return $audience;
    }

    /**
     * @param  array<string, mixed>  $metrics
     * @param  list<string>  $keys
     */
    private function metricNumber(array $metrics, array $keys): float
    {
        foreach ($keys as $key) {
            if (isset($metrics[$key]) && is_numeric($metrics[$key])) {
                return (float) $metrics[$key];
            }
        }

        return 0.0;
    }

    /**
     * @return list<array{name: string, value: int}>
     */
    private function creatorActivitySeries(int $creatorId): array
    {
        $series = [];
        foreach ($this->lastSixMonths() as $key => $name) {
            $series[$key] = ['name' => $name, 'value' => 0];
        }

        if ($creatorId < 1) {
            return array_values($series);
        }

        CampaignCreator::query()
            ->where('creator_id', $creatorId)
            ->where('created_at', '>=', now()->startOfMonth()->subMonths(5))
            ->get(['created_at'])
            ->each(function (CampaignCreator $row) use (&$series) {
                $key = $row->created_at?->format('Y-m');
                if ($key && isset($series[$key])) {
                    $series[$key]['value']++;
                }
            });

        return array_values($series);
    }

    /**
     * @return array<string, string>
     */
    private function lastSixMonths(): array
    {
        $labels = [1 => 'Jan', 2 => 'Fev', 3 => 'Mar', 4 => 'Abr', 5 => 'Mai', 6 => 'Jun', 7 => 'Jul', 8 => 'Ago', 9 => 'Set', 10 => 'Out', 11 => 'Nov', 12 => 'Dez'];
        $months = [];

        for ($i = 5; $i >= 0; $i--) {
            $date = now()->startOfMonth()->subMonths($i);
            $months[$date->format('Y-m')] = $labels[(int) $date->format('n')].' '.substr($date->format('Y'), -2);
        }

        return $months;
    }

    /**
     * @return list<array{name: string, value: float}>
     */
    private function revenueSeries(): array
    {
        $series = [];
        foreach ($this->lastSixMonths() as $key => $name) {
            $series[$key] = ['name' => $name, 'value' => 0.0];
        }

        Campaign::query()
            ->whereNotNull('start_date')
            ->where('start_date', '>=', now()->startOfMonth()->subMonths(5)->toDateString())
            ->get(['start_date', 'total_budget'])
            ->each(function (Campaign $campaign) use (&$series) {
                $key = $campaign->start_date?->format('Y-m');
                if ($key && isset($series[$key])) {
                    $series[$key]['value'] += (float) $campaign->total_budget;
                }
            });

        return array_values($series);
    }
}
