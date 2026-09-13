<?php

namespace App\Enums;

enum StorefrontEventType: string
{
    case View = 'view';
    case Click = 'click';
}
