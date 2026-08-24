<?php

namespace App\Enums;

enum MailMessageStatus: string
{
    case Scheduled = 'scheduled';
    case Queued = 'queued';
    case Processing = 'processing';
    case Sent = 'sent';
    case Delivered = 'delivered';
    case Opened = 'opened';
    case Clicked = 'clicked';
    case TemporaryFailed = 'temporary_failed';
    case PermanentFailed = 'permanent_failed';
    case Bounced = 'bounced';
    case Complained = 'complained';
    case Cancelled = 'cancelled';

    public function isFailure(): bool
    {
        return in_array($this, [
            self::TemporaryFailed,
            self::PermanentFailed,
            self::Bounced,
            self::Complained,
        ], true);
    }
}
