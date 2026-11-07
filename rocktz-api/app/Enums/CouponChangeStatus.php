<?php

namespace App\Enums;

enum CouponChangeStatus: string
{
    case Pending = 'pending';
    case Rejected = 'rejected';
}
