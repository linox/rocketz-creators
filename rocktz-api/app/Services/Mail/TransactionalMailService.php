<?php

namespace App\Services\Mail;

use App\Enums\CompanyStatus;
use App\Enums\CreatorStatus;
use App\Enums\MailMessageStatus;
use App\Enums\MailTemplateKey;
use App\Enums\UserRole;
use App\Jobs\SendTransactionalMailJob;
use App\Models\MailMessage;
use App\Models\MailSetting;
use App\Models\MailTemplate;
use App\Models\User;
use App\Support\AppLocale;
use App\Support\FrontendUrl;
use App\Support\MailVariableRenderer;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\URL;

class TransactionalMailService
{
    public function __construct(private readonly MailVariableRenderer $renderer) {}

    /**
     * @param  array<string, scalar|null>  $context
     */
    public function send(
        MailTemplateKey $key,
        User $user,
        array $context = [],
        ?Model $related = null,
        string $occurrence = 'default',
        ?MailMessageStatus $initialStatus = null,
    ): ?MailMessage {
        if (! $this->sendingEnabled()) {
            return null;
        }

        $user->loadMissing(['creator', 'company', 'notificationPreference']);

        if (! $this->recipientAllowed($user, $key)) {
            return null;
        }

        $template = MailTemplate::query()->where('key', $key->value)->first();
        if ($template && ! $template->enabled) {
            return null;
        }

        if (! $this->prefers($user, $key)) {
            return null;
        }

        $locale = $user->preferredLocale();
        $copy = $this->copyFor($key, $locale, $template);
        $variables = $this->withDefaults($user, $context);
        $subject = $this->renderer->render($copy['subject'], $variables);

        $message = $this->insertMessage(
            $key,
            $user,
            $related,
            $occurrence,
            $subject,
            $variables,
            $copy,
            $initialStatus ?? MailMessageStatus::Queued,
        );

        if (! $message || $message->status === MailMessageStatus::Scheduled) {
            return $message;
        }

        SendTransactionalMailJob::dispatch($message->id);

        return $message;
    }

    public function sendingEnabled(): bool
    {
        $status = $this->sendingStatus();

        return $status['sending_enabled'];
    }

    /**
     * @return array{sending_enabled: bool, env_enabled: bool, stored_enabled: bool}
     */
    public function sendingStatus(): array
    {
        $envEnabled = (bool) config('mail.sending_enabled', true);
        $storedEnabled = MailSetting::current()->sending_enabled;

        return [
            'sending_enabled' => $envEnabled && $storedEnabled,
            'env_enabled' => $envEnabled,
            'stored_enabled' => $storedEnabled,
        ];
    }

    public function setSendingEnabled(bool $enabled): void
    {
        $row = MailSetting::current();
        $row->sending_enabled = $enabled;
        $row->save();
    }

    public function recipientAllowed(User $user, MailTemplateKey $key): bool
    {
        if (! filter_var((string) $user->email, FILTER_VALIDATE_EMAIL)) {
            return false;
        }

        if (in_array($key, [MailTemplateKey::PasswordReset, MailTemplateKey::TwoFactorCode], true)) {
            return true;
        }

        $user->loadMissing(['creator', 'company']);

        if ($user->role === UserRole::Creator) {
            $status = $user->creator?->status;
            if (in_array($key, [
                MailTemplateKey::CreatorRegistered,
                MailTemplateKey::CreatorApproved,
                MailTemplateKey::CreatorRejected,
            ], true)) {
                return true;
            }

            return $status === CreatorStatus::Active;
        }

        if ($user->role === UserRole::Company) {
            $status = $user->company?->status;
            if (in_array($key, [
                MailTemplateKey::CompanyRegistered,
                MailTemplateKey::CompanyApproved,
                MailTemplateKey::CompanyRejected,
            ], true)) {
                return true;
            }

            return $status === CompanyStatus::Active;
        }

        return true;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function viewDataFor(MailMessage $message): array
    {
        $locale = $message->user?->preferredLocale() ?? AppLocale::laravelLocale(AppLocale::DEFAULT);
        $payload = $message->payload ?? [];
        $copy = $payload['copy'] ?? $this->copyFor($message->template_key, $locale, null);
        $variables = $payload['variables'] ?? [];

        $body = $this->renderer->render((string) ($copy['body'] ?? ''), $variables);
        $greeting = $this->renderer->render((string) ($copy['greeting'] ?? ''), $variables);
        $ctaLabel = $this->renderer->render((string) ($copy['cta_label'] ?? ''), $variables);
        $ctaUrl = (string) ($variables['cta_url'] ?? $variables['link_plataforma'] ?? FrontendUrl::origin());

        return [
            'locale' => $locale,
            'title' => $message->subject,
            'greeting' => $greeting,
            'bodyHtml' => nl2br($body),
            'highlights' => $this->renderer->highlights($message->template_key->highlightKeys(), $variables, $locale),
            'ctaLabel' => $ctaLabel,
            'ctaUrl' => $ctaUrl,
            'supportUrl' => FrontendUrl::supportMailto(),
            'supportAddress' => (string) config('mail.support_address'),
            'preferencesUrl' => FrontendUrl::settings(),
            'unsubscribeUrl' => $this->unsubscribeUrl($message->user_id),
            'brand' => trans('mail.brand', [], $locale),
            'footerNote' => trans('mail.footer_note', [], $locale),
            'preferencesLabel' => trans('mail.footer_preferences', [], $locale),
            'supportLabel' => trans('mail.footer_support', [], $locale),
        ];
    }

    public function previewHtml(MailTemplateKey $key, User $user, array $context = []): string
    {
        $locale = $user->preferredLocale();
        $copy = $this->copyFor($key, $locale, MailTemplate::query()->where('key', $key->value)->first());
        $variables = $this->withDefaults($user, $context);
        $fake = new MailMessage([
            'user_id' => $user->id,
            'template_key' => $key,
            'subject' => $this->renderer->render($copy['subject'], $variables),
            'payload' => ['copy' => $copy, 'variables' => $variables],
        ]);
        $fake->setRelation('user', $user);

        return view('mail.layout', $this->viewDataFor($fake))->render();
    }

    /**
     * @return array{subject: string, greeting: string, body: string, cta_label: string}
     */
    public function defaultCopy(MailTemplateKey $key, string $locale): array
    {
        $base = 'mail.templates.'.$key->value;

        return [
            'subject' => trans($base.'.subject', [], $locale),
            'greeting' => trans($base.'.greeting', [], $locale),
            'body' => trans($base.'.body', [], $locale),
            'cta_label' => trans($base.'.cta', [], $locale),
        ];
    }

    /**
     * @return array{subject: string, greeting: string, body: string, cta_label: string}
     */
    public function copyFor(MailTemplateKey $key, string $locale, ?MailTemplate $template): array
    {
        $defaults = $this->defaultCopy($key, $locale);
        $version = $template?->latestVersionFor($locale);
        if (! $version) {
            return $defaults;
        }

        return [
            'subject' => $version->subject !== '' ? $version->subject : $defaults['subject'],
            'greeting' => $version->greeting ?: $defaults['greeting'],
            'body' => $version->body !== '' ? $version->body : $defaults['body'],
            'cta_label' => $version->cta_label ?: $defaults['cta_label'],
        ];
    }

    public function unsubscribeUrl(int $userId): string
    {
        return URL::temporarySignedRoute('mail.unsubscribe', now()->addDays(30), ['user' => $userId]);
    }

    private function prefers(User $user, MailTemplateKey $key): bool
    {
        $flag = $key->preferenceFlag();
        if ($flag === null) {
            return true;
        }

        $prefs = $user->notificationPreference;

        return $prefs ? $prefs->allows($flag) : true;
    }

    /**
     * @param  array<string, scalar|null>  $context
     * @param  array{subject: string, greeting: string, body: string, cta_label: string}  $copy
     * @param  array<string, scalar|null>  $variables
     */
    private function insertMessage(
        MailTemplateKey $key,
        User $user,
        ?Model $related,
        string $occurrence,
        string $subject,
        array $variables,
        array $copy,
        MailMessageStatus $status,
    ): ?MailMessage {
        $idempotency = hash('sha256', implode('|', [
            $key->value,
            (string) $user->id,
            $related ? $related::class : '',
            $related ? (string) $related->getKey() : '',
            $occurrence,
        ]));

        try {
            return MailMessage::query()->create([
                'user_id' => $user->id,
                'email' => $user->email,
                'template_key' => $key,
                'subject' => $subject,
                'status' => $status,
                'idempotency_key' => $idempotency,
                'related_type' => $related ? $related::class : null,
                'related_id' => $related?->getKey(),
                'campaign_id' => $variables['campaign_id'] ?? null,
                'company_id' => $variables['company_id'] ?? null,
                'creator_id' => $variables['creator_id'] ?? null,
                'payload' => ['copy' => $copy, 'variables' => $variables],
                'scheduled_at' => $status === MailMessageStatus::Scheduled ? now() : null,
            ]);
        } catch (UniqueConstraintViolationException) {
            return null;
        }
    }

    /**
     * @param  array<string, scalar|null>  $context
     * @return array<string, scalar|null>
     */
    private function withDefaults(User $user, array $context): array
    {
        $name = $user->name;
        $creatorName = $user->creator?->artistic_name ?: $user->creator?->full_name ?: $name;
        $companyName = $user->company?->name;

        return array_merge([
            'nome_usuario' => $name,
            'nome_criador' => $creatorName,
            'nome_empresa' => $companyName,
            'link_plataforma' => FrontendUrl::origin(),
            'link_suporte' => FrontendUrl::supportMailto(),
            'link_cadastro' => $user->creator
                ? FrontendUrl::to('/creators/'.$user->creator->id)
                : FrontendUrl::to('/company-dashboard'),
        ], $context);
    }
}
