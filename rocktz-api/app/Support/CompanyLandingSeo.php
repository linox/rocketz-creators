<?php

namespace App\Support;

use App\Models\CompanyLandingPage;

class CompanyLandingSeo
{
    /**
     * @return array{title: string, description: string, image: ?string, url: string}
     */
    public static function for(CompanyLandingPage $page): array
    {
        $page->loadMissing('company');
        $name = trim((string) ($page->display_name ?: $page->company?->name ?: ''));
        $description = trim((string) $page->description);
        if ($description === '') {
            $description = (string) __('landing.default_description', ['name' => $name]);
        }

        $image = MediaUrl::publicAbsolute($page->banner_url)
            ?: MediaUrl::publicAbsolute($page->logo_url ?: $page->company?->logo_url);

        return [
            'title' => (string) __('landing.share_title', ['name' => $name]),
            'description' => $description,
            'image' => $image,
            'url' => FrontendUrl::to('l/'.$page->slug.'/'),
        ];
    }
}
