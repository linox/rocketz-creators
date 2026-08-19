<?php

namespace Database\Factories;

use App\Enums\NotificationTargetRole;
use App\Enums\NotificationType;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Notification>
 */
class NotificationFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'creator_id' => null,
            'campaign_id' => null,
            'recurring_contract_id' => null,
            'title' => fake()->sentence(6),
            'message' => fake()->paragraph(),
            'type' => NotificationType::General,
            'target_role' => NotificationTargetRole::All,
            'link' => fake()->optional()->url(),
            'read' => false,
        ];
    }

    public function unread(): static
    {
        return $this->state(fn (array $attributes) => [
            'read' => false,
        ]);
    }

    public function read(): static
    {
        return $this->state(fn (array $attributes) => [
            'read' => true,
        ]);
    }
}
