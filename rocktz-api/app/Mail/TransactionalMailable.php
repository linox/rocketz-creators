<?php

namespace App\Mail;

use App\Models\MailMessage;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\Headers;
use Illuminate\Queue\SerializesModels;

class TransactionalMailable extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param  array<string, mixed>  $templateData
     */
    public function __construct(
        public MailMessage $mailMessage,
        public array $templateData,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->mailMessage->subject,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.layout',
            with: $this->templateData,
        );
    }

    public function headers(): Headers
    {
        return new Headers(
            text: [
                'X-Creatorz-Mail-Id' => (string) $this->mailMessage->id,
            ],
        );
    }
}
