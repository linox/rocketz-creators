<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserNotificationPreference extends Model
{
    protected $fillable = [
        'user_id',
        'opportunities',
        'campaign_updates',
        'new_demands',
        'deadline_reminders',
        'delivery_updates',
        'promotional',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'opportunities' => 'boolean',
            'campaign_updates' => 'boolean',
            'new_demands' => 'boolean',
            'deadline_reminders' => 'boolean',
            'delivery_updates' => 'boolean',
            'promotional' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function allows(string $flag): bool
    {
        return (bool) ($this->getAttribute($flag) ?? true);
    }
}
