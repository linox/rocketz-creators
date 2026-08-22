<?php

namespace App\Support;

class PostLink
{
    public const NETWORKS = ['instagram', 'tiktok', 'youtube'];

    public function __construct(
        public readonly string $network,
        public readonly string $url,
        public readonly string $id,
        public readonly string $handle = '',
    ) {}

    public static function parse(?string $value): ?self
    {
        $raw = trim((string) $value);
        if ($raw === '') {
            return null;
        }

        $url = preg_match('#^https?://#i', $raw) ? $raw : 'https://'.ltrim($raw, '/');
        $parts = parse_url($url);
        if (! is_array($parts)) {
            return null;
        }

        $host = strtolower((string) ($parts['host'] ?? ''));
        $path = trim((string) ($parts['path'] ?? ''), '/');
        $query = [];
        parse_str((string) ($parts['query'] ?? ''), $query);

        if (str_ends_with($host, 'instagram.com')) {
            return self::instagram($url, $path);
        }

        if (str_contains($host, 'tiktok.com')) {
            return self::tiktok($url, $host, $path);
        }

        if (str_contains($host, 'youtube.com') || str_ends_with($host, 'youtu.be')) {
            return self::youtube($path, $query);
        }

        return null;
    }

    public function canonicalUrl(): string
    {
        return match ($this->network) {
            'instagram' => 'https://www.instagram.com/p/'.$this->id.'/',
            'tiktok' => $this->handle !== ''
                ? 'https://www.tiktok.com/@'.$this->handle.'/'.(str_contains($this->url, '/photo/') ? 'photo' : 'video').'/'.$this->id
                : $this->url,
            'youtube' => 'https://www.youtube.com/watch?v='.$this->id,
            default => $this->url,
        };
    }

    public function cacheKey(): string
    {
        return 'post-metrics:'.$this->network.':'.mb_strtolower($this->id);
    }

    private static function instagram(string $url, string $path): ?self
    {
        if (! preg_match('#(?:^|/)(?:p|reel|reels|tv)/([A-Za-z0-9_-]+)#i', $path, $match)) {
            return null;
        }

        $handle = '';
        if (
            preg_match('#^([A-Za-z0-9._]+)/(?:p|reel|reels|tv)/#i', $path, $user)
            && ! in_array(strtolower($user[1]), ['p', 'reel', 'reels', 'tv', 'stories', 'share'], true)
        ) {
            $handle = $user[1];
        }

        return new self('instagram', $url, $match[1], $handle);
    }

    private static function tiktok(string $url, string $host, string $path): ?self
    {
        if (preg_match('#(?:^|/)@([A-Za-z0-9._]+)/(?:video|photo)/(\d+)#i', $path, $match)) {
            return new self('tiktok', $url, $match[2], $match[1]);
        }

        if (preg_match('#(?:^|/)(?:t|v)/([A-Za-z0-9]+)#i', $path, $match)) {
            return new self('tiktok', $url, $match[1]);
        }

        if (preg_match('#^(www\.)?(vm|vt)\.tiktok\.com$#i', $host)) {
            $id = trim(explode('/', $path)[0] ?? '', '/');

            return $id === '' ? null : new self('tiktok', $url, $id);
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $query
     */
    private static function youtube(string $path, array $query): ?self
    {
        $id = '';
        if (isset($query['u']) && is_string($query['u'])) {
            $nested = self::parse('https://www.youtube.com'.urldecode($query['u']));
            if ($nested?->network === 'youtube') {
                return $nested;
            }
        }
        if (preg_match('#(?:shorts|embed|live|v|watch)/([A-Za-z0-9_-]{6,})#i', $path, $match)) {
            $id = $match[1];
        } elseif (isset($query['v']) && is_string($query['v'])) {
            $id = $query['v'];
        } elseif (preg_match('#^[A-Za-z0-9_-]{6,}$#', $path)) {
            $id = $path;
        }

        $id = (string) preg_replace('/[^A-Za-z0-9_-].*/', '', $id);

        return $id === '' ? null : new self('youtube', 'https://www.youtube.com/watch?v='.$id, $id);
    }
}
