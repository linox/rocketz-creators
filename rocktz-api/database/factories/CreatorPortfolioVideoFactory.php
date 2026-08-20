<?php

namespace Database\Factories;

use App\Models\Creator;
use App\Models\CreatorPortfolioVideo;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CreatorPortfolioVideo>
 */
class CreatorPortfolioVideoFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'creator_id' => Creator::factory(),
            'title' => fake()->sentence(3),
            'url' => fake()->url(),
            'description' => fake()->optional()->sentence(),
            'orientation' => fake()->randomElement(['vertical', 'horizontal']),
            'file_size' => fake()->numberBetween(5_000_000, 80_000_000),
            'uploaded_at' => fake()->optional()->dateTimeBetween('-1 year'),
        ];
    }
}
