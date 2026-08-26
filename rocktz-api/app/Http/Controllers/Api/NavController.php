<?php

namespace App\Http\Controllers\Api;

use App\Enums\ApplicationStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\CampaignCreator;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NavController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $unread = Notification::query()->where('read', false);
        $unread->visibleTo($user);

        $pending = 0;
        if ($user->role === UserRole::Admin) {
            $pending = CampaignCreator::query()
                ->where('application_status', ApplicationStatus::Pending)
                ->count();
        }

        return response()->json([
            'unread' => $unread->count(),
            'pending_applications' => $pending,
        ]);
    }
}
