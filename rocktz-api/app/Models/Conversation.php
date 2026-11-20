<?php

namespace App\Models;

use App\Enums\ConversationCloseReason;
use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable([
    'subject',
    'company_id',
    'creator_id',
    'campaign_id',
    'recurring_contract_id',
    'with_agency',
    'created_by',
    'last_message_at',
    'closed_at',
    'close_reason',
])]
class Conversation extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'with_agency' => 'boolean',
            'last_message_at' => 'datetime',
            'closed_at' => 'datetime',
            'close_reason' => ConversationCloseReason::class,
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
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

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(ConversationMessage::class);
    }

    public function latestMessage(): HasOne
    {
        return $this->hasOne(ConversationMessage::class)->latestOfMany();
    }

    public function reads(): HasMany
    {
        return $this->hasMany(ConversationRead::class);
    }

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return match ($user->role) {
            UserRole::Admin => $query,
            UserRole::Company => $query->where('company_id', $user->actingCompanyId() ?? 0),
            UserRole::Creator => $query->where('creator_id', $user->creator?->id ?? 0),
        };
    }
}
