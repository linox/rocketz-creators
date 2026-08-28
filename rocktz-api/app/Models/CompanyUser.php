<?php

namespace App\Models;

use App\Enums\CompanyStatus;
use Database\Factories\CompanyUserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_id', 'company_id', 'status', 'can_publish_without_approval'])]
class CompanyUser extends Model
{
    /** @use HasFactory<CompanyUserFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => CompanyStatus::class,
            'can_publish_without_approval' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    protected static function booted(): void
    {
        static::created(function (CompanyUser $row) {
            $user = $row->user;
            if ($user && ! $user->active_company_id) {
                $user->forceFill(['active_company_id' => $row->company_id])->saveQuietly();
            }
        });

        static::deleted(function (CompanyUser $row) {
            $user = User::query()->find($row->user_id);
            $user?->ensureActiveCompany();
        });
    }
}
