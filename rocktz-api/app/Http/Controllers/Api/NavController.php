<?php

namespace App\Http\Controllers\Api;

use App\Enums\ApplicationStatus;
use App\Enums\RecurringContractStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\CampaignCreator;
use App\Models\Notification;
use App\Models\RecurringContract;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NavController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $unread = Notification::collapseCopies(
            Notification::query()->where('read', false)->visibleTo($user)->get(),
        );

        $pending = 0;
        if ($user->role === UserRole::Admin) {
            $pending = CampaignCreator::query()
                ->where('application_status', ApplicationStatus::Pending)
                ->count();
        }

        return response()->json([
            'unread' => $unread->count(),
            'pending_applications' => $pending,
            'has_recurring' => $this->userHasRecurring($user),
        ]);
    }

    private function userHasRecurring(mixed $user): bool
    {
        if ($user->role === UserRole::Creator) {
            $creatorId = $user->creator?->id;
            if (! $creatorId) {
                return false;
            }

            return RecurringContract::query()
                ->where('status', '!=', RecurringContractStatus::PendingAgency)
                ->where(function (Builder $builder) use ($creatorId) {
                    $builder->whereHas('recurringContractCreators', fn (Builder $query) => $query->where('creator_id', $creatorId))
                        ->orWhereHas('contentPlanningItems', fn (Builder $query) => $query->where('creator_id', $creatorId));
                })
                ->exists();
        }

        if ($user->role === UserRole::Company) {
            $companyId = $user->actingCompanyId();
            if (! $companyId) {
                return false;
            }

            return RecurringContract::query()->where('company_id', $companyId)->exists();
        }

        return RecurringContract::query()->exists();
    }
}
