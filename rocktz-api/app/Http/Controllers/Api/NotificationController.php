<?php

namespace App\Http\Controllers\Api;

use App\Enums\NotificationTargetRole;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\NotificationResource;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $own = Notification::collapseCopies(
            $this->filtered($request, $user)->latest()->limit(400)->get(),
        )->take(100);

        if ($user->role === UserRole::Admin && ! $request->boolean('mine')) {
            $samples = Notification::collapseCopies(
                $this->filtered($request, $user, audience: true)->latest()->limit(400)->get(),
                perRecipient: false,
            )->take(100);
            $own = $own
                ->concat($samples)
                ->unique('id')
                ->sortByDesc(fn (Notification $notification) => $notification->created_at?->getTimestamp() ?? 0)
                ->values();
        }

        return response()->json(['data' => NotificationResource::collection($own)]);
    }

    public function markRead(Request $request, Notification $notification): JsonResponse
    {
        abort_unless($this->visibleTo($request->user(), $notification), 403, __('auth.forbidden'));
        $this->copies($request->user(), $notification)->update(['read' => true]);
        $notification->refresh();

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
        $this->copies($request->user(), $notification)->delete();

        return response()->json(['message' => __('auth.notification_removed')]);
    }

    private function filtered(Request $request, User $user, bool $audience = false): Builder
    {
        $query = Notification::query();

        if ($audience) {
            $query->where('target_role', '!=', NotificationTargetRole::Admin->value);
        } else {
            $query->visibleTo($user);
        }

        if ($request->boolean('unread')) {
            $query->where('read', false);
        }

        if ($type = $request->string('type')->toString()) {
            $query->where('type', $type);
        }

        return $query;
    }

    private function copies(User $actor, Notification $notification): Builder
    {
        $ownsRow = $notification->user_id === null || (int) $notification->user_id === (int) $actor->id;
        $allRecipients = $actor->role === UserRole::Admin && ! $ownsRow;

        return $notification->replicas($allRecipients);
    }

    private function visibleTo(User $user, Notification $notification): bool
    {
        if ($user->role === UserRole::Admin) {
            return true;
        }

        if ($user->role === UserRole::Company) {
            return (int) $notification->user_id === (int) $user->id
                && (int) $notification->company_id === (int) $user->actingCompanyId();
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
