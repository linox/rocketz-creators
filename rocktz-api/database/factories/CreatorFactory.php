<?php

namespace Database\Factories;

use App\Enums\CreatorStatus;
use App\Enums\UserRole;
use App\Models\Creator;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Creator>
 */
class CreatorFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $fullName = fake()->name();
        $handle = fake()->unique()->userName();

        return [
            'user_id' => User::factory()->state(['role' => UserRole::Creator]),
            'full_name' => $fullName,
            'artistic_name' => fake()->firstName(),
            'photo_url' => fake()->boolean(70) ? 'https://i.pravatar.cc/400?u='.fake()->uuid() : null,
            'document' => fake()->numerify('###########'),
            'cpf' => fake()->numerify('###.###.###-##'),
            'whatsapp' => fake()->numerify('+55 ## 9####-####'),
            'city' => fake()->city(),
            'state' => fake()->stateAbbr(),
            'birth_date' => fake()->dateTimeBetween('-40 years', '-18 years')->format('Y-m-d'),
            'pix_key' => fake()->safeEmail(),
            'bank_details' => 'Banco '.fake()->randomElement(['Nubank', 'Itaú', 'Bradesco', 'Inter']).' / agência '.fake()->numerify('####').' / conta '.fake()->numerify('#####-#'),
            'socials' => [
                'instagram' => '@'.$handle,
                'tiktok' => '@'.$handle,
                'youtube' => fake()->optional()->url(),
            ],
            'metrics' => [
                'instagram_followers' => fake()->numberBetween(2000, 250000),
                'tiktok_followers' => fake()->numberBetween(1000, 400000),
                'engagement_rate' => fake()->randomFloat(2, 1, 12),
            ],
            'categories' => fake()->randomElements(
                ['ugc', 'beleza', 'lifestyle', 'moda', 'food', 'tech', 'fitness'],
                fake()->numberBetween(2, 4),
            ),
            'pricing' => [
                'reel' => fake()->numberBetween(400, 2500),
                'story' => fake()->numberBetween(150, 800),
                'tiktok' => fake()->numberBetween(400, 2500),
            ],
            'accepts_exchange' => fake()->boolean(30),
            'accepts_paid_traffic' => fake()->boolean(50),
            'accepts_exclusivity' => fake()->boolean(20),
            'bio' => fake()->paragraph(),
            'work_affinities' => fake()->randomElements(
                ['skincare', 'moda', 'gastronomia', 'viagem', 'games', 'maternidade'],
                fake()->numberBetween(1, 3),
            ),
            'internal_notes' => fake()->optional()->sentence(),
            'status' => CreatorStatus::Review,
        ];
    }

    public function active(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => CreatorStatus::Active,
        ]);
    }

    public function review(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => CreatorStatus::Review,
        ]);
    }

    public function paused(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => CreatorStatus::Paused,
        ]);
    }

    public function rejected(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => CreatorStatus::Rejected,
        ]);
    }
}
