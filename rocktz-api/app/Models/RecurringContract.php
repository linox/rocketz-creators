<?php

namespace App\Models;

use App\Enums\RecurringContractStatus;
use Database\Factories\RecurringContractFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'company_id',
    'title',
    'objective',
    'start_date',
    'end_date',
    'status',
    'monthly_fee',
    'currency',
    'notes',
])]
class RecurringContract extends Model
{
    /** @use HasFactory<RecurringContractFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'status' => RecurringContractStatus::class,
            'monthly_fee' => 'decimal:2',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function recurringContractCreators(): HasMany
    {
        return $this->hasMany(RecurringContractCreator::class);
    }

    public function creators(): BelongsToMany
    {
        return $this->belongsToMany(Creator::class, 'recurring_contract_creators')
            ->withTimestamps();
    }

    public function contentPlanningItems(): HasMany
    {
        return $this->hasMany(ContentPlanningItem::class);
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    }

    public function isPendingAgency(): bool
    {
        return $this->status === RecurringContractStatus::PendingAgency;
    }
}
