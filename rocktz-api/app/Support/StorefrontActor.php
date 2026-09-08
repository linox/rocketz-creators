<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class StorefrontActor
{
    public static function user(Request $request): ?User
    {
        $user = $request->user() ?: Auth::guard('sanctum')->user();

        return $user instanceof User ? $user : null;
    }

    public static function key(Request $request): string
    {
        $user = self::user($request);
        if ($user) {
            return 'user:'.$user->id;
        }

        $raw = implode('|', [
            (string) $request->ip(),
            substr((string) $request->userAgent(), 0, 180),
            (string) config('app.key'),
        ]);

        return 'guest:'.hash('sha256', $raw);
    }
}
