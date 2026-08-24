<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MailTemplate;
use App\Models\MailTemplateVersion;
use App\Services\Mail\TransactionalMailService;
use App\Support\MailVariableRenderer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MailTemplateController extends Controller
{
    public function __construct(
        private readonly TransactionalMailService $mail,
        private readonly MailVariableRenderer $renderer,
    ) {}

    public function index(): JsonResponse
    {
        $rows = MailTemplate::query()->orderBy('key')->get()->map(fn (MailTemplate $template) => $this->serialize($template));

        return response()->json([
            'data' => $rows,
            'sending' => $this->mail->sendingStatus(),
        ]);
    }

    public function settings(): JsonResponse
    {
        return response()->json(['data' => $this->mail->sendingStatus()]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sending_enabled' => ['required', 'boolean'],
        ]);
        $this->mail->setSendingEnabled((bool) $data['sending_enabled']);

        return response()->json([
            'data' => $this->mail->sendingStatus(),
            'message' => $this->mail->sendingEnabled()
                ? __('mail.sending_enabled')
                : __('mail.sending_disabled'),
        ]);
    }

    public function show(MailTemplate $mailTemplate): JsonResponse
    {
        return response()->json(['data' => $this->serialize($mailTemplate, true)]);
    }

    public function update(Request $request, MailTemplate $mailTemplate): JsonResponse
    {
        $data = $request->validate([
            'enabled' => ['sometimes', 'boolean'],
            'reminder_offsets' => ['nullable', 'array'],
            'reminder_offsets.*' => ['integer'],
            'locale' => ['required', Rule::in(['pt_BR', 'en', 'es'])],
            'subject' => ['required', 'string', 'max:255'],
            'greeting' => ['nullable', 'string'],
            'body' => ['required', 'string'],
            'cta_label' => ['nullable', 'string', 'max:120'],
        ]);

        $key = $mailTemplate->key;
        $combined = ($data['subject'] ?? '').' '.($data['body'] ?? '').' '.($data['cta_label'] ?? '');
        $missing = $this->renderer->missingRequired($key->requiredVariables(), $this->placeholderMap($combined));
        if ($missing !== []) {
            return response()->json([
                'message' => __('mail.missing_required_variables', ['vars' => implode(', ', $missing)]),
            ], 422);
        }

        if (array_key_exists('enabled', $data)) {
            $mailTemplate->enabled = $data['enabled'];
        }
        if (array_key_exists('reminder_offsets', $data)) {
            $mailTemplate->reminder_offsets = $data['reminder_offsets'];
        }
        $mailTemplate->save();

        MailTemplateVersion::query()->create([
            'mail_template_id' => $mailTemplate->id,
            'locale' => $data['locale'],
            'subject' => $data['subject'],
            'greeting' => $data['greeting'] ?? '',
            'body' => $data['body'],
            'cta_label' => $data['cta_label'] ?? '',
            'is_default' => false,
        ]);

        return response()->json(['data' => $this->serialize($mailTemplate->fresh(), true)]);
    }

    public function restore(Request $request, MailTemplate $mailTemplate): JsonResponse
    {
        $data = $request->validate([
            'locale' => ['required', Rule::in(['pt_BR', 'en', 'es'])],
        ]);
        $copy = $this->mail->defaultCopy($mailTemplate->key, $data['locale']);
        MailTemplateVersion::query()->create([
            'mail_template_id' => $mailTemplate->id,
            'locale' => $data['locale'],
            'subject' => $copy['subject'],
            'greeting' => $copy['greeting'],
            'body' => $copy['body'],
            'cta_label' => $copy['cta_label'],
            'is_default' => true,
        ]);

        return response()->json(['data' => $this->serialize($mailTemplate->fresh(), true)]);
    }

    public function preview(Request $request, MailTemplate $mailTemplate): JsonResponse
    {
        $html = $this->mail->previewHtml($mailTemplate->key, $request->user(), [
            'nome_campanha' => 'Campanha demo',
            'nome_demanda' => 'Demanda demo',
            'nome_empresa' => 'Empresa demo',
            'nome_criador' => $request->user()->name,
            'cta_url' => config('app.frontend_url'),
            'link_campanha' => config('app.frontend_url'),
            'link_demanda' => config('app.frontend_url'),
            'link_plataforma' => config('app.frontend_url'),
            'link_cadastro' => config('app.frontend_url'),
        ]);

        return response()->json(['html' => $html]);
    }

    public function test(Request $request, MailTemplate $mailTemplate): JsonResponse
    {
        if (! $this->mail->sendingEnabled()) {
            return response()->json(['message' => __('mail.sending_disabled')], 422);
        }

        $this->mail->send($mailTemplate->key, $request->user(), [
            'nome_campanha' => 'Campanha demo',
            'nome_demanda' => 'Demanda demo',
            'nome_empresa' => 'Empresa demo',
            'nome_criador' => $request->user()->name,
            'cta_url' => config('app.frontend_url'),
            'link_campanha' => config('app.frontend_url'),
            'link_demanda' => config('app.frontend_url'),
            'link_plataforma' => config('app.frontend_url'),
            'link_cadastro' => config('app.frontend_url'),
        ], null, 'test:'.now()->timestamp);

        return response()->json(['message' => __('mail.test_sent')]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(MailTemplate $template, bool $withVersions = false): array
    {
        $payload = [
            'id' => $template->id,
            'key' => $template->key->value,
            'audience' => $template->audience->value,
            'category' => $template->category->value,
            'enabled' => $template->enabled,
            'reminder_offsets' => $template->reminder_offsets,
            'variables' => array_keys(trans('mail.variables')),
            'required_variables' => $template->key->requiredVariables(),
        ];
        if ($withVersions) {
            $payload['versions'] = $template->versions()->latest('id')->limit(30)->get();
            $payload['current'] = [];
            foreach (['pt_BR', 'en', 'es'] as $locale) {
                $payload['current'][$locale] = $this->mail->copyFor($template->key, $locale, $template);
            }
        }

        return $payload;
    }

    /**
     * @return array<string, string>
     */
    private function placeholderMap(string $text): array
    {
        preg_match_all('/\{\{\s*([a-z0-9_]+)\s*\}\}/i', $text, $matches);

        return array_fill_keys($matches[1] ?? [], '1');
    }
}
