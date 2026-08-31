<?php

namespace App\Models;

use App\Enums\ApplicationStatus;
use App\Enums\DeliveryStatus;
use App\Enums\PaymentStatus;
use App\Enums\SignatureStatus;
use App\Enums\StageApprovalStatus;
use Database\Factories\CampaignCreatorFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable([
    'campaign_id',
    'creator_id',
    'delivery_type',
    'amount',
    'delivery_date',
    'post_date',
    'delivery_status',
    'payment_status',
    'payment_date',
    'notes',
    'application_status',
    'rejection_reason',
    'revision_details',
    'script_status',
    'video_status',
    'script_feedback',
    'video_feedback',
    'script_submitted_at',
    'video_submitted_at',
    'pending_upload_id',
    'upload_progress',
    'signature_status',
    'signature_sent_at',
    'signature_signed_at',
    'contract_url',
    'custom_contract_accepted_at',
])]
class CampaignCreator extends Model
{
    /** @use HasFactory<CampaignCreatorFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'delivery_date' => 'date',
            'post_date' => 'date',
            'delivery_status' => DeliveryStatus::class,
            'payment_status' => PaymentStatus::class,
            'payment_date' => 'date',
            'application_status' => ApplicationStatus::class,
            'script_status' => StageApprovalStatus::class,
            'video_status' => StageApprovalStatus::class,
            'script_submitted_at' => 'datetime',
            'video_submitted_at' => 'datetime',
            'signature_status' => SignatureStatus::class,
            'signature_sent_at' => 'datetime',
            'signature_signed_at' => 'datetime',
            'custom_contract_accepted_at' => 'datetime',
        ];
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(Creator::class);
    }

    public function content(): HasOne
    {
        return $this->hasOne(CampaignCreatorContent::class);
    }
}
