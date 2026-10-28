<?php

namespace App\Enums;

enum FinancePaymentStatus: string
{
    case AwaitingInvoice = 'awaiting_invoice';
    case Submitted = 'submitted';
    case Rejected = 'rejected';
    case Released = 'released';
    case Paid = 'paid';

    public function owesInvoice(): bool
    {
        return match ($this) {
            self::AwaitingInvoice, self::Rejected => true,
            default => false,
        };
    }
}
