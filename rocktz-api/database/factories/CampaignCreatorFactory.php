<?php

namespace Database\Factories;

use App\Enums\ApplicationStatus;
use App\Enums\DeliveryStatus;
use App\Enums\PaymentStatus;
use App\Enums\SignatureStatus;
use App\Enums\StageApprovalStatus;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\Creator;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CampaignCreator>
 */
class CampaignCreatorFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'campaign_id' => Campaign::factory(),
            'creator_id' => Creator::factory()->active(),
            'delivery_type' => fake()->randomElement(['reel', 'story', 'tiktok', 'ugc']),
            'amount' => fake()->randomFloat(2, 500, 8000),
            'delivery_date' => fake()->optional()->dateTimeBetween('now', '+1 month')?->format('Y-m-d'),
            'post_date' => fake()->optional()->dateTimeBetween('now', '+2 months')?->format('Y-m-d'),
            'delivery_status' => DeliveryStatus::Pending,
            'payment_status' => PaymentStatus::Pending,
            'notes' => fake()->optional()->sentence(),
            'application_status' => ApplicationStatus::Pending,
            'rejection_reason' => null,
            'revision_details' => null,
            'script_status' => StageApprovalStatus::Pending,
            'video_status' => StageApprovalStatus::Pending,
            'script_feedback' => null,
            'video_feedback' => null,
            'script_submitted_at' => null,
            'video_submitted_at' => null,
            'signature_status' => SignatureStatus::Pending,
            'signature_sent_at' => null,
            'signature_signed_at' => null,
            'contract_url' => null,
        ];
    }

    public function pendingApplication(): static
    {
        return $this->state(fn (array $attributes) => [
            'application_status' => ApplicationStatus::Pending,
        ]);
    }

    public function approved(): static
    {
        return $this->state(fn (array $attributes) => [
            'application_status' => ApplicationStatus::Approved,
        ]);
    }

    public function paidAndSigned(): static
    {
        return $this->state(fn (array $attributes) => [
            'application_status' => ApplicationStatus::Approved,
            'delivery_status' => DeliveryStatus::Published,
            'payment_status' => PaymentStatus::Paid,
            'signature_status' => SignatureStatus::Signed,
            'signature_sent_at' => now()->subDays(10),
            'signature_signed_at' => now()->subDays(8),
            'script_status' => StageApprovalStatus::Approved,
            'video_status' => StageApprovalStatus::Approved,
            'contract_url' => fake()->url(),
        ]);
    }
}
