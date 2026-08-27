<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DeviceToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DeviceTokenController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'min:8', 'max:512'],
            'platform' => ['required', 'string', Rule::in(['ios', 'android', 'web'])],
        ]);

        $row = DeviceToken::query()->updateOrCreate(
            ['token' => $data['token']],
            [
                'user_id' => (int) $request->user()->id,
                'platform' => $data['platform'],
            ],
        );

        return response()->json([
            'data' => [
                'id' => $row->id,
                'platform' => $row->platform,
            ],
        ], $row->wasRecentlyCreated ? 201 : 200);
    }

    public function destroy(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:512'],
        ]);

        DeviceToken::query()
            ->where('user_id', $request->user()->id)
            ->where('token', $data['token'])
            ->delete();

        return response()->json(['message' => __('auth.device_token_removed')]);
    }
}
