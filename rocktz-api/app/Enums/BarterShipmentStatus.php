<?php

namespace App\Enums;

enum BarterShipmentStatus: string
{
    case Pending = 'pending';
    case Posted = 'posted';
    case InTransit = 'in_transit';
    case OutForDelivery = 'out_for_delivery';
    case AwaitingPickup = 'awaiting_pickup';
    case Delivered = 'delivered';
    case Handed = 'handed';
    case Sent = 'sent';
    case Returned = 'returned';
    case Issue = 'issue';
    case NotFound = 'not_found';
    case Other = 'other';
}
