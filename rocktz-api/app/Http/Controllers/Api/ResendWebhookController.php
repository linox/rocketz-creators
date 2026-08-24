<?php

namespace App\Http\Controllers\Api;

use App\Enums\MailMessageStatus;
use App\Http\Controllers\Controller;
use App\Models\MailMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ResendWebhookController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $secret = (string) config('services.resend.webhook_secret');
        if ($secret !== '') {
            $token = (string) $request->header('X-Resend-Webhook-Secret', '');
            $svix = (string) $request->header('svix-signature', '');
            $valid = ($token !== '' && hash_equals($secret, $token))
                || ($svix !== '' && (hash_equals($secret, $svix) || str_contains($svix, $secret)));
            abort_unless($valid, 401);
        }

        $type = (string) $request->input('type', '');
        $emailId = (string) ($request->input('data.email_id') ?: $request->input('data.message_id') ?: '');
        $mailId = (string) ($request->input('data.headers.X-Creatorz-Mail-Id') ?: $request->input('data.tags.mail_id') ?: '');

        $message = null;
        if ($mailId !== '') {
            $message = MailMessage::query()->find($mailId);
        }
        if (! $message && $emailId !== '') {
            $message = MailMessage::query()->where('provider_id', $emailId)->first();
        }

        if (! $message) {
            return response()->json(['ok' => true]);
        }

        $status = match (true) {
            str_contains($type, 'delivered') => MailMessageStatus::Delivered,
            str_contains($type, 'opened') => MailMessageStatus::Opened,
            str_contains($type, 'clicked') => MailMessageStatus::Clicked,
            str_contains($type, 'bounced') => MailMessageStatus::Bounced,
            str_contains($type, 'complained') => MailMessageStatus::Complained,
            default => null,
        };

        if (! $status) {
            return response()->json(['ok' => true]);
        }

        $updates = ['status' => $status];
        if ($emailId !== '') {
            $updates['provider_id'] = $emailId;
        }
        if ($status === MailMessageStatus::Delivered) {
            $updates['delivered_at'] = now();
        }
        if ($status === MailMessageStatus::Opened) {
            $updates['opened_at'] = now();
        }
        if ($status === MailMessageStatus::Clicked) {
            $updates['clicked_at'] = now();
        }

        $message->update($updates);

        return response()->json(['ok' => true]);
    }
}
