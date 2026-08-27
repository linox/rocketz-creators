<?php

namespace App\Services;

use App\Enums\NotificationTargetRole;
use App\Enums\NotificationType;
use App\Enums\UserRole;
use App\Jobs\SendPushNotificationJob;
use App\Models\CompanyUser;
use App\Models\Creator;
use App\Models\Notification;
use App\Models\User;
use BackedEnum;

class NotificationService
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public function send(array $payload): Notification
    {
        $notification = Notification::query()->create([
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

        if ($notification->user_id) {
            SendPushNotificationJob::dispatch($notification->id);
        }

        return $notification;
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

    /**
     * @param  array<string, mixed>  $payload
     */
    public function notifyCompany(int $companyId, array $payload): void
    {
        CompanyUser::query()
            ->where('company_id', $companyId)
            ->whereNotNull('user_id')
            ->get()
            ->each(function (CompanyUser $row) use ($payload) {
                $this->send(array_merge($payload, [
                    'user_id' => $row->user_id,
                    'target_role' => NotificationTargetRole::Company,
                ]));
            });
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function notifyCreator(?int $creatorId, array $payload): ?Notification
    {
        if (! $creatorId) {
            return null;
        }

        $userId = $payload['user_id'] ?? Creator::query()->whereKey($creatorId)->value('user_id');

        return $this->send(array_merge($payload, [
            'user_id' => $userId,
            'creator_id' => $creatorId,
            'target_role' => NotificationTargetRole::Creator,
        ]));
    }

    public static function value(mixed $status): ?string
    {
        if ($status === null || $status === '') {
            return null;
        }

        return $status instanceof BackedEnum ? (string) $status->value : (string) $status;
    }

    public static function is(mixed $status, BackedEnum $expected): bool
    {
        return self::value($status) === (string) $expected->value;
    }
}
