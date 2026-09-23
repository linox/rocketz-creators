<?php

namespace App\Models;

use App\Enums\NotificationTargetRole;
use App\Enums\NotificationType;
use App\Enums\UserRole;
use BackedEnum;
use Database\Factories\NotificationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Collection;

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
            $query->where(function (Builder $builder) use ($user) {
                $builder->where('user_id', $user->id)
                    ->orWhereNull('user_id');
            });

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

    /**
     * Copies of this same event. Audience oversight can include every recipient.
     */
    public function replicas(bool $allRecipients = false): Builder
    {
        $query = static::query()
            ->where('title', $this->title)
            ->where('message', $this->message)
            ->where('type', $this->type)
            ->where('target_role', $this->target_role)
            ->where('link', $this->link)
            ->where('creator_id', $this->creator_id)
            ->where('campaign_id', $this->campaign_id)
            ->where('recurring_contract_id', $this->recurring_contract_id);

        if (! $allRecipients) {
            $query->where('user_id', $this->user_id);
        }

        if ($this->created_at) {
            $query->whereDate('created_at', $this->created_at->toDateString());
        }

        return $query;
    }

    /**
     * One card per event. Repeated writes for the same recipient on the same day stay collapsed.
     *
     * @param  Collection<int, self>  $notifications
     * @return Collection<int, self>
     */
    public static function collapseCopies(Collection $notifications, bool $perRecipient = true): Collection
    {
        $seen = [];
        $kept = new Collection;

        $sorted = $notifications->sortByDesc(
            fn (self $notification) => sprintf(
                '%010d-%010d',
                $notification->created_at?->getTimestamp() ?? 0,
                $notification->id,
            ),
        );

        foreach ($sorted as $notification) {
            $key = $notification->collapseKey($perRecipient);
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $kept->push($notification);
        }

        return $kept->values();
    }

    public function collapseKey(bool $perRecipient = true): string
    {
        $type = $this->type instanceof BackedEnum ? $this->type->value : (string) $this->type;
        $role = $this->target_role instanceof BackedEnum ? $this->target_role->value : (string) $this->target_role;

        return implode("\0", [
            $perRecipient ? (string) ($this->user_id ?? '') : '',
            (string) $this->title,
            (string) $this->message,
            $type,
            $role,
            (string) ($this->link ?? ''),
            (string) ($this->creator_id ?? ''),
            (string) ($this->campaign_id ?? ''),
            (string) ($this->recurring_contract_id ?? ''),
            $this->created_at?->toDateString() ?? '',
        ]);
    }
}
