<?php

namespace App\Enums;

enum RecurringContractStatus: string
{
    case Active = 'active';
    case Paused = 'paused';
    case Finished = 'finished';
}
