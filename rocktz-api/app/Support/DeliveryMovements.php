<?php

namespace App\Support;

use App\Enums\DeliveryStatus;
use App\Enums\StageApprovalStatus;
use App\Services\DeliveryMovementNotifier;
use App\Services\NotificationService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

class DeliveryMovements
{
    /**
     * @param  array<string, mixed>  $incoming
     * @param  array<string, mixed>|null  $before  Previous status values. Defaults to the model that stores the log.
     */
    public static function capture(Model $store, array $incoming, ?array $before = null): void
    {
        if (! self::supports($store)) {
            return;
        }

        $before ??= [
            'script_status' => $store->getAttribute('script_status'),
            'video_status' => $store->getAttribute('video_status'),
            'delivery_status' => $store->getAttribute('delivery_status'),
            'status' => $store->getAttribute('status'),
        ];

        if (self::became($incoming, $before, 'script_status', StageApprovalStatus::Submitted->value)) {
            app(DeliveryMovementNotifier::class)->received($store, 'script');
        }
        if (self::became($incoming, $before, 'video_status', StageApprovalStatus::Submitted->value)) {
            app(DeliveryMovementNotifier::class)->received($store, 'video');
        } elseif (self::became($incoming, $before, 'delivery_status', DeliveryStatus::Sent->value)) {
            app(DeliveryMovementNotifier::class)->received($store, 'video');
        }

        foreach ([
            'script_status' => 'script_approved',
            'video_status' => 'video_approved',
        ] as $field => $type) {
            if (! array_key_exists($field, $incoming)) {
                continue;
            }
            $next = NotificationService::value($incoming[$field]);
            $previous = NotificationService::value($before[$field] ?? null);
            if ($next === StageApprovalStatus::Approved->value && $next !== $previous) {
                self::append($store, $type);
            }
        }

        $nextPublished = null;
        if (array_key_exists('delivery_status', $incoming)) {
            $nextPublished = NotificationService::value($incoming['delivery_status']);
        } elseif (array_key_exists('status', $incoming)) {
            $nextPublished = NotificationService::value($incoming['status']);
        }
        $wasPublished = NotificationService::value($before['delivery_status'] ?? null) === DeliveryStatus::Published->value
            || NotificationService::value($before['status'] ?? null) === DeliveryStatus::Published->value;
        if ($nextPublished === DeliveryStatus::Published->value && ! $wasPublished) {
            self::append($store, 'published');
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public static function append(Model $model, string $type, array $payload = []): void
    {
        $history = $model->getAttribute('movements');
        if (! is_array($history)) {
            $history = [];
        }

        $history[] = array_merge([
            'type' => $type,
            'at' => now()->toIso8601String(),
        ], $payload);

        $model->setAttribute('movements', $history);
    }

    /**
     * @param  array<string, mixed>  $incoming
     * @param  array<string, mixed>  $before
     */
    private static function became(array $incoming, array $before, string $field, string $expected): bool
    {
        if (! array_key_exists($field, $incoming)) {
            return false;
        }

        $next = NotificationService::value($incoming[$field]);
        $previous = NotificationService::value($before[$field] ?? null);

        return $next === $expected && $next !== $previous;
    }

    private static function supports(Model $model): bool
    {
        static $supported = [];
        $table = $model->getTable();
        if (! array_key_exists($table, $supported)) {
            $supported[$table] = Schema::hasColumn($table, 'movements');
        }

        return $supported[$table];
    }
}
