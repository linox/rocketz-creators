<?php

namespace App\Support;

use App\Enums\UserRole;
use App\Models\User;

class CreatorPrivacy
{
    public static function canViewPersonalData(?User $viewer, int $creatorId): bool
    {
        if (! $viewer) {
            return false;
        }

        if ($viewer->role === UserRole::Admin) {
            return true;
        }

        return $viewer->role === UserRole::Creator && (int) $viewer->creator?->id === $creatorId;
    }
}
