<?php

namespace App\Enums;

enum ContractAcceptanceStatus: string
{
    case Valid = 'valid';
    case Revoked = 'revoked';
}
