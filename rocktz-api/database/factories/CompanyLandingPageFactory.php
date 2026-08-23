<?php

namespace Database\Factories;

use App\Enums\LandingPageStatus;
use App\Models\Company;
use App\Models\CompanyLandingPage;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<CompanyLandingPage>
 */
class CompanyLandingPageFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->unique()->company();

        return [
            'company_id' => Company::factory()->active(),
            'slug' => Str::slug($name).'-'.Str::lower(Str::random(4)),
            'display_name' => $name,
            'logo_url' => null,
            'banner_url' => null,
            'title' => null,
            'description' => null,
            'cta_text' => null,
            'primary_color' => '#8A3FFC',
            'button_color' => '#8A3FFC',
            'background_color' => '#FDFDFE',
            'website_url' => null,
            'socials' => [],
            'status' => LandingPageStatus::Draft,
        ];
    }

    public function published(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => LandingPageStatus::Published,
            'published_at' => now(),
        ]);
    }

    public function disabled(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => LandingPageStatus::Disabled,
        ]);
    }
}
