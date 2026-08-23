<?php

namespace App\Enums;

enum LandingPageStatus: string
{
    case Draft = 'draft';
    case Published = 'published';
    case Disabled = 'disabled';
}
