<?php

namespace App\Models;

use App\Enums\CompanyStatus;
use App\Support\Geo;
use Database\Factories\CompanyFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'name',
    'cnpj',
    'segment',
    'responsible_name',
    'whatsapp',
    'email',
    'city',
    'country',
    'currency',
    'observations',
    'logo_url',
    'objective',
    'status',
])]
class Company extends Model
{
    /** @use HasFactory<CompanyFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => CompanyStatus::class,
        ];
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(CompanyContact::class);
    }

    public function companyUsers(): HasMany
    {
        return $this->hasMany(CompanyUser::class);
    }

    public function favoriteCreators(): BelongsToMany
    {
        return $this->belongsToMany(Creator::class, 'company_favorite_creators')
            ->withTimestamps();
    }

    public function campaigns(): HasMany
    {
        return $this->hasMany(Campaign::class);
    }

    public function recurringContracts(): HasMany
    {
        return $this->hasMany(RecurringContract::class);
    }

    public function contentPlanningItems(): HasMany
    {
        return $this->hasMany(ContentPlanningItem::class);
    }

    public static function assertApproved(?int $companyId): void
    {
        abort_unless($companyId, 422, __('auth.company_not_linked'));

        $company = static::query()->find($companyId);
        abort_unless($company, 422, __('auth.company_not_linked'));
        abort_unless(
            $company->status === CompanyStatus::Active,
            422,
            __('auth.company_not_approved'),
        );
    }

    public function countryCode(): string
    {
        return Geo::isValidCountry($this->country) ? Geo::normalizeCountry($this->country) : Geo::DEFAULT_COUNTRY;
    }

    public function currencyCode(): string
    {
        return Geo::isValidCurrency($this->currency) ? Geo::normalizeCurrency($this->currency) : Geo::defaultCurrency($this->countryCode());
    }
}
