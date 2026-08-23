<?php

namespace App\Services\SocialMetrics;

class SocialSnapshot
{
    public function __construct(
        public readonly string $network,
        public readonly string $handle,
        public readonly ?int $followers = null,
        public readonly ?int $views = null,
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
            handle: (string) ($payload['handle'] ?? ''),
            followers: isset($payload['followers']) ? (int) $payload['followers'] : null,
            views: isset($payload['views']) ? (int) $payload['views'] : null,
            engagement: isset($payload['engagement']) ? (float) $payload['engagement'] : null,
            cached: $cached,
        );
    }

    /**
     * @return array{network: string, handle: string, followers: int|null, views: int|null, engagement: float|null}
     */
    public function toArray(): array
    {
        return [
            'network' => $this->network,
            'handle' => $this->handle,
            'followers' => $this->followers,
            'views' => $this->views,
            'engagement' => $this->engagement,
        ];
    }

    /**
     * @return array{ok: true, cached: bool, handle: string, followers: int|null, views: int|null, engagement: float|null}
     */
    public function toSyncResult(): array
    {
        return [
            'ok' => true,
            'cached' => $this->cached,
            'handle' => $this->handle,
            'followers' => $this->followers,
            'views' => $this->views,
            'engagement' => $this->engagement,
        ];
    }

    public function withCached(bool $cached = true): self
    {
        return new self(
            $this->network,
            $this->handle,
            $this->followers,
            $this->views,
            $this->engagement,
            $cached,
        );
    }

    public function fillMissing(?int $views = null, ?float $engagement = null): self
    {
        return new self(
            $this->network,
            $this->handle,
            $this->followers,
            $this->views ?? $views,
            $this->engagement ?? $engagement,
            $this->cached,
        );
    }
}
