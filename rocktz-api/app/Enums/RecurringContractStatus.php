<?php

namespace App\Enums;

enum RecurringContractStatus: string
{
    case PendingAgency = 'pending_agency';
    case Active = 'active';
    case Paused = 'paused';
    case Finished = 'finished';
}
