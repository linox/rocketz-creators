<?php

namespace App\Enums;

enum BarterShipmentMethod: string
{
    case Correios = 'correios';
    case Hand = 'hand';
    case Other = 'other';
}
