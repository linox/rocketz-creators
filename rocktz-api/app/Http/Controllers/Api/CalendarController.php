<?php

namespace App\Http\Controllers\Api;

use App\Enums\ApplicationStatus;
use App\Enums\CampaignStatus;
use App\Enums\RecurringContractStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\CampaignCreator;
use App\Models\ContentPlanningItem;
use App\Support\MediaUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class CalendarController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $data = $request->validate([
            'month' => ['required', 'string', 'regex:/^\d{4}-\d{2}$/'],
            'kind' => ['nullable', Rule::in(['all', 'delivery', 'post'])],
        ]);

        $kind = $data['kind'] ?? 'all';
        $start = Carbon::createFromFormat('Y-m-d', $data['month'].'-01')->startOfMonth();
        $end = $start->copy()->endOfMonth();
        $user = $request->user();

        $events = [
            ...$this->campaignEvents($user, $start, $end, $kind),
            ...$this->planningEvents($user, $start, $end, $kind),
        ];

        usort($events, fn (array $a, array $b) => strcmp($a['date'].$a['kind'].$a['id'], $b['date'].$b['kind'].$b['id']));

        return response()->json(['data' => array_values($events)]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function campaignEvents(mixed $user, Carbon $start, Carbon $end, string $kind): array
    {
        $query = CampaignCreator::query()
            ->with(['creator', 'campaign.company'])
            ->where('application_status', ApplicationStatus::Approved)
            ->whereHas('campaign', function ($campaign) use ($user) {
                if ($user->role === UserRole::Company) {
                    $campaign->where('company_id', $user->actingCompanyId());
                } elseif ($user->role === UserRole::Creator) {
                    $campaign->where('status', '!=', CampaignStatus::PendingAgency);
                }
            });

        if ($user->role === UserRole::Creator) {
            $query->where('creator_id', $user->creator?->id ?: 0);
        } elseif ($user->role === UserRole::Company) {
            $query->whereHas('campaign', fn ($q) => $q->where('company_id', $user->actingCompanyId()));
        }

        $this->constrainDates($query, $start, $end, $kind, 'delivery_date', 'post_date');

        $events = [];
        foreach ($query->get() as $row) {
            $campaign = $row->campaign;
            $creator = $this->creatorPayload($row->creator);
            $company = $campaign?->company ? [
                'id' => $campaign->company->id,
                'name' => $campaign->company->name,
            ] : null;
            $href = '/campaigns/'.$row->campaign_id;
            $title = $campaign?->name ?: 'Campaign';
            $status = $row->delivery_status?->value;
            $format = $row->delivery_type;

            if ($this->includesKind($kind, 'delivery') && $this->inRange($row->delivery_date, $start, $end)) {
                $events[] = $this->event(
                    'campaign:delivery:'.$row->id,
                    'delivery',
                    'campaign',
                    (int) $row->campaign_id,
                    $row->delivery_date->toDateString(),
                    $title,
                    $format,
                    $status,
                    $href,
                    $creator,
                    $company,
                );
            }
            if ($this->includesKind($kind, 'post') && $this->inRange($row->post_date, $start, $end)) {
                $events[] = $this->event(
                    'campaign:post:'.$row->id,
                    'post',
                    'campaign',
                    (int) $row->campaign_id,
                    $row->post_date->toDateString(),
                    $title,
                    $format,
                    $status,
                    $href,
                    $creator,
                    $company,
                );
            }
        }

        return $events;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function planningEvents(mixed $user, Carbon $start, Carbon $end, string $kind): array
    {
        $query = ContentPlanningItem::query()
            ->with(['creator', 'company', 'recurringContract'])
            ->whereHas('recurringContract', function ($contract) use ($user) {
                if ($user->role === UserRole::Company) {
                    $contract->where('company_id', $user->actingCompanyId());
                } elseif ($user->role === UserRole::Creator) {
                    $contract->where('status', '!=', RecurringContractStatus::PendingAgency);
                }
            });

        if ($user->role === UserRole::Creator) {
            $query->where('creator_id', $user->creator?->id ?: 0);
        } elseif ($user->role === UserRole::Company) {
            $query->where('company_id', $user->actingCompanyId());
        }

        $this->constrainDates($query, $start, $end, $kind, 'planned_date', 'post_date');

        $events = [];
        foreach ($query->get() as $item) {
            $creator = $this->creatorPayload($item->creator);
            $company = $item->company ? [
                'id' => $item->company->id,
                'name' => $item->company->name,
            ] : null;
            $href = '/recurring/'.$item->recurring_contract_id;
            $title = trim((string) $item->title) !== ''
                ? $item->title
                : ($item->recurringContract?->title ?: 'Recurring');
            $status = $item->status?->value;
            $format = $item->content_type?->value;

            if ($this->includesKind($kind, 'delivery') && $this->inRange($item->planned_date, $start, $end)) {
                $events[] = $this->event(
                    'recurring:delivery:'.$item->id,
                    'delivery',
                    'recurring',
                    (int) $item->recurring_contract_id,
                    $item->planned_date->toDateString(),
                    $title,
                    $format,
                    $status,
                    $href,
                    $creator,
                    $company,
                );
            }
            if ($this->includesKind($kind, 'post') && $this->inRange($item->post_date, $start, $end)) {
                $events[] = $this->event(
                    'recurring:post:'.$item->id,
                    'post',
                    'recurring',
                    (int) $item->recurring_contract_id,
                    $item->post_date->toDateString(),
                    $title,
                    $format,
                    $status,
                    $href,
                    $creator,
                    $company,
                );
            }
        }

        return $events;
    }

    private function constrainDates($query, Carbon $start, Carbon $end, string $kind, string $deliveryColumn, string $postColumn): void
    {
        $from = $start->toDateString();
        $to = $end->toDateString();

        $query->where(function ($q) use ($kind, $from, $to, $deliveryColumn, $postColumn) {
            if ($kind === 'delivery') {
                $q->whereBetween($deliveryColumn, [$from, $to]);

                return;
            }
            if ($kind === 'post') {
                $q->whereBetween($postColumn, [$from, $to]);

                return;
            }
            $q->whereBetween($deliveryColumn, [$from, $to])
                ->orWhereBetween($postColumn, [$from, $to]);
        });
    }

    private function includesKind(string $filter, string $kind): bool
    {
        return $filter === 'all' || $filter === $kind;
    }

    private function inRange(mixed $date, Carbon $start, Carbon $end): bool
    {
        if (! $date) {
            return false;
        }

        $value = $date instanceof Carbon ? $date : Carbon::parse($date);

        return $value->betweenIncluded($start->copy()->startOfDay(), $end->copy()->endOfDay());
    }

    /**
     * @return array<string, mixed>|null
     */
    private function creatorPayload(mixed $creator): ?array
    {
        if (! $creator) {
            return null;
        }

        return [
            'id' => $creator->id,
            'artistic_name' => $creator->artistic_name,
            'photo_url' => MediaUrl::publicAbsolute($creator->photo_url),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function event(
        string $id,
        string $kind,
        string $source,
        int $sourceId,
        string $date,
        string $title,
        ?string $format,
        ?string $status,
        string $href,
        ?array $creator,
        ?array $company,
    ): array {
        return [
            'id' => $id,
            'kind' => $kind,
            'source' => $source,
            'source_id' => $sourceId,
            'date' => $date,
            'title' => $title,
            'format' => $format,
            'status' => $status,
            'href' => $href,
            'creator' => $creator,
            'company' => $company,
        ];
    }
}
