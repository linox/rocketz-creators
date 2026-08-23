<?php

namespace App\Enums;

enum LandingSignupStatus: string
{
    case Pending = 'pending';
    case Reviewing = 'reviewing';
    case Approved = 'approved';
    case Rejected = 'rejected';
}
