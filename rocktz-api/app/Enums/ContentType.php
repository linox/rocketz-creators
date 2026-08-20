<?php

namespace App\Enums;

enum ContentType: string
{
    case Reel = 'reel';
    case Story = 'story';
    case Post = 'post';
    case Tiktok = 'tiktok';
    case Youtube = 'youtube';
    case Live = 'live';
    case LiveInstagram = 'live_instagram';
    case LiveTiktok = 'live_tiktok';
    case LiveYoutube = 'live_youtube';
    case Pinterest = 'pinterest';
    case Blog = 'blog';
    case Podcast = 'podcast';
    case Unboxing = 'unboxing';
    case Ugc = 'ugc';
    case Event = 'event';
    case Other = 'other';
}
