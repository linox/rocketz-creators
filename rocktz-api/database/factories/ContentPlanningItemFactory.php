<?php

namespace Database\Factories;

use App\Enums\ApprovalFlowType;
use App\Enums\ContentPlanningStatus;
use App\Enums\ContentType;
use App\Enums\StageApprovalStatus;
use App\Models\Company;
use App\Models\ContentPlanningItem;
use App\Models\Creator;
use App\Models\RecurringContract;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ContentPlanningItem>
 */
class ContentPlanningItemFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'recurring_contract_id' => RecurringContract::factory(),
            'company_id' => Company::factory()->active(),
            'creator_id' => Creator::factory()->active(),
            'month' => fake()->date('Y-m'),
            'content_type' => fake()->randomElement(ContentType::cases()),
            'title' => fake()->sentence(4),
            'description' => fake()->optional()->paragraph(),
            'briefing_note' => fake()->optional()->sentence(),
            'briefing' => fake()->optional()->paragraph(),
            'references' => fake()->optional()->url(),
            'script' => fake()->optional()->paragraph(),
            'caption' => fake()->optional()->sentence(),
            'planned_date' => fake()->optional()->dateTimeBetween('now', '+1 month')?->format('Y-m-d'),
            'status' => ContentPlanningStatus::Planned,
            'approval_flow' => ApprovalFlowType::ScriptAndVideo,
            'script_status' => StageApprovalStatus::Pending,
            'video_status' => StageApprovalStatus::Pending,
            'script_feedback' => null,
            'video_feedback' => null,
            'script_submitted_at' => null,
            'video_submitted_at' => null,
            'published_url' => null,
            'metrics' => [],
            'media_url' => null,
            'submission_url' => null,
            'submission_notes' => null,
            'feedback_note' => null,
            'submitted_at' => null,
            'reviewed_at' => null,
        ];
    }

    public function planned(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => ContentPlanningStatus::Planned,
        ]);
    }

    public function review(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => ContentPlanningStatus::Review,
            'script_status' => StageApprovalStatus::Submitted,
            'submitted_at' => now()->subDay(),
            'script_submitted_at' => now()->subDay(),
        ]);
    }

    public function published(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => ContentPlanningStatus::Published,
            'script_status' => StageApprovalStatus::Approved,
            'video_status' => StageApprovalStatus::Approved,
            'published_url' => fake()->url(),
            'reviewed_at' => now()->subDays(2),
        ]);
    }
}
