<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'alert_key',
    'fingerprint',
    'ping_count',
    'ping_on',
    'last_ping_at',
    'seen_at',
    'seen_fingerprint',
])]
class BrowserAlertPing extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'ping_count' => 'integer',
            'ping_on' => 'date',
            'last_ping_at' => 'datetime',
            'seen_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
