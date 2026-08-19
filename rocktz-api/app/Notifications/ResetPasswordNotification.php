<?php

namespace App\Notifications;

use App\Support\AppLocale;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;

class ResetPasswordNotification extends ResetPassword
{
    public function toMail($notifiable): MailMessage
    {
        $expire = (int) config('auth.passwords.users.expire', 60);
        $locale = method_exists($notifiable, 'preferredLocale')
            ? $notifiable->preferredLocale()
            : AppLocale::laravelLocale(AppLocale::fromRequest());

        return (new MailMessage)
            ->locale($locale)
            ->subject(trans('auth.mail.reset_subject', [], $locale))
            ->greeting(trans('auth.mail.reset_greeting', [], $locale))
            ->line(trans('auth.mail.reset_line', [], $locale))
            ->action(trans('auth.mail.reset_action', [], $locale), $this->resetUrl($notifiable))
            ->line(trans('auth.mail.reset_expire', ['minutes' => $expire], $locale))
            ->line(trans('auth.mail.reset_ignore', [], $locale));
    }
}
