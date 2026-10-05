<?php

namespace App\Support;

class NetworkSize
{
    /**
     * Maior audiência entre Instagram, TikTok e YouTube.
     *
     * @param  array<string, mixed>|null  $metrics
     */
    public static function of(?array $metrics): int
    {
        $max = 0;
        foreach (['instagram_followers', 'tiktok_followers', 'youtube_followers', 'youtube_subscribers', 'followers'] as $key) {
            $value = (int) ($metrics[$key] ?? 0);
            if ($value > $max) {
                $max = $value;
            }
        }

        return $max;
    }
}
