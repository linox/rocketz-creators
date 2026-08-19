<?php

namespace App\Enums;

enum NotificationTargetRole: string
{
    case Admin = 'admin';
    case Creator = 'creator';
    case Company = 'company';
    case All = 'all';
}
