<?php

use App\Enums\MailTemplateKey;
use App\Models\MailTemplate;
use App\Models\MailTemplateVersion;
use App\Services\Mail\TransactionalMailService;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $key = MailTemplateKey::ConversationStarted;
        $template = MailTemplate::query()->updateOrCreate(
            ['key' => $key->value],
            [
                'audience' => $key->audience(),
                'category' => $key->category(),
                'enabled' => true,
                'reminder_offsets' => null,
            ],
        );

        $mail = app(TransactionalMailService::class);
        foreach (['pt_BR', 'en', 'es'] as $locale) {
            $exists = MailTemplateVersion::query()
                ->where('mail_template_id', $template->id)
                ->where('locale', $locale)
                ->where('is_default', true)
                ->exists();
            if ($exists) {
                continue;
            }

            $copy = $mail->defaultCopy($key, $locale);
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

    public function down(): void
    {
        $template = MailTemplate::query()->where('key', MailTemplateKey::ConversationStarted->value)->first();
        if ($template) {
            $template->versions()->delete();
            $template->delete();
        }
    }
};
