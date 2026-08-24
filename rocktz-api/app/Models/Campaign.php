<?php

namespace App\Models;

use App\Enums\ApprovalFlowType;
use App\Enums\CampaignStatus;
use App\Enums\PostingProfile;
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
    'barter_details',
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

    public function scopeForCreatorMarketplace($query, Creator $creator)
    {
        if ($creator->canAccessAllCountries()) {
            return $query;
        }

        return $query->whereHas('company', fn ($builder) => $builder->where('country', $creator->countryCode()));
    }
}
