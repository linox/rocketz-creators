<?php

namespace App\Models;

use App\Enums\NotificationTargetRole;
use App\Enums\NotificationType;
use App\Enums\UserRole;
use Database\Factories\NotificationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'creator_id',
    'campaign_id',
    'recurring_contract_id',
    'title',
    'message',
    'type',
    'target_role',
    'link',
    'read',
])]
class Notification extends Model
{
    /** @use HasFactory<NotificationFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => NotificationType::class,
            'target_role' => NotificationTargetRole::class,
            'read' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(Creator::class);
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }

    public function recurringContract(): BelongsTo
    {
        return $this->belongsTo(RecurringContract::class);
    }

    public function scopeVisibleTo(Builder $query, User $user): void
    {
        if ($user->role === UserRole::Admin) {
            return;
        }

        if ($user->role === UserRole::Creator) {
            $creatorId = $user->creator?->id;
            $query->where(function (Builder $builder) use ($user, $creatorId) {
                $builder->where('user_id', $user->id);
                if ($creatorId) {
                    $builder->orWhere(function (Builder $inner) use ($creatorId) {
                        $inner->where('creator_id', $creatorId)
                            ->where('target_role', NotificationTargetRole::Creator);
                    });
                }
            });

            return;
        }

        $query->where('user_id', $user->id);
    }
}
