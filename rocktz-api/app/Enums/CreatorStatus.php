<?php

namespace App\Enums;

enum CreatorStatus: string
{
    case Active = 'active';
    case Review = 'review';
    case Paused = 'paused';
    case Rejected = 'rejected';
}
