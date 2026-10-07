<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\ShippingSender;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ShippingSender>
 */
class ShippingSenderFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => Company::factory()->active(),
            'created_by_user_id' => User::factory()->admin(),
            'name' => fake()->company(),
            'phone' => fake()->numerify('+55 ## 9####-####'),
            'address' => [
                'country' => 'BR',
                'zip' => '01310100',
                'street' => 'Avenida Paulista',
                'number' => '1000',
                'complement' => null,
                'neighborhood' => 'Bela Vista',
                'city' => 'Sao Paulo',
                'state' => 'SP',
            ],
        ];
    }

    public function agency(): static
    {
        return $this->state(fn (array $attributes) => [
            'company_id' => null,
        ]);
    }
}
