<?php

namespace App\Models;

use App\Enums\MailTemplateKey;
use App\Enums\Permission;
use App\Enums\UserRole;
use App\Services\Mail\TransactionalMailService;
use App\Support\AppLocale;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Translation\HasLocalePreference;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'password', 'role', 'google_id', 'avatar_url', 'locale', 'active_company_id'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable implements HasLocalePreference
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
            'two_factor_enabled' => 'boolean',
        ];
    }

    public function twoFactorChallenges(): HasMany
    {
        return $this->hasMany(TwoFactorChallenge::class);
    }

    public function creator(): HasOne
    {
        return $this->hasOne(Creator::class);
    }

    public function companyUsers(): HasMany
    {
        return $this->hasMany(CompanyUser::class);
    }

    public function companyUser(): HasOne
    {
        return $this->hasOne(CompanyUser::class);
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'active_company_id');
    }

    /**
     * @return list<int>
     */
    public function companyIds(): array
    {
        if ($this->relationLoaded('companyUsers')) {
            return $this->companyUsers->pluck('company_id')->map(fn ($id) => (int) $id)->values()->all();
        }

        return $this->companyUsers()->pluck('company_id')->map(fn ($id) => (int) $id)->values()->all();
    }

    public function actingCompanyId(): ?int
    {
        $id = (int) $this->active_company_id;
        if ($id > 0 && in_array($id, $this->companyIds(), true)) {
            return $id;
        }

        $first = $this->companyIds()[0] ?? 0;

        return $first > 0 ? $first : null;
    }

    public function belongsToCompany(int $companyId): bool
    {
        return in_array($companyId, $this->companyIds(), true);
    }

    public function actingCompanyUser(): ?CompanyUser
    {
        $companyId = $this->actingCompanyId();
        if (! $companyId) {
            return null;
        }

        if ($this->relationLoaded('companyUsers')) {
            return $this->companyUsers->firstWhere('company_id', $companyId);
        }

        if ($this->relationLoaded('companyUser') && $this->companyUser?->company_id === $companyId) {
            return $this->companyUser;
        }

        return $this->companyUsers()->where('company_id', $companyId)->first();
    }

    public function ensureActiveCompany(): void
    {
        if ($this->role !== UserRole::Company) {
            return;
        }

        $resolved = $this->actingCompanyId();
        if ((int) $this->active_company_id === (int) $resolved) {
            return;
        }

        $this->forceFill(['active_company_id' => $resolved])->saveQuietly();
        $this->unsetRelation('company');
        $this->unsetRelation('companyUser');
    }

    public function switchActiveCompany(int $companyId): void
    {
        abort_unless($this->role === UserRole::Company && $this->belongsToCompany($companyId), 403, __('auth.forbidden'));
        $this->forceFill(['active_company_id' => $companyId])->save();
        $this->unsetRelation('company');
        $this->unsetRelation('companyUser');
    }

    public function loadAuthRelations(): static
    {
        $this->ensureActiveCompany();

        return $this->load([
            'creator.contractAcceptances' => fn ($q) => $q->latest('id'),
            'company',
            'companyUser',
            'companyUsers.company',
            'permissionGrants',
        ]);
    }

    public function consents(): HasMany
    {
        return $this->hasMany(Consent::class);
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    }

    public function deviceTokens(): HasMany
    {
        return $this->hasMany(DeviceToken::class);
    }

    public function notificationPreference(): HasOne
    {
        return $this->hasOne(UserNotificationPreference::class);
    }

    public function mailMessages(): HasMany
    {
        return $this->hasMany(MailMessage::class);
    }

    public function permissionGrants(): HasMany
    {
        return $this->hasMany(UserPermission::class);
    }

    public function permissionSlugs(): array
    {
        if ($this->relationLoaded('permissionGrants')) {
            return $this->permissionGrants->pluck('permission')->unique()->values()->all();
        }

        return $this->permissionGrants()->pluck('permission')->unique()->values()->all();
    }

    public function hasPermission(Permission|string $permission): bool
    {
        $slug = $permission instanceof Permission ? $permission->value : $permission;
        if ($this->role === UserRole::Admin && $slug === Permission::CampaignsPublishWithoutApproval->value) {
            return true;
        }

        return in_array($slug, $this->permissionSlugs(), true);
    }

    public function sendPasswordResetNotification(#[\SensitiveParameter] $token): void
    {
        $frontend = rtrim((string) config('app.frontend_url'), '/');
        $url = $frontend.'/reset-password?token='.$token.'&email='.urlencode($this->email);
        app(TransactionalMailService::class)->send(
            MailTemplateKey::PasswordReset,
            $this,
            [
                'cta_url' => $url,
                'link_plataforma' => $url,
                'nome_usuario' => $this->name,
            ],
            null,
            'reset:'.substr($token, 0, 12),
        );
    }

    public function preferredLocale(): string
    {
        return AppLocale::laravelLocale($this->locale ?: AppLocale::DEFAULT);
    }

    public function canPublishWithoutApproval(): bool
    {
        if ($this->role === UserRole::Admin) {
            return true;
        }

        if ($this->role !== UserRole::Company) {
            return false;
        }

        return (bool) $this->actingCompanyUser()?->can_publish_without_approval;
    }

    public function purgeAccount(): void
    {
        DB::transaction(function () {
            $this->tokens()->delete();
            $this->companyUsers()->delete();
            $this->delete();
        });
    }
}
