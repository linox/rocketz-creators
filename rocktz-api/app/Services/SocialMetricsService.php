<?php

namespace App\Services;

use App\Exceptions\SocialMetricsException;
use App\Models\Creator;
use App\Services\SocialMetrics\SocialSnapshot;
use App\Support\SocialHandle;
use App\Support\SocialNumbers;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class SocialMetricsService
{
    public const NETWORKS = ['instagram', 'tiktok', 'youtube'];

    private const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

    private const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

    /**
     * @param  array<string, string|null>  $handles
     * @return array<string, array<string, mixed>>
     */
    public function sync(Creator $creator, ?string $network, array $handles = [], bool $force = false): array
    {
        $targets = $network ? [$network] : self::NETWORKS;

        foreach ($targets as $target) {
            if (! in_array($target, self::NETWORKS, true)) {
                throw new SocialMetricsException(__('auth.social_network_unsupported'));
            }
        }

        $socials = $creator->socials ?? [];
        $metrics = $creator->metrics ?? [];
        $results = [];
        $synced = 0;

        foreach ($targets as $target) {
            $handle = SocialHandle::normalize(
                $target,
                $handles[$target] ?? ($socials[$target] ?? null),
            );

            if ($handle === '') {
                $results[$target] = [
                    'ok' => false,
                    'message' => __('auth.social_handle_required'),
                ];

                continue;
            }

            try {
                $snapshot = $this->snapshotFor($target, $handle, $socials, $metrics, $force);
                $this->applySnapshot($socials, $metrics, $snapshot);
                $results[$target] = $snapshot->toSyncResult();
                $synced++;
                $this->pauseBetweenFetches(! $snapshot->cached);
            } catch (SocialMetricsException $e) {
                $results[$target] = [
                    'ok' => false,
                    'message' => $e->getMessage(),
                ];

                if ($network) {
                    throw $e;
                }
            }
        }

        if ($synced === 0) {
            $firstError = collect($results)->pluck('message')->filter()->first()
                ?: __('auth.social_sync_none');

            throw new SocialMetricsException($firstError);
        }

        $creator->socials = $socials;
        $creator->metrics = $metrics;
        $creator->save();

        return $results;
    }

    /**
     * @param  array<string, mixed>  $socials
     * @param  array<string, mixed>  $metrics
     */
    private function snapshotFor(string $network, string $handle, array $socials, array $metrics, bool $force): SocialSnapshot
    {
        $storedHandle = SocialHandle::normalize($network, $socials[$network] ?? null);
        $syncedAt = (int) ($metrics["{$network}_synced_at"] ?? 0);
        $freshAfter = now()->subHours($this->cacheHours())->timestamp;

        if (
            ! $force
            && $storedHandle === $handle
            && $syncedAt >= $freshAfter
            && array_key_exists("{$network}_followers", $metrics)
        ) {
            return new SocialSnapshot(
                network: $network,
                handle: $handle,
                followers: SocialNumbers::intOrNull($metrics["{$network}_followers"] ?? null),
                views: SocialNumbers::intOrNull($metrics["{$network}_views"] ?? null),
                engagement: isset($metrics["{$network}_engagement"]) ? (float) $metrics["{$network}_engagement"] : null,
                cached: true,
            );
        }

        $cacheKey = "social-metrics:{$network}:".mb_strtolower($handle);

        if (! $force) {
            $cached = Cache::get($cacheKey);
            if (is_array($cached)) {
                return SocialSnapshot::fromArray($cached, cached: true);
            }
        }

        $snapshot = $this->fetch($network, $handle);
        Cache::put($cacheKey, $snapshot->toArray(), now()->addHours($this->cacheHours()));

        return $snapshot;
    }

    /**
     * @param  array<string, mixed>  $socials
     * @param  array<string, mixed>  $metrics
     */
    private function applySnapshot(array &$socials, array &$metrics, SocialSnapshot $snapshot): void
    {
        $network = $snapshot->network;
        $socials[$network] = $snapshot->handle;

        if ($snapshot->followers !== null) {
            $metrics["{$network}_followers"] = $snapshot->followers;
            if ($network === 'youtube') {
                $metrics['youtube_subscribers'] = $snapshot->followers;
            }
            if ($network === 'instagram') {
                $metrics['followers'] = $snapshot->followers;
            }
        }

        if ($snapshot->views !== null) {
            $metrics["{$network}_views"] = $snapshot->views;
            if ($network === 'instagram') {
                $metrics['avgViews'] = $snapshot->views;
            }
        }

        if ($snapshot->engagement !== null) {
            $metrics["{$network}_engagement"] = $snapshot->engagement;
            if ($network === 'instagram') {
                $metrics['avgEngagement'] = $snapshot->engagement;
            }
        }

        $metrics["{$network}_synced_at"] = now()->timestamp;
    }

    private function fetch(string $network, string $handle): SocialSnapshot
    {
        if ($this->scrapeCreatorsKey() !== '') {
            return $this->fetchViaScrapeCreators($network, $handle);
        }

        return match ($network) {
            'youtube' => $this->fetchYouTube($handle),
            'instagram' => $this->fetchInstagramPublic($handle),
            'tiktok' => $this->fetchTikTokPublic($handle),
            default => throw new SocialMetricsException(__('auth.social_network_unsupported')),
        };
    }

    private function fetchYouTube(string $handle): SocialSnapshot
    {
        if ($this->youtubeApiKey() !== '') {
            return $this->fetchYouTubeApi($handle);
        }

        return $this->fetchYouTubePublic($handle);
    }

    private function fetchViaScrapeCreators(string $network, string $handle): SocialSnapshot
    {
        $path = match ($network) {
            'instagram' => '/v1/instagram/profile',
            'tiktok' => '/v1/tiktok/profile',
            'youtube' => '/v1/youtube/channel',
            default => throw new SocialMetricsException(__('auth.social_network_unsupported')),
        };

        $query = match ($network) {
            'youtube' => SocialHandle::isYoutubeChannelId($handle)
                ? ['channelId' => $handle]
                : ['handle' => $handle],
            default => ['handle' => $handle],
        };
        $query['cache_max_age'] = '1d';

        $json = $this->requestJson(
            rtrim($this->scrapeCreatorsUrl(), '/').$path.'?'.http_build_query($query),
            ['x-api-key' => $this->scrapeCreatorsKey()],
        );

        return match ($network) {
            'instagram' => $this->snapshotFromInstagramPayload($handle, $json),
            'tiktok' => $this->snapshotFromTikTokPayload($handle, $json),
            'youtube' => $this->snapshotFromYouTubePayload($handle, $json),
            default => throw new SocialMetricsException(__('auth.social_network_unsupported')),
        };
    }

    /**
     * @param  array<string, mixed>  $json
     */
    private function snapshotFromInstagramPayload(string $handle, array $json): SocialSnapshot
    {
        $user = data_get($json, 'data.user', data_get($json, 'user', $json));
        if (! is_array($user)) {
            $user = [];
        }

        $followers = SocialNumbers::intOrNull(
            data_get($user, 'edge_followed_by.count')
                ?? data_get($user, 'follower_count')
                ?? data_get($json, 'follower_count')
        );

        $views = [];
        $likes = [];
        $timeline = data_get($user, 'edge_owner_to_timeline_media.edges', []);
        $reels = data_get($user, 'edge_felix_video_timeline.edges', []);
        $edges = array_merge(is_array($timeline) ? $timeline : [], is_array($reels) ? $reels : []);
        if ($edges !== []) {
            foreach ($edges as $edge) {
                $node = is_array($edge) ? ($edge['node'] ?? $edge) : [];
                if (! is_array($node)) {
                    continue;
                }
                $view = SocialNumbers::intOrNull($node['video_view_count'] ?? $node['videoPlayCount'] ?? $node['play_count'] ?? null);
                if ($view) {
                    $views[] = $view;
                }
                $like = SocialNumbers::intOrNull(
                    data_get($node, 'edge_liked_by.count') ?? data_get($node, 'edge_media_preview_like.count')
                );
                $comments = SocialNumbers::intOrNull(data_get($node, 'edge_media_to_comment.count')) ?? 0;
                if ($like !== null) {
                    $likes[] = $like + $comments;
                }
            }
        }

        if ($followers === null) {
            throw new SocialMetricsException(__('auth.social_profile_unavailable'));
        }

        return new SocialSnapshot(
            network: 'instagram',
            handle: SocialHandle::instagram((string) ($user['username'] ?? $handle)) ?: $handle,
            followers: $followers,
            views: SocialNumbers::average($views),
            engagement: $likes === [] ? null : SocialNumbers::engagementPercent((int) round(array_sum($likes) / count($likes)), $followers, 1),
        );
    }

    /**
     * @param  array<string, mixed>  $json
     */
    private function snapshotFromTikTokPayload(string $handle, array $json): SocialSnapshot
    {
        $stats = data_get($json, 'stats', data_get($json, 'userInfo.stats', []));
        $user = data_get($json, 'user', data_get($json, 'userInfo.user', []));
        $followers = SocialNumbers::intOrNull(is_array($stats) ? ($stats['followerCount'] ?? $stats['follower_count'] ?? null) : null);
        $hearts = SocialNumbers::intOrNull(is_array($stats) ? ($stats['heartCount'] ?? $stats['heart'] ?? null) : null);
        $videos = SocialNumbers::intOrNull(is_array($stats) ? ($stats['videoCount'] ?? null) : null);

        $plays = [];
        $items = data_get($json, 'itemList', data_get($json, 'items', []));
        if (is_array($items)) {
            foreach ($items as $item) {
                $play = SocialNumbers::intOrNull(data_get($item, 'stats.playCount') ?? data_get($item, 'playCount'));
                if ($play) {
                    $plays[] = $play;
                }
            }
        }

        if ($followers === null) {
            throw new SocialMetricsException(__('auth.social_profile_unavailable'));
        }

        $uniqueId = is_array($user) ? (string) ($user['uniqueId'] ?? $handle) : $handle;

        return new SocialSnapshot(
            network: 'tiktok',
            handle: SocialHandle::tiktok($uniqueId) ?: $handle,
            followers: $followers,
            views: SocialNumbers::average($plays),
            engagement: SocialNumbers::engagementPercent($hearts, $followers, $videos),
        );
    }

    /**
     * @param  array<string, mixed>  $json
     */
    private function snapshotFromYouTubePayload(string $handle, array $json): SocialSnapshot
    {
        $followers = SocialNumbers::intOrNull($json['subscriberCount'] ?? $json['subscriber_count'] ?? null)
            ?? SocialNumbers::parseCompact((string) ($json['subscriberCountText'] ?? ''));
        $views = SocialNumbers::intOrNull($json['viewCount'] ?? null)
            ?? SocialNumbers::parseCompact((string) ($json['viewCountText'] ?? ''));
        $videos = SocialNumbers::intOrNull($json['videoCount'] ?? null)
            ?? SocialNumbers::parseCompact((string) ($json['videoCountText'] ?? $json['videosCountText'] ?? ''));

        if ($followers === null) {
            throw new SocialMetricsException(__('auth.social_profile_unavailable'));
        }

        $avgViews = ($views && $videos) ? (int) round($views / max(1, $videos)) : null;
        $resolved = SocialHandle::youtube((string) ($json['channel'] ?? $json['handle'] ?? $handle)) ?: $handle;

        return new SocialSnapshot(
            network: 'youtube',
            handle: $resolved,
            followers: $followers,
            views: $avgViews,
            engagement: null,
        );
    }

    private function fetchYouTubeApi(string $handle): SocialSnapshot
    {
        $query = [
            'part' => 'statistics,snippet',
            'key' => $this->youtubeApiKey(),
        ];
        if (SocialHandle::isYoutubeChannelId($handle)) {
            $query['id'] = $handle;
        } else {
            $query['forHandle'] = $handle;
        }

        $json = $this->requestJson('https://www.googleapis.com/youtube/v3/channels?'.http_build_query($query));
        $item = data_get($json, 'items.0');
        if (! is_array($item)) {
            throw new SocialMetricsException(__('auth.social_profile_not_found'));
        }

        $stats = $item['statistics'] ?? [];
        $followers = SocialNumbers::intOrNull($stats['subscriberCount'] ?? null);
        $views = SocialNumbers::intOrNull($stats['viewCount'] ?? null);
        $videos = SocialNumbers::intOrNull($stats['videoCount'] ?? null);
        $customUrl = ltrim((string) data_get($item, 'snippet.customUrl', $handle), '@');

        if ($followers === null) {
            throw new SocialMetricsException(__('auth.social_profile_unavailable'));
        }

        return new SocialSnapshot(
            network: 'youtube',
            handle: $customUrl !== '' ? $customUrl : $handle,
            followers: $followers,
            views: ($views && $videos) ? (int) round($views / max(1, $videos)) : null,
            engagement: null,
        );
    }

    private function fetchYouTubePublic(string $handle): SocialSnapshot
    {
        $base = SocialHandle::publicUrl('youtube', $handle);
        $html = $this->requestHtml($base.'/about', ['CONSENT' => 'YES+1']);
        $snapshot = $this->parseYouTubeHtml($handle, $html);

        if ($snapshot->followers === null) {
            $html = $this->requestHtml($base, ['CONSENT' => 'YES+1']);
            $snapshot = $this->parseYouTubeHtml($handle, $html);
        }

        if ($snapshot->followers === null) {
            throw new SocialMetricsException(__('auth.social_profile_unavailable'));
        }

        return $snapshot;
    }

    private function parseYouTubeHtml(string $handle, string $html): SocialSnapshot
    {
        $subscribers = SocialNumbers::parseCompact($this->matchFirst($html, [
            '/"subscriberCountText":"([^"]+)"/',
            '/"subscriberCountText":\{"simpleText":"([^"]+)"/',
            '/"subscriberCountText":\{"accessibility":\{"accessibilityData":\{"label":"([^"]+)"/',
        ])) ?? SocialNumbers::intOrNull($this->matchFirst($html, [
            '/"subscriberCount"\s*:\s*"?(\d+)"?/',
        ]));

        $totalViews = SocialNumbers::parseCompact($this->matchFirst($html, [
            '/"viewCountText":"([^"]+)"/',
            '/"viewCountText":\{"simpleText":"([^"]+)"/',
        ])) ?? SocialNumbers::intOrNull($this->matchFirst($html, [
            '/"viewCount"\s*:\s*"(\d+)"/',
        ]));

        $videos = SocialNumbers::parseCompact($this->matchFirst($html, [
            '/"videoCountText":"([^"]+)"/',
            '/"videosCountText":\{"simpleText":"([^"]+)"/',
            '/"videoCountText":\{"simpleText":"([^"]+)"/',
        ])) ?? SocialNumbers::intOrNull($this->matchFirst($html, [
            '/"videoCount"\s*:\s*"(\d+)"/',
        ]));

        return new SocialSnapshot(
            network: 'youtube',
            handle: $handle,
            followers: $subscribers,
            views: ($totalViews && $videos) ? (int) round($totalViews / max(1, $videos)) : null,
            engagement: null,
        );
    }

    private function fetchInstagramPublic(string $handle): SocialSnapshot
    {
        $profileUrl = SocialHandle::publicUrl('instagram', $handle);
        $infoUrl = 'https://www.instagram.com/api/v1/users/web_profile_info/?username='.rawurlencode($handle);

        $response = $this->http()
            ->withHeaders([
                'Accept' => 'application/json, text/plain, */*',
                'Accept-Language' => 'en-US,en;q=0.9,pt-BR;q=0.8',
                'X-IG-App-ID' => '936619743392459',
                'Referer' => $profileUrl,
                'Origin' => 'https://www.instagram.com',
            ])
            ->get($infoUrl);

        if ($response->status() === 404) {
            throw new SocialMetricsException(__('auth.social_profile_not_found'));
        }

        if ($response->successful()) {
            $json = $response->json();
            if (is_array($json) && data_get($json, 'data.user')) {
                return $this->snapshotFromInstagramPayload($handle, $json);
            }

            $fromHtml = $this->snapshotFromInstagramHtml($handle, (string) $response->body());
            if ($fromHtml !== null) {
                return $fromHtml;
            }
        }

        $fromHtml = $this->snapshotFromInstagramHtml($handle, $this->requestHtml($profileUrl));
        if ($fromHtml !== null) {
            return $fromHtml;
        }

        throw new SocialMetricsException(__('auth.social_profile_unavailable'));
    }

    private function snapshotFromInstagramHtml(string $handle, string $html): ?SocialSnapshot
    {
        $followers = SocialNumbers::intOrNull($this->matchFirst($html, [
            '/"edge_followed_by"\s*:\s*\{\s*"count"\s*:\s*(\d+)/',
            '/"follower_count"\s*:\s*(\d+)/',
        ]));

        if ($followers === null) {
            $description = $this->matchFirst($html, [
                '/property="og:description"\s+content="([^"]+)"/',
                '/content="([^"]+)"\s+property="og:description"/',
            ]);
            if ($description && preg_match('/([\d.,]+\s*[KMB]?)\s*(Followers|seguidores)/i', $description, $match)) {
                $followers = SocialNumbers::parseCompact($match[1]);
            }
        }

        if ($followers === null) {
            return null;
        }

        return new SocialSnapshot(
            network: 'instagram',
            handle: $handle,
            followers: $followers,
            views: null,
            engagement: null,
        );
    }

    private function fetchTikTokPublic(string $handle): SocialSnapshot
    {
        $attempts = [
            [SocialHandle::publicUrl('tiktok', $handle), self::MOBILE_UA],
            ['https://www.tiktok.com/embed/@'.$handle, self::BROWSER_UA],
        ];

        $snapshot = null;

        foreach ($attempts as [$url, $userAgent]) {
            try {
                $html = $this->requestHtml($url, userAgent: $userAgent);
            } catch (SocialMetricsException) {
                continue;
            }

            $parsed = $this->snapshotFromTikTokHtml($handle, $html);
            if ($parsed === null) {
                continue;
            }

            if ($snapshot === null) {
                $snapshot = $parsed;
            } elseif ($snapshot->views === null && $parsed->views !== null) {
                $snapshot = new SocialSnapshot(
                    network: 'tiktok',
                    handle: $snapshot->handle,
                    followers: $snapshot->followers,
                    views: $parsed->views,
                    engagement: $snapshot->engagement,
                );
            }

            if ($snapshot->followers !== null && $snapshot->views !== null) {
                break;
            }
        }

        if ($snapshot === null || $snapshot->followers === null) {
            throw new SocialMetricsException(__('auth.social_profile_unavailable'));
        }

        return $snapshot;
    }

    private function snapshotFromTikTokHtml(string $handle, string $html): ?SocialSnapshot
    {
        $followers = null;
        $hearts = null;
        $videos = null;
        $plays = [];

        if (preg_match('/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)<\/script>/s', $html, $match)) {
            $json = json_decode($match[1], true);
            if (is_array($json)) {
                $info = data_get($json, '__DEFAULT_SCOPE__.webapp.user-detail.userInfo', []);
                $stats = is_array($info) ? ($info['stats'] ?? $info['statsV2'] ?? []) : [];
                if (is_array($stats)) {
                    $followers = SocialNumbers::intOrNull($stats['followerCount'] ?? null);
                    $hearts = SocialNumbers::intOrNull($stats['heartCount'] ?? $stats['heart'] ?? null);
                    $videos = SocialNumbers::intOrNull($stats['videoCount'] ?? null);
                }
                $items = is_array($info) ? ($info['itemList'] ?? []) : [];
                if (is_array($items)) {
                    foreach ($items as $item) {
                        $play = SocialNumbers::intOrNull(data_get($item, 'stats.playCount') ?? data_get($item, 'playCount'));
                        if ($play) {
                            $plays[] = $play;
                        }
                    }
                }
            }
        }

        $followers ??= SocialNumbers::intOrNull($this->matchFirst($html, [
            '/"followerCount"\s*:\s*"?(\d+)"?/',
        ]));
        $hearts ??= SocialNumbers::intOrNull($this->matchFirst($html, [
            '/"heartCount"\s*:\s*"?(\d+)"?/',
        ]));
        $videos ??= SocialNumbers::intOrNull($this->matchFirst($html, [
            '/"videoCount"\s*:\s*"?(\d+)"?/',
        ]));

        if ($plays === []) {
            preg_match_all('/"playCount"\s*:\s*"?(\d+)"?/', $html, $playMatches);
            $plays = array_map('intval', $playMatches[1] ?? []);
        }

        if ($followers === null) {
            return null;
        }

        return new SocialSnapshot(
            network: 'tiktok',
            handle: $handle,
            followers: $followers,
            views: SocialNumbers::average($plays),
            engagement: SocialNumbers::engagementPercent($hearts, $followers, $videos),
        );
    }

    /**
     * @param  array<string, string>  $headers
     * @return array<string, mixed>
     */
    private function requestJson(string $url, array $headers = []): array
    {
        $response = $this->http()
            ->withHeaders($headers)
            ->acceptJson()
            ->get($url);

        $this->assertReachable($response);

        $json = $response->json();
        if (! is_array($json)) {
            throw new SocialMetricsException(__('auth.social_profile_unavailable'));
        }

        return $json;
    }

    /**
     * @param  array<string, string>  $cookies
     */
    private function requestHtml(string $url, array $cookies = [], ?string $userAgent = null): string
    {
        $request = $this->http($userAgent)->withHeaders([
            'Accept' => 'text/html,application/xhtml+xml',
            'Accept-Language' => 'en-US,en;q=0.9,pt-BR;q=0.8',
        ]);

        if ($cookies !== []) {
            $domain = parse_url($url, PHP_URL_HOST) ?: '';
            $request = $request->withCookies($cookies, $domain);
        }

        $response = $request->get($url);
        $this->assertReachable($response);

        return (string) $response->body();
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
            throw new SocialMetricsException(__('auth.social_profile_not_found'));
        }

        if ($status >= 400) {
            throw new SocialMetricsException(__('auth.social_profile_unavailable'));
        }
    }

    private function looksLikeLoginWall(string $html): bool
    {
        return str_contains($html, 'accounts/login')
            || str_contains($html, 'login.instagram.com')
            || (str_contains($html, 'Log in') && str_contains($html, 'Sign up') && ! str_contains($html, 'og:description'));
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

    private function scrapeCreatorsKey(): string
    {
        return trim((string) config('services.social.scrape_creators_key'));
    }

    private function scrapeCreatorsUrl(): string
    {
        return trim((string) config('services.social.scrape_creators_url', 'https://api.scrapecreators.com'))
            ?: 'https://api.scrapecreators.com';
    }

    private function youtubeApiKey(): string
    {
        return trim((string) config('services.social.youtube_api_key'));
    }
}
