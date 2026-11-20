<?php

namespace App\Enums;

enum ConversationCloseReason: string
{
    case Resolved = 'resolved';
    case NoLongerNeeded = 'no_longer_needed';
    case Duplicate = 'duplicate';
    case Other = 'other';
}
