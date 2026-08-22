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
    'creator_invite_code',
])]
class Company extends Model
{
    /** @use HasFactory<CompanyFactory> */
    use HasFactory;

    private const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => CompanyStatus::class,
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Company $company) {
            if (! filled($company->creator_invite_code)) {
                $company->creator_invite_code = static::generateInviteCode();
            }
        });
    }

    public static function generateInviteCode(): string
    {
        do {
            $code = '';
            $max = strlen(self::INVITE_ALPHABET) - 1;
            for ($i = 0; $i < 8; $i++) {
                $code .= self::INVITE_ALPHABET[random_int(0, $max)];
            }
        } while (static::query()->where('creator_invite_code', $code)->exists());

        return $code;
    }

    public static function normalizeInviteCode(?string $code): string
    {
        return strtoupper((string) preg_replace('/[^A-Za-z0-9]/', '', (string) $code));
    }

    public static function findActiveByInviteCode(?string $code): ?static
    {
        $normalized = static::normalizeInviteCode($code);
        if ($normalized === '') {
            return null;
        }

        return static::query()
            ->where('creator_invite_code', $normalized)
            ->where('status', CompanyStatus::Active)
            ->first();
    }

    public function rotateInviteCode(): string
    {
        $this->creator_invite_code = static::generateInviteCode();
        $this->save();

        return (string) $this->creator_invite_code;
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

    public function invitedCreators(): HasMany
    {
        return $this->hasMany(Creator::class, 'invited_by_company_id');
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
