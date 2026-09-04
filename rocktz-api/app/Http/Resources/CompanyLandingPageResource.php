<?php

namespace App\Http\Resources;

use App\Support\CompanyLandingSeo;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CompanyLandingPageResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $company = $this->company;
        $includePrivate = (bool) ($this->additional['include_private'] ?? false);
        $metrics = $this->additional['metrics'] ?? null;

        return [
            'id' => $this->id,
            'company_id' => $this->company_id,
            'company' => $company ? [
                'id' => $company->id,
                'name' => $company->name,
                'logo_url' => $company->logo_url,
                'status' => $company->status?->value,
            ] : null,
            'slug' => $this->slug,
            'display_name' => $this->display_name,
            'logo_url' => $this->logo_url ?: $company?->logo_url,
            'banner_url' => $this->banner_url,
            'title' => $this->title,
            'description' => $this->description,
            'cta_text' => $this->cta_text,
            'primary_color' => $this->primary_color ?: '#8A3FFC',
            'button_color' => $this->button_color ?: '#8A3FFC',
            'background_color' => $this->background_color ?: '#FDFDFE',
            'website_url' => $this->website_url,
            'socials' => $this->socials ?? [],
            'status' => $this->status?->value,
            'seo' => CompanyLandingSeo::for($this->resource),
            'published_at' => $this->published_at?->toIso8601String(),
            'metrics' => $this->when($includePrivate && is_array($metrics), $metrics),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
