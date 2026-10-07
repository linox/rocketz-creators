<?php

use App\Enums\MailTemplateKey;
use App\Models\MailTemplate;
use App\Services\Mail\TransactionalMailService;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Previous shipped defaults. Only these rows are replaced, so an edited
     * template in the admin stays as the team left it.
     *
     * @var array<string, array{subject: string, body: string, cta_label: string}>
     */
    private array $previous = [
        'pt_BR' => [
            'subject' => 'Seu perfil foi aprovado no Creatorz!',
            'body' => "Seu perfil foi aprovado e agora você já pode participar das oportunidades disponíveis no Creatorz by Rocketz.\n\nComplete seu perfil, mantenha seus dados atualizados e acompanhe as campanhas e demandas compatíveis com o seu perfil.",
            'cta_label' => 'Ver oportunidades',
        ],
        'en' => [
            'subject' => 'Your Creatorz profile was approved!',
            'body' => "Your profile is approved and you can now join opportunities on Creatorz by Rocketz.\n\nKeep your profile updated and follow campaigns that match you.",
            'cta_label' => 'See opportunities',
        ],
        'es' => [
            'subject' => 'Tu perfil fue aprobado en Creatorz!',
            'body' => "Tu perfil fue aprobado y ya puedes participar en las oportunidades de Creatorz by Rocketz.\n\nMantén tus datos actualizados y sigue las campañas compatibles con tu perfil.",
            'cta_label' => 'Ver oportunidades',
        ],
    ];

    public function up(): void
    {
        $template = MailTemplate::query()->where('key', MailTemplateKey::CreatorApproved->value)->first();
        if (! $template) {
            return;
        }

        $mail = app(TransactionalMailService::class);

        foreach ($this->previous as $locale => $old) {
            $copy = $mail->defaultCopy(MailTemplateKey::CreatorApproved, $locale);

            $template->versions()
                ->where('locale', $locale)
                ->where('subject', $old['subject'])
                ->where('body', $old['body'])
                ->update([
                    'subject' => $copy['subject'],
                    'body' => $copy['body'],
                    'cta_label' => $copy['cta_label'],
                ]);
        }
    }

    public function down(): void
    {
        $template = MailTemplate::query()->where('key', MailTemplateKey::CreatorApproved->value)->first();
        if (! $template) {
            return;
        }

        $mail = app(TransactionalMailService::class);

        foreach ($this->previous as $locale => $old) {
            $copy = $mail->defaultCopy(MailTemplateKey::CreatorApproved, $locale);

            $template->versions()
                ->where('locale', $locale)
                ->where('subject', $copy['subject'])
                ->where('body', $copy['body'])
                ->update([
                    'subject' => $old['subject'],
                    'body' => $old['body'],
                    'cta_label' => $old['cta_label'],
                ]);
        }
    }
};
