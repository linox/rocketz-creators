<?php

namespace App\Models;

use App\Enums\CreatorStatus;
use App\Support\Geo;
use Database\Factories\CreatorFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
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
