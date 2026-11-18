<?php

namespace App\Enums;

enum RecurringPaymentMode: string
{
    case Cash = 'cash';
    case Barter = 'barter';
    case Mixed = 'mixed';
}
