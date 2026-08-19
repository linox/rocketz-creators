<?php

namespace Database\Factories;

use App\Enums\RecurringContractStatus;
use App\Models\Company;
use App\Models\RecurringContract;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RecurringContract>
 */
class RecurringContractFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => Company::factory()->active(),
            'title' => fake()->words(3, true),
            'objective' => fake()->optional()->sentence(),
            'start_date' => fake()->dateTimeBetween('-2 months', 'now')->format('Y-m-d'),
            'end_date' => fake()->optional()->dateTimeBetween('+2 months', '+1 year')?->format('Y-m-d'),
            'status' => RecurringContractStatus::Active,
            'monthly_fee' => fake()->randomFloat(2, 2000, 15000),
            'notes' => fake()->optional()->sentence(),
        ];
    }

    public function active(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => RecurringContractStatus::Active,
        ]);
    }

    public function paused(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => RecurringContractStatus::Paused,
        ]);
    }

    public function finished(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => RecurringContractStatus::Finished,
        ]);
    }
}
