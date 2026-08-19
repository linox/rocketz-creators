<?php

namespace App\Enums;

enum CampaignStatus: string
{
    case Briefing = 'briefing';
    case Selection = 'selection';
    case Approval = 'approval';
    case Production = 'production';
    case Published = 'published';
    case Finished = 'finished';
}
