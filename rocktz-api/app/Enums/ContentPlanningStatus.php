<?php

namespace App\Enums;

enum ContentPlanningStatus: string
{
    case Planned = 'planned';
    case InProduction = 'in_production';
    case Review = 'review';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Published = 'published';
}
