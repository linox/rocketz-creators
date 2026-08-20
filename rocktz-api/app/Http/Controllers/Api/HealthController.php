<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $payload = [
            'status' => 'ok',
            'app' => config('app.name'),
        ];

        if (app()->environment('local')) {
            $payload['upload'] = [
                'upload_max_filesize' => ini_get('upload_max_filesize'),
                'post_max_size' => ini_get('post_max_size'),
            ];
        }

        return response()->json($payload);
    }
}
