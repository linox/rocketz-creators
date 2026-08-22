<?php

namespace App\Services\SocialMetrics;

class PostSnapshot
{
    public function __construct(
        public readonly string $network,
        public readonly string $url,
        public readonly ?int $likes = null,
        public readonly ?int $comments = null,
        public readonly ?int $views = null,
        public readonly ?int $shares = null,
        public readonly ?float $engagement = null,
        public readonly bool $cached = false,
    ) {}

    /**
     * @param  array<string, mixed>  $payload
     */
    public static function fromArray(array $payload, bool $cached = false): self
    {
        return new self(
            network: (string) ($payload['network'] ?? ''),
            url: (string) ($payload['url'] ?? ''),
            likes: isset($payload['likes']) ? (int) $payload['likes'] : null,
            comments: isset($payload['comments']) ? (int) $payload['comments'] : null,
            views: isset($payload['views']) ? (int) $payload['views'] : null,
            shares: isset($payload['shares']) ? (int) $payload['shares'] : null,
            engagement: isset($payload['engagement']) ? (float) $payload['engagement'] : null,
            cached: $cached,
        );
    }

    /**
     * @return array{network: string, url: string, likes: int|null, comments: int|null, views: int|null, shares: int|null, engagement: float|null}
     */
    public function toArray(): array
    {
        return [
            'network' => $this->network,
            'url' => $this->url,
            'likes' => $this->likes,
            'comments' => $this->comments,
            'views' => $this->views,
            'shares' => $this->shares,
            'engagement' => $this->engagement,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function toMetrics(): array
    {
        return [
            'network' => $this->network,
            'url' => $this->url,
            'likes' => $this->likes,
            'comments' => $this->comments,
            'views' => $this->views,
            'shares' => $this->shares,
            'engagement' => $this->engagement,
            'synced_at' => now()->timestamp,
        ];
    }

    /**
     * @return array{ok: true, cached: bool, network: string, likes: int|null, comments: int|null, views: int|null, shares: int|null, engagement: float|null}
     */
    public function toSyncResult(): array
    {
        return [
            'ok' => true,
            'cached' => $this->cached,
            'network' => $this->network,
            'likes' => $this->likes,
            'comments' => $this->comments,
            'views' => $this->views,
            'shares' => $this->shares,
            'engagement' => $this->engagement,
        ];
    }

    public function withEngagement(?float $engagement): self
    {
        return new self(
            $this->network,
            $this->url,
            $this->likes,
            $this->comments,
            $this->views,
            $this->shares,
            $engagement,
            $this->cached,
        );
    }

    public function withViews(?int $views): self
    {
        return new self(
            $this->network,
            $this->url,
            $this->likes,
            $this->comments,
            $views ?? $this->views,
            $this->shares,
            $this->engagement,
            $this->cached,
        );
    }

    public function hasStats(): bool
    {
        return $this->likes !== null || $this->comments !== null || $this->views !== null;
    }
}
