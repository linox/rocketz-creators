<?php

namespace App\Services;

use App\Enums\ApplicationStatus;
use App\Enums\ApprovalFlowType;
use App\Enums\DeliveryStatus;
use App\Enums\StageApprovalStatus;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\CampaignDeliverable;
use App\Models\CampaignDemand;
use App\Support\DeliveryMovements;
use App\Support\RevisionHistory;
use App\Support\SubmissionVersioning;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class CampaignDemandSync
{
    /** @var list<string> */
    public const TYPES = ['reels', 'stories', 'tiktok', 'ugc', 'posts', 'youtube', 'live_instagram', 'live_tiktok', 'live_youtube'];

    /** @var list<string> */
    public const LIVE_TYPES = ['live', 'live_instagram', 'live_tiktok', 'live_youtube'];

    public function syncCampaign(Campaign $campaign): void
    {
        $campaign->loadMissing(['deliverable', 'campaignCreators.demands']);

        foreach ($campaign->campaignCreators as $row) {
            $row->setRelation('campaign', $campaign);
            $this->syncCreator($row);
        }
    }

    /**
     * @param  Collection<int, Campaign>|iterable<int, Campaign>  $campaigns
     */
    public function syncCampaigns(iterable $campaigns): void
    {
        foreach ($campaigns as $campaign) {
            $this->syncCampaign($campaign);
        }
    }

    public function syncCreator(CampaignCreator $row): int
    {
        if ($row->application_status !== ApplicationStatus::Approved) {
            return 0;
        }

        $row->loadMissing(['campaign.deliverable', 'demands']);
        if (! is_array($row->deliverables) && $row->campaign?->deliverable === null) {
            return 0;
        }

        $quota = $this->quotaFor($row);
        $hadNone = $row->demands->isEmpty();
        $created = 0;
        $changed = false;
        $first = null;

        foreach (self::TYPES as $type) {
            $target = $quota[$type];
            $existing = $row->demands->where('content_type', $type)->sortBy('position')->values();

            for ($position = $existing->count() + 1; $position <= $target; $position++) {
                $demand = $row->demands()->create([
                    'content_type' => $type,
                    'position' => $position,
                    'script_status' => StageApprovalStatus::Pending,
                    'video_status' => StageApprovalStatus::Pending,
                    'delivery_status' => DeliveryStatus::Pending,
                ]);
                $existing->push($demand);
                $first ??= $demand;
                $created++;
                $changed = true;
            }

            if ($this->trimUntouched($row, $type, $existing, $target)) {
                $changed = true;
            }
        }

        if ($hadNone && $first) {
            $this->absorbLegacyContent($row, $first);
            $this->rollup($row);
        } elseif ($changed) {
            $row->unsetRelation('demands');
            $this->rollup($row);
        }

        return $created;
    }

    /**
     * @param  array<string, mixed>|null  $custom
     * @return array<string, int>
     */
    public function normalizeDeliverables(?array $custom): ?array
    {
        if ($custom === null) {
            return null;
        }

        $quota = [];
        foreach (self::TYPES as $type) {
            $quota[$type] = max(0, (int) ($custom[$type] ?? 0));
        }

        return $quota;
    }

    /**
     * @param  array<string, int>|null  $custom
     */
    public function assertQuota(CampaignCreator $row, ?array $custom): void
    {
        $row->loadMissing(['campaign.deliverable', 'demands']);
        $quota = $this->quotaFrom($row, $custom);

        foreach (self::TYPES as $type) {
            $locked = $row->demands
                ->where('content_type', $type)
                ->reject(fn (CampaignDemand $demand) => $this->demandIsUntouched($demand))
                ->count();
            if ($quota[$type] < $locked) {
                throw ValidationException::withMessages([
                    "deliverables.{$type}" => __('auth.campaign_creator_deliverable_locked', ['locked' => $locked]),
                ]);
            }
        }
    }

    /**
     * @return array<string, int>
     */
    private function quotaFor(CampaignCreator $row): array
    {
        return $this->quotaFrom($row, is_array($row->deliverables) ? $row->deliverables : null);
    }

    /**
     * @param  array<string, mixed>|null  $custom
     * @return array<string, int>
     */
    private function quotaFrom(CampaignCreator $row, ?array $custom): array
    {
        $deliverable = $row->campaign?->deliverable;
        $quota = [];
        foreach (self::TYPES as $type) {
            $quota[$type] = is_array($custom)
                ? max(0, (int) ($custom[$type] ?? 0))
                : max(0, (int) ($deliverable->{$type} ?? 0));
        }

        return $quota;
    }

    /**
     * @param  array<string, mixed>|null  $custom
     */
    public function deliveryTypeLabel(?array $custom, ?CampaignDeliverable $deliverable): string
    {
        if ($custom !== null) {
            return $this->formatQuota($this->normalizeDeliverables($custom) ?? []);
        }

        $summary = trim((string) ($deliverable?->summary ?? ''));
        if ($summary !== '') {
            return mb_substr($summary, 0, 255);
        }

        $quota = [];
        foreach (self::TYPES as $type) {
            $quota[$type] = max(0, (int) ($deliverable?->{$type} ?? 0));
        }

        return $this->formatQuota($quota);
    }

    /**
     * @param  array<string, int>  $quota
     */
    private function formatQuota(array $quota): string
    {
        $parts = [];
        $labels = [
            'reels' => fn (int $count) => $count.'x Reel'.($count > 1 ? 's' : ''),
            'stories' => fn (int $count) => $count.'x Stories',
            'tiktok' => fn (int $count) => $count.'x TikTok',
            'ugc' => fn (int $count) => $count.'x UGC',
            'posts' => fn (int $count) => $count.'x Post'.($count > 1 ? 's' : ''),
            'youtube' => fn (int $count) => $count.'x YouTube',
            'live_instagram' => fn (int $count) => $count.'x Live Instagram',
            'live_tiktok' => fn (int $count) => $count.'x Live TikTok',
            'live_youtube' => fn (int $count) => $count.'x Live YouTube',
        ];
        foreach ($labels as $type => $label) {
            $count = (int) ($quota[$type] ?? 0);
            if ($count > 0) {
                $parts[] = $label($count);
            }
        }

        return mb_substr(implode(' + ', $parts), 0, 255);
    }

    /**
     * @param  Collection<int, CampaignDemand>  $existing
     */
    private function trimUntouched(CampaignCreator $row, string $type, Collection $existing, int $target): bool
    {
        $remove = $existing->count() - $target;
        if ($remove <= 0) {
            return false;
        }

        $deleted = false;
        $ordered = $existing->sort(function (CampaignDemand $left, CampaignDemand $right) {
            $leftHasPauta = filled($left->pauta) ? 1 : 0;
            $rightHasPauta = filled($right->pauta) ? 1 : 0;
            if ($leftHasPauta !== $rightHasPauta) {
                return $leftHasPauta <=> $rightHasPauta;
            }

            return $right->position <=> $left->position;
        })->values();

        foreach ($ordered as $demand) {
            if ($remove <= 0) {
                break;
            }
            if (! $this->demandIsUntouched($demand)) {
                continue;
            }
            $demand->delete();
            $remove--;
            $deleted = true;
        }

        if ($deleted) {
            $this->renumber($row, $type);
        }

        return $deleted;
    }

    private function renumber(CampaignCreator $row, string $type): void
    {
        $left = $row->demands()->where('content_type', $type)->orderBy('position')->orderBy('id')->get();
        foreach ($left as $demand) {
            $demand->forceFill(['position' => $demand->position + 1000])->save();
        }
        $position = 1;
        foreach ($left as $demand) {
            $demand->forceFill(['position' => $position])->save();
            $position++;
        }
    }

    private function demandIsUntouched(CampaignDemand $demand): bool
    {
        // A pauta is the brief for that slot. It does not mean the creator already
        // has to deliver the campaign's original package.
        if ($this->demandHasScript($demand) || $this->demandHasVideo($demand)) {
            return false;
        }

        return $this->statusValue($demand->script_status) === StageApprovalStatus::Pending->value
            && $this->statusValue($demand->video_status) === StageApprovalStatus::Pending->value
            && $this->statusValue($demand->delivery_status) === DeliveryStatus::Pending->value;
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function fillSubmission(CampaignDemand $demand, array $attributes): void
    {
        $fields = array_intersect_key($attributes, array_flip([
            'script',
            'script_file_url',
            'script_file_name',
            'video_url',
            'video_file_size',
            'image_url',
            'published_link',
            'script_status',
            'video_status',
            'delivery_status',
            'script_feedback',
            'video_feedback',
            'revision_details',
            'pauta',
        ]));

        if (array_key_exists('pauta', $fields)) {
            $fields['pauta'] = trim((string) ($fields['pauta'] ?? '')) ?: null;
        }

        if (NotificationService::is($fields['script_status'] ?? null, StageApprovalStatus::Submitted)) {
            $fields['script_submitted_at'] = now();
        }
        if (NotificationService::is($fields['video_status'] ?? null, StageApprovalStatus::Submitted)) {
            $fields['video_submitted_at'] = now();
        }

        if (array_key_exists('pending_upload_id', $attributes)) {
            $fields['pending_upload_id'] = $attributes['pending_upload_id'];
            $fields['upload_progress'] = $attributes['upload_progress'] ?? null;
        }

        DeliveryMovements::capture($demand, $fields);
        $demand->fill($fields)->save();

        if (NotificationService::is($fields['script_status'] ?? null, StageApprovalStatus::Revision)) {
            RevisionHistory::append(
                $demand,
                'script',
                (string) ($fields['script_feedback'] ?? $fields['revision_details'] ?? ''),
            );
            $demand->save();
        }

        if (NotificationService::is($fields['video_status'] ?? null, StageApprovalStatus::Revision)) {
            RevisionHistory::append(
                $demand,
                'video',
                (string) ($fields['video_feedback'] ?? $fields['revision_details'] ?? ''),
            );
            $demand->save();
        }

        if (NotificationService::is($fields['script_status'] ?? null, StageApprovalStatus::Submitted)) {
            SubmissionVersioning::append($demand, 'script', [
                'script' => $demand->script,
                'script_file_url' => $demand->script_file_url,
                'script_file_name' => $demand->script_file_name,
            ]);
        }

        if (NotificationService::is($fields['video_status'] ?? null, StageApprovalStatus::Submitted) && $demand->video_url) {
            SubmissionVersioning::append($demand, 'video', [
                'video_url' => $demand->video_url,
                'video_file_size' => $demand->video_file_size,
            ]);
        }

        $demand->loadMissing('campaignCreator');
        if ($demand->campaignCreator) {
            $this->rollup($demand->campaignCreator);
        }
    }

    /**
     * A note sent as a revision before the creator submitted that stage is a pauta, not a change request.
     *
     * @param  array<string, mixed>  $attributes
     * @return array<string, mixed>
     */
    public function storeBriefInsteadOfEmptyRevision(CampaignDemand $demand, array $attributes): array
    {
        $attributes = $this->moveEmptyStageRevisionToPauta($demand, $attributes, 'script');
        $attributes = $this->moveEmptyStageRevisionToPauta($demand, $attributes, 'video');

        return $attributes;
    }

    /**
     * Moves notes already stored as a revision on a stage the creator never submitted into the demand pauta.
     */
    public function releaseBriefNotesStoredAsRevision(): int
    {
        $released = 0;
        $creatorIds = [];

        CampaignDemand::query()
            ->where(function ($query) {
                $query->where(function ($video) {
                    $video->where('video_status', StageApprovalStatus::Revision->value)
                        ->whereNull('video_submitted_at')
                        ->where(fn ($empty) => $empty->whereNull('video_url')->orWhere('video_url', ''))
                        ->where(fn ($empty) => $empty->whereNull('image_url')->orWhere('image_url', ''))
                        ->where(fn ($empty) => $empty->whereNull('published_link')->orWhere('published_link', ''));
                })->orWhere(function ($script) {
                    $script->where('script_status', StageApprovalStatus::Revision->value)
                        ->whereNull('script_submitted_at')
                        ->where(fn ($empty) => $empty->whereNull('script')->orWhere('script', ''))
                        ->where(fn ($empty) => $empty->whereNull('script_file_url')->orWhere('script_file_url', ''));
                });
            })
            ->orderBy('id')
            ->each(function (CampaignDemand $demand) use (&$released, &$creatorIds) {
                if (! $this->releaseStoredRevisionWithoutSubmission($demand)) {
                    return;
                }
                $released++;
                $creatorIds[$demand->campaign_creator_id] = true;
            });

        foreach (array_keys($creatorIds) as $creatorId) {
            $row = CampaignCreator::query()->find($creatorId);
            if ($row) {
                $this->rollup($row);
            }
        }

        return $released;
    }

    public function rollup(CampaignCreator $row): void
    {
        $demands = $row->demands()->get();
        if ($demands->isEmpty()) {
            return;
        }

        $row->forceFill([
            'script_status' => $this->rollupStage($demands->map(fn (CampaignDemand $demand) => $demand->script_status)),
            'video_status' => $this->rollupStage($demands->map(fn (CampaignDemand $demand) => $demand->video_status)),
            'delivery_status' => $this->rollupDelivery($demands),
        ])->save();
    }

    public function contentReady(CampaignCreator $row): bool
    {
        $row->loadMissing(['campaign', 'demands']);
        if ($row->demands->isEmpty()) {
            return false;
        }

        return $row->demands->every(fn (CampaignDemand $demand) => $this->demandReady($row, $demand));
    }

    private function absorbLegacyContent(CampaignCreator $row, CampaignDemand $demand): void
    {
        $row->loadMissing('content');
        $content = $row->content;
        $hasWork = $content && (
            filled($content->script)
            || filled($content->script_file_url)
            || filled($content->video_url)
            || filled($content->image_url)
            || filled($content->published_link)
        );
        $hasStatus = $this->statusMoved($row->script_status)
            || $this->statusMoved($row->video_status)
            || $this->deliveryMoved($row->delivery_status);

        if (! $hasWork && ! $hasStatus) {
            return;
        }

        $demand->fill([
            'script' => $content?->script,
            'script_file_url' => $content?->script_file_url,
            'script_file_name' => $content?->script_file_name,
            'video_url' => $content?->video_url,
            'video_file_size' => $content?->video_file_size,
            'image_url' => $content?->image_url,
            'published_link' => $content?->published_link,
            'script_status' => $row->script_status ?? StageApprovalStatus::Pending,
            'video_status' => $row->video_status ?? StageApprovalStatus::Pending,
            'delivery_status' => $row->delivery_status ?? DeliveryStatus::Pending,
            'script_feedback' => $row->script_feedback,
            'video_feedback' => $row->video_feedback,
            'revision_details' => $row->revision_details,
            'script_submitted_at' => $row->script_submitted_at,
            'video_submitted_at' => $row->video_submitted_at,
            'script_version' => $content?->script_version ?? 0,
            'video_version' => $content?->video_version ?? 0,
            'submission_versions' => $content?->submission_versions,
            'revision_history' => $content?->revision_history,
            'story_prints' => $content?->story_prints,
            'metrics' => $content?->metrics,
        ])->save();
    }

    private function demandReady(CampaignCreator $row, CampaignDemand $demand): bool
    {
        $delivery = $demand->delivery_status instanceof DeliveryStatus
            ? $demand->delivery_status->value
            : (string) $demand->delivery_status;
        if (in_array($delivery, [DeliveryStatus::Approved->value, DeliveryStatus::Published->value], true)) {
            return true;
        }

        if (in_array((string) $demand->content_type, self::LIVE_TYPES, true)) {
            return false;
        }

        $flow = $row->campaign?->approval_flow;
        $flowValue = $flow instanceof ApprovalFlowType ? $flow->value : (string) ($flow ?? ApprovalFlowType::ScriptAndVideo->value);
        $script = $demand->script_status instanceof StageApprovalStatus ? $demand->script_status->value : (string) $demand->script_status;
        $video = $demand->video_status instanceof StageApprovalStatus ? $demand->video_status->value : (string) $demand->video_status;
        $scriptApproved = $script === StageApprovalStatus::Approved->value;
        $videoApproved = $video === StageApprovalStatus::Approved->value;
        $scriptOnly = $flowValue === 'script_only';
        $staged = $flowValue !== 'video_only';

        if ($videoApproved && (! $staged || $scriptApproved || $scriptOnly)) {
            return true;
        }

        return $scriptOnly && $scriptApproved;
    }

    /**
     * @param  Collection<int, mixed>  $statuses
     */
    private function rollupStage(Collection $statuses): StageApprovalStatus
    {
        $values = $statuses->map(fn ($status) => $status instanceof StageApprovalStatus ? $status->value : (string) $status);
        if ($values->contains(StageApprovalStatus::Revision->value)) {
            return StageApprovalStatus::Revision;
        }
        if ($values->contains(StageApprovalStatus::Submitted->value)) {
            return StageApprovalStatus::Submitted;
        }
        if ($values->isNotEmpty() && $values->every(fn ($value) => $value === StageApprovalStatus::Approved->value)) {
            return StageApprovalStatus::Approved;
        }

        return StageApprovalStatus::Pending;
    }

    /**
     * @param  Collection<int, CampaignDemand>  $demands
     */
    private function rollupDelivery(Collection $demands): DeliveryStatus
    {
        $values = $demands->map(fn (CampaignDemand $demand) => $demand->delivery_status instanceof DeliveryStatus
            ? $demand->delivery_status->value
            : (string) $demand->delivery_status);

        if ($values->contains(DeliveryStatus::Revision->value)) {
            return DeliveryStatus::Revision;
        }
        if ($values->contains(DeliveryStatus::Sent->value)) {
            return DeliveryStatus::Sent;
        }
        if ($values->isNotEmpty() && $values->every(fn ($value) => $value === DeliveryStatus::Published->value)) {
            return DeliveryStatus::Published;
        }
        if ($values->isNotEmpty() && $values->every(fn ($value) => in_array($value, [DeliveryStatus::Approved->value, DeliveryStatus::Published->value], true))) {
            return DeliveryStatus::Approved;
        }

        return DeliveryStatus::Pending;
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @return array<string, mixed>
     */
    private function moveEmptyStageRevisionToPauta(CampaignDemand $demand, array $attributes, string $stage): array
    {
        $statusKey = $stage === 'script' ? 'script_status' : 'video_status';
        if (! NotificationService::is($attributes[$statusKey] ?? null, StageApprovalStatus::Revision)) {
            return $attributes;
        }
        if ($stage === 'script' ? $this->demandHasScript($demand, $attributes) : $this->demandHasVideo($demand, $attributes)) {
            return $attributes;
        }

        $feedbackKey = $stage === 'script' ? 'script_feedback' : 'video_feedback';
        $note = trim((string) ($attributes[$feedbackKey] ?? $attributes['revision_details'] ?? ''));
        unset($attributes[$feedbackKey]);
        $attributes[$statusKey] = StageApprovalStatus::Pending->value;
        $attributes[$feedbackKey] = null;

        $otherStatus = $stage === 'script' ? 'video_status' : 'script_status';
        $otherIsRevision = NotificationService::is($attributes[$otherStatus] ?? null, StageApprovalStatus::Revision)
            || $this->statusValue($demand->{$otherStatus}) === StageApprovalStatus::Revision->value;
        $deliveryIsRevision = NotificationService::is($attributes['delivery_status'] ?? null, DeliveryStatus::Revision)
            || $this->statusValue($demand->delivery_status) === DeliveryStatus::Revision->value;
        if (! $otherIsRevision && $deliveryIsRevision) {
            $attributes['delivery_status'] = DeliveryStatus::Pending->value;
            $attributes['revision_details'] = null;
        } elseif (! $otherIsRevision) {
            unset($attributes['delivery_status'], $attributes['revision_details']);
        }

        if ($note !== '') {
            $attributes['pauta'] = $this->appendPauta($attributes['pauta'] ?? $demand->pauta, $note);
        }

        if ($stage === 'video' && $this->approvedScriptWithoutSubmission($demand, $attributes)) {
            $attributes['script_status'] = StageApprovalStatus::Pending->value;
        }

        return $attributes;
    }

    private function releaseStoredRevisionWithoutSubmission(CampaignDemand $demand): bool
    {
        $changed = false;
        $history = is_array($demand->revision_history) ? $demand->revision_history : [];

        if ($this->statusValue($demand->video_status) === StageApprovalStatus::Revision->value && ! $this->demandHasVideo($demand)) {
            $note = $this->storedRevisionNote($demand, 'video');
            if ($note !== '') {
                $demand->pauta = $this->appendPauta($demand->pauta, $note);
            }
            $history = $this->withoutStage($history, 'video');
            $demand->video_status = StageApprovalStatus::Pending;
            $demand->video_feedback = null;
            if ($this->approvedScriptWithoutSubmission($demand)) {
                $demand->script_status = StageApprovalStatus::Pending;
            }
            if ($this->statusValue($demand->script_status) !== StageApprovalStatus::Revision->value
                && $this->statusValue($demand->delivery_status) === DeliveryStatus::Revision->value) {
                $demand->delivery_status = DeliveryStatus::Pending;
                $demand->revision_details = null;
            }
            $changed = true;
        }

        if ($this->statusValue($demand->script_status) === StageApprovalStatus::Revision->value && ! $this->demandHasScript($demand)) {
            $note = $this->storedRevisionNote($demand, 'script');
            if ($note !== '') {
                $demand->pauta = $this->appendPauta($demand->pauta, $note);
            }
            $history = $this->withoutStage($history, 'script');
            $demand->script_status = StageApprovalStatus::Pending;
            $demand->script_feedback = null;
            if ($this->statusValue($demand->video_status) !== StageApprovalStatus::Revision->value
                && $this->statusValue($demand->delivery_status) === DeliveryStatus::Revision->value) {
                $demand->delivery_status = DeliveryStatus::Pending;
                $demand->revision_details = null;
            }
            $changed = true;
        }

        if (! $changed) {
            return false;
        }

        $demand->revision_history = $history;
        $demand->save();

        return true;
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    /**
     * @param  array<string, mixed>  $attributes
     */
    private function approvedScriptWithoutSubmission(CampaignDemand $demand, array $attributes = []): bool
    {
        if ($this->demandHasScript($demand, $attributes)) {
            return false;
        }

        return $this->statusValue($attributes['script_status'] ?? $demand->script_status) === StageApprovalStatus::Approved->value;
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function demandHasScript(CampaignDemand $demand, array $attributes = []): bool
    {
        return filled($demand->script)
            || filled($demand->script_file_url)
            || filled($demand->script_submitted_at)
            || filled($attributes['script'] ?? null)
            || filled($attributes['script_file_url'] ?? null);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function demandHasVideo(CampaignDemand $demand, array $attributes = []): bool
    {
        return filled($demand->video_url)
            || filled($demand->image_url)
            || filled($demand->published_link)
            || filled($demand->video_submitted_at)
            || filled($attributes['video_url'] ?? null)
            || filled($attributes['image_url'] ?? null)
            || filled($attributes['published_link'] ?? null);
    }

    private function storedRevisionNote(CampaignDemand $demand, string $stage): string
    {
        $feedback = $stage === 'script' ? $demand->script_feedback : $demand->video_feedback;
        $direct = trim((string) $feedback);
        $history = is_array($demand->revision_history) ? $demand->revision_history : [];
        $notes = [];
        foreach ($history as $entry) {
            if (! is_array($entry) || ($entry['stage'] ?? '') !== $stage) {
                continue;
            }
            $note = trim((string) ($entry['note'] ?? ''));
            if ($note !== '' && ! in_array($note, $notes, true)) {
                $notes[] = $note;
            }
        }
        $otherStage = $stage === 'script' ? 'video' : 'script';
        $otherStatus = $otherStage === 'script' ? $demand->script_status : $demand->video_status;
        $details = $this->statusValue($otherStatus) === StageApprovalStatus::Revision->value
            ? ''
            : trim((string) $demand->revision_details);
        if ($direct !== '') {
            array_unshift($notes, $direct);
        }
        if ($details !== '') {
            $notes[] = $details;
        }

        $unique = [];
        foreach ($notes as $note) {
            if ($note !== '' && ! in_array($note, $unique, true)) {
                $unique[] = $note;
            }
        }

        return implode("\n\n", $unique);
    }

    /**
     * @param  list<mixed>  $history
     * @return list<mixed>
     */
    private function withoutStage(array $history, string $stage): array
    {
        return array_values(array_filter(
            $history,
            fn ($entry) => ! is_array($entry) || ($entry['stage'] ?? '') !== $stage,
        ));
    }

    private function appendPauta(mixed $current, string $note): string
    {
        $note = trim($note);
        $current = trim((string) $current);
        if ($note === '' || $current === $note || ($current !== '' && str_contains($current, $note))) {
            return $current;
        }

        return $current === '' ? $note : $current."\n\n".$note;
    }

    private function statusValue(mixed $status): string
    {
        if ($status instanceof StageApprovalStatus || $status instanceof DeliveryStatus) {
            return $status->value;
        }

        return (string) ($status ?? '');
    }

    private function statusMoved(mixed $status): bool
    {
        $value = $status instanceof StageApprovalStatus ? $status->value : (string) ($status ?? '');

        return $value !== '' && $value !== StageApprovalStatus::Pending->value;
    }

    private function deliveryMoved(mixed $status): bool
    {
        $value = $status instanceof DeliveryStatus ? $status->value : (string) ($status ?? '');

        return $value !== '' && $value !== DeliveryStatus::Pending->value;
    }
}
