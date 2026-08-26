<?php

namespace App\Http\Controllers\Api;

use App\Enums\NotificationTargetRole;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\NotificationResource;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Notification::query()->latest();
        $query->visibleTo($user);

        if ($user->role === UserRole::Admin && $request->boolean('mine')) {
            $query->where('user_id', $user->id);
        }

        if ($request->boolean('unread')) {
            $query->where('read', false);
        }

        if ($type = $request->string('type')->toString()) {
            $query->where('type', $type);
        }

        return response()->json(['data' => NotificationResource::collection($query->limit(100)->get())]);
    }

    public function markRead(Request $request, Notification $notification): JsonResponse
    {
        abort_unless($this->visibleTo($request->user(), $notification), 403, __('auth.forbidden'));
        $notification->update(['read' => true]);

        return response()->json(['data' => new NotificationResource($notification)]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $query = Notification::query()->where('read', false);
        $query->visibleTo($request->user());
        $query->update(['read' => true]);

        return response()->json(['message' => __('auth.notifications_read')]);
    }

    public function destroy(Request $request, Notification $notification): JsonResponse
    {
        abort_unless($this->visibleTo($request->user(), $notification), 403, __('auth.forbidden'));
        $notification->delete();

        return response()->json(['message' => __('auth.notification_removed')]);
    }

    private function visibleTo(User $user, Notification $notification): bool
    {
        if ($user->role === UserRole::Admin) {
            return true;
        }

        if ((int) $notification->user_id === (int) $user->id) {
            return true;
        }

        return $user->role === UserRole::Creator
            && $notification->target_role === NotificationTargetRole::Creator
            && $user->creator?->id
            && (int) $notification->creator_id === (int) $user->creator->id;
    }
}
