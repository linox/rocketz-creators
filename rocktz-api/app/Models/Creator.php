<?php

namespace App\Models;

use App\Enums\CreatorStatus;
use App\Enums\Permission;
use App\Enums\UserRole;
use App\Support\Geo;
use Database\Factories\CreatorFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'user_id',
    'full_name',
    'artistic_name',
    'photo_url',
    'document',
    'cpf',
    'whatsapp',
    'city',
    'country',
    'state',
    'birth_date',
    'pix_key',
    'bank_details',
    'socials',
    'metrics',
    'categories',
    'pricing',
    'accepts_exchange',
    'accepts_paid_traffic',
    'accepts_exclusivity',
    'bio',
    'work_affinities',
    'internal_notes',
    'status',
    'can_access_all_countries',
    'invited_by_company_id',
])]
class Creator extends Model
{
    /** @use HasFactory<CreatorFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'birth_date' => 'date',
            'socials' => 'array',
            'metrics' => 'array',
            'categories' => 'array',
            'pricing' => 'array',
            'accepts_exchange' => 'boolean',
            'accepts_paid_traffic' => 'boolean',
            'accepts_exclusivity' => 'boolean',
            'work_affinities' => 'array',
            'status' => CreatorStatus::class,
            'can_access_all_countries' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function invitedByCompany(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'invited_by_company_id');
    }

    public function portfolioVideos(): HasMany
    {
        return $this->hasMany(CreatorPortfolioVideo::class);
    }

    public function contractAcceptances(): HasMany
    {
        return $this->hasMany(CreatorContractAcceptance::class);
    }

    public function favoritedByCompanies(): BelongsToMany
    {
        return $this->belongsToMany(Company::class, 'company_favorite_creators')
            ->withTimestamps();
    }

    public function campaignCreators(): HasMany
    {
        return $this->hasMany(CampaignCreator::class);
    }

    public function campaigns(): BelongsToMany
    {
        return $this->belongsToMany(Campaign::class, 'campaign_creators')
            ->withTimestamps();
    }

    public function recurringContractCreators(): HasMany
    {
        return $this->hasMany(RecurringContractCreator::class);
    }

    public function contentPlanningItems(): HasMany
    {
        return $this->hasMany(ContentPlanningItem::class);
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    }

    public function landingSignups(): HasMany
    {
        return $this->hasMany(CompanyLandingSignup::class);
    }

    public function scopeInCompanyPool(Builder $query, int $companyId): Builder
    {
        return $query->where(function (Builder $builder) use ($companyId) {
            $builder->where('invited_by_company_id', $companyId)
                ->orWhereHas('landingSignups', fn (Builder $inner) => $inner->where('company_id', $companyId));
        });
    }

    public function isInCompanyPool(int $companyId): bool
    {
        if ($this->invited_by_company_id && (int) $this->invited_by_company_id === $companyId) {
            return true;
        }

        if ($this->relationLoaded('landingSignups')) {
            return $this->landingSignups->contains(
                fn (CompanyLandingSignup $signup) => (int) $signup->company_id === $companyId
            );
        }

        return $this->landingSignups()->where('company_id', $companyId)->exists();
    }

    public function canBeModeratedBy(?User $user): bool
    {
        if (! $user || $this->status !== CreatorStatus::Review) {
            return false;
        }

        if ($user->role === UserRole::Admin) {
            return $user->hasPermission(Permission::CreatorsModerate);
        }

        if ($user->role !== UserRole::Company) {
            return false;
        }

        $companyId = (int) $user->companyUser?->company_id;

        return $companyId > 0 && $this->isInCompanyPool($companyId);
    }

    public function isAccessibleByCompany(int $companyId): bool
    {
        if ($this->isInCompanyPool($companyId)) {
            return true;
        }

        if ($this->campaignCreators()->whereHas('campaign', fn (Builder $query) => $query->where('company_id', $companyId))->exists()) {
            return true;
        }

        return $this->recurringContractCreators()
            ->whereHas('recurringContract', fn (Builder $query) => $query->where('company_id', $companyId))
            ->exists();
    }

    public function countryCode(): string
    {
        return Geo::isValidCountry($this->country) ? Geo::normalizeCountry($this->country) : Geo::DEFAULT_COUNTRY;
    }

    public function canAccessAllCountries(): bool
    {
        return filter_var($this->can_access_all_countries, FILTER_VALIDATE_BOOLEAN);
    }

    public function canAccessCompanyCountry(?Company $company): bool
    {
        if ($this->canAccessAllCountries()) {
            return true;
        }

        $companyCountry = $company?->countryCode() ?: Geo::DEFAULT_COUNTRY;

        return $this->countryCode() === $companyCountry;
    }
}
