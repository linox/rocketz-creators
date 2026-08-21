<?php

namespace App\Http\Middleware;

use App\Enums\Permission;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use ValueError;

class EnsureUserHasPermission
{
    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => __('auth.unauthenticated')], 401);
        }

        try {
            $ability = Permission::from($permission);
        } catch (ValueError) {
            return response()->json(['message' => __('auth.forbidden_permission')], 403);
        }

        if (! $user->hasPermission($ability)) {
            return response()->json(['message' => __('auth.forbidden_permission')], 403);
        }

        return $next($request);
    }
}
