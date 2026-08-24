<?php

namespace App\Jobs;

use App\Enums\ContentPlanningStatus;
use App\Enums\DeliveryStatus;
use App\Enums\MailMessageStatus;
use App\Enums\MailTemplateKey;
use App\Enums\StageApprovalStatus;
use App\Mail\TransactionalMailable;
use App\Models\CampaignCreator;
use App\Models\ContentPlanningItem;
use App\Models\MailMessage;
use App\Services\Mail\MailNotifier;
use App\Services\Mail\TransactionalMailService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mailer\Exception\HttpTransportException;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Throwable;

class SendTransactionalMailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [30, 120, 300];

    public function __construct(public int $mailMessageId) {}

    public function handle(TransactionalMailService $mail): void
    {
        $message = MailMessage::query()->with(['user', 'related'])->find($this->mailMessageId);
        if (! $message) {
            return;
        }

        if (in_array($message->status, [
            MailMessageStatus::Sent,
            MailMessageStatus::Delivered,
            MailMessageStatus::Opened,
            MailMessageStatus::Clicked,
            MailMessageStatus::Cancelled,
            MailMessageStatus::PermanentFailed,
            MailMessageStatus::Bounced,
            MailMessageStatus::Complained,
        ], true)) {
            return;
        }

        $user = $message->user;
        $cancelReminder = $this->shouldCancel($message);
        if (! $mail->sendingEnabled()) {
            $message->update([
                'status' => MailMessageStatus::Cancelled,
                'failure_reason' => 'sending_disabled',
            ]);

            return;
        }
        if (! $user || ! $mail->recipientAllowed($user, $message->template_key) || $cancelReminder) {
            $message->update([
                'status' => MailMessageStatus::Cancelled,
                'failure_reason' => $cancelReminder ? 'status_changed' : 'recipient_not_allowed',
            ]);

            return;
        }

        $viewData = $mail->viewDataFor($message);
        $message->update([
            'status' => MailMessageStatus::Processing,
            'attempts' => $message->attempts + 1,
        ]);

        $providerId = (string) $message->id;

        try {
            Mail::to($message->email)->send(new TransactionalMailable($message, $viewData));
            $message->update([
                'status' => MailMessageStatus::Sent,
                'sent_at' => now(),
                'provider_id' => $providerId,
                'failure_reason' => null,
            ]);
        } catch (Throwable $e) {
            $permanent = $this->isPermanent($e);
            $message->update([
                'status' => $permanent ? MailMessageStatus::PermanentFailed : MailMessageStatus::TemporaryFailed,
                'failure_reason' => mb_substr($e->getMessage(), 0, 2000),
            ]);

            if ($permanent) {
                app(MailNotifier::class)->adminSendFailed($message);
                $this->fail($e);

                return;
            }

            throw $e;
        }
    }

    private function shouldCancel(MailMessage $message): bool
    {
        $key = $message->template_key;
        if (! in_array($key, [
            MailTemplateKey::DemandReminder,
            MailTemplateKey::DeliveryPendingReviewReminder,
        ], true)) {
            return false;
        }

        $related = $message->related;
        if ($related instanceof ContentPlanningItem) {
            return in_array($related->status, [
                ContentPlanningStatus::Approved,
                ContentPlanningStatus::Published,
                ContentPlanningStatus::Rejected,
            ], true);
        }

        if ($related instanceof CampaignCreator) {
            if ($key === MailTemplateKey::DemandReminder) {
                return in_array($related->delivery_status, [
                    DeliveryStatus::Approved,
                    DeliveryStatus::Published,
                ], true);
            }

            return ! (
                $related->script_status === StageApprovalStatus::Submitted
                || $related->video_status === StageApprovalStatus::Submitted
                || $related->delivery_status === DeliveryStatus::Sent
            );
        }

        return false;
    }

    private function isPermanent(Throwable $e): bool
    {
        if ($e instanceof HttpTransportException) {
            $code = $e->getCode();
            if ($code >= 400 && $code < 500 && $code !== 429) {
                return true;
            }
        }

        if ($e instanceof TransportExceptionInterface) {
            $code = $e->getCode();
            if ($code >= 400 && $code < 500 && $code !== 429) {
                return true;
            }
        }

        return false;
    }
}
