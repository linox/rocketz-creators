<?php

namespace App\Services;

use App\Enums\NotificationTargetRole;
use App\Enums\NotificationType;
use App\Enums\UserRole;
use App\Models\Notification;
use App\Models\User;

class NotificationService
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public function send(array $payload): Notification
    {
        return Notification::query()->create([
            'user_id' => $payload['user_id'] ?? null,
            'creator_id' => $payload['creator_id'] ?? null,
            'campaign_id' => $payload['campaign_id'] ?? null,
            'recurring_contract_id' => $payload['recurring_contract_id'] ?? null,
            'title' => $payload['title'],
            'message' => $payload['message'],
            'type' => $payload['type'] ?? NotificationType::General,
            'target_role' => $payload['target_role'] ?? NotificationTargetRole::Admin,
            'link' => $payload['link'] ?? null,
            'read' => false,
        ]);
    }

    public function notifyAdmins(string $title, string $message, NotificationType $type, ?string $link = null, array $extra = []): void
    {
        User::query()->where('role', UserRole::Admin)->get()->each(function (User $admin) use ($title, $message, $type, $link, $extra) {
            $this->send(array_merge($extra, [
                'user_id' => $admin->id,
                'title' => $title,
                'message' => $message,
                'type' => $type,
                'target_role' => NotificationTargetRole::Admin,
                'link' => $link,
            ]));
        });
    }
}
