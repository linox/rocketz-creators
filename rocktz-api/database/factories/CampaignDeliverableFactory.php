<?php

namespace Database\Factories;

use App\Models\Campaign;
use App\Models\CampaignDeliverable;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CampaignDeliverable>
 */
class CampaignDeliverableFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'campaign_id' => Campaign::factory(),
            'summary' => fake()->sentence(),
            'reels' => fake()->numberBetween(0, 4),
            'stories' => fake()->numberBetween(0, 8),
            'tiktok' => fake()->numberBetween(0, 3),
            'ugc' => fake()->numberBetween(0, 2),
            'posts' => fake()->numberBetween(0, 3),
            'youtube' => fake()->numberBetween(0, 1),
            'deadline_days' => fake()->numberBetween(7, 30),
            'guidelines' => fake()->optional()->paragraph(),
        ];
    }
}
