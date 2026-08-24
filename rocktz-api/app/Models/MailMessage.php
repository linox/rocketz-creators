<?php

namespace App\Models;

use App\Enums\MailMessageStatus;
use App\Enums\MailTemplateKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class MailMessage extends Model
{
    protected $fillable = [
        'user_id',
        'email',
        'template_key',
        'subject',
        'status',
        'provider_id',
        'idempotency_key',
        'attempts',
        'failure_reason',
        'related_type',
        'related_id',
        'campaign_id',
        'company_id',
        'creator_id',
        'payload',
        'scheduled_at',
        'sent_at',
        'delivered_at',
        'opened_at',
        'clicked_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'template_key' => MailTemplateKey::class,
            'status' => MailMessageStatus::class,
            'payload' => 'array',
            'scheduled_at' => 'datetime',
            'sent_at' => 'datetime',
            'delivered_at' => 'datetime',
            'opened_at' => 'datetime',
            'clicked_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function related(): MorphTo
    {
        return $this->morphTo();
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(Creator::class);
    }
}
