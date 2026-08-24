<?php

namespace App\Enums;

enum MailTemplateCategory: string
{
    case Operational = 'operational';
    case Opportunity = 'opportunity';
    case Reminder = 'reminder';
    case Digest = 'digest';
    case Promotional = 'promotional';
}
