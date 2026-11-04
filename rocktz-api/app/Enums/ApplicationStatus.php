<?php

namespace App\Enums;

enum ApplicationStatus: string
{
    case Pending = 'pending';
    case Invited = 'invited';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Declined = 'declined';
}
