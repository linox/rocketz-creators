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
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasOneThrough;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'password', 'role', 'google_id', 'avatar_url', 'locale'])]
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
        ];
    }

    public function creator(): HasOne
    {
        return $this->hasOne(Creator::class);
    }

    public function companyUser(): HasOne
    {
        return $this->hasOne(CompanyUser::class);
    }

    public function company(): HasOneThrough
    {
        return $this->hasOneThrough(
            Company::class,
            CompanyUser::class,
            'user_id',
            'id',
            'id',
            'company_id',
        );
    }

    public function consents(): HasMany
    {
        return $this->hasMany(Consent::class);
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
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

        return $this->hasPermission(Permission::CampaignsPublishWithoutApproval)
            || (bool) $this->companyUser?->can_publish_without_approval;
    }
}
