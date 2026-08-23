<?php

namespace App\Models;

use App\Enums\LandingPageStatus;
use Database\Factories\CompanyLandingPageFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

#[Fillable([
    'company_id',
    'slug',
    'display_name',
    'logo_url',
    'banner_url',
    'title',
    'description',
    'cta_text',
    'primary_color',
    'button_color',
    'background_color',
    'website_url',
    'socials',
    'status',
    'views_count',
    'cta_clicks_count',
    'signups_started_count',
    'signups_completed_count',
    'published_at',
])]
class CompanyLandingPage extends Model
{
    /** @use HasFactory<CompanyLandingPageFactory> */
    use HasFactory;

    /** @var list<string> */
    public const RESERVED_SLUGS = [
        'admin',
        'api',
        'auth',
        'available-campaigns',
        'campaign-deliveries',
        'campaigns',
        'companies',
        'company-dashboard',
        'company-landing',
        'creator-dashboard',
        'creators',
        'dashboard',
        'health',
        'join',
        'l',
        'login',
        'media',
        'notifications',
        'recurring',
        'reset-password',
        'uploads',
        'users',
        'admin-users',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'socials' => 'array',
            'status' => LandingPageStatus::class,
            'published_at' => 'datetime',
            'views_count' => 'integer',
            'cta_clicks_count' => 'integer',
            'signups_started_count' => 'integer',
            'signups_completed_count' => 'integer',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function signups(): HasMany
    {
        return $this->hasMany(CompanyLandingSignup::class);
    }

    public static function normalizeSlug(?string $slug): string
    {
        return Str::slug((string) $slug);
    }

    public static function isReservedSlug(string $slug): bool
    {
        return in_array($slug, self::RESERVED_SLUGS, true);
    }

    public function isPublished(): bool
    {
        return $this->status === LandingPageStatus::Published;
    }
}
