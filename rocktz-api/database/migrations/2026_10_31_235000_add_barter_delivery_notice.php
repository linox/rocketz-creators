<?php

use App\Enums\MailTemplateKey;
use App\Models\MailTemplate;
use App\Models\MailTemplateVersion;
use App\Services\Mail\TransactionalMailService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('barter_shipments', function (Blueprint $table) {
            $table->timestamp('notified_delivered_at')->nullable()->after('delivered_at');
        });

        $key = MailTemplateKey::BarterDelivered;
        $template = MailTemplate::query()->updateOrCreate(
            ['key' => $key->value],
            [
                'audience' => $key->audience(),
                'category' => $key->category(),
                'enabled' => true,
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
        Schema::table('barter_shipments', function (Blueprint $table) {
            $table->dropColumn('notified_delivered_at');
        });

        $template = MailTemplate::query()->where('key', MailTemplateKey::BarterDelivered->value)->first();
        if ($template) {
            $template->versions()->delete();
            $template->delete();
        }
    }
};
