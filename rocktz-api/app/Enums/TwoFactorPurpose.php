<?php

namespace App\Enums;

enum TwoFactorPurpose: string
{
    case Login = 'login';
    case Enable = 'enable';
    case Disable = 'disable';
}
