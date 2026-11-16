<?php

namespace App\Models;

use App\Enums\CreatorVideoUsageKind;
use App\Enums\CreatorVideoUsageSource;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'creator_video_id',
    'kind',
    'url',
    'note',
    'occurred_at',
    'recorded_by',
    'source',
    'fingerprint',
])]
class CreatorVideoUsage extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'kind' => CreatorVideoUsageKind::class,
            'source' => CreatorVideoUsageSource::class,
            'occurred_at' => 'datetime',
        ];
    }

    public function video(): BelongsTo
    {
        return $this->belongsTo(CreatorVideo::class, 'creator_video_id');
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
