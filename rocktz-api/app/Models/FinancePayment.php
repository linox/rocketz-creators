<?php

namespace App\Models;

use App\Enums\FinancePaymentSource;
use App\Enums\FinancePaymentStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'company_id',
    'creator_id',
    'source',
    'campaign_id',
    'campaign_creator_id',
    'recurring_contract_id',
    'reference_month',
    'amount',
    'currency',
    'invoice_due_date',
    'payment_due_date',
    'status',
    'invoice_media_id',
    'invoice_submitted_at',
    'rejection_reason',
    'reviewed_at',
    'reviewed_by',
    'paid_at',
    'dedupe_key',
])]
class FinancePayment extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'source' => FinancePaymentSource::class,
            'reference_month' => 'date',
            'amount' => 'decimal:2',
            'invoice_due_date' => 'date',
            'payment_due_date' => 'date',
            'status' => FinancePaymentStatus::class,
            'invoice_submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'paid_at' => 'date',
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

    public function campaignCreator(): BelongsTo
    {
        return $this->belongsTo(CampaignCreator::class);
    }

    public function recurringContract(): BelongsTo
    {
        return $this->belongsTo(RecurringContract::class);
    }

    public function invoiceMedia(): BelongsTo
    {
        return $this->belongsTo(MediaFile::class, 'invoice_media_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function owesInvoice(): bool
    {
        return $this->status?->owesInvoice() ?? false;
    }
}
