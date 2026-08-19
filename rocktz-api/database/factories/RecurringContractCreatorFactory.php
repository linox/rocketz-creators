<?php

namespace Database\Factories;

use App\Models\Creator;
use App\Models\RecurringContract;
use App\Models\RecurringContractCreator;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RecurringContractCreator>
 */
class RecurringContractCreatorFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'recurring_contract_id' => RecurringContract::factory(),
            'creator_id' => Creator::factory()->active(),
            'monthly_cache' => fake()->randomFloat(2, 800, 5000),
            'monthly_fee' => fake()->randomFloat(2, 200, 1500),
            'deliverables_fee' => fake()->randomFloat(2, 300, 2000),
            'monthly_deliverables' => [
                'reels' => fake()->numberBetween(1, 4),
                'stories' => fake()->numberBetween(2, 8),
            ],
            'notes' => fake()->optional()->sentence(),
        ];
    }
}
