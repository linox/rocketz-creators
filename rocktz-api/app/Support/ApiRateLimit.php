<?php

namespace App\Support;

use Illuminate\Http\Request;

class ApiRateLimit
{
    public const READ_PER_MINUTE = 300;

    public const WRITE_PER_MINUTE = 60;

    public const UPLOAD_PER_MINUTE = 400;

    public const PUBLIC_READ_PER_MINUTE = 240;

    public const OAUTH_PER_MINUTE = 20;

    public static function actorKey(Request $request): string
    {
        $id = $request->user()?->getAuthIdentifier();

        if ($id !== null && $id !== '') {
            return 'user:'.$id;
        }

        return 'ip:'.(string) $request->ip();
    }
}
