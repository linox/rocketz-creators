<?php

namespace App\Models;

use App\Enums\ContractAcceptanceStatus;
use Database\Factories\CreatorContractAcceptanceFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'creator_id',
    'term_id',
    'version',
    'full_name',
    'document',
    'email',
    'accepted_at',
    'ip',
    'user_agent',
    'declarations',
    'all_accepted',
    'status',
])]
class CreatorContractAcceptance extends Model
{
    /** @use HasFactory<CreatorContractAcceptanceFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'accepted_at' => 'datetime',
            'declarations' => 'array',
            'all_accepted' => 'boolean',
            'status' => ContractAcceptanceStatus::class,
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(Creator::class);
    }
}
