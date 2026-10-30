<?php

namespace App\Http\Controllers\Api;

use App\Enums\FinancePaymentSource;
use App\Enums\FinancePaymentStatus;
use App\Enums\Permission;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\FinancePaymentResource;
use App\Models\Company;
use App\Models\FinancePayment;
use App\Models\MediaFile;
use App\Services\FinancePaymentNotifier;
use App\Services\FinancePaymentSync;
use App\Support\MediaKind;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class FinancePaymentController extends Controller
{
    public function __construct(
        private readonly FinancePaymentSync $sync,
        private readonly FinancePaymentNotifier $notifier,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->assertAdminFinance($request);
        $user = $request->user();
        $companyId = $this->scopedCompanyId($request);
        $creatorId = $user->role === UserRole::Creator ? (int) ($user->creator?->id ?? 0) : null;
        abort_unless($user->role !== UserRole::Creator || $creatorId, 403, __('auth.forbidden'));

        $this->sync->sync($companyId, $creatorId);

        $query = FinancePayment::query()
            ->with($this->paymentRelations())
            ->orderByDesc('reference_month')
            ->orderBy('invoice_due_date')
            ->orderByDesc('id');

        if ($creatorId) {
            $query->where('creator_id', $creatorId);
        } elseif ($companyId) {
            $query->where('company_id', $companyId);
        }

        $months = (clone $query)
            ->setEagerLoads([])
            ->reorder()
            ->select('reference_month')
            ->distinct()
            ->orderByDesc('reference_month')
            ->pluck('reference_month')
            ->map(fn ($month) => Carbon::parse($month)->format('Y-m'))
            ->unique()
            ->sortDesc()
            ->values();

        $month = $request->string('month')->toString();
        if (preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month) === 1) {
            $start = Carbon::createFromFormat('!Y-m', $month)->startOfMonth();
            $query->whereBetween('reference_month', [
                $start->toDateString(),
                $start->copy()->endOfMonth()->toDateString(),
            ]);
        }

        $summary = (clone $query)
            ->setEagerLoads([])
            ->reorder()
            ->selectRaw('status, count(*) as total, coalesce(sum(amount), 0) as amount_total')
            ->groupBy('status')
            ->get();

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }
        if ($request->filled('source')) {
            $query->where('source', $request->string('source')->toString());
        }

        $company = $companyId ? Company::query()->find($companyId) : null;
        $counts = [];
        $amounts = [];
        foreach ($summary as $row) {
            $attributes = $row->getAttributes();
            $status = (string) $attributes['status'];
            $counts[$status] = (int) $attributes['total'];
            $amounts[$status] = (float) $attributes['amount_total'];
        }

        return response()->json([
            'data' => FinancePaymentResource::collection($query->get()),
            'meta' => [
                'company' => $company ? $this->companySettings($company) : null,
                'counts' => $counts,
                'amounts' => $amounts,
                'months' => $months,
            ],
        ]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $companyId = $this->managedCompanyId($request);
        $data = $request->validate([
            'invoice_due_day' => ['required', 'integer', 'min:1', 'max:28'],
            'payment_due_day' => ['required', 'integer', 'min:1', 'max:28'],
            'invoice_data_campaign' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'invoice_data_recurring' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'invoice_data_coupon' => ['sometimes', 'nullable', 'string', 'max:5000'],
        ]);

        foreach (['invoice_data_campaign', 'invoice_data_recurring', 'invoice_data_coupon'] as $field) {
            if (array_key_exists($field, $data)) {
                $data[$field] = trim((string) ($data[$field] ?? '')) ?: null;
            }
        }

        $company = Company::query()->findOrFail($companyId);
        $company->fill($data)->save();

        return response()->json([
            'message' => __('auth.finance_settings_saved'),
            'data' => $this->companySettings($company),
        ]);
    }

    public function update(Request $request, FinancePayment $financePayment): JsonResponse
    {
        $this->assertCanManage($request, $financePayment);
        abort_if($financePayment->status === FinancePaymentStatus::Paid, 422, __('auth.finance_already_paid'));

        $data = $request->validate([
            'invoice_due_date' => ['required', 'date'],
            'payment_due_date' => ['required', 'date', 'after_or_equal:invoice_due_date'],
        ]);

        $previous = $financePayment->payment_due_date?->toDateString();
        $financePayment->fill($data)->save();
        if ($financePayment->status === FinancePaymentStatus::Released
            && $financePayment->payment_due_date?->toDateString() !== $previous) {
            $this->sync->mirrorCampaign($financePayment);
            $this->notifier->paymentReleased($financePayment);
        }

        return response()->json([
            'message' => __('auth.finance_dates_saved'),
            'data' => new FinancePaymentResource($this->present($financePayment)),
        ]);
    }

    public function submitInvoice(Request $request, FinancePayment $financePayment): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->role === UserRole::Creator, 403, __('auth.forbidden'));
        abort_unless((int) ($user->creator?->id ?? 0) === (int) $financePayment->creator_id, 403, __('auth.forbidden'));
        abort_unless($financePayment->owesInvoice(), 422, __('auth.finance_invoice_pending'));

        $data = $request->validate([
            'media_id' => ['required', 'integer', 'exists:media_files,id'],
        ]);

        $media = MediaFile::query()->findOrFail($data['media_id']);
        if ((int) $media->uploaded_by !== (int) $user->id) {
            throw ValidationException::withMessages([
                'media_id' => __('auth.finance_invoice_owner'),
            ]);
        }

        $kind = MediaKind::detect((string) $media->mime_type, (string) $media->mime_type, MediaKind::rawExtension((string) $media->filename));
        if (! in_array($kind, ['document', 'image'], true)) {
            throw ValidationException::withMessages([
                'media_id' => __('auth.finance_invoice_file'),
            ]);
        }

        $financePayment->fill([
            'invoice_media_id' => $media->id,
            'invoice_submitted_at' => now(),
            'status' => FinancePaymentStatus::Submitted,
            'rejection_reason' => null,
            'reviewed_at' => null,
            'reviewed_by' => null,
        ])->save();

        $this->notifier->invoiceSubmitted($financePayment);

        return response()->json([
            'message' => __('auth.finance_invoice_received'),
            'data' => new FinancePaymentResource($this->present($financePayment)),
        ]);
    }

    public function approve(Request $request, FinancePayment $financePayment): JsonResponse
    {
        $this->assertCanManage($request, $financePayment);
        abort_unless($financePayment->status === FinancePaymentStatus::Submitted, 422, __('auth.finance_not_submitted'));

        $data = $request->validate([
            'payment_due_date' => ['nullable', 'date', 'after_or_equal:today'],
        ]);

        $due = $data['payment_due_date'] ?? $financePayment->payment_due_date?->toDateString();
        if (! $due || Carbon::parse($due)->startOfDay()->lt(now()->startOfDay())) {
            throw ValidationException::withMessages([
                'payment_due_date' => __('auth.finance_payment_date'),
            ]);
        }

        $financePayment->fill([
            'payment_due_date' => $due,
            'status' => FinancePaymentStatus::Released,
            'reviewed_at' => now(),
            'reviewed_by' => $request->user()->id,
            'rejection_reason' => null,
        ])->save();

        $this->sync->mirrorCampaign($financePayment);
        $this->notifier->paymentReleased($financePayment);

        return response()->json([
            'message' => __('auth.finance_payment_released_title'),
            'data' => new FinancePaymentResource($this->present($financePayment)),
        ]);
    }

    public function reject(Request $request, FinancePayment $financePayment): JsonResponse
    {
        $this->assertCanManage($request, $financePayment);
        abort_unless($financePayment->status === FinancePaymentStatus::Submitted, 422, __('auth.finance_not_submitted'));

        $data = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
        ]);

        $financePayment->fill([
            'status' => FinancePaymentStatus::Rejected,
            'rejection_reason' => trim($data['reason']),
            'reviewed_at' => now(),
            'reviewed_by' => $request->user()->id,
        ])->save();

        $this->notifier->invoiceRejected($financePayment);

        return response()->json([
            'message' => __('auth.finance_invoice_rejected_title'),
            'data' => new FinancePaymentResource($this->present($financePayment)),
        ]);
    }

    public function pay(Request $request, FinancePayment $financePayment): JsonResponse
    {
        $this->assertCanManage($request, $financePayment);
        abort_unless($financePayment->status === FinancePaymentStatus::Released, 422, __('auth.finance_not_released'));

        $financePayment->fill([
            'status' => FinancePaymentStatus::Paid,
            'paid_at' => now()->toDateString(),
        ])->save();

        $this->sync->mirrorCampaign($financePayment);

        return response()->json([
            'message' => __('auth.finance_marked_paid'),
            'data' => new FinancePaymentResource($this->present($financePayment)),
        ]);
    }

    private function present(FinancePayment $payment): FinancePayment
    {
        return $payment->fresh()->load($this->paymentRelations());
    }

    /**
     * @return array<int, string>
     */
    private function paymentRelations(): array
    {
        return [
            'company:id,name,invoice_data_campaign,invoice_data_recurring,invoice_data_coupon',
            'creator:id,artistic_name,full_name,photo_url,pix_key,bank_account',
            'campaign:id,name',
            'recurringContract:id,title',
            'invoiceMedia',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function companySettings(Company $company): array
    {
        return [
            'id' => $company->id,
            'invoice_due_day' => (int) ($company->invoice_due_day ?: 5),
            'payment_due_day' => (int) ($company->payment_due_day ?: 15),
            'invoice_data_campaign' => $company->invoiceDataFor(FinancePaymentSource::Campaign),
            'invoice_data_recurring' => $company->invoiceDataFor(FinancePaymentSource::Recurring),
            'invoice_data_coupon' => $company->invoiceDataFor(FinancePaymentSource::Coupon),
        ];
    }

    private function scopedCompanyId(Request $request): ?int
    {
        $user = $request->user();
        if ($user->role === UserRole::Company) {
            $companyId = (int) $user->actingCompanyId();
            abort_unless($companyId, 403, __('auth.company_not_linked'));

            return $companyId;
        }

        if ($user->role === UserRole::Admin && $request->filled('company_id')) {
            return $request->integer('company_id');
        }

        return null;
    }

    private function managedCompanyId(Request $request): int
    {
        $this->assertAdminFinance($request);
        $user = $request->user();
        abort_unless(in_array($user->role, [UserRole::Admin, UserRole::Company], true), 403, __('auth.forbidden'));

        $companyId = $user->role === UserRole::Company
            ? (int) $user->actingCompanyId()
            : $request->integer('company_id');

        Company::assertApproved($companyId);

        return $companyId;
    }

    private function assertAdminFinance(Request $request): void
    {
        $user = $request->user();
        if ($user->role !== UserRole::Admin) {
            return;
        }

        abort_unless($user->hasPermission(Permission::FinanceAccess), 403, __('auth.forbidden_permission'));
    }

    private function assertCanManage(Request $request, FinancePayment $payment): void
    {
        $this->assertAdminFinance($request);
        $user = $request->user();
        if ($user->role === UserRole::Admin) {
            return;
        }

        abort_unless(
            $user->role === UserRole::Company && (int) $user->actingCompanyId() === (int) $payment->company_id,
            403,
            __('auth.forbidden'),
        );
        Company::assertApproved((int) $payment->company_id);
    }
}
