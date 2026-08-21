<?php

namespace Database\Factories;

use App\Enums\ApprovalFlowType;
use App\Enums\CampaignStatus;
use App\Models\Campaign;
use App\Models\Company;
use App\Support\Geo;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Campaign>
 */
class CampaignFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $creatorsBudget = fake()->randomFloat(2, 3000, 25000);
        $agencyFee = round($creatorsBudget * 0.2, 2);

        return [
            'company_id' => Company::factory()->active(),
            'name' => fake()->words(3, true),
            'objective' => fake()->sentence(),
            'start_date' => fake()->dateTimeBetween('-1 month', '+1 month')->format('Y-m-d'),
            'end_date' => fake()->dateTimeBetween('+1 month', '+4 months')->format('Y-m-d'),
            'total_budget' => $creatorsBudget + $agencyFee,
            'agency_fee' => $agencyFee,
            'creators_budget' => $creatorsBudget,
            'creator_cache' => $creatorsBudget,
            'currency' => 'BRL',
            'status' => CampaignStatus::Briefing,
            'image_url' => fake()->boolean(50) ? 'https://placehold.co/800x600?text=Campaign' : null,
            'is_secret' => false,
            'is_direct_contract' => false,
            'is_barter' => false,
            'barter_details' => null,
            'approval_flow' => ApprovalFlowType::ScriptAndVideo,
        ];
    }

    public function configure(): static
    {
        return $this->afterCreating(function (Campaign $campaign) {
            $company = $campaign->company;
            if (! $company) {
                return;
            }

            $from = Geo::normalizeCurrency($campaign->currency ?: Geo::DEFAULT_CURRENCY);
            $to = $company->currencyCode();
            if ($from === $to) {
                if ($campaign->currency !== $to) {
                    $campaign->forceFill(['currency' => $to])->saveQuietly();
                }

                return;
            }

            $campaign->forceFill([
                'total_budget' => Geo::convertMoney($campaign->total_budget, $from, $to),
                'agency_fee' => Geo::convertMoney($campaign->agency_fee, $from, $to),
                'creators_budget' => Geo::convertMoney($campaign->creators_budget, $from, $to),
                'creator_cache' => Geo::convertMoney($campaign->creator_cache, $from, $to),
                'currency' => $to,
            ])->saveQuietly();
        });
    }

    public function briefing(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => CampaignStatus::Briefing,
        ]);
    }

    public function selection(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => CampaignStatus::Selection,
        ]);
    }

    public function approval(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => CampaignStatus::Approval,
        ]);
    }

    public function production(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => CampaignStatus::Production,
        ]);
    }

    public function published(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => CampaignStatus::Published,
        ]);
    }

    public function finished(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => CampaignStatus::Finished,
        ]);
    }
}
