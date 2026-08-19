<?php

namespace App\Enums;

enum CompanyStatus: string
{
    case Active = 'active';
    case Pending = 'pending';
    case Rejected = 'rejected';
}
