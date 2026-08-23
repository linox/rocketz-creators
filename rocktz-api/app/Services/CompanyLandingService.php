<?php

namespace App\Services;

use App\Enums\CompanyStatus;
use App\Enums\LandingPageStatus;
use App\Enums\LandingSignupStatus;
use App\Enums\NotificationType;
use App\Models\Company;
use App\Models\CompanyLandingPage;
use App\Models\CompanyLandingSignup;
use App\Models\Creator;
use App\Models\User;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class CompanyLandingService
{
    public function __construct(private readonly NotificationService $notifications) {}

    public function firstOrCreateForCompany(Company $company): CompanyLandingPage
    {
        $existing = $company->landingPage;
        if ($existing) {
            return $existing;
        }

        return CompanyLandingPage::query()->create([
            'company_id' => $company->id,
            'slug' => $this->uniqueSlug($company->name),
            'display_name' => $company->name,
            'logo_url' => $company->logo_url,
            'status' => LandingPageStatus::Draft,
            'socials' => [],
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(CompanyLandingPage $page, array $data): CompanyLandingPage
    {
        if (array_key_exists('slug', $data) && filled($data['slug'])) {
            $slug = CompanyLandingPage::normalizeSlug((string) $data['slug']);
            $this->assertSlugAvailable($slug, $page->id);
            $data['slug'] = $slug;
        }

        if (isset($data['socials']) && is_array($data['socials'])) {
            $data['socials'] = $this->sanitizeSocials($data['socials']);
        }

        $page->fill($data)->save();

        return $page->fresh() ?? $page;
    }

    public function publish(CompanyLandingPage $page): CompanyLandingPage
    {
        abort_unless(
            $page->company?->status === CompanyStatus::Active,
            422,
            __('auth.company_not_approved'),
        );

        $this->assertSlugAvailable($page->slug, $page->id);

        $page->forceFill([
            'status' => LandingPageStatus::Published,
            'published_at' => $page->published_at ?? now(),
        ])->save();

        return $page->fresh() ?? $page;
    }

    public function disable(CompanyLandingPage $page): CompanyLandingPage
    {
        $page->forceFill([
            'status' => LandingPageStatus::Disabled,
        ])->save();

        return $page->fresh() ?? $page;
    }

    public function publishedBySlug(string $slug): CompanyLandingPage
    {
        $normalized = CompanyLandingPage::normalizeSlug($slug);
        $page = CompanyLandingPage::query()
            ->with('company')
            ->where('slug', $normalized)
            ->first();

        abort_unless(
            $page?->isPublished() && $page->company?->status === CompanyStatus::Active,
            404,
            __('auth.landing_unavailable'),
        );

        return $page;
    }

    public function trackEvent(CompanyLandingPage $page, string $event): void
    {
        $column = match ($event) {
            'view' => 'views_count',
            'cta_click' => 'cta_clicks_count',
            'signup_started' => 'signups_started_count',
            default => null,
        };

        if (! $column) {
            return;
        }

        $page->increment($column);
    }

    public function attributeCreator(string $slug, Creator $creator, bool $notify = true): CompanyLandingSignup
    {
        $page = $this->publishedBySlug($slug);

        $signup = CompanyLandingSignup::query()->firstOrCreate(
            [
                'company_id' => $page->company_id,
                'creator_id' => $creator->id,
            ],
            [
                'company_landing_page_id' => $page->id,
                'status' => LandingSignupStatus::Pending,
            ],
        );

        if ($signup->wasRecentlyCreated) {
            $page->increment('signups_completed_count');

            if ($notify) {
                $this->notifyCompanyOfSignup($page, $creator);
            }
        }

        return $signup->fresh(['creator.user', 'creator.portfolioVideos']) ?? $signup;
    }

    public function updateSignupStatus(
        CompanyLandingSignup $signup,
        LandingSignupStatus $status,
        ?User $reviewer,
    ): CompanyLandingSignup {
        $signup->forceFill([
            'status' => $status,
            'reviewed_at' => in_array($status, [LandingSignupStatus::Approved, LandingSignupStatus::Rejected], true)
                ? now()
                : $signup->reviewed_at,
            'reviewed_by_user_id' => $reviewer?->id ?? $signup->reviewed_by_user_id,
        ])->save();

        return $signup->fresh(['creator.user', 'creator.portfolioVideos', 'reviewedBy']) ?? $signup;
    }

    /**
     * @return array<string, int|float>
     */
    public function metrics(CompanyLandingPage $page): array
    {
        $signups = $page->signups();
        $approved = (clone $signups)->where('status', LandingSignupStatus::Approved)->count();
        $rejected = (clone $signups)->where('status', LandingSignupStatus::Rejected)->count();
        $reviewing = (clone $signups)->where('status', LandingSignupStatus::Reviewing)->count();
        $pending = (clone $signups)->where('status', LandingSignupStatus::Pending)->count();
        $completed = (int) $page->signups_completed_count;
        $views = (int) $page->views_count;
        $analyzed = $approved + $rejected + $reviewing;

        return [
            'views' => $views,
            'cta_clicks' => (int) $page->cta_clicks_count,
            'signups_started' => (int) $page->signups_started_count,
            'signups_completed' => $completed,
            'pending' => $pending,
            'reviewing' => $reviewing,
            'analyzed' => $analyzed,
            'approved' => $approved,
            'rejected' => $rejected,
            'conversion_rate' => $views > 0 ? round(($completed / $views) * 100, 1) : 0,
        ];
    }

    public function uniqueSlug(string $source, ?int $ignoreId = null): string
    {
        $base = CompanyLandingPage::normalizeSlug($source);
        if ($base === '' || strlen($base) < 3) {
            $base = 'marca';
        }

        $candidate = $base;
        $suffix = 2;

        while (! $this->slugIsFree($candidate, $ignoreId)) {
            $candidate = $base.'-'.$suffix;
            $suffix++;
        }

        return $candidate;
    }

    public function assertSlugAvailable(string $slug, ?int $ignoreId = null): void
    {
        $normalized = CompanyLandingPage::normalizeSlug($slug);

        if ($normalized === '' || strlen($normalized) < 3) {
            throw ValidationException::withMessages([
                'slug' => [__('auth.landing_slug_invalid')],
            ]);
        }

        if (CompanyLandingPage::isReservedSlug($normalized)) {
            throw ValidationException::withMessages([
                'slug' => [__('auth.landing_slug_reserved')],
            ]);
        }

        if (! $this->slugIsFree($normalized, $ignoreId)) {
            throw ValidationException::withMessages([
                'slug' => [__('auth.landing_slug_taken')],
            ]);
        }
    }

    private function slugIsFree(string $slug, ?int $ignoreId = null): bool
    {
        if (CompanyLandingPage::isReservedSlug($slug)) {
            return false;
        }

        return ! CompanyLandingPage::query()
            ->where('slug', $slug)
            ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->exists();
    }

    /**
     * @param  array<string, mixed>  $socials
     * @return array<string, string>
     */
    private function sanitizeSocials(array $socials): array
    {
        $allowed = ['instagram', 'tiktok', 'youtube', 'linkedin'];
        $clean = [];

        foreach ($allowed as $network) {
            $value = trim((string) ($socials[$network] ?? ''));
            if ($value !== '') {
                $clean[$network] = Str::limit($value, 255, '');
            }
        }

        return $clean;
    }

    private function notifyCompanyOfSignup(CompanyLandingPage $page, Creator $creator): void
    {
        $name = $creator->artistic_name ?: $creator->full_name;

        $this->notifications->notifyCompany($page->company_id, [
            'creator_id' => $creator->id,
            'title' => __('auth.landing_signup_title'),
            'message' => __('auth.landing_signup_message', ['name' => $name]),
            'type' => NotificationType::Application,
            'link' => '/creators/'.$creator->id.'?from=landing',
        ]);
    }
}
