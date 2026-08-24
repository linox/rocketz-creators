<?php

namespace Database\Seeders;

use App\Enums\MailTemplateKey;
use App\Models\MailTemplate;
use App\Models\MailTemplateVersion;
use App\Services\Mail\TransactionalMailService;
use Illuminate\Database\Seeder;

class MailTemplateSeeder extends Seeder
{
    public function run(): void
    {
        $mail = app(TransactionalMailService::class);

        foreach (MailTemplateKey::cases() as $key) {
            $template = MailTemplate::query()->updateOrCreate(
                ['key' => $key->value],
                [
                    'audience' => $key->audience(),
                    'category' => $key->category(),
                    'enabled' => true,
                    'reminder_offsets' => $key->defaultReminderOffsets() ?: null,
                ],
            );

            foreach (['pt_BR', 'en', 'es'] as $locale) {
                $copy = $mail->defaultCopy($key, $locale);
                $exists = MailTemplateVersion::query()
                    ->where('mail_template_id', $template->id)
                    ->where('locale', $locale)
                    ->where('is_default', true)
                    ->exists();
                if ($exists) {
                    continue;
                }
                MailTemplateVersion::query()->create([
                    'mail_template_id' => $template->id,
                    'locale' => $locale,
                    'subject' => $copy['subject'],
                    'greeting' => $copy['greeting'],
                    'body' => $copy['body'],
                    'cta_label' => $copy['cta_label'],
                    'is_default' => true,
                ]);
            }
        }
    }
}
