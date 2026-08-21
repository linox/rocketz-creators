<?php

namespace App\Enums;

enum Permission: string
{
    case UsersManage = 'users.manage';
    case CreatorsModerate = 'creators.moderate';
    case CompaniesModerate = 'companies.moderate';
    case CampaignsAssign = 'campaigns.assign';
    case CampaignsApproveAgency = 'campaigns.approve_agency';
    case CampaignsPublishWithoutApproval = 'campaigns.publish_without_approval';
    case DataReset = 'data.reset';

    /**
     * @return list<self>
     */
    public static function forRole(UserRole $role): array
    {
        return match ($role) {
            UserRole::Admin => [
                self::UsersManage,
                self::CreatorsModerate,
                self::CompaniesModerate,
                self::CampaignsAssign,
                self::CampaignsApproveAgency,
                self::DataReset,
            ],
            UserRole::Company => [
                self::CampaignsPublishWithoutApproval,
            ],
            UserRole::Creator => [],
        };
    }

    /**
     * @return list<string>
     */
    public static function slugsForRole(UserRole $role): array
    {
        return array_map(fn (self $permission) => $permission->value, self::forRole($role));
    }
}
