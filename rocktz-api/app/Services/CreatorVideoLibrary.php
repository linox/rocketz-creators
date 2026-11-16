<?php

namespace App\Services;

use App\Enums\CreatorVideoSource;
use App\Enums\CreatorVideoUsageKind;
use App\Enums\CreatorVideoUsageSource;
use App\Enums\UserRole;
use App\Models\CampaignCreatorContent;
use App\Models\CampaignDemand;
use App\Models\ContentPlanningItem;
use App\Models\CreatorVideo;
use App\Models\CreatorVideoUsage;
use App\Models\User;
use App\Support\SafeHttpUrl;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

class CreatorVideoLibrary
{
    public function syncVisible(User $user): void
    {
        $this->demandQuery($user)
            ->with(['campaignCreator.campaign', 'campaignCreator.creator'])
            ->orderBy('id')
            ->each(fn (CampaignDemand $demand) => $this->ingestDemand($demand));

        $this->planningQuery($user)
            ->with(['recurringContract'])
            ->orderBy('id')
            ->each(fn (ContentPlanningItem $item) => $this->ingestPlanningItem($item));

        $this->ingestLegacyContents($user);
    }

    private function ingestDemand(CampaignDemand $demand): void
    {
        $url = trim((string) $demand->video_url);
        $participation = $demand->campaignCreator;
        if (! $participation || ! $participation->creator_id || ! $this->looksLikeVideo($url)) {
            return;
        }

        $video = $this->persist(CreatorVideo::query()->firstOrNew([
            'campaign_demand_id' => $demand->id,
        ]), [
            'creator_id' => $participation->creator_id,
            'company_id' => $participation->campaign?->company_id,
            'campaign_id' => $participation->campaign_id,
            'recurring_contract_id' => null,
            'campaign_demand_id' => $demand->id,
            'content_planning_item_id' => null,
            'campaign_creator_content_id' => null,
            'content_type' => $demand->content_type,
            'position' => $demand->position,
            'title' => $this->formatLabel($demand->content_type, (int) $demand->position),
            'video_url' => $url,
            'video_file_size' => $demand->video_file_size,
            'source' => CreatorVideoSource::Campaign,
        ], $demand->video_submitted_at ?? $demand->updated_at);

        $this->rememberPost($video, $demand->published_link, $demand->updated_at);
    }

    private function ingestPlanningItem(ContentPlanningItem $item): void
    {
        $url = $this->planningVideoUrl($item);
        if (! $item->creator_id || $url === null) {
            return;
        }

        $type = $item->content_type instanceof \BackedEnum ? $item->content_type->value : (string) $item->content_type;
        $title = trim((string) $item->title);
        if ($title === '') {
            $title = $this->formatLabel($type, null);
        }

        $video = $this->persist(CreatorVideo::query()->firstOrNew([
            'content_planning_item_id' => $item->id,
        ]), [
            'creator_id' => $item->creator_id,
            'company_id' => $item->company_id ?: $item->recurringContract?->company_id,
            'campaign_id' => null,
            'recurring_contract_id' => $item->recurring_contract_id,
            'campaign_demand_id' => null,
            'content_planning_item_id' => $item->id,
            'campaign_creator_content_id' => null,
            'content_type' => $type,
            'position' => null,
            'title' => $title,
            'video_url' => $url,
            'video_file_size' => null,
            'source' => CreatorVideoSource::Recurring,
        ], $item->video_submitted_at ?? $item->submitted_at ?? $item->updated_at);

        $this->rememberPost($video, $item->published_url, $item->updated_at);
    }

    private function ingestLegacyContents(User $user): void
    {
        $contents = $this->contentQuery($user)
            ->with(['campaignCreator.campaign'])
            ->orderBy('id')
            ->get();
        if ($contents->isEmpty()) {
            return;
        }

        $covered = CampaignDemand::query()
            ->whereIn('campaign_creator_id', $contents->pluck('campaign_creator_id'))
            ->whereNotNull('video_url')
            ->where('video_url', '!=', '')
            ->pluck('campaign_creator_id')
            ->all();
        $covered = array_fill_keys($covered, true);

        foreach ($contents as $content) {
            if (isset($covered[$content->campaign_creator_id])) {
                continue;
            }
            $this->ingestContent($content);
        }
    }

    private function ingestContent(CampaignCreatorContent $content): void
    {
        $url = trim((string) $content->video_url);
        $participation = $content->campaignCreator;
        if (! $participation || ! $participation->creator_id || ! $this->looksLikeVideo($url)) {
            return;
        }

        $type = trim((string) $participation->delivery_type) ?: 'video';
        $video = $this->persist(CreatorVideo::query()->firstOrNew([
            'campaign_creator_content_id' => $content->id,
        ]), [
            'creator_id' => $participation->creator_id,
            'company_id' => $participation->campaign?->company_id,
            'campaign_id' => $participation->campaign_id,
            'recurring_contract_id' => null,
            'campaign_demand_id' => null,
            'content_planning_item_id' => null,
            'campaign_creator_content_id' => $content->id,
            'content_type' => $type,
            'position' => null,
            'title' => $this->formatLabel($type, null),
            'video_url' => $url,
            'video_file_size' => $content->video_file_size,
            'source' => CreatorVideoSource::Campaign,
        ], $participation->video_submitted_at ?? $content->updated_at);

        $this->rememberPost($video, $content->published_link, $content->updated_at);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function persist(CreatorVideo $video, array $attributes, mixed $receivedAt): CreatorVideo
    {
        $nextUrl = (string) $attributes['video_url'];
        $urlChanged = $video->exists && $video->video_url !== $nextUrl;
        $video->fill($attributes);
        if (! $video->received_at || $urlChanged) {
            $video->received_at = $receivedAt instanceof CarbonInterface ? $receivedAt : ($receivedAt ? Carbon::parse($receivedAt) : now());
        }
        if ($video->isDirty()) {
            $video->save();
        }

        return $video;
    }

    private function rememberPost(CreatorVideo $video, mixed $url, mixed $when): void
    {
        $link = trim((string) $url);
        if ($link === '' || ! SafeHttpUrl::isValid($link)) {
            return;
        }

        $fingerprint = 'posted:'.hash('sha256', $link);
        $dismissed = $video->dismissed_fingerprints ?? [];
        if (in_array($fingerprint, $dismissed, true)) {
            return;
        }

        CreatorVideoUsage::query()->firstOrCreate(
            [
                'creator_video_id' => $video->id,
                'fingerprint' => $fingerprint,
            ],
            [
                'kind' => CreatorVideoUsageKind::Posted,
                'url' => $link,
                'source' => CreatorVideoUsageSource::Auto,
                'occurred_at' => $when instanceof CarbonInterface ? $when : ($when ? Carbon::parse($when) : now()),
            ],
        );
    }

    public function formatLabel(?string $type, ?int $position): string
    {
        $type = trim((string) $type);
        $format = $type;
        if ($type !== '') {
            $key = 'auth.campaign_demand_formats.'.$type;
            $translated = __($key);
            $format = $translated === $key ? str_replace('_', ' ', $type) : $translated;
        }

        return trim($format.' '.($position ?: ''));
    }

    private function planningVideoUrl(ContentPlanningItem $item): ?string
    {
        foreach ([$item->media_url, $item->submission_url] as $candidate) {
            $url = trim((string) $candidate);
            if ($this->looksLikeVideo($url)) {
                return $url;
            }
        }

        return null;
    }

    private function looksLikeVideo(string $url): bool
    {
        if ($url === '') {
            return false;
        }

        return preg_match('/\.(pdf|docx?|txt|jpe?g|png|gif|webp|avif|heic|svg)(\?|#|$)/i', $url) !== 1;
    }

    /**
     * @return Builder<CampaignDemand>
     */
    private function demandQuery(User $user): Builder
    {
        $query = CampaignDemand::query()
            ->whereNotNull('video_url')
            ->where('video_url', '!=', '');

        if ($user->role === UserRole::Company) {
            $companyId = $user->actingCompanyId() ?? 0;
            $query->whereHas('campaignCreator.campaign', fn (Builder $campaign) => $campaign->where('company_id', $companyId));
        } elseif ($user->role === UserRole::Creator) {
            $creatorId = $user->creator?->id ?? 0;
            $query->whereHas('campaignCreator', fn (Builder $row) => $row->where('creator_id', $creatorId));
        } elseif ($user->role !== UserRole::Admin) {
            abort(403, __('auth.forbidden'));
        }

        return $query;
    }

    /**
     * @return Builder<ContentPlanningItem>
     */
    private function planningQuery(User $user): Builder
    {
        $query = ContentPlanningItem::query()
            ->where(function (Builder $rows) {
                $rows->where(fn (Builder $inner) => $inner->whereNotNull('media_url')->where('media_url', '!=', ''))
                    ->orWhere(fn (Builder $inner) => $inner->whereNotNull('submission_url')->where('submission_url', '!=', ''));
            });

        if ($user->role === UserRole::Company) {
            $query->where('company_id', $user->actingCompanyId() ?? 0);
        } elseif ($user->role === UserRole::Creator) {
            $query->where('creator_id', $user->creator?->id ?? 0);
        } elseif ($user->role !== UserRole::Admin) {
            abort(403, __('auth.forbidden'));
        }

        return $query;
    }

    /**
     * @return Builder<CampaignCreatorContent>
     */
    private function contentQuery(User $user): Builder
    {
        $query = CampaignCreatorContent::query()
            ->whereNotNull('video_url')
            ->where('video_url', '!=', '');

        if ($user->role === UserRole::Company) {
            $companyId = $user->actingCompanyId() ?? 0;
            $query->whereHas('campaignCreator.campaign', fn (Builder $campaign) => $campaign->where('company_id', $companyId));
        } elseif ($user->role === UserRole::Creator) {
            $creatorId = $user->creator?->id ?? 0;
            $query->whereHas('campaignCreator', fn (Builder $row) => $row->where('creator_id', $creatorId));
        } elseif ($user->role !== UserRole::Admin) {
            abort(403, __('auth.forbidden'));
        }

        return $query;
    }
}
