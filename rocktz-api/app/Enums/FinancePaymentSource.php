<?php

namespace App\Enums;

enum FinancePaymentSource: string
{
    case Campaign = 'campaign';
    case Recurring = 'recurring';
    case Coupon = 'coupon';
}
