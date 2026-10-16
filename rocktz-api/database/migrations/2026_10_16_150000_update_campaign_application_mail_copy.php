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
     * @var array<string, array<string, array{subject: string, body: string}>>
     */
    private array $previous = [
        'campaign.application_approved' => [
            'pt_BR' => [
                'subject' => 'Você foi aprovado para a campanha {{nome_campanha}}!',
                'body' => 'Você foi aprovado para a campanha {{nome_campanha}}. Acesse a plataforma para ver os próximos passos e as informações iniciais da entrega.',
            ],
            'en' => [
                'subject' => 'You were approved for {{nome_campanha}}!',
                'body' => 'You were approved for {{nome_campanha}}. Open the platform to see next steps and the first delivery details.',
            ],
            'es' => [
                'subject' => 'Fuiste aprobado para la campaña {{nome_campanha}}!',
                'body' => 'Fuiste aprobado para {{nome_campanha}}. Entra a la plataforma para ver los próximos pasos y la información inicial de la entrega.',
            ],
        ],
        'campaign.application_rejected' => [
            'pt_BR' => [
                'subject' => 'Atualização sobre a campanha {{nome_campanha}}',
                'body' => "A seleção da campanha {{nome_campanha}} foi concluída e, desta vez, sua candidatura não avançou. Essa decisão vale só para esta campanha e não representa uma avaliação definitiva do seu trabalho.\n\nContinue acompanhando outras oportunidades no Creatorz.",
            ],
            'en' => [
                'subject' => 'Update on {{nome_campanha}}',
                'body' => "Casting for {{nome_campanha}} is complete and your application did not move forward this time. This decision is only for this campaign.\n\nKeep an eye on other opportunities on Creatorz.",
            ],
            'es' => [
                'subject' => 'Actualización sobre la campaña {{nome_campanha}}',
                'body' => "La selección de {{nome_campanha}} terminó y, esta vez, tu candidatura no avanzó. La decisión vale solo para esta campaña.\n\nSigue las demás oportunidades en Creatorz.",
            ],
        ],
    ];

    public function up(): void
    {
        $mail = app(TransactionalMailService::class);

        foreach ($this->previous as $key => $locales) {
            $template = MailTemplate::query()->where('key', $key)->first();
            if (! $template) {
                continue;
            }

            $templateKey = MailTemplateKey::from($key);
            foreach ($locales as $locale => $old) {
                $copy = $mail->defaultCopy($templateKey, $locale);
                $template->versions()
                    ->where('locale', $locale)
                    ->where('subject', $old['subject'])
                    ->where('body', $old['body'])
                    ->update([
                        'subject' => $copy['subject'],
                        'body' => $copy['body'],
                    ]);
            }
        }
    }

    public function down(): void
    {
        $mail = app(TransactionalMailService::class);

        foreach ($this->previous as $key => $locales) {
            $template = MailTemplate::query()->where('key', $key)->first();
            if (! $template) {
                continue;
            }

            $templateKey = MailTemplateKey::from($key);
            foreach ($locales as $locale => $old) {
                $copy = $mail->defaultCopy($templateKey, $locale);
                $template->versions()
                    ->where('locale', $locale)
                    ->where('subject', $copy['subject'])
                    ->where('body', $copy['body'])
                    ->update([
                        'subject' => $old['subject'],
                        'body' => $old['body'],
                    ]);
            }
        }
    }
};
