<?php

namespace Database\Factories;

use App\Enums\RecurringContractStatus;
use App\Models\Company;
use App\Models\RecurringContract;
use App\Support\Geo;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RecurringContract>
 */
class RecurringContractFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => Company::factory()->active(),
            'title' => fake()->words(3, true),
            'objective' => fake()->optional()->sentence(),
            'start_date' => fake()->dateTimeBetween('-2 months', 'now')->format('Y-m-d'),
            'end_date' => fake()->optional()->dateTimeBetween('+2 months', '+1 year')?->format('Y-m-d'),
            'status' => RecurringContractStatus::Active,
            'monthly_fee' => fake()->randomFloat(2, 2000, 15000),
            'currency' => 'BRL',
            'notes' => fake()->optional()->sentence(),
        ];
    }

    public function configure(): static
    {
        return $this->afterCreating(function (RecurringContract $contract) {
            $company = $contract->company;
            if (! $company) {
                return;
            }

            $from = Geo::normalizeCurrency($contract->currency ?: Geo::DEFAULT_CURRENCY);
            $to = $company->currencyCode();
            if ($from === $to) {
                if ($contract->currency !== $to) {
                    $contract->forceFill(['currency' => $to])->saveQuietly();
                }

                return;
            }

            $contract->forceFill([
                'monthly_fee' => Geo::convertMoney($contract->monthly_fee, $from, $to),
                'currency' => $to,
            ])->saveQuietly();
        });
    }

    public function active(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => RecurringContractStatus::Active,
        ]);
    }

    public function paused(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => RecurringContractStatus::Paused,
        ]);
    }

    public function finished(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => RecurringContractStatus::Finished,
        ]);
    }
}
