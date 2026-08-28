<?php

namespace App\Support;

use Illuminate\Http\Request;

class ActivityActionResolver
{
    /**
     * @var list<string>
     */
    private const SKIP = [
        '#^api/notifications(/|$)#',
        '#^api/notification-preferences$#',
        '#^api/device-tokens$#',
        '#^api/auth/#',
        '#^api/activity-logs#',
        '#^api/media/uploads/.+/chunks/#',
        '#^api/media/uploads$#',
        '#^api/mail/templates/[^/]+/preview$#',
        '#^api/creators/[^/]+/social-sync$#',
        '#^api/campaigns/[^/]+/post-metrics-sync$#',
        '#^api/recurring-contracts/[^/]+/post-metrics-sync$#',
        '#^api/landings/.+/events$#',
    ];

    /**
     * method + path with numeric ids replaced by *
     *
     * @var array<string, string>
     */
    private const MAP = [
        'POST creators' => 'creator.create',
        'PATCH creators/*' => 'creator.update',
        'POST creators/*/portfolio' => 'creator.portfolio.add',
        'DELETE creators/*/portfolio/*' => 'creator.portfolio.remove',
        'POST creators/*/contract' => 'creator.contract.accept',
        'POST creators/*/approve' => 'creator.approve',
        'POST creators/*/reject' => 'creator.reject',
        'POST creators/*/password' => 'creator.password.reset',
        'DELETE creators/*' => 'creator.delete',
        'POST creators/reset-casting' => 'creator.reset_casting',
        'POST companies' => 'company.create',
        'PATCH companies/*' => 'company.update',
        'DELETE companies/*' => 'company.delete',
        'POST companies/*/favorites/*' => 'company.favorite.toggle',
        'POST companies/*/invite-code' => 'company.invite.rotate',
        'POST companies/*/approve' => 'company.approve',
        'POST companies/*/reject' => 'company.reject',
        'POST companies/*/users' => 'company.user.create',
        'PATCH companies/*/users/*' => 'company.user.update',
        'DELETE companies/*/users/*' => 'company.user.delete',
        'PATCH companies/*/landing' => 'landing.update',
        'POST companies/*/landing/publish' => 'landing.publish',
        'POST companies/*/landing/disable' => 'landing.disable',
        'PATCH companies/*/landing/signups/*' => 'landing.signup.update',
        'POST landings/*/claim' => 'landing.claim',
        'POST campaigns' => 'campaign.create',
        'PATCH campaigns/*' => 'campaign.update',
        'DELETE campaigns/*' => 'campaign.delete',
        'POST campaigns/*/apply' => 'campaign.apply',
        'POST campaigns/*/assign' => 'campaign.assign',
        'POST campaigns/*/approve-agency' => 'campaign.approve_agency',
        'POST campaigns/reset' => 'campaign.reset',
        'PATCH campaign-creators/*' => 'campaign.participation.update',
        'DELETE campaign-creators/*' => 'campaign.participation.delete',
        'POST recurring-contracts' => 'recurring.create',
        'PATCH recurring-contracts/*' => 'recurring.update',
        'DELETE recurring-contracts/*' => 'recurring.delete',
        'POST recurring-contracts/*/creators' => 'recurring.creator.attach',
        'DELETE recurring-contracts/*/creators/*' => 'recurring.creator.detach',
        'POST recurring-contracts/*/generate-month-demands' => 'recurring.generate_month',
        'POST recurring-contracts/*/items' => 'recurring.item.create',
        'POST recurring-contracts/*/approve-agency' => 'recurring.approve_agency',
        'POST recurring-contracts/reset' => 'recurring.reset',
        'PATCH content-planning-items/*' => 'planning.item.update',
        'DELETE content-planning-items/*' => 'planning.item.delete',
        'POST users' => 'user.create',
        'PATCH users/*' => 'user.update',
        'DELETE users/*' => 'user.delete',
        'POST admin-users' => 'admin_user.create',
        'DELETE admin-users/*' => 'admin_user.delete',
        'PATCH mail/templates/*' => 'mail.template.update',
        'POST mail/templates/*/restore' => 'mail.template.restore',
        'POST mail/templates/*/test' => 'mail.template.test',
        'PATCH mail/settings' => 'mail.settings.update',
        'POST media' => 'media.upload',
        'POST media/uploads/*' => 'media.upload.complete',
        'DELETE media/uploads/*' => 'media.upload.cancel',
    ];

    public static function shouldSkip(Request $request): bool
    {
        if (! in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            return true;
        }

        $path = $request->path();
        foreach (self::SKIP as $pattern) {
            if (preg_match($pattern, $path) === 1) {
                return true;
            }
        }

        return false;
    }

    public static function actionFor(Request $request): string
    {
        $path = preg_replace('#^api/#', '', $request->path()) ?? $request->path();
        $normalized = preg_replace('#/[0-9]+#', '/*', $path) ?? $path;
        $key = strtoupper($request->method()).' '.$normalized;

        return self::MAP[$key] ?? 'other';
    }
}
