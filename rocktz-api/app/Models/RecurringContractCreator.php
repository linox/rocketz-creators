<?php

namespace App\Models;

use Database\Factories\RecurringContractCreatorFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'recurring_contract_id',
    'creator_id',
    'start_date',
    'end_date',
    'monthly_cache',
    'monthly_fee',
    'deliverables_fee',
    'monthly_deliverables',
    'notes',
])]
class RecurringContractCreator extends Model
{
    /** @use HasFactory<RecurringContractCreatorFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'monthly_cache' => 'decimal:2',
            'monthly_fee' => 'decimal:2',
            'deliverables_fee' => 'decimal:2',
            'monthly_deliverables' => 'array',
        ];
    }

    public function recurringContract(): BelongsTo
    {
        return $this->belongsTo(RecurringContract::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(Creator::class);
    }
}
