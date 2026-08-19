<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\NotificationResource;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Notification::query()->latest();

        if ($user->role !== UserRole::Admin) {
            $query->where(function ($builder) use ($user) {
                $builder->where('user_id', $user->id);
                if ($user->creator?->id) {
                    $builder->orWhere('creator_id', $user->creator->id);
                }
            });
        } elseif ($request->boolean('mine')) {
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

    public function markRead(Notification $notification): JsonResponse
    {
        $notification->update(['read' => true]);

        return response()->json(['data' => new NotificationResource($notification)]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Notification::query()->where('read', false);
        if ($user->role !== UserRole::Admin) {
            $query->where('user_id', $user->id);
        }
        $query->update(['read' => true]);

        return response()->json(['message' => __('auth.notifications_read')]);
    }

    public function destroy(Notification $notification): JsonResponse
    {
        $notification->delete();

        return response()->json(['message' => __('auth.notification_removed')]);
    }
}
