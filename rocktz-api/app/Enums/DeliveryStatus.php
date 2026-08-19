<?php

namespace App\Enums;

enum DeliveryStatus: string
{
    case Pending = 'pending';
    case Sent = 'sent';
    case Revision = 'revision';
    case Approved = 'approved';
    case Published = 'published';
}
