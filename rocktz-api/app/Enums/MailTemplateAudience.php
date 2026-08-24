<?php

namespace App\Enums;

enum MailTemplateAudience: string
{
    case Creator = 'creator';
    case Company = 'company';
    case Admin = 'admin';
}
