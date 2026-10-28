<?php

namespace App\Services;

use App\Enums\ApplicationStatus;
use App\Enums\FinancePaymentSource;
use App\Enums\FinancePaymentStatus;
use App\Enums\PaymentStatus;
use App\Enums\RecurringContractStatus;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\Company;
use App\Models\FinancePayment;
use App\Models\RecurringContract;
use App\Models\RecurringContractCreator;
use Illuminate\Support\Carbon;

class FinancePaymentSync
{
    public function sync(?int $companyId = null, ?int $creatorId = null): void
    {
        $this->syncCampaigns($companyId, $creatorId);
        $this->syncRecurring($companyId, $creatorId);
    }

    public function ensureCampaignPayment(CampaignCreator $participation): ?FinancePayment
    {
        $participation->loadMissing('campaign.company');
        $campaign = $participation->campaign;
        if (! $this->isPayableCampaign($campaign) || $participation->application_status !== ApplicationStatus::Approved) {
            return null;
        }

        $amount = $this->campaignAmount($participation);
        if ($amount <= 0) {
            return null;
        }

        $month = $this->campaignMonth($participation);
        $dates = $this->datesFor($campaign->company ?? Company::query()->find($campaign->company_id), $month);

        $payment = FinancePayment::query()->firstOrCreate(
            ['dedupe_key' => 'campaign:'.$participation->id],
            [
                'company_id' => $campaign->company_id,
                'creator_id' => $participation->creator_id,
                'source' => FinancePaymentSource::Campaign,
                'campaign_id' => $campaign->id,
                'campaign_creator_id' => $participation->id,
                'reference_month' => $month->toDateString(),
                'amount' => $amount,
                'currency' => $campaign->currency ?: 'BRL',
                'invoice_due_date' => $dates['invoice_due_date'],
                'payment_due_date' => $dates['payment_due_date'],
                'status' => FinancePaymentStatus::AwaitingInvoice,
            ],
        );

        if ($payment->status === FinancePaymentStatus::AwaitingInvoice && (float) $payment->amount !== $amount) {
            $payment->amount = $amount;
            $payment->save();
        }

        return $payment;
    }

    public function mirrorCampaign(FinancePayment $payment): void
    {
        if ($payment->source !== FinancePaymentSource::Campaign || ! $payment->campaign_creator_id) {
            return;
        }

        $row = $payment->campaignCreator;
        if (! $row) {
            return;
        }

        if ($payment->status === FinancePaymentStatus::Released) {
            $row->payment_status = PaymentStatus::Scheduled;
            $row->payment_date = $payment->payment_due_date;
            $row->save();
        }

        if ($payment->status === FinancePaymentStatus::Paid) {
            $row->payment_status = PaymentStatus::Paid;
            $row->payment_date = $payment->paid_at ?? now()->toDateString();
            $row->save();
        }
    }

    /**
     * @return array{invoice_due_date: string, payment_due_date: string}
     */
    public function datesFor(?Company $company, Carbon $referenceMonth): array
    {
        $invoiceDay = $this->day($company?->invoice_due_day, 5);
        $paymentDay = $this->day($company?->payment_due_day, 15);
        $invoiceMonth = $referenceMonth->copy()->startOfMonth()->addMonth();
        $paymentMonth = $invoiceMonth->copy();
        if ($paymentDay <= $invoiceDay) {
            $paymentMonth->addMonth();
        }

        return [
            'invoice_due_date' => $invoiceMonth->day($invoiceDay)->toDateString(),
            'payment_due_date' => $paymentMonth->day($paymentDay)->toDateString(),
        ];
    }

    private function syncCampaigns(?int $companyId, ?int $creatorId): void
    {
        $query = CampaignCreator::query()
            ->where('application_status', ApplicationStatus::Approved)
            ->whereHas('campaign', function ($campaign) use ($companyId) {
                $campaign->where('is_barter', false)
                    ->where('is_benefit_coupon', false)
                    ->where('is_direct_contract', false);
                if ($companyId) {
                    $campaign->where('company_id', $companyId);
                }
            })
            ->with('campaign.company');

        if ($creatorId) {
            $query->where('creator_id', $creatorId);
        }

        $query->orderBy('id')->each(function (CampaignCreator $row) {
            $this->ensureCampaignPayment($row);
        });
    }

    private function syncRecurring(?int $companyId, ?int $creatorId): void
    {
        $query = RecurringContract::query()
            ->whereIn('status', [
                RecurringContractStatus::Active,
                RecurringContractStatus::Paused,
                RecurringContractStatus::Finished,
            ])
            ->with(['company', 'recurringContractCreators']);

        if ($companyId) {
            $query->where('company_id', $companyId);
        }

        $query->orderBy('id')->each(function (RecurringContract $contract) use ($creatorId) {
            foreach ($contract->recurringContractCreators as $row) {
                if ($creatorId && (int) $row->creator_id !== $creatorId) {
                    continue;
                }
                $this->ensureRecurringMonths($contract, $row);
            }
        });
    }

    private function ensureRecurringMonths(RecurringContract $contract, RecurringContractCreator $row): void
    {
        $amount = (float) ($row->monthly_cache ?? 0);
        if ($amount <= 0 || ! $row->creator_id) {
            return;
        }

        $start = ($row->start_date ?? $contract->start_date ?? now())->copy()->startOfMonth();
        $end = ($row->end_date ?? $contract->end_date ?? now())->copy()->startOfMonth();
        $company = $contract->company;

        foreach ($this->months($start, $end) as $month) {
            $dates = $this->datesFor($company, $month);
            $payment = FinancePayment::query()->firstOrCreate(
                ['dedupe_key' => 'recurring:'.$contract->id.':'.$row->creator_id.':'.$month->toDateString()],
                [
                    'company_id' => $contract->company_id,
                    'creator_id' => $row->creator_id,
                    'source' => FinancePaymentSource::Recurring,
                    'recurring_contract_id' => $contract->id,
                    'reference_month' => $month->toDateString(),
                    'amount' => $amount,
                    'currency' => $contract->currency ?: 'BRL',
                    'invoice_due_date' => $dates['invoice_due_date'],
                    'payment_due_date' => $dates['payment_due_date'],
                    'status' => FinancePaymentStatus::AwaitingInvoice,
                ],
            );

            if ($payment->status === FinancePaymentStatus::AwaitingInvoice && (float) $payment->amount !== $amount) {
                $payment->amount = $amount;
                $payment->save();
            }
        }
    }

    /**
     * @return list<Carbon>
     */
    private function months(Carbon $start, Carbon $end): array
    {
        $cursor = $start->copy()->startOfMonth();
        $last = $end->copy()->startOfMonth();
        $current = now()->startOfMonth();
        if ($last->greaterThan($current)) {
            $last = $current->copy();
        }

        $months = [];
        $guard = 0;
        while ($cursor->lessThanOrEqualTo($last) && $guard < 120) {
            $months[] = $cursor->copy();
            $cursor->addMonth();
            $guard++;
        }

        return $months;
    }

    private function isPayableCampaign(?Campaign $campaign): bool
    {
        if (! $campaign) {
            return false;
        }

        return ! $campaign->is_barter && ! $campaign->is_benefit_coupon && ! $campaign->is_direct_contract;
    }

    private function campaignAmount(CampaignCreator $participation): float
    {
        $amount = (float) ($participation->amount ?? 0);
        if ($amount > 0) {
            return $amount;
        }

        return (float) ($participation->campaign?->creator_cache ?? 0);
    }

    private function campaignMonth(CampaignCreator $participation): Carbon
    {
        $date = $participation->delivery_date ?? $participation->post_date ?? now();

        return $date->copy()->startOfMonth();
    }

    private function day(mixed $value, int $fallback): int
    {
        $day = (int) ($value ?: $fallback);

        return max(1, min(28, $day));
    }
}
