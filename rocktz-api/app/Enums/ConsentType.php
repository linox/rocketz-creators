<?php

namespace App\Enums;

enum ConsentType: string
{
    case LgpdSignup = 'lgpd_signup';
    case LgpdMarketing = 'lgpd_marketing';
    case LgpdAnalytics = 'lgpd_analytics';
    case LgpdProfilePublic = 'lgpd_profile_public';
}
