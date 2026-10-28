<?php

namespace App\Services;

use App\Enums\FinancePaymentSource;
use App\Enums\FinancePaymentStatus;
use App\Enums\NotificationType;
use App\Models\Company;
use App\Models\Creator;
use App\Models\CreatorCoupon;
use App\Models\CreatorCouponEarning;
use App\Models\FinancePayment;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CouponEarningService
{
    public function __construct(
        private readonly FinancePaymentSync $finance,
        private readonly NotificationService $notifications,
    ) {}

    /**
     * @param  list<array{creator_id: int, amount: float|null}>  $entries
     * @return array<string, mixed>
     */
    public function save(Company $company, Carbon $month, array $entries, ?int $userId): array
    {
        $month = $month->copy()->startOfMonth();
        $ids = collect($entries)->pluck('creator_id')->map(fn ($id) => (int) $id)->unique()->values();
        $allowed = CreatorCoupon::query()
            ->where('company_id', $company->id)
            ->whereIn('creator_id', $ids)
            ->pluck('creator_id')
            ->map(fn ($id) => (int) $id)
            ->unique();

        if ($allowed->count() !== $ids->count()) {
            throw ValidationException::withMessages([
                'entries' => [__('auth.coupon_earning_creator')],
            ]);
        }

        $notify = [];

        DB::transaction(function () use ($company, $month, $entries, $userId, &$notify) {
            foreach ($entries as $entry) {
                $created = $this->apply(
                    $company,
                    $month,
                    (int) $entry['creator_id'],
                    $entry['amount'],
                    $userId,
                );
                if ($created) {
                    $notify[] = (int) $entry['creator_id'];
                }
            }
        });

        $label = $month->copy()->locale(app()->getLocale())->isoFormat('MMMM YYYY');
        foreach (array_unique($notify) as $creatorId) {
            $this->notifications->notifyCreator($creatorId, [
                'company_id' => $company->id,
                'title' => __('auth.coupon_earning_ready_title'),
                'message' => __('auth.coupon_earning_ready', [
                    'month' => $label,
                    'company' => $company->name,
                ]),
                'type' => NotificationType::General,
                'link' => '/finance',
            ]);
        }

        return $this->sheet($company, $month);
    }

    /**
     * @return array<string, mixed>
     */
    public function sheet(Company $company, Carbon $month): array
    {
        $month = $month->copy()->startOfMonth();
        $coupons = CreatorCoupon::query()
            ->where('company_id', $company->id)
            ->with('creator:id,artistic_name,full_name')
            ->orderBy('code')
            ->get()
            ->groupBy('creator_id');

        $earnings = CreatorCouponEarning::query()
            ->where('company_id', $company->id)
            ->whereDate('reference_month', $month->toDateString())
            ->get()
            ->keyBy('creator_id');

        $payments = FinancePayment::query()
            ->where('company_id', $company->id)
            ->where('source', FinancePaymentSource::Coupon)
            ->whereDate('reference_month', $month->toDateString())
            ->get()
            ->keyBy('creator_id');

        $rows = [];
        foreach ($coupons as $creatorId => $group) {
            $creator = $group->first()?->creator;
            $earning = $earnings->get($creatorId);
            $payment = $payments->get($creatorId);
            $amount = $earning?->amount ?? $payment?->amount;

            $rows[] = [
                'creator_id' => (int) $creatorId,
                'artistic_name' => $creator?->artistic_name,
                'full_name' => $creator?->full_name,
                'codes' => $group->pluck('code')->unique()->values()->all(),
                'amount' => $amount !== null ? (float) $amount : null,
                'payment_status' => $payment?->status?->value,
                'locked' => $payment ? ! $this->editable($payment) : false,
            ];
        }

        usort($rows, function (array $left, array $right) {
            $leftName = mb_strtolower((string) ($left['artistic_name'] ?: $left['full_name']));
            $rightName = mb_strtolower((string) ($right['artistic_name'] ?: $right['full_name']));

            return $leftName <=> $rightName;
        });

        return [
            'company_id' => $company->id,
            'month' => $month->format('Y-m'),
            'currency' => $company->currencyCode(),
            'rows' => $rows,
        ];
    }

    private function apply(Company $company, Carbon $month, int $creatorId, ?float $amount, ?int $userId): bool
    {
        $key = sprintf('coupon:%d:%d:%s', $company->id, $creatorId, $month->toDateString());
        $payment = FinancePayment::query()->where('dedupe_key', $key)->first();
        $earning = CreatorCouponEarning::query()
            ->where('company_id', $company->id)
            ->where('creator_id', $creatorId)
            ->whereDate('reference_month', $month->toDateString())
            ->first();
        $normalized = round((float) $amount, 2);

        if ($normalized <= 0) {
            if (! $this->clearable($payment)) {
                $this->locked($creatorId);
            }
            $payment?->delete();
            $earning?->delete();

            return false;
        }

        if ($payment && ! $this->editable($payment) && ! $this->same($payment->amount, $normalized)) {
            $this->locked($creatorId);
        }

        $payload = [
            'amount' => $normalized,
            'currency' => $company->currencyCode(),
            'created_by' => $userId,
        ];
        if ($earning) {
            $earning->fill($payload)->save();
        } else {
            CreatorCouponEarning::query()->create($payload + [
                'company_id' => $company->id,
                'creator_id' => $creatorId,
                'reference_month' => $month->toDateString(),
            ]);
        }

        if (! $payment) {
            $dates = $this->finance->datesFor($company, $month);
            FinancePayment::query()->create([
                'company_id' => $company->id,
                'creator_id' => $creatorId,
                'source' => FinancePaymentSource::Coupon,
                'reference_month' => $month->toDateString(),
                'amount' => $normalized,
                'currency' => $company->currencyCode(),
                'invoice_due_date' => $dates['invoice_due_date'],
                'payment_due_date' => $dates['payment_due_date'],
                'status' => FinancePaymentStatus::AwaitingInvoice,
                'dedupe_key' => $key,
            ]);

            return true;
        }

        if ($this->editable($payment) && ! $this->same($payment->amount, $normalized)) {
            $payment->amount = $normalized;
            $payment->currency = $company->currencyCode();
            $payment->save();
        }

        return false;
    }

    private function editable(?FinancePayment $payment): bool
    {
        if (! $payment) {
            return true;
        }

        return in_array($payment->status, [
            FinancePaymentStatus::AwaitingInvoice,
            FinancePaymentStatus::Rejected,
        ], true);
    }

    private function clearable(?FinancePayment $payment): bool
    {
        if (! $payment) {
            return true;
        }

        return $payment->status === FinancePaymentStatus::AwaitingInvoice;
    }

    private function same(mixed $left, mixed $right): bool
    {
        return number_format(round((float) $left, 2), 2, '.', '')
            === number_format(round((float) $right, 2), 2, '.', '');
    }

    private function locked(int $creatorId): never
    {
        $creator = Creator::query()->find($creatorId);
        $name = $creator?->artistic_name ?: $creator?->full_name ?: (string) $creatorId;

        throw ValidationException::withMessages([
            'entries' => [__('auth.coupon_earning_locked', ['name' => $name])],
        ]);
    }
}
