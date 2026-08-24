<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UserNotificationPreference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationPreferenceController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $prefs = UserNotificationPreference::query()->firstOrCreate(
            ['user_id' => $request->user()->id],
            [
                'opportunities' => true,
                'campaign_updates' => true,
                'new_demands' => true,
                'deadline_reminders' => true,
                'delivery_updates' => true,
                'promotional' => true,
            ],
        );

        return response()->json(['data' => $prefs]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'opportunities' => ['sometimes', 'boolean'],
            'campaign_updates' => ['sometimes', 'boolean'],
            'new_demands' => ['sometimes', 'boolean'],
            'deadline_reminders' => ['sometimes', 'boolean'],
            'delivery_updates' => ['sometimes', 'boolean'],
            'promotional' => ['sometimes', 'boolean'],
        ]);

        $prefs = UserNotificationPreference::query()->firstOrCreate(['user_id' => $request->user()->id]);
        $prefs->fill($data)->save();

        return response()->json(['data' => $prefs->fresh()]);
    }
}
