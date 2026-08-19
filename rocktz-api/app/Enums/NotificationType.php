<?php

namespace App\Enums;

enum NotificationType: string
{
    case Application = 'application';
    case Approval = 'approval';
    case Rejection = 'rejection';
    case DeliveryReview = 'delivery_review';
    case Contract = 'contract';
    case General = 'general';
}
