<?php

namespace App\Services;

use App\Enums\ApplicationStatus;
use App\Enums\ApprovalFlowType;
use App\Enums\CampaignStatus;
use App\Enums\ContentPlanningStatus;
use App\Enums\DeliveryStatus;
use App\Enums\StageApprovalStatus;
use App\Enums\UserRole;
use App\Models\BrowserAlertPing;
use App\Models\CampaignCreator;
use App\Models\CampaignDemand;
use App\Models\ContentPlanningItem;
use App\Models\Creator;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class BrowserAlertService
{
    public const MAX_PER_DAY = 3;

    public const GAP_HOURS = 4;

    public const BATCH = 5;

    /**
     * Alerts the browser should show now. Each returned alert is claimed so the
     * same state is not sent again until the next slot, a new movement, or the next day.
     *
     * @return list<array{key: string, kind: string, title: string, body: string, url: string, inbox_id: ?string}>
     */
    public function claimDue(User $user): array
    {
        $candidates = $this->candidates($user);
        if ($candidates === []) {
            return [];
        }

        $states = BrowserAlertPing::query()
            ->where('user_id', $user->id)
            ->whereIn('alert_key', array_column($candidates, 'key'))
            ->get()
            ->keyBy('alert_key');

        $ready = [];
        foreach ($candidates as $alert) {
            $state = $states->get($alert['key']);
            if (! $this->looksDue($state, $alert['fingerprint'])) {
                continue;
            }
            $ready[] = $alert + [
                '_moved' => ! $state || $state->fingerprint !== $alert['fingerprint'],
                '_fresh' => ! $state || $state->last_ping_at === null,
            ];
        }

        usort($ready, function (array $a, array $b) {
            $rank = ['script_sent' => 0, 'delivery_received' => 1, 'delivery_overdue' => 2];
            $left = [(int) ! $a['_moved'], (int) ! $a['_fresh'], $rank[$a['kind']] ?? 9];
            $right = [(int) ! $b['_moved'], (int) ! $b['_fresh'], $rank[$b['kind']] ?? 9];

            return $left <=> $right;
        });

        $claimed = [];
        foreach ($ready as $alert) {
            if (count($claimed) >= self::BATCH) {
                break;
            }
            if (! $this->claim($user, $alert)) {
                continue;
            }
            $claimed[] = [
                'key' => $alert['key'],
                'kind' => $alert['kind'],
                'title' => $alert['title'],
                'body' => $alert['body'],
                'url' => $alert['url'],
                'inbox_id' => $alert['inbox_id'],
            ];
        }

        return $claimed;
    }

    public function markSeen(User $user, ?string $key, ?string $inboxId): void
    {
        $candidates = collect($this->candidates($user));
        $subject = null;
        if ($inboxId) {
            $subject = $candidates->firstWhere('inbox_id', $inboxId)['subject'] ?? null;
        }

        $matched = $candidates->filter(function (array $alert) use ($key, $inboxId, $subject) {
            if ($key && $alert['key'] === $key) {
                return true;
            }
            if ($inboxId && $alert['inbox_id'] === $inboxId) {
                return true;
            }

            return $subject && $alert['subject'] === $subject;
        });

        foreach ($matched as $alert) {
            BrowserAlertPing::query()->updateOrCreate(
                ['user_id' => $user->id, 'alert_key' => $alert['key']],
                [
                    'fingerprint' => $alert['fingerprint'],
                    'seen_at' => now(),
                    'seen_fingerprint' => $alert['fingerprint'],
                ],
            );
        }

        if ($key && $matched->isEmpty()) {
            BrowserAlertPing::query()
                ->where('user_id', $user->id)
                ->where('alert_key', $key)
                ->where('fingerprint', '!=', '')
                ->update([
                    'seen_at' => now(),
                    'seen_fingerprint' => DB::raw('fingerprint'),
                ]);
        }
    }

    /**
     * @return list<array{key: string, kind: string, subject: string, fingerprint: string, title: string, body: string, url: string, inbox_id: ?string}>
     */
    private function candidates(User $user): array
    {
        $reviewer = $user->role !== UserRole::Creator;
        if ($user->role === UserRole::Company && ! $user->actingCompanyId()) {
            return [];
        }
        if ($user->role === UserRole::Creator && ! $user->creator?->id) {
            return [];
        }

        $alerts = [];
        foreach ($this->participations($user) as $row) {
            $this->pushParticipation($alerts, $row, $reviewer);
        }
        foreach ($this->planningItems($user) as $item) {
            $this->pushPlanning($alerts, $item, $reviewer);
        }

        return $alerts;
    }

    /**
     * @return list<CampaignCreator>
     */
    private function participations(User $user): array
    {
        $today = now()->toDateString();
        $query = CampaignCreator::query()
            ->with(['campaign', 'creator', 'content', 'demands'])
            ->where('application_status', ApplicationStatus::Approved)
            ->whereHas('campaign', fn ($q) => $q->where('status', '!=', CampaignStatus::Finished))
            ->where(function ($q) use ($today) {
                $q->where('script_status', StageApprovalStatus::Submitted)
                    ->orWhere('video_status', StageApprovalStatus::Submitted)
                    ->orWhere('delivery_status', DeliveryStatus::Sent)
                    ->orWhereHas('demands', function ($demand) {
                        $demand->where('script_status', StageApprovalStatus::Submitted)
                            ->orWhere('video_status', StageApprovalStatus::Submitted)
                            ->orWhere('delivery_status', DeliveryStatus::Sent);
                    })
                    ->orWhere(function ($late) use ($today) {
                        $late->whereNotIn('delivery_status', [DeliveryStatus::Approved, DeliveryStatus::Published])
                            ->where(function ($date) use ($today) {
                                $date->whereDate('delivery_date', '<', $today)
                                    ->orWhere(function ($inherited) use ($today) {
                                        $inherited->whereNull('delivery_date')
                                            ->whereHas('campaign', fn ($campaign) => $campaign->whereDate('delivery_date', '<', $today));
                                    });
                            });
                    });
            })
            ->latest('id')
            ->limit(400);

        if ($user->role === UserRole::Company) {
            $query->whereHas('campaign', fn ($q) => $q->where('company_id', $user->actingCompanyId()));
        }
        if ($user->role === UserRole::Creator) {
            $query->where('creator_id', $user->creator?->id ?: 0);
        }

        return $query->get()->all();
    }

    /**
     * @return list<ContentPlanningItem>
     */
    private function planningItems(User $user): array
    {
        $today = now()->toDateString();
        $month = now()->format('Y-m');
        $query = ContentPlanningItem::query()
            ->visibleToCreator()
            ->with(['creator', 'recurringContract'])
            ->whereNotIn('status', [
                ContentPlanningStatus::Approved,
                ContentPlanningStatus::Published,
                ContentPlanningStatus::Rejected,
            ])
            ->where(function ($q) use ($today, $month) {
                $q->where('script_status', StageApprovalStatus::Submitted)
                    ->orWhere('video_status', StageApprovalStatus::Submitted)
                    ->orWhereDate('post_date', '<', $today)
                    ->orWhereDate('planned_date', '<', $today)
                    ->orWhere('month', '<', $month);
            })
            ->latest('id')
            ->limit(400);

        if ($user->role === UserRole::Company) {
            $query->where('company_id', $user->actingCompanyId());
        }
        if ($user->role === UserRole::Creator) {
            $query->where('creator_id', $user->creator?->id ?: 0);
        }

        return $query->get()->all();
    }

    /**
     * @param  list<array<string, mixed>>  $alerts
     */
    private function pushParticipation(array &$alerts, CampaignCreator $row, bool $reviewer): void
    {
        $campaign = $row->campaign;
        if (! $campaign || NotificationService::is($campaign->status, CampaignStatus::Finished)) {
            return;
        }
        if (! NotificationService::is($row->application_status, ApplicationStatus::Approved)) {
            return;
        }

        $flow = $campaign->approval_flow ?? ApprovalFlowType::ScriptAndVideo;
        $deadline = $this->dateKey($row->delivery_date) ?? $this->dateKey($campaign->delivery_date);
        $shared = [
            'flow' => $flow,
            'deadline' => $deadline,
            'creator' => $this->creatorName($row->creator),
            'creator_id' => (int) $row->creator_id,
            'campaign_id' => (int) $campaign->id,
            'contract_id' => null,
            'source' => 'campaign',
            'participation_id' => (int) $row->id,
            'planning_id' => null,
            'planning_status' => null,
        ];

        if ($row->demands->isNotEmpty()) {
            $scriptOnDemand = $row->demands->contains(fn (CampaignDemand $demand) => $this->isSubmitted($demand->script_status) || $demand->script_submitted_at);
            $videoOnDemand = $row->demands->contains(fn (CampaignDemand $demand) => $this->isSubmitted($demand->video_status) || $demand->video_submitted_at || NotificationService::is($demand->delivery_status, DeliveryStatus::Sent));

            foreach ($row->demands as $demand) {
                $this->pushWork($alerts, $shared + [
                    'subject' => 'demand:'.$demand->id,
                    'demand_id' => (int) $demand->id,
                    'title' => trim($campaign->name.' · '.$demand->label()),
                    'script_status' => $demand->script_status,
                    'video_status' => $demand->video_status,
                    'delivery_status' => $demand->delivery_status,
                    'script_at' => $demand->script_submitted_at,
                    'video_at' => $demand->video_submitted_at,
                    'script_version' => (int) $demand->script_version,
                    'video_version' => (int) $demand->video_version,
                ], $reviewer);
            }

            if ($reviewer && $this->expectsScript($flow) && $this->isSubmitted($row->script_status) && ! $scriptOnDemand) {
                $this->pushWork($alerts, $shared + $this->parentSlice($row, $campaign->name, scriptOnly: true), $reviewer);
            }
            if ($reviewer && $this->expectsVideo($flow) && ! $videoOnDemand && ($this->isSubmitted($row->video_status) || NotificationService::is($row->delivery_status, DeliveryStatus::Sent))) {
                $this->pushWork($alerts, $shared + $this->parentSlice($row, $campaign->name, scriptOnly: false), $reviewer);
            }

            return;
        }

        $this->pushWork($alerts, $shared + [
            'subject' => 'participation:'.$row->id,
            'demand_id' => null,
            'title' => (string) $campaign->name,
            'script_status' => $row->script_status,
            'video_status' => $row->video_status,
            'delivery_status' => $row->delivery_status,
            'script_at' => $row->script_submitted_at,
            'video_at' => $row->video_submitted_at,
            'script_version' => (int) ($row->content?->script_version ?? 0),
            'video_version' => (int) ($row->content?->video_version ?? 0),
        ], $reviewer);
    }

    /**
     * @return array<string, mixed>
     */
    private function parentSlice(CampaignCreator $row, string $title, bool $scriptOnly): array
    {
        return [
            'subject' => 'participation:'.$row->id,
            'demand_id' => null,
            'title' => $title,
            'script_status' => $scriptOnly ? $row->script_status : StageApprovalStatus::Approved,
            'video_status' => $scriptOnly ? StageApprovalStatus::Pending : $row->video_status,
            'delivery_status' => $scriptOnly ? DeliveryStatus::Pending : $row->delivery_status,
            'script_at' => $scriptOnly ? $row->script_submitted_at : null,
            'video_at' => $scriptOnly ? null : $row->video_submitted_at,
            'script_version' => $scriptOnly ? (int) ($row->content?->script_version ?? 0) : 0,
            'video_version' => $scriptOnly ? 0 : (int) ($row->content?->video_version ?? 0),
            'deadline' => null,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $alerts
     */
    private function pushPlanning(array &$alerts, ContentPlanningItem $item, bool $reviewer): void
    {
        if (in_array($item->status, [ContentPlanningStatus::Approved, ContentPlanningStatus::Published, ContentPlanningStatus::Rejected], true)) {
            return;
        }

        $title = trim((string) ($item->title ?: $item->recurringContract?->title));
        if ($title === '') {
            $title = __('auth.browser_alert_untitled');
        }

        $this->pushWork($alerts, [
            'flow' => $item->approval_flow ?? ApprovalFlowType::ScriptAndVideo,
            'deadline' => $this->planningDeadline($item),
            'creator' => $this->creatorName($item->creator),
            'creator_id' => (int) $item->creator_id,
            'campaign_id' => null,
            'contract_id' => (int) $item->recurring_contract_id,
            'source' => 'recurring',
            'participation_id' => null,
            'planning_id' => (int) $item->id,
            'planning_status' => $item->status,
            'subject' => 'planning:'.$item->id,
            'demand_id' => null,
            'title' => $title,
            'script_status' => $item->script_status,
            'video_status' => $item->video_status,
            'delivery_status' => null,
            'script_at' => $item->script_submitted_at,
            'video_at' => $item->video_submitted_at ?: $item->submitted_at,
            'script_version' => (int) $item->script_version,
            'video_version' => (int) $item->video_version,
        ], $reviewer);
    }

    /**
     * @param  list<array<string, mixed>>  $alerts
     * @param  array<string, mixed>  $work
     */
    private function pushWork(array &$alerts, array $work, bool $reviewer): void
    {
        $flow = $work['flow'] instanceof ApprovalFlowType ? $work['flow'] : ApprovalFlowType::ScriptAndVideo;
        $scriptWaiting = $reviewer
            && $this->expectsScript($flow)
            && $this->isSubmitted($work['script_status']);
        $deliveryWaiting = $reviewer
            && $this->expectsVideo($flow)
            && $work['video_status'] !== StageApprovalStatus::Approved
            && (
                $this->isSubmitted($work['video_status'])
                || NotificationService::is($work['delivery_status'], DeliveryStatus::Sent)
                || (
                    $work['planning_status'] === ContentPlanningStatus::Review
                    && ! $this->isSubmitted($work['script_status'])
                    && $work['video_at']
                )
            );

        if ($scriptWaiting) {
            $alerts[] = $this->make($work, 'script_sent', 'script', $reviewer, [
                $this->statusValue($work['script_status']),
                $this->stamp($work['script_at']),
                (string) $work['script_version'],
            ]);
        }
        if ($deliveryWaiting) {
            $alerts[] = $this->make($work, 'delivery_received', 'delivery', $reviewer, [
                $this->statusValue($work['video_status']),
                $this->statusValue($work['delivery_status']),
                $this->stamp($work['video_at']),
                (string) $work['video_version'],
            ]);
        }
        if (! $scriptWaiting && ! $deliveryWaiting && ! $this->done($work, $flow) && $this->past($work['deadline'])) {
            $alerts[] = $this->make($work, 'delivery_overdue', 'overdue', $reviewer, [
                $this->statusValue($work['script_status']),
                $this->statusValue($work['video_status']),
                $this->statusValue($work['delivery_status']),
                $this->statusValue($work['planning_status']),
                (string) $work['deadline'],
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $work
     * @param  list<string>  $parts
     * @return array{key: string, kind: string, subject: string, fingerprint: string, title: string, body: string, url: string, inbox_id: ?string}
     */
    private function make(array $work, string $kind, string $prefix, bool $reviewer, array $parts): array
    {
        $stage = $kind === 'script_sent' || ($kind === 'delivery_overdue' && $this->expectsScript($work['flow']) && ! NotificationService::is($work['script_status'], StageApprovalStatus::Approved))
            ? 'script'
            : 'video';
        $inboxId = $kind === 'delivery_overdue' ? null : $this->inboxId($work, $stage);
        $key = $prefix.':'.$work['subject'];
        $params = ['creator' => $work['creator'], 'title' => $work['title']];
        [$title, $body] = match ($kind) {
            'script_sent' => [__('auth.browser_alert_script_title'), __('auth.browser_alert_script', $params)],
            'delivery_received' => [__('auth.browser_alert_delivery_title'), __('auth.browser_alert_delivery', $params)],
            default => [
                __('auth.browser_alert_overdue_title'),
                __($reviewer ? 'auth.browser_alert_overdue' : 'auth.browser_alert_overdue_own', $params),
            ],
        };

        return [
            'key' => $key,
            'kind' => $kind,
            'subject' => (string) $work['subject'],
            'fingerprint' => implode('|', $parts),
            'title' => $title,
            'body' => $body,
            'url' => $this->url($this->path($work, $inboxId, $reviewer), $key),
            'inbox_id' => $inboxId,
        ];
    }

    /**
     * @param  array<string, mixed>  $work
     */
    private function path(array $work, ?string $inboxId, bool $reviewer): string
    {
        if ($reviewer && $inboxId) {
            $query = 'delivery='.rawurlencode($inboxId);
            if ($work['source'] === 'recurring') {
                $query = 'tab=recurring&'.$query;
            }

            return '/campaign-deliveries?'.$query;
        }

        if ($reviewer) {
            if ($work['source'] === 'recurring' && $work['contract_id']) {
                return '/recurring/'.$work['contract_id'];
            }

            return '/campaigns/'.$work['campaign_id'];
        }

        $tab = $work['source'] === 'recurring' ? 'recurring' : 'campaigns';

        return '/creators/'.$work['creator_id'].'?tab='.$tab;
    }

    private function url(string $path, string $key): string
    {
        $separator = str_contains($path, '?') ? '&' : '?';

        return $path.$separator.'alert='.rawurlencode($key);
    }

    /**
     * @param  array<string, mixed>  $work
     */
    private function inboxId(array $work, string $stage): ?string
    {
        if ($work['source'] === 'recurring' && $work['planning_id']) {
            return 'recurring-'.$work['planning_id'].'-'.$stage;
        }
        if (! $work['participation_id']) {
            return null;
        }
        $id = 'campaign-'.$work['participation_id'];
        if ($work['demand_id']) {
            $id .= '-d'.$work['demand_id'];
        }

        return $id.'-'.$stage;
    }

    /**
     * @param  array<string, mixed>  $work
     */
    private function done(array $work, ApprovalFlowType $flow): bool
    {
        if (NotificationService::is($work['delivery_status'], DeliveryStatus::Approved) || NotificationService::is($work['delivery_status'], DeliveryStatus::Published)) {
            return true;
        }
        if (in_array($work['planning_status'], [ContentPlanningStatus::Approved, ContentPlanningStatus::Published, ContentPlanningStatus::Rejected], true)) {
            return true;
        }

        $scriptOk = ! $this->expectsScript($flow) || NotificationService::is($work['script_status'], StageApprovalStatus::Approved);
        $videoOk = ! $this->expectsVideo($flow) || NotificationService::is($work['video_status'], StageApprovalStatus::Approved);

        return $scriptOk && $videoOk;
    }

    private function expectsScript(ApprovalFlowType $flow): bool
    {
        return in_array($flow, [ApprovalFlowType::ScriptAndVideo, ApprovalFlowType::ScriptOnly], true);
    }

    private function expectsVideo(ApprovalFlowType $flow): bool
    {
        return $flow !== ApprovalFlowType::ScriptOnly;
    }

    private function isSubmitted(mixed $status): bool
    {
        return NotificationService::is($status, StageApprovalStatus::Submitted);
    }

    private function past(?string $deadline): bool
    {
        if (! $deadline) {
            return false;
        }
        if (preg_match('/^\d{4}-\d{2}$/', $deadline) === 1) {
            return $deadline < now()->format('Y-m');
        }

        return $deadline < now()->toDateString();
    }

    private function planningDeadline(ContentPlanningItem $item): ?string
    {
        $post = $this->dateKey($item->post_date);
        if ($post) {
            return $post;
        }
        $planned = $this->dateKey($item->planned_date);
        $month = $item->month ?: ($planned ? substr($planned, 0, 7) : null);
        if ($planned && $month && $planned === $month.'-01') {
            return $month < now()->format('Y-m') ? $month : null;
        }
        if ($planned) {
            return $planned;
        }

        return ($month && $month < now()->format('Y-m')) ? $month : null;
    }

    private function creatorName(?Creator $creator): string
    {
        $name = trim((string) ($creator?->artistic_name ?: $creator?->full_name));

        return $name !== '' ? $name : __('auth.browser_alert_creator_fallback');
    }

    private function dateKey(mixed $value): ?string
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }
        if (! is_string($value) || $value === '') {
            return null;
        }

        $key = substr($value, 0, 10);

        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $key) === 1 ? $key : null;
    }

    private function stamp(mixed $value): string
    {
        if ($value instanceof \DateTimeInterface) {
            return Carbon::instance(\DateTime::createFromInterface($value))->toIso8601String();
        }

        return is_string($value) ? $value : '';
    }

    private function statusValue(mixed $status): string
    {
        return (string) (NotificationService::value($status) ?? '');
    }

    private function looksDue(?BrowserAlertPing $state, string $fingerprint): bool
    {
        if ($state && $state->seen_at && $state->seen_fingerprint === $fingerprint) {
            return false;
        }
        if (! $state || $state->fingerprint !== $fingerprint || $state->last_ping_at === null) {
            return true;
        }

        $today = now()->toDateString();
        $count = $state->ping_on?->toDateString() === $today ? (int) $state->ping_count : 0;
        if ($count >= self::MAX_PER_DAY) {
            return false;
        }

        return $state->last_ping_at->lte(now()->subHours(self::GAP_HOURS));
    }

    /**
     * @param  array{key: string, fingerprint: string}  $alert
     */
    private function claim(User $user, array $alert): bool
    {
        return (bool) DB::transaction(function () use ($user, $alert) {
            $row = BrowserAlertPing::query()
                ->where('user_id', $user->id)
                ->where('alert_key', $alert['key'])
                ->lockForUpdate()
                ->first();

            if (! $row) {
                $row = new BrowserAlertPing([
                    'user_id' => $user->id,
                    'alert_key' => $alert['key'],
                    'fingerprint' => '',
                    'ping_count' => 0,
                ]);
            }

            if (! $this->looksDue($row->exists ? $row : null, $alert['fingerprint'])) {
                return false;
            }

            $moved = ! $row->exists || $row->fingerprint !== $alert['fingerprint'];
            $today = now()->toDateString();
            $count = (! $moved && $row->ping_on?->toDateString() === $today) ? (int) $row->ping_count : 0;

            $row->forceFill([
                'fingerprint' => $alert['fingerprint'],
                'ping_on' => $today,
                'ping_count' => $count + 1,
                'last_ping_at' => now(),
            ])->save();

            return true;
        });
    }
}
