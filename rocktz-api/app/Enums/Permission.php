<?php

namespace App\Enums;

enum Permission: string
{
    case UsersManage = 'users.manage';
    case CreatorsModerate = 'creators.moderate';
    case CreatorsHideValues = 'creators.hide_values';
    case CompaniesModerate = 'companies.moderate';
    case CampaignsAssign = 'campaigns.assign';
    case CampaignsApproveAgency = 'campaigns.approve_agency';
    case CampaignsPublishWithoutApproval = 'campaigns.publish_without_approval';
    case DataReset = 'data.reset';
    case MailManage = 'mail.manage';
    case LogsView = 'logs.view';

    /**
     * @return list<self>
     */
    public static function forRole(UserRole $role): array
    {
        return match ($role) {
            UserRole::Admin => [
                self::UsersManage,
                self::CreatorsModerate,
                self::CreatorsHideValues,
                self::CompaniesModerate,
                self::CampaignsAssign,
                self::CampaignsApproveAgency,
                self::DataReset,
                self::MailManage,
                self::LogsView,
            ],
            UserRole::Company => [
                self::CampaignsPublishWithoutApproval,
                self::CreatorsHideValues,
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

    /**
     * Permissões ligadas ao criar um usuário. Ocultar valores é opt-in.
     *
     * @return list<string>
     */
    public static function defaultSlugsForRole(UserRole $role): array
    {
        return array_values(array_filter(
            self::slugsForRole($role),
            fn (string $slug) => $slug !== self::CreatorsHideValues->value,
        ));
    }
}
