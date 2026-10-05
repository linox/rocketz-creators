<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\CreatorGroup;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CreatorGroup>
 */
class CreatorGroupFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => Company::factory()->active(),
            'name' => fake()->words(2, true),
            'description' => fake()->optional()->sentence(),
        ];
    }
}
