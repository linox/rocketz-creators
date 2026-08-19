<?php

namespace Database\Factories;

use App\Models\Campaign;
use App\Models\CampaignBriefing;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CampaignBriefing>
 */
class CampaignBriefingFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'campaign_id' => Campaign::factory(),
            'product' => fake()->words(3, true),
            'key_message' => fake()->sentence(),
            'must_have' => fake()->sentence(),
            'donts' => fake()->sentence(),
            'cta' => fake()->randomElement(['Saiba mais', 'Compre agora', 'Use o cupom']),
            'hashtags' => '#'.fake()->word().' #'.fake()->word(),
            'link' => fake()->url(),
            'coupon' => strtoupper(fake()->bothify('ROCKETZ##')),
            'attachments' => [],
        ];
    }
}
