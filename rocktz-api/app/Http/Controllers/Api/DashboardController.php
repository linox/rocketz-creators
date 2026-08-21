<?php

namespace App\Http\Controllers\Api;

use App\Enums\ApplicationStatus;
use App\Enums\CampaignStatus;
use App\Enums\CreatorStatus;
use App\Enums\DeliveryStatus;
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
            return response()->json($this->companyStats((int) $user->companyUser?->company_id));
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

        return [
            'campaigns' => (clone $rows)->count(),
            'approved_campaigns' => (clone $rows)->where('application_status', ApplicationStatus::Approved)->count(),
            'pending_applications' => (clone $rows)->where('application_status', ApplicationStatus::Pending)->count(),
            'status' => Creator::query()->find($creatorId)?->status?->value,
        ];
    }

    /**
     * @return list<array{name: string, value: float}>
     */
    private function revenueSeries(): array
    {
        $labels = [1 => 'Jan', 2 => 'Fev', 3 => 'Mar', 4 => 'Abr', 5 => 'Mai', 6 => 'Jun', 7 => 'Jul', 8 => 'Ago', 9 => 'Set', 10 => 'Out', 11 => 'Nov', 12 => 'Dez'];
        $series = [];

        for ($i = 5; $i >= 0; $i--) {
            $date = now()->startOfMonth()->subMonths($i);
            $key = $date->format('Y-m');
            $series[$key] = [
                'name' => $labels[(int) $date->format('n')].' '.substr($date->format('Y'), -2),
                'value' => 0.0,
            ];
        }

        Campaign::query()
            ->whereNotNull('start_date')
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
