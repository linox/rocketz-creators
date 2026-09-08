<?php

namespace App\Support;

use App\Models\Creator;

class CreatorStorefrontSeo
{
    /**
     * @return array{title: string, description: string, image: ?string, url: string}
     */
    public static function for(Creator $creator): array
    {
        $name = trim((string) ($creator->artistic_name ?: $creator->full_name));
        $description = trim((string) $creator->bio);
        if ($description === '') {
            $description = (string) __('landing.storefront_default_description', ['name' => $name]);
        }

        $image = null;
        if ($creator->storefront_show_banner) {
            $image = MediaUrl::publicAbsolute($creator->storefront_banner_url);
        }
        $image = $image ?: MediaUrl::publicAbsolute($creator->photo_url);

        return [
            'title' => (string) __('landing.storefront_share_title', ['name' => $name]),
            'description' => $description,
            'image' => $image,
            'url' => FrontendUrl::to('c/'.($creator->storefront_slug ?: $creator->id).'/'),
        ];
    }
}
