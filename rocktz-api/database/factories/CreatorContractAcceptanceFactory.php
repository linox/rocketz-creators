<?php

namespace Database\Factories;

use App\Enums\ContractAcceptanceStatus;
use App\Models\Creator;
use App\Models\CreatorContractAcceptance;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CreatorContractAcceptance>
 */
class CreatorContractAcceptanceFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'creator_id' => Creator::factory(),
            'term_id' => 'creator-terms',
            'version' => '1.0',
            'full_name' => fake()->name(),
            'document' => fake()->numerify('###.###.###-##'),
            'email' => fake()->safeEmail(),
            'accepted_at' => now(),
            'ip' => fake()->ipv4(),
            'user_agent' => fake()->userAgent(),
            'declarations' => [
                'lgpd' => true,
                'terms' => true,
                'image_rights' => true,
            ],
            'all_accepted' => true,
            'status' => ContractAcceptanceStatus::Valid,
        ];
    }

    public function valid(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => ContractAcceptanceStatus::Valid,
            'all_accepted' => true,
        ]);
    }

    public function revoked(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => ContractAcceptanceStatus::Revoked,
        ]);
    }
}
