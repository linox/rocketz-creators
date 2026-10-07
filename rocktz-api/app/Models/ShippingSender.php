<?php

namespace App\Models;

use App\Enums\UserRole;
use Database\Factories\ShippingSenderFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'company_id',
    'created_by_user_id',
    'name',
    'phone',
    'address',
])]
class ShippingSender extends Model
{
    /** @use HasFactory<ShippingSenderFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'address' => 'array',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    /**
     * Agency sees every saved sender. A company sees only senders it created.
     *
     * @param  Builder<ShippingSender>  $query
     * @return Builder<ShippingSender>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->role === UserRole::Admin) {
            return $query;
        }

        $companyId = (int) $user->actingCompanyId();

        return $query->where('company_id', $companyId > 0 ? $companyId : 0);
    }
}
