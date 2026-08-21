<?php

namespace App\Services;

use App\Enums\Permission;
use App\Enums\UserRole;
use App\Models\User;

class PermissionService
{
    public function grantDefaults(User $user): void
    {
        $this->sync($user, Permission::slugsForRole($user->role));
    }

    /**
     * @param  list<string>  $slugs
     */
    public function sync(User $user, array $slugs): void
    {
        $allowed = Permission::slugsForRole($user->role);
        $slugs = array_values(array_unique(array_intersect($allowed, $slugs)));

        $user->permissionGrants()->delete();
        foreach ($slugs as $slug) {
            $user->permissionGrants()->create(['permission' => $slug]);
        }
        $user->unsetRelation('permissionGrants');

        $this->syncPublishFlag(
            $user,
            in_array(Permission::CampaignsPublishWithoutApproval->value, $slugs, true),
        );
    }

    public function syncPublishFlag(User $user, bool $enabled): void
    {
        if ($user->role !== UserRole::Company) {
            return;
        }

        $user->loadMissing('companyUser');
        $user->companyUser?->update(['can_publish_without_approval' => $enabled]);
    }
}
