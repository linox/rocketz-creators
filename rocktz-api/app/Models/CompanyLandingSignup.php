<?php

namespace App\Models;

use App\Enums\LandingSignupStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'company_id',
    'company_landing_page_id',
    'creator_id',
    'status',
    'reviewed_at',
    'reviewed_by_user_id',
])]
class CompanyLandingSignup extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => LandingSignupStatus::class,
            'reviewed_at' => 'datetime',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function landingPage(): BelongsTo
    {
        return $this->belongsTo(CompanyLandingPage::class, 'company_landing_page_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(Creator::class);
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by_user_id');
    }
}
