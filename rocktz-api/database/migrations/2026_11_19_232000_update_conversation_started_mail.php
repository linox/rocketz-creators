<?php

use App\Enums\MailTemplateKey;
use App\Models\MailTemplate;
use App\Models\MailTemplateVersion;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $template = MailTemplate::query()->where('key', MailTemplateKey::ConversationStarted->value)->first();
        if (! $template) {
            return;
        }

        $replacements = [
            'pt_BR' => "Você recebeu uma mensagem sobre {{nome_trabalho}}.\n\n{{mensagem}}",
            'en' => "You received a message about {{nome_trabalho}}.\n\n{{mensagem}}",
            'es' => "Recibiste un mensaje sobre {{nome_trabalho}}.\n\n{{mensagem}}",
        ];

        foreach ($replacements as $locale => $body) {
            MailTemplateVersion::query()
                ->where('mail_template_id', $template->id)
                ->where('locale', $locale)
                ->where('body', 'like', '%{{nome_remetente}}%')
                ->update(['body' => $body]);
        }
    }

    public function down(): void
    {
        $template = MailTemplate::query()->where('key', MailTemplateKey::ConversationStarted->value)->first();
        if (! $template) {
            return;
        }

        $current = [
            'pt_BR' => "Você recebeu uma mensagem sobre {{nome_trabalho}}.\n\n{{mensagem}}",
            'en' => "You received a message about {{nome_trabalho}}.\n\n{{mensagem}}",
            'es' => "Recibiste un mensaje sobre {{nome_trabalho}}.\n\n{{mensagem}}",
        ];
        $previous = [
            'pt_BR' => "{{nome_remetente}} enviou a primeira mensagem sobre {{nome_trabalho}}.\n\nAssunto: {{assunto}}\n\n{{mensagem}}",
            'en' => "{{nome_remetente}} sent the first message about {{nome_trabalho}}.\n\nSubject: {{assunto}}\n\n{{mensagem}}",
            'es' => "{{nome_remetente}} envió el primer mensaje sobre {{nome_trabalho}}.\n\nAsunto: {{assunto}}\n\n{{mensagem}}",
        ];

        foreach ($previous as $locale => $body) {
            MailTemplateVersion::query()
                ->where('mail_template_id', $template->id)
                ->where('locale', $locale)
                ->where('body', $current[$locale])
                ->update(['body' => $body]);
        }
    }
};
