<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserNotificationPreference;
use App\Support\FrontendUrl;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class MailUnsubscribeController extends Controller
{
    public function __invoke(Request $request, User $user): RedirectResponse
    {
        $prefs = UserNotificationPreference::query()->firstOrCreate(['user_id' => $user->id]);
        $prefs->forceFill([
            'opportunities' => false,
            'campaign_updates' => false,
            'new_demands' => false,
            'deadline_reminders' => false,
            'delivery_updates' => false,
            'promotional' => false,
        ])->save();

        return redirect()->away(FrontendUrl::settings().'?unsubscribed=1');
    }
}
