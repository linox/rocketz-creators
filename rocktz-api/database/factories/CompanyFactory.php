<?php

namespace Database\Factories;

use App\Enums\CompanyStatus;
use App\Models\Company;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Company>
 */
class CompanyFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->company(),
            'cnpj' => fake()->unique()->numerify('##.###.###/####-##'),
            'segment' => fake()->randomElement(['beleza', 'moda', 'alimentos', 'tech', 'varejo', 'serviços']),
            'responsible_name' => fake()->name(),
            'whatsapp' => fake()->numerify('+55 ## 9####-####'),
            'email' => fake()->unique()->companyEmail(),
            'city' => fake()->city(),
            'observations' => fake()->optional()->sentence(),
            'logo_url' => fake()->boolean(40) ? 'https://placehold.co/200x200?text=Logo' : null,
            'objective' => fake()->optional()->sentence(),
            'status' => CompanyStatus::Pending,
        ];
    }

    public function pending(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => CompanyStatus::Pending,
        ]);
    }

    public function active(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => CompanyStatus::Active,
        ]);
    }

    public function rejected(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => CompanyStatus::Rejected,
        ]);
    }
}
