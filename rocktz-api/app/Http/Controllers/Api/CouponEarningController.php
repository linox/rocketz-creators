<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Services\CouponEarningService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class CouponEarningController extends Controller
{
    public function __construct(private readonly CouponEarningService $earnings) {}

    public function index(Request $request): JsonResponse
    {
        $company = $this->company($request);
        $month = $this->month($request);

        return response()->json([
            'data' => $this->earnings->sheet($company, $month),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $company = $this->company($request);
        $month = $this->month($request);
        $data = $request->validate([
            'entries' => ['present', 'array'],
            'entries.*.creator_id' => ['required', 'integer', 'distinct'],
            'entries.*.amount' => ['nullable', 'numeric', 'min:0', 'max:99999999.99'],
        ]);

        $entries = collect($data['entries'] ?? [])
            ->map(fn (array $entry) => [
                'creator_id' => (int) $entry['creator_id'],
                'amount' => array_key_exists('amount', $entry) && $entry['amount'] !== null
                    ? (float) $entry['amount']
                    : null,
            ])
            ->all();

        $sheet = $this->earnings->save($company, $month, $entries, $request->user()?->id);

        return response()->json([
            'message' => __('auth.coupon_earning_saved'),
            'data' => $sheet,
        ]);
    }

    private function company(Request $request): Company
    {
        $user = $request->user();
        if ($user->role === UserRole::Company) {
            $id = (int) $user->actingCompanyId();
            abort_unless($id, 403, __('auth.company_not_linked'));
        } else {
            $id = $request->integer('company_id');
            abort_unless($id > 0, 422, __('auth.company_not_linked'));
        }

        Company::assertApproved($id);

        return Company::query()->findOrFail($id);
    }

    private function month(Request $request): Carbon
    {
        $request->validate([
            'month' => ['required', 'date_format:Y-m'],
        ]);

        $month = Carbon::createFromFormat('!Y-m', $request->string('month')->toString())->startOfMonth();
        if ($month->gt(now()->copy()->startOfMonth())) {
            throw ValidationException::withMessages([
                'month' => [__('auth.coupon_earning_future')],
            ]);
        }

        return $month;
    }
}
