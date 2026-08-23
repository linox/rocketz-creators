<?php

namespace App\Services;

use App\Exceptions\SocialMetricsException;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\CampaignCreatorContent;
use App\Models\ContentPlanningItem;
use App\Models\Creator;
use App\Models\RecurringContract;
use App\Services\SocialMetrics\PostSnapshot;
use App\Support\PostLink;
use App\Support\SocialNumbers;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class PostMetricsService
{
    private const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

    private const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

    private const IG_APP_ID = '936619743392459';

    /**
     * @return array<int, array<string, mixed>>
     */
    public function sync(Campaign $campaign, ?int $campaignCreatorId = null, bool $force = false): array
    {
        $campaign->loadMissing(['campaignCreators.creator', 'campaignCreators.content']);

        $rows = $campaign->campaignCreators->filter(function (CampaignCreator $row) use ($campaignCreatorId) {
            if ($campaignCreatorId && (int) $row->id !== $campaignCreatorId) {
                return false;
            }

            return filled($row->content?->published_link);
        })->values();

        if ($campaignCreatorId && $rows->isEmpty()) {
            throw new SocialMetricsException(__('auth.post_metrics_link_required'));
        }

        if ($rows->isEmpty()) {
            throw new SocialMetricsException(__('auth.post_metrics_none'));
        }

        $results = [];
        $synced = 0;

        foreach ($rows as $row) {
            $link = (string) $row->content->published_link;
            $parsed = PostLink::parse($link);

            if ($parsed === null) {
                $results[$row->id] = [
                    'ok' => false,
                    'message' => __('auth.post_metrics_unsupported'),
                ];

                continue;
            }

            try {
                $snapshot = $this->snapshotFor($parsed, $this->followersFromCreator($row->creator, $parsed->network), $force);
                $this->persist($row->content, $snapshot);
                $results[$row->id] = $snapshot->toSyncResult();
                $synced++;
                $this->pauseBetweenFetches(! $snapshot->cached);
            } catch (SocialMetricsException $e) {
                $results[$row->id] = [
                    'ok' => false,
                    'message' => $e->getMessage(),
                ];
            }
        }

        if ($synced === 0) {
            $firstError = collect($results)->pluck('message')->filter()->first()
                ?: __('auth.post_metrics_unavailable');

            throw new SocialMetricsException($firstError);
        }

        return $results;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function syncPlanning(RecurringContract $contract, ?string $month = null, ?int $itemId = null, bool $force = false): array
    {
        $contract->loadMissing(['contentPlanningItems.creator']);

        $rows = $contract->contentPlanningItems->filter(function (ContentPlanningItem $item) use ($month, $itemId) {
            if ($itemId && (int) $item->id !== $itemId) {
                return false;
            }

            if ($month && $item->month !== $month) {
                return false;
            }

            return filled($item->published_url);
        })->values();

        if ($itemId && $rows->isEmpty()) {
            throw new SocialMetricsException(__('auth.post_metrics_link_required'));
        }

        if ($rows->isEmpty()) {
            throw new SocialMetricsException(__('auth.post_metrics_none'));
        }

        $results = [];
        $synced = 0;

        foreach ($rows as $item) {
            $link = (string) $item->published_url;
            $parsed = PostLink::parse($link);

            if ($parsed === null) {
                $results[$item->id] = [
                    'ok' => false,
                    'message' => __('auth.post_metrics_unsupported'),
                ];

                continue;
            }

            try {
                $snapshot = $this->snapshotFor($parsed, $this->followersFromCreator($item->creator, $parsed->network), $force);
                $this->persist($item, $snapshot);
                $results[$item->id] = $snapshot->toSyncResult();
                $synced++;
                $this->pauseBetweenFetches(! $snapshot->cached);
            } catch (SocialMetricsException $e) {
                $results[$item->id] = [
                    'ok' => false,
                    'message' => $e->getMessage(),
                ];
            }
        }

        if ($synced === 0) {
            $firstError = collect($results)->pluck('message')->filter()->first()
                ?: __('auth.post_metrics_unavailable');

            throw new SocialMetricsException($firstError);
        }

        return $results;
    }

    private function snapshotFor(PostLink $link, ?int $followers, bool $force): PostSnapshot
    {
        if (! $force) {
            $cached = Cache::get($link->cacheKey());
            if (is_array($cached)) {
                return $this->withEngagement(PostSnapshot::fromArray($cached, cached: true), $followers);
            }
        }

        $snapshot = $this->withEngagement($this->fetch($link), $followers);
        Cache::put($link->cacheKey(), $snapshot->toArray(), now()->addHours($this->cacheHours()));

        return $snapshot;
    }

    private function fetch(PostLink $link): PostSnapshot
    {
        $snapshot = match ($link->network) {
            'instagram' => $this->fetchInstagram($link),
            'tiktok' => $this->fetchTikTok($link),
            'youtube' => $this->fetchYouTube($link),
            default => throw new SocialMetricsException(__('auth.post_metrics_unsupported')),
        };

        if (! $snapshot->hasStats()) {
            throw new SocialMetricsException(__('auth.post_metrics_unavailable'));
        }

        return $snapshot;
    }

    private function fetchInstagram(PostLink $link): PostSnapshot
    {
        $likes = null;
        $comments = null;
        $views = null;
        $handle = $link->handle;

        $urls = array_values(array_unique(array_filter([
            $link->url,
            'https://www.instagram.com/p/'.$link->id.'/',
            'https://www.instagram.com/reel/'.$link->id.'/',
        ])));

        foreach ($urls as $url) {
            try {
                $html = $this->requestHtml($url, [
                    'Accept-Language' => 'en-US,en;q=0.9',
                    'X-IG-App-ID' => self::IG_APP_ID,
                    'Referer' => 'https://www.instagram.com/',
                ], self::MOBILE_UA);
            } catch (SocialMetricsException) {
                continue;
            }

            if ($likes === null || $comments === null) {
                [$pageLikes, $pageComments] = $this->parseInstagramDescription($html);
                $likes ??= $pageLikes;
                $comments ??= $pageComments;
            }

            $views ??= $this->parseInstagramViews($html);
            if ($handle === '') {
                $handle = $this->instagramHandleFromHtml($html);
            }

            if ($likes !== null && $comments !== null) {
                break;
            }
        }

        $views ??= $this->instagramViewsFromEmbed($link);

        if ($handle !== '') {
            [$profileLikes, $profileComments, $profileViews] = $this->instagramStatsFromProfile($handle, $link->id);
            $likes ??= $profileLikes;
            $comments ??= $profileComments;
            $views ??= $profileViews;
        }

        return new PostSnapshot(
            network: 'instagram',
            url: $link->url,
            likes: $likes,
            comments: $comments,
            views: $views,
        );
    }

    private function instagramViewsFromEmbed(PostLink $link): ?int
    {
        $urls = [
            'https://www.instagram.com/p/'.$link->id.'/embed/captioned/',
            'https://www.instagram.com/reel/'.$link->id.'/embed/captioned/',
        ];

        foreach ($urls as $url) {
            try {
                $html = $this->requestHtml($url, [
                    'Accept-Language' => 'en-US,en;q=0.9',
                    'X-IG-App-ID' => self::IG_APP_ID,
                    'Referer' => 'https://www.instagram.com/p/'.$link->id.'/',
                ], self::MOBILE_UA);
            } catch (SocialMetricsException) {
                continue;
            }

            $views = $this->parseInstagramViews($html);
            if ($views !== null) {
                return $views;
            }
        }

        return null;
    }

    private function parseInstagramViews(string $html): ?int
    {
        return SocialNumbers::intOrNull($this->matchFirst($html, [
            '/video_play_count\\\\":(\d+)/',
            '/"video_play_count"\s*:\s*"?(\d+)/',
            '/video_view_count\\\\":(\d+)/',
            '/"video_view_count"\s*:\s*"?(\d+)/',
            '/play_count\\\\":(\d+)/',
            '/"play_count"\s*:\s*"?(\d+)/',
        ]));
    }

    /**
     * @return array{0: int|null, 1: int|null}
     */
    private function parseInstagramDescription(string $html): array
    {
        $description = $this->matchFirst($html, [
            '/property="og:description"\s+content="([^"]+)"/',
            '/content="([^"]+)"\s+property="og:description"/',
            '/name="description"\s+content="([^"]+)"/',
            '/content="([^"]+)"\s+name="description"/',
        ]);
        $description = html_entity_decode((string) $description, ENT_QUOTES | ENT_HTML5, 'UTF-8');

        $likes = SocialNumbers::parseCompact($this->matchFirst($description, [
            '/([\d][\d.,]*\s*(?:[kmb]|mil)?)\s+(?:likes?|curtidas?|me\s*gusta)/iu',
        ]));
        $comments = SocialNumbers::parseCompact($this->matchFirst($description, [
            '/([\d][\d.,]*\s*(?:[kmb]|mil)?)\s+(?:comments?|coment[aá]rios?)/iu',
        ]));

        $likes ??= SocialNumbers::intOrNull($this->matchFirst($html, [
            '/"like_count"\s*:\s*(\d+)/',
            '/"edge_liked_by"\s*:\s*\{\s*"count"\s*:\s*(\d+)/',
            '/"edge_media_preview_like"\s*:\s*\{\s*"count"\s*:\s*(\d+)/',
        ]));
        $comments ??= SocialNumbers::intOrNull($this->matchFirst($html, [
            '/"comment_count"\s*:\s*(\d+)/',
            '/"edge_media_to_comment"\s*:\s*\{\s*"count"\s*:\s*(\d+)/',
        ]));

        return [$likes, $comments];
    }

    private function instagramHandleFromHtml(string $html): string
    {
        $ogUrl = $this->matchFirst($html, ['/property="og:url" content="([^"]+)"/']);
        $parsed = PostLink::parse(html_entity_decode((string) $ogUrl, ENT_QUOTES | ENT_HTML5, 'UTF-8'));

        if ($parsed?->handle) {
            return $parsed->handle;
        }

        if (preg_match('/\s-\s@?([A-Za-z0-9._]+)\s+on\s+/i', $html, $match)) {
            return $match[1];
        }

        return '';
    }

    /**
     * @return array{0: int|null, 1: int|null, 2: int|null}
     */
    private function instagramStatsFromProfile(string $handle, string $shortcode): array
    {
        $profileUrl = 'https://www.instagram.com/'.$handle.'/';
        $infoUrl = 'https://www.instagram.com/api/v1/users/web_profile_info/?username='.rawurlencode($handle);

        try {
            $response = $this->http()
                ->withHeaders([
                    'Accept' => 'application/json, text/plain, */*',
                    'Accept-Language' => 'en-US,en;q=0.9,pt-BR;q=0.8',
                    'X-IG-App-ID' => self::IG_APP_ID,
                    'Referer' => $profileUrl,
                    'Origin' => 'https://www.instagram.com',
                ])
                ->get($infoUrl);
        } catch (\Throwable) {
            return [null, null, null];
        }

        if (! $response->successful()) {
            return [null, null, null];
        }

        $json = $response->json();
        $edges = array_merge(
            data_get($json, 'data.user.edge_owner_to_timeline_media.edges', []) ?: [],
            data_get($json, 'data.user.edge_felix_video_timeline.edges', []) ?: [],
        );

        foreach ($edges as $edge) {
            $node = is_array($edge) ? ($edge['node'] ?? $edge) : [];
            if (! is_array($node) || ($node['shortcode'] ?? '') !== $shortcode) {
                continue;
            }

            return [
                SocialNumbers::intOrNull(data_get($node, 'edge_liked_by.count') ?? data_get($node, 'edge_media_preview_like.count')),
                SocialNumbers::intOrNull(data_get($node, 'edge_media_to_comment.count')),
                SocialNumbers::intOrNull($node['video_play_count'] ?? $node['video_view_count'] ?? $node['videoPlayCount'] ?? $node['ig_play_count'] ?? $node['play_count'] ?? null),
            ];
        }

        return [null, null, null];
    }

    private function fetchTikTok(PostLink $link): PostSnapshot
    {
        $videoId = preg_match('/^\d{15,}$/', $link->id) ? $link->id : null;
        $seen = [];
        $attempts = [$link->url, $link->canonicalUrl()];
        if ($link->handle !== '' && $videoId) {
            $attempts[] = 'https://www.tiktok.com/@'.$link->handle.'/photo/'.$videoId;
            $attempts[] = 'https://www.tiktok.com/@'.$link->handle.'/video/'.$videoId;
        }

        foreach ($attempts as $url) {
            if ($url === '' || isset($seen[$url])) {
                continue;
            }
            $seen[$url] = true;

            try {
                [$html, $finalUrl] = $this->requestPage($url, userAgent: self::MOBILE_UA);
            } catch (SocialMetricsException) {
                continue;
            }

            $videoId = $this->tiktokVideoId($html, $finalUrl) ?? $videoId;
            $snapshot = $this->parseTikTokHtml($link->url, $html);
            if ($snapshot->hasStats()) {
                return $snapshot;
            }
        }

        if ($videoId) {
            try {
                $html = $this->requestHtml('https://www.tiktok.com/embed/v2/'.$videoId, userAgent: self::BROWSER_UA);
                $snapshot = $this->parseTikTokHtml($link->url, $html);
                if ($snapshot->hasStats()) {
                    return $snapshot;
                }
            } catch (SocialMetricsException) {
                // continue to throw below
            }
        }

        throw new SocialMetricsException(__('auth.post_metrics_unavailable'));
    }

    private function tiktokVideoId(string $html, string $finalUrl): ?string
    {
        $candidates = [$finalUrl];
        foreach ([
            '/<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)/i',
            '/property=["\']og:url["\']\s+content=["\']([^"\']+)/i',
            '#https://www\.tiktok\.com/@[^/]+/(?:video|photo)/(\d{15,})#',
        ] as $pattern) {
            if (preg_match($pattern, $html, $match)) {
                $candidates[] = html_entity_decode($match[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
            }
        }

        foreach ($candidates as $candidate) {
            if (preg_match('/^\d{15,}$/', $candidate)) {
                return $candidate;
            }
            $resolved = PostLink::parse($candidate);
            if ($resolved && preg_match('/^\d{15,}$/', $resolved->id)) {
                return $resolved->id;
            }
        }

        return null;
    }

    private function parseTikTokHtml(string $url, string $html): PostSnapshot
    {
        $likes = null;
        $comments = null;
        $views = null;
        $shares = null;

        if (preg_match('/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)<\/script>/s', $html, $match)) {
            $json = json_decode($match[1], true);
            $stats = data_get($json, '__DEFAULT_SCOPE__.webapp.video-detail.itemInfo.itemStruct.stats', []);
            if (! is_array($stats) || $stats === []) {
                $stats = data_get($json, '__DEFAULT_SCOPE__.webapp.video-detail.itemInfo.itemStruct.statsV2', []);
            }
            if (is_array($stats) && $stats !== []) {
                $likes = SocialNumbers::intOrNull($stats['diggCount'] ?? $stats['likeCount'] ?? null);
                $comments = SocialNumbers::intOrNull($stats['commentCount'] ?? null);
                $views = SocialNumbers::intOrNull($stats['playCount'] ?? null);
                $shares = SocialNumbers::intOrNull($stats['shareCount'] ?? null);
            }
        }

        $likes ??= SocialNumbers::intOrNull($this->matchFirst($html, ['/"diggCount"\s*:\s*"?(\d+)"?/', '/"likeCount"\s*:\s*"?(\d+)"?/']));
        $comments ??= SocialNumbers::intOrNull($this->matchFirst($html, ['/"commentCount"\s*:\s*"?(\d+)"?/']));
        $views ??= SocialNumbers::intOrNull($this->matchFirst($html, ['/"playCount"\s*:\s*"?(\d+)"?/']));
        $shares ??= SocialNumbers::intOrNull($this->matchFirst($html, ['/"shareCount"\s*:\s*"?(\d+)"?/']));

        return new PostSnapshot(
            network: 'tiktok',
            url: $url,
            likes: $likes,
            comments: $comments,
            views: $views,
            shares: $shares,
        );
    }

    private function fetchYouTube(PostLink $link): PostSnapshot
    {
        $likes = null;
        $comments = null;
        $views = null;

        $merge = function (?array $stats) use (&$likes, &$comments, &$views): void {
            if ($stats === null) {
                return;
            }
            $likes ??= $stats[0];
            $comments ??= $stats[1];
            $views ??= $stats[2];
        };

        $merge($this->fetchYouTubeDataApi($link));

        if ($views === null || $likes === null || $comments === null) {
            $merge($this->fetchYouTubePublicPages($link));
        }

        if ($views === null || $likes === null || $comments === null) {
            $merge($this->fetchYouTubeInnertube($link));
        }

        return new PostSnapshot(
            network: 'youtube',
            url: $link->canonicalUrl(),
            likes: $likes,
            comments: $comments,
            views: $views,
        );
    }

    /**
     * @return array{0: int|null, 1: int|null, 2: int|null}|null
     */
    private function fetchYouTubeDataApi(PostLink $link): ?array
    {
        $key = trim((string) config('services.social.youtube_api_key'));
        if ($key === '') {
            return null;
        }

        try {
            $response = $this->http()
                ->acceptJson()
                ->get('https://www.googleapis.com/youtube/v3/videos', [
                    'part' => 'statistics',
                    'id' => $link->id,
                    'key' => $key,
                ]);
        } catch (\Throwable) {
            return null;
        }

        if (! $response->successful()) {
            return null;
        }

        $stats = data_get($response->json(), 'items.0.statistics', []);
        if (! is_array($stats) || $stats === []) {
            return null;
        }

        return [
            SocialNumbers::intOrNull($stats['likeCount'] ?? null),
            SocialNumbers::intOrNull($stats['commentCount'] ?? null),
            SocialNumbers::intOrNull($stats['viewCount'] ?? null),
        ];
    }

    /**
     * @return array{0: int|null, 1: int|null, 2: int|null}|null
     */
    private function fetchYouTubePublicPages(PostLink $link): ?array
    {
        $urls = array_values(array_unique(array_filter([
            $link->url,
            $link->canonicalUrl(),
            'https://www.youtube.com/shorts/'.$link->id,
            'https://www.youtube.com/embed/'.$link->id,
        ])));

        $likes = null;
        $comments = null;
        $views = null;

        foreach ($urls as $url) {
            try {
                $html = $this->requestYouTubeHtml($url);
            } catch (SocialMetricsException) {
                continue;
            }

            [$pageLikes, $pageComments, $pageViews] = $this->parseYouTubeStats($html);
            $likes ??= $pageLikes;
            $comments ??= $pageComments;
            $views ??= $pageViews;

            if ($views !== null && $likes !== null && $comments !== null) {
                break;
            }
        }

        if ($likes === null && $comments === null && $views === null) {
            return null;
        }

        return [$likes, $comments, $views];
    }

    /**
     * @return array{0: int|null, 1: int|null, 2: int|null}|null
     */
    private function fetchYouTubeInnertube(PostLink $link): ?array
    {
        $payload = [
            'context' => [
                'client' => [
                    'hl' => 'en',
                    'gl' => 'US',
                    'clientName' => 'WEB',
                    'clientVersion' => '2.20240821.01.00',
                ],
            ],
            'videoId' => $link->id,
        ];

        $likes = null;
        $comments = null;
        $views = null;

        foreach (['player', 'next'] as $endpoint) {
            try {
                $response = $this->http()
                    ->asJson()
                    ->withHeaders([
                        'Origin' => 'https://www.youtube.com',
                        'Referer' => $link->canonicalUrl(),
                    ])
                    ->post('https://www.youtube.com/youtubei/v1/'.$endpoint.'?prettyPrint=false', $payload);
            } catch (\Throwable) {
                continue;
            }

            if (! $response->successful()) {
                continue;
            }

            [$pageLikes, $pageComments, $pageViews] = $this->parseYouTubeStats((string) $response->body());
            $likes ??= $pageLikes;
            $comments ??= $pageComments;
            $views ??= $pageViews;

            if ($views !== null && $likes !== null && $comments !== null) {
                break;
            }
        }

        if ($likes === null && $comments === null && $views === null) {
            return null;
        }

        return [$likes, $comments, $views];
    }

    private function requestYouTubeHtml(string $url): string
    {
        $host = parse_url($url, PHP_URL_HOST) ?: 'www.youtube.com';

        $response = $this->http()
            ->withHeaders([
                'Accept' => 'text/html,application/xhtml+xml',
                'Accept-Language' => 'en-US,en;q=0.9,pt-BR;q=0.8',
            ])
            ->withCookies([
                'CONSENT' => 'YES+1',
                'SOCS' => 'CAISNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjQwODE5LjA3X3AxGgJlbiACGgYIgIu6rgY',
            ], $host)
            ->get($url);

        $this->assertReachable($response);

        return (string) $response->body();
    }

    /**
     * @return array{0: int|null, 1: int|null, 2: int|null}
     */
    private function parseYouTubeStats(string $body): array
    {
        $likes = null;
        $comments = null;
        $views = null;

        $payloads = [];
        $decoded = json_decode($body, true);
        if (is_array($decoded)) {
            $payloads[] = $decoded;
        }
        foreach (['ytInitialPlayerResponse', 'ytInitialData'] as $variable) {
            $embedded = $this->youtubeEmbeddedJson($body, $variable);
            if (is_array($embedded)) {
                $payloads[] = $embedded;
            }
        }

        foreach ($payloads as $payload) {
            [$jsonLikes, $jsonComments, $jsonViews] = $this->statsFromYouTubeJson($payload);
            $likes ??= $jsonLikes;
            $comments ??= $jsonComments;
            $views ??= $jsonViews;
        }

        $views ??= SocialNumbers::intOrNull($this->matchFirst($body, [
            '/"viewCount"\s*:\s*"(\d+)"/',
            '/"viewCount"\s*:\s*(\d+)/',
        ])) ?? SocialNumbers::parseCompact($this->matchFirst($body, [
            '/"viewCount"\s*:\s*\{\s*"simpleText"\s*:\s*"([^"]+)"/',
            '/"shortViewCount"\s*:\s*\{\s*"simpleText"\s*:\s*"([^"]+)"/',
            '/itemprop="interactionCount" content="(\d+)"/',
        ]));

        $likes ??= SocialNumbers::intOrNull($this->matchFirst($body, [
            '/"likeCount"\s*:\s*"(\d+)"/',
            '/"likeCount"\s*:\s*(\d+)/',
        ])) ?? SocialNumbers::parseCompact($this->matchFirst($body, [
            '/along with ([\d.,\s]+) other/i',
            '/"likeCount"\s*:\s*\{\s*"simpleText"\s*:\s*"([^"]+)"/',
            '/"accessibilityText"\s*:\s*"([^"]*(?:likes?|curtidas?)[^"]*)"/i',
            '/"label"\s*:\s*"([^"]*(?:likes?|curtidas?)[^"]*)"/i',
        ]));

        $comments ??= SocialNumbers::intOrNull($this->matchFirst($body, [
            '/"commentCount"\s*:\s*"(\d+)"/',
            '/"commentCount"\s*:\s*(\d+)/',
        ])) ?? SocialNumbers::parseCompact($this->matchFirst($body, [
            '/"commentsCount"\s*:\s*\{\s*"runs"\s*:\s*\[\s*\{\s*"text"\s*:\s*"([^"]+)"/',
            '/"countText"\s*:\s*\{\s*"runs"\s*:\s*\[\s*\{\s*"text"\s*:\s*"([^"]+)"\s*\}\s*,\s*\{\s*"text"\s*:\s*"\s*(?:Comments|coment)/i',
            '/"contextualInfo"\s*:\s*\{\s*"runs"\s*:\s*\[\s*\{\s*"text"\s*:\s*"([\d.,\s]+)"\s*\}\s*\]\s*\}\s*,\s*"menu"/',
            '/"commentCount"\s*:\s*\{\s*"simpleText"\s*:\s*"([^"]+)"/',
            '/"contextualInfo"\s*:\s*"([^"]*(?:comments?|coment[aá]rios?)[^"]*)"/i',
        ]));

        return [$likes, $comments, $views];
    }

    /**
     * @param  array<string, mixed>  $json
     * @return array{0: int|null, 1: int|null, 2: int|null}
     */
    private function statsFromYouTubeJson(array $json): array
    {
        $views = SocialNumbers::intOrNull(data_get($json, 'videoDetails.viewCount'))
            ?? SocialNumbers::intOrNull(data_get($json, 'microformat.playerMicroformatRenderer.viewCount'))
            ?? SocialNumbers::parseCompact((string) data_get($json, 'contents.twoColumnWatchNextResults.results.results.contents.1.videoPrimaryInfoRenderer.viewCount.videoViewCountRenderer.viewCount.simpleText', ''));

        $likes = SocialNumbers::intOrNull($this->youtubeJsonValue($json, 'likeCount'));
        $comments = $this->youtubeCommentsFromJson($json)
            ?? SocialNumbers::intOrNull($this->youtubeJsonValue($json, 'commentCount'));

        if ($likes === null) {
            $likes = SocialNumbers::parseCompact($this->youtubeJsonText($json, '/along with ([\d.,\s]+) other/i'))
                ?? SocialNumbers::parseCompact($this->youtubeJsonText($json, '/([\d][\d.,]*)\s+(?:likes?|curtidas?)/i'));
        }

        if ($comments === null) {
            $comments = SocialNumbers::parseCompact($this->youtubeJsonText($json, '/([\d][\d.,]*)\s+(?:comments?|coment[aá]rios?)/i'));
        }

        return [$likes, $comments, $views];
    }

    /**
     * @param  array<string, mixed>  $json
     */
    private function youtubeCommentsFromJson(array $json): ?int
    {
        $fromHeader = function (?array $header): ?int {
            if ($header === null) {
                return null;
            }

            return SocialNumbers::parseCompact((string) (
                data_get($header, 'commentsCount.runs.0.text')
                    ?? data_get($header, 'commentsCount.simpleText')
                    ?? data_get($header, 'countText.runs.0.text')
                    ?? data_get($header, 'contextualInfo.runs.0.text')
                    ?? data_get($header, 'contextualInfo.simpleText')
                    ?? ''
            ));
        };

        $found = null;
        $walk = function ($node) use (&$walk, &$found, $fromHeader): void {
            if ($found !== null || ! is_array($node)) {
                return;
            }
            if (isset($node['commentsHeaderRenderer']) && is_array($node['commentsHeaderRenderer'])) {
                $found = $fromHeader($node['commentsHeaderRenderer']);
                if ($found !== null) {
                    return;
                }
            }
            foreach ($node as $value) {
                if (is_array($value)) {
                    $walk($value);
                }
            }
        };
        $walk($json);

        if ($found !== null) {
            return $found;
        }

        foreach (data_get($json, 'engagementPanels', []) ?: [] as $panel) {
            if (! is_array($panel)) {
                continue;
            }
            $renderer = data_get($panel, 'engagementPanelSectionListRenderer.header.engagementPanelTitleHeaderRenderer');
            $title = mb_strtolower((string) (
                data_get($renderer, 'title.runs.0.text')
                    ?? data_get($renderer, 'title.simpleText')
                    ?? ''
            ));
            if (! str_contains($title, 'comment') && ! str_contains($title, 'coment')) {
                continue;
            }

            $count = $fromHeader(is_array($renderer) ? $renderer : null);
            if ($count !== null) {
                return $count;
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $json
     */
    private function youtubeJsonValue(array $json, string $key): mixed
    {
        $found = null;
        $walk = function ($node) use (&$walk, &$found, $key): void {
            if ($found !== null || ! is_array($node)) {
                return;
            }
            foreach ($node as $name => $value) {
                if ((string) $name === $key && (is_numeric($value) || (is_string($value) && preg_match('/^\d+$/', $value)))) {
                    $found = $value;

                    return;
                }
                if (is_array($value)) {
                    $walk($value);
                }
            }
        };
        $walk($json);

        return $found;
    }

    /**
     * @param  array<string, mixed>  $json
     */
    private function youtubeJsonText(array $json, string $pattern): ?string
    {
        $found = null;
        $walk = function ($node) use (&$walk, &$found, $pattern): void {
            if ($found !== null) {
                return;
            }
            if (is_string($node) && preg_match($pattern, $node, $match)) {
                $found = $match[1] ?? $match[0];

                return;
            }
            if (! is_array($node)) {
                return;
            }
            foreach ($node as $value) {
                $walk($value);
            }
        };
        $walk($json);

        return $found;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function youtubeEmbeddedJson(string $html, string $variable): ?array
    {
        $needle = $variable.' = ';
        $pos = strpos($html, $needle);
        if ($pos === false) {
            $needle = $variable.'=';
            $pos = strpos($html, $needle);
        }
        if ($pos === false) {
            return null;
        }

        $start = $pos + strlen($needle);
        $length = strlen($html);
        while ($start < $length && $html[$start] !== '{') {
            $start++;
        }
        if ($start >= $length) {
            return null;
        }

        $depth = 0;
        $inString = false;
        $escape = false;
        for ($i = $start; $i < $length; $i++) {
            $char = $html[$i];
            if ($inString) {
                if ($escape) {
                    $escape = false;
                    continue;
                }
                if ($char === '\\') {
                    $escape = true;
                    continue;
                }
                if ($char === '"') {
                    $inString = false;
                }
                continue;
            }
            if ($char === '"') {
                $inString = true;
                continue;
            }
            if ($char === '{') {
                $depth++;
            } elseif ($char === '}') {
                $depth--;
                if ($depth === 0) {
                    $json = json_decode(substr($html, $start, $i - $start + 1), true);

                    return is_array($json) ? $json : null;
                }
            }
        }

        return null;
    }

    private function persist(CampaignCreatorContent|ContentPlanningItem $model, PostSnapshot $snapshot): void
    {
        $metrics = is_array($model->metrics) ? $model->metrics : [];
        foreach ($snapshot->toMetrics() as $key => $value) {
            if ($value !== null || in_array($key, ['network', 'url', 'synced_at'], true)) {
                $metrics[$key] = $value;
            }
        }
        $model->metrics = $metrics;
        $model->save();
    }

    private function withEngagement(PostSnapshot $snapshot, ?int $followers): PostSnapshot
    {
        $interactions = ($snapshot->likes ?? 0) + ($snapshot->comments ?? 0) + ($snapshot->shares ?? 0);
        $engagement = SocialNumbers::engagementPercent($interactions, $followers, 1);

        if ($engagement === null && $snapshot->views) {
            $engagement = round($interactions / $snapshot->views * 100, 2);
        }

        return $snapshot->withEngagement($engagement);
    }

    private function followersFromCreator(?Creator $creator, string $network): ?int
    {
        $metrics = is_array($creator?->metrics) ? $creator->metrics : [];

        return match ($network) {
            'instagram' => SocialNumbers::intOrNull($metrics['instagram_followers'] ?? $metrics['followers'] ?? null),
            'tiktok' => SocialNumbers::intOrNull($metrics['tiktok_followers'] ?? null),
            'youtube' => SocialNumbers::intOrNull($metrics['youtube_followers'] ?? $metrics['youtube_subscribers'] ?? null),
            default => null,
        };
    }

    /**
     * @param  array<string, string>  $headers
     * @return array{0: string, 1: string}
     */
    private function requestPage(string $url, array $headers = [], ?string $userAgent = null): array
    {
        $response = $this->http($userAgent)
            ->withHeaders(array_merge([
                'Accept' => 'text/html,application/xhtml+xml',
                'Accept-Language' => 'en-US,en;q=0.9,pt-BR;q=0.8',
            ], $headers))
            ->get($url);

        $this->assertReachable($response);

        return [(string) $response->body(), (string) $response->effectiveUri()];
    }

    /**
     * @param  array<string, string>  $headers
     */
    private function requestHtml(string $url, array $headers = [], ?string $userAgent = null): string
    {
        [$html] = $this->requestPage($url, $headers, $userAgent);

        return $html;
    }

    private function http(?string $userAgent = null): PendingRequest
    {
        return Http::timeout(12)
            ->connectTimeout(8)
            ->withUserAgent($userAgent ?? self::BROWSER_UA)
            ->withOptions(['allow_redirects' => true]);
    }

    private function assertReachable(Response $response): void
    {
        $status = $response->status();
        $finalUrl = (string) $response->effectiveUri();

        if ($status === 404 || str_contains($finalUrl, '/accounts/login')) {
            throw new SocialMetricsException(__('auth.post_metrics_not_found'));
        }

        if ($status >= 400) {
            throw new SocialMetricsException(__('auth.post_metrics_unavailable'));
        }
    }

    /**
     * @param  list<string>  $patterns
     */
    private function matchFirst(string $html, array $patterns): ?string
    {
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $html, $match)) {
                return html_entity_decode($match[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
            }
        }

        return null;
    }

    private function cacheHours(): int
    {
        return max(1, (int) config('services.social.cache_hours', 24));
    }

    private function pauseBetweenFetches(bool $didFetch): void
    {
        if (! $didFetch) {
            return;
        }

        $ms = max(0, (int) config('services.social.fetch_delay_ms', 400));
        if ($ms > 0) {
            usleep($ms * 1000);
        }
    }
}
