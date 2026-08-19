<?php

namespace App\Enums;

enum SignatureStatus: string
{
    case Pending = 'pending';
    case Sent = 'sent';
    case Signed = 'signed';
}
