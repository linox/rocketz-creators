<?php

namespace App\Jobs;

use App\Models\Notification;
use App\Services\FcmPushService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SendPushNotificationJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [30, 120, 300];

    public function __construct(public int $notificationId) {}

    public function handle(FcmPushService $fcm): void
    {
        $notification = Notification::query()->find($this->notificationId);
        if (! $notification || ! $notification->user_id) {
            return;
        }

        $data = array_filter([
            'notification_id' => (string) $notification->id,
            'type' => $notification->type?->value,
            'link' => $notification->link,
            'campaign_id' => $notification->campaign_id ? (string) $notification->campaign_id : null,
            'recurring_contract_id' => $notification->recurring_contract_id
                ? (string) $notification->recurring_contract_id
                : null,
        ], fn ($value) => $value !== null && $value !== '');

        $fcm->sendToUser(
            (int) $notification->user_id,
            (string) $notification->title,
            (string) $notification->message,
            $data,
        );
    }
}
