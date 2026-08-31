<?php

namespace App\Models;

use App\Enums\ApplicationStatus;
use App\Enums\ApprovalFlowType;
use App\Enums\CampaignStatus;
use App\Enums\PostingProfile;
use App\Support\Geo;
use Database\Factories\CampaignFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable([
    'company_id',
    'name',
    'objective',
    'start_date',
    'end_date',
    'total_budget',
    'agency_fee',
    'agency_fee_percent',
    'creators_budget',
    'creator_cache',
    'currency',
    'status',
    'image_url',
    'is_secret',
    'is_direct_contract',
    'is_barter',
    'limit_by_city',
    'state',
    'city',
    'barter_details',
    'has_custom_contract',
    'custom_contract_terms',
    'approval_flow',
    'posting_profile',
])]
class Campaign extends Model
{
    public const DEFAULT_AGENCY_FEE_PERCENT = 20.0;

    /** @use HasFactory<CampaignFactory> */
    use HasFactory;

    /**
     * @return array{agency_fee_percent: float, agency_fee: float, creators_budget: float}
     */
    public static function feeSplit(?float $totalBudget, ?float $percent = null): array
    {
        $percent = max(0, min(100, $percent ?? self::DEFAULT_AGENCY_FEE_PERCENT));
        $budget = max(0, (float) $totalBudget);
        $agencyFee = round($budget * $percent / 100, 2);

        return [
            'agency_fee_percent' => round($percent, 2),
            'agency_fee' => $agencyFee,
            'creators_budget' => round($budget - $agencyFee, 2),
        ];
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'total_budget' => 'decimal:2',
            'agency_fee' => 'decimal:2',
            'agency_fee_percent' => 'decimal:2',
            'creators_budget' => 'decimal:2',
            'creator_cache' => 'decimal:2',
            'status' => CampaignStatus::class,
            'is_secret' => 'boolean',
            'is_direct_contract' => 'boolean',
            'is_barter' => 'boolean',
            'limit_by_city' => 'boolean',
            'has_custom_contract' => 'boolean',
            'approval_flow' => ApprovalFlowType::class,
            'posting_profile' => PostingProfile::class,
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function briefing(): HasOne
    {
        return $this->hasOne(CampaignBriefing::class);
    }

    public function deliverable(): HasOne
    {
        return $this->hasOne(CampaignDeliverable::class);
    }

    public function campaignCreators(): HasMany
    {
        return $this->hasMany(CampaignCreator::class);
    }

    public function creators(): BelongsToMany
    {
        return $this->belongsToMany(Creator::class, 'campaign_creators')
            ->withTimestamps();
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    }

    public function isPendingAgency(): bool
    {
        return $this->status === CampaignStatus::PendingAgency;
    }

    public function approvedCreatorsAmount(): float
    {
        if (isset($this->approved_creators_amount)) {
            return round((float) $this->approved_creators_amount, 2);
        }

        if ($this->relationLoaded('campaignCreators')) {
            return round((float) $this->campaignCreators
                ->filter(fn (CampaignCreator $row) => $row->application_status === ApplicationStatus::Approved)
                ->sum(fn (CampaignCreator $row) => (float) $row->amount), 2);
        }

        return round((float) $this->campaignCreators()
            ->where('application_status', ApplicationStatus::Approved)
            ->sum('amount'), 2);
    }

    public function creatorsBudgetLimit(): float
    {
        return round((float) ($this->creators_budget ?? 0), 2);
    }

    public function requiresCustomContract(): bool
    {
        return (bool) $this->has_custom_contract && filled($this->custom_contract_terms);
    }

    public function isAcceptingApplications(): bool
    {
        if ($this->is_barter) {
            return true;
        }

        $limit = $this->creatorsBudgetLimit();
        if ($limit <= 0) {
            return true;
        }

        return $this->approvedCreatorsAmount() < $limit;
    }

    public function matchesCreatorLocation(?Creator $creator): bool
    {
        if (! $this->limit_by_city) {
            return true;
        }
        if (! $creator) {
            return false;
        }

        $state = Geo::normalizeRegion($this->state);
        if ($state !== '' && Geo::normalizeRegion($creator->state) !== $state) {
            return false;
        }

        $city = mb_strtolower(trim((string) $this->city));
        if ($city !== '' && mb_strtolower(trim((string) $creator->city)) !== $city) {
            return false;
        }

        return $state !== '' || $city !== '';
    }

    public function scopeMatchingCreatorLocation($query, Creator $creator)
    {
        return $query->where(function ($builder) use ($creator) {
            $builder->where('limit_by_city', false)
                ->orWhere(function ($limited) use ($creator) {
                    $state = Geo::normalizeRegion($creator->state);
                    $city = trim((string) $creator->city);
                    $limited->where('limit_by_city', true);
                    if ($state === '' || $city === '') {
                        $limited->whereRaw('0 = 1');

                        return;
                    }
                    $limited->whereRaw('UPPER(state) = ?', [$state])
                        ->whereRaw('LOWER(TRIM(city)) = LOWER(TRIM(?))', [$city]);
                });
        });
    }

    public function scopeForCreatorMarketplace($query, Creator $creator)
    {
        if (! $creator->canAccessAllCountries()) {
            $query->whereHas('company', fn ($builder) => $builder->where('country', $creator->countryCode()));
        }

        return $query->where(function ($builder) use ($creator) {
            $builder->matchingCreatorLocation($creator)
                ->orWhereHas('campaignCreators', fn ($q) => $q->where('creator_id', $creator->id));
        });
    }
}
