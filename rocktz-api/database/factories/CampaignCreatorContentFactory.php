<?php

namespace Database\Factories;

use App\Models\CampaignCreator;
use App\Models\CampaignCreatorContent;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CampaignCreatorContent>
 */
class CampaignCreatorContentFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'campaign_creator_id' => CampaignCreator::factory(),
            'script' => fake()->optional()->paragraphs(2, true),
            'video_url' => fake()->optional()->url(),
            'image_url' => fake()->boolean(40) ? 'https://placehold.co/600x800?text=Content' : null,
            'published_link' => fake()->optional()->url(),
            'story_prints' => [],
            'metrics' => [
                'views' => fake()->numberBetween(500, 80000),
                'likes' => fake()->numberBetween(50, 8000),
            ],
        ];
    }
}
