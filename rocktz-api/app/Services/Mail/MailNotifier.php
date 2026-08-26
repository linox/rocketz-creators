<?php

namespace App\Services\Mail;

use App\Enums\CampaignStatus;
use App\Enums\CreatorStatus;
use App\Enums\MailTemplateKey;
use App\Enums\UserRole;
use App\Models\Campaign;
use App\Models\CampaignCreator;
use App\Models\Company;
use App\Models\ContentPlanningItem;
use App\Models\Creator;
use App\Models\MailMessage;
use App\Models\RecurringContract;
use App\Models\User;
use App\Support\FrontendUrl;
use Illuminate\Database\Eloquent\Model;

class MailNotifier
{
    public function __construct(private readonly TransactionalMailService $mail) {}

    public function creatorRegistered(User $user): void
    {
        $user->loadMissing('creator');
        $this->mail->send(MailTemplateKey::CreatorRegistered, $user, [
            'nome_criador' => $user->creator?->artistic_name ?: $user->name,
            'data_cadastro' => now()->isoFormat('D MMM YYYY'),
            'cta_url' => $user->creator ? FrontendUrl::to('/creators/'.$user->creator->id) : FrontendUrl::origin(),
            'link_cadastro' => $user->creator ? FrontendUrl::to('/creators/'.$user->creator->id) : FrontendUrl::origin(),
            'creator_id' => $user->creator?->id,
        ], $user->creator);
        $this->notifyAdmins(MailTemplateKey::AdminCreatorPending, [
            'nome_criador' => $user->creator?->artistic_name ?: $user->name,
            'cta_url' => $user->creator ? FrontendUrl::to('/creators/'.$user->creator->id) : FrontendUrl::to('/creators'),
            'creator_id' => $user->creator?->id,
        ], $user->creator, 'creator:'.($user->creator?->id ?? $user->id));
    }

    public function creatorApproved(Creator $creator): void
    {
        $user = $creator->user;
        if (! $user) {
            return;
        }
        $this->mail->send(MailTemplateKey::CreatorApproved, $user, [
            'nome_criador' => $creator->artistic_name ?: $creator->full_name,
            'cta_url' => FrontendUrl::to('/available-campaigns'),
            'link_plataforma' => FrontendUrl::to('/available-campaigns'),
            'creator_id' => $creator->id,
        ], $creator);
    }

    public function creatorRejected(Creator $creator, ?string $reason): void
    {
        $user = $creator->user;
        if (! $user) {
            return;
        }
        $this->mail->send(MailTemplateKey::CreatorRejected, $user, [
            'nome_criador' => $creator->artistic_name ?: $creator->full_name,
            'motivo_reprovacao' => $reason,
            'cta_url' => FrontendUrl::to('/creators/'.$creator->id),
            'link_cadastro' => FrontendUrl::to('/creators/'.$creator->id),
            'creator_id' => $creator->id,
        ], $creator);
    }

    public function companyRegistered(User $user): void
    {
        $user->loadMissing('company');
        $this->mail->send(MailTemplateKey::CompanyRegistered, $user, [
            'nome_empresa' => $user->company?->name,
            'nome_usuario' => $user->name,
            'data_cadastro' => now()->isoFormat('D MMM YYYY'),
            'cta_url' => FrontendUrl::to('/company-dashboard'),
            'company_id' => $user->company?->id,
        ], $user->company);
        $this->notifyAdmins(MailTemplateKey::AdminCompanyPending, [
            'nome_empresa' => $user->company?->name,
            'cta_url' => $user->company ? FrontendUrl::to('/companies') : FrontendUrl::origin(),
            'company_id' => $user->company?->id,
        ], $user->company, 'company:'.($user->company?->id ?? $user->id));
    }

    public function companyApproved(Company $company): void
    {
        $company->loadMissing('companyUsers.user');
        foreach ($company->companyUsers as $row) {
            if ($row->user) {
                $this->mail->send(MailTemplateKey::CompanyApproved, $row->user, [
                    'nome_empresa' => $company->name,
                    'cta_url' => FrontendUrl::to('/company-dashboard'),
                    'company_id' => $company->id,
                ], $company);
            }
        }
    }

    public function companyRejected(Company $company): void
    {
        $company->loadMissing('companyUsers.user');
        foreach ($company->companyUsers as $row) {
            if ($row->user) {
                $this->mail->send(MailTemplateKey::CompanyRejected, $row->user, [
                    'nome_empresa' => $company->name,
                    'cta_url' => FrontendUrl::supportMailto(),
                    'link_suporte' => FrontendUrl::supportMailto(),
                    'company_id' => $company->id,
                ], $company);
            }
        }
    }

    public function campaignVisible(Campaign $campaign): void
    {
        $campaign->loadMissing('company.companyUsers.user', 'briefing', 'deliverable');
        if ($campaign->isPendingAgency() || $campaign->status === CampaignStatus::Finished || $campaign->is_secret) {
            return;
        }

        foreach ($campaign->company?->companyUsers ?? [] as $row) {
            if ($row->user) {
                $this->mail->send(MailTemplateKey::CampaignPublished, $row->user, $this->campaignVars($campaign, [
                    'cta_url' => FrontendUrl::to('/campaigns/'.$campaign->id),
                ]), $campaign, 'published');
            }
        }

        $already = $campaign->campaignCreators()->pluck('creator_id');
        $country = $campaign->company?->countryCode();

        Creator::query()
            ->where('status', CreatorStatus::Active)
            ->whereNotNull('user_id')
            ->whereNotIn('id', $already)
            ->where(function ($query) use ($country) {
                $query->where('can_access_all_countries', true);
                if ($country) {
                    $query->orWhere('country', $country);
                }
            })
            ->with('user')
            ->get()
            ->filter(fn (Creator $creator) => $campaign->matchesCreatorLocation($creator))
            ->each(function (Creator $creator) use ($campaign) {
                if (! $creator->user) {
                    return;
                }
                $this->mail->send(
                    MailTemplateKey::CampaignOpportunity,
                    $creator->user,
                    $this->campaignVars($campaign, [
                        'nome_criador' => $creator->artistic_name ?: $creator->full_name,
                        'cta_url' => FrontendUrl::to('/campaigns/'.$campaign->id),
                        'link_campanha' => FrontendUrl::to('/campaigns/'.$campaign->id),
                        'creator_id' => $creator->id,
                    ]),
                    $campaign,
                    'opportunity:'.$creator->id,
                );
            });
    }

    public function campaignPendingAgency(Campaign $campaign): void
    {
        $this->notifyAdmins(MailTemplateKey::AdminCampaignPending, [
            'nome_campanha' => $campaign->name,
            'nome_empresa' => $campaign->company?->name,
            'cta_url' => FrontendUrl::to('/campaigns/'.$campaign->id),
            'campaign_id' => $campaign->id,
            'company_id' => $campaign->company_id,
        ], $campaign);
    }

    public function recurringPendingAgency(RecurringContract $contract): void
    {
        $this->notifyAdmins(MailTemplateKey::AdminCampaignPending, [
            'nome_campanha' => $contract->title,
            'nome_empresa' => $contract->company?->name,
            'cta_url' => FrontendUrl::to('/recurring/'.$contract->id),
            'company_id' => $contract->company_id,
        ], $contract);
    }

    public function creatorApplied(Campaign $campaign, Creator $creator): void
    {
        $campaign->loadMissing('company.companyUsers.user');
        foreach ($campaign->company?->companyUsers ?? [] as $row) {
            if ($row->user) {
                $this->mail->send(MailTemplateKey::CampaignCreatorApplied, $row->user, [
                    'nome_criador' => $creator->artistic_name ?: $creator->full_name,
                    'nome_campanha' => $campaign->name,
                    'cta_url' => FrontendUrl::to('/campaigns/'.$campaign->id),
                    'link_campanha' => FrontendUrl::to('/campaigns/'.$campaign->id),
                    'campaign_id' => $campaign->id,
                    'company_id' => $campaign->company_id,
                    'creator_id' => $creator->id,
                ], $campaign, 'apply:'.$creator->id);
            }
        }

        if ($creator->user) {
            $this->mail->send(MailTemplateKey::CampaignApplicationReceived, $creator->user, [
                'nome_criador' => $creator->artistic_name ?: $creator->full_name,
                'nome_campanha' => $campaign->name,
                'cta_url' => FrontendUrl::to('/creators/'.$creator->id.'?tab=campaigns'),
                'link_campanha' => FrontendUrl::to('/campaigns/'.$campaign->id),
                'campaign_id' => $campaign->id,
                'creator_id' => $creator->id,
            ], $campaign, 'applied');
        }
    }

    public function landingSignup(Company $company, Creator $creator): void
    {
        $company->loadMissing('companyUsers.user');
        foreach ($company->companyUsers as $row) {
            if ($row->user) {
                $this->mail->send(MailTemplateKey::CampaignCreatorApplied, $row->user, [
                    'nome_criador' => $creator->artistic_name ?: $creator->full_name,
                    'nome_campanha' => $company->name,
                    'cta_url' => FrontendUrl::to('/creators/'.$creator->id.'?from=landing'),
                    'link_campanha' => FrontendUrl::to('/creators/'.$creator->id.'?from=landing'),
                    'company_id' => $company->id,
                    'creator_id' => $creator->id,
                ], $creator, 'landing:'.$company->id);
            }
        }
    }

    public function applicationDecided(CampaignCreator $row, bool $approved, ?string $reason = null): void
    {
        $row->loadMissing(['creator.user', 'campaign.company']);
        $user = $row->creator?->user;
        if (! $user) {
            return;
        }
        $campaign = $row->campaign;
        $key = $approved ? MailTemplateKey::CampaignApplicationApproved : MailTemplateKey::CampaignApplicationRejected;
        $this->mail->send($key, $user, [
            'nome_criador' => $row->creator?->artistic_name,
            'nome_campanha' => $campaign?->name,
            'nome_empresa' => $campaign?->company?->name,
            'data_entrega' => optional($row->delivery_date)?->isoFormat('D MMM YYYY'),
            'motivo_reprovacao' => $approved ? null : $reason,
            'cta_url' => $approved
                ? FrontendUrl::to('/campaigns/'.$row->campaign_id)
                : FrontendUrl::to('/available-campaigns'),
            'link_campanha' => FrontendUrl::to('/campaigns/'.$row->campaign_id),
            'campaign_id' => $row->campaign_id,
            'creator_id' => $row->creator_id,
            'company_id' => $campaign?->company_id,
        ], $campaign, $approved ? 'approved' : 'rejected');
    }

    public function demandAssignedToCreator(Creator $creator, RecurringContract $contract, ?ContentPlanningItem $item = null): void
    {
        $user = $creator->user;
        if (! $user) {
            return;
        }
        $this->mail->send(MailTemplateKey::DemandAssigned, $user, [
            'nome_criador' => $creator->artistic_name ?: $creator->full_name,
            'nome_campanha' => $contract->title,
            'nome_empresa' => $contract->company?->name,
            'nome_demanda' => $item?->title ?: $contract->title,
            'data_entrega' => optional($item?->planned_date)?->isoFormat('D MMM YYYY'),
            'cta_url' => FrontendUrl::to('/creators/'.$creator->id.'?tab=recurring'),
            'link_demanda' => FrontendUrl::to('/recurring/'.$contract->id),
            'creator_id' => $creator->id,
            'company_id' => $contract->company_id,
        ], $item ?? $contract, $item ? 'item:'.$item->id : 'contract');
    }

    public function campaignAssigned(Campaign $campaign, Creator $creator): void
    {
        if (! $creator->user) {
            return;
        }
        $this->mail->send(MailTemplateKey::DemandAssigned, $creator->user, [
            'nome_criador' => $creator->artistic_name ?: $creator->full_name,
            'nome_campanha' => $campaign->name,
            'nome_empresa' => $campaign->company?->name,
            'nome_demanda' => $campaign->name,
            'cta_url' => FrontendUrl::to('/creators/'.$creator->id.'?tab=campaigns'),
            'link_demanda' => FrontendUrl::to('/campaigns/'.$campaign->id),
            'campaign_id' => $campaign->id,
            'creator_id' => $creator->id,
            'company_id' => $campaign->company_id,
        ], $campaign, 'assigned');
    }

    public function revisionRequested(User $user, string $campaignName, string $demandName, ?string $comments, string $ctaPath, array $ids = []): void
    {
        $this->mail->send(MailTemplateKey::DeliveryRevisionRequested, $user, array_merge([
            'nome_campanha' => $campaignName,
            'nome_demanda' => $demandName,
            'solicitacao_modificacao' => $comments,
            'cta_url' => FrontendUrl::to($ctaPath),
            'link_demanda' => FrontendUrl::to($ctaPath),
        ], $ids));
    }

    public function deliveryApproved(User $user, string $campaignName, string $demandName, string $ctaPath, array $ids = []): void
    {
        $this->mail->send(MailTemplateKey::DeliveryApproved, $user, array_merge([
            'nome_campanha' => $campaignName,
            'nome_demanda' => $demandName,
            'cta_url' => FrontendUrl::to($ctaPath),
            'link_demanda' => FrontendUrl::to($ctaPath),
        ], $ids));
    }

    public function deliverySubmitted(int $companyId, Creator $creator, string $title, string $ctaPath, array $ids, ?Model $related = null): void
    {
        $company = Company::query()->with('companyUsers.user')->find($companyId);
        if (! $company) {
            return;
        }
        foreach ($company->companyUsers as $row) {
            if ($row->user) {
                $this->mail->send(MailTemplateKey::DeliverySubmitted, $row->user, array_merge([
                    'nome_criador' => $creator->artistic_name ?: $creator->full_name,
                    'nome_campanha' => $title,
                    'nome_demanda' => $title,
                    'data_entrega' => now()->isoFormat('D MMM YYYY'),
                    'cta_url' => FrontendUrl::to($ctaPath),
                    'link_demanda' => FrontendUrl::to($ctaPath),
                    'company_id' => $companyId,
                    'creator_id' => $creator->id,
                ], $ids), $related, 'submit:'.$creator->id);
            }
        }
    }

    public function demandUpdated(ContentPlanningItem $item, ?string $reason = null): void
    {
        $item->loadMissing(['creator.user', 'recurringContract.company']);
        $user = $item->creator?->user;
        if (! $user) {
            return;
        }
        $this->mail->send(MailTemplateKey::DemandUpdated, $user, [
            'nome_demanda' => $item->title ?: $item->recurringContract?->title,
            'nome_campanha' => $item->recurringContract?->title,
            'data_limite' => optional($item->planned_date)?->isoFormat('D MMM YYYY'),
            'motivo_reprovacao' => $reason,
            'cta_url' => FrontendUrl::to('/creators/'.$item->creator_id.'?tab=recurring'),
            'link_demanda' => FrontendUrl::to('/recurring/'.$item->recurring_contract_id),
            'creator_id' => $item->creator_id,
            'company_id' => $item->company_id,
        ], $item, 'updated:'.($item->updated_at?->timestamp ?? time()));
    }

    public function adminSendFailed(MailMessage $failed): void
    {
        if ($failed->template_key === MailTemplateKey::AdminSendFailed) {
            return;
        }
        $this->notifyAdmins(MailTemplateKey::AdminSendFailed, [
            'nome_usuario' => $failed->email,
            'nome_campanha' => $failed->template_key->value,
            'cta_url' => FrontendUrl::to('/mail/log'),
        ], $failed, 'fail:'.$failed->id);
    }

    /**
     * @param  array<string, scalar|null>  $context
     */
    public function notifyAdmins(MailTemplateKey $key, array $context, ?Model $related = null, string $occurrence = 'default'): void
    {
        User::query()->where('role', UserRole::Admin)->get()->each(function (User $admin) use ($key, $context, $related, $occurrence) {
            $this->mail->send($key, $admin, $context, $related, $occurrence.':admin:'.$admin->id);
        });
    }

    /**
     * @param  array<string, scalar|null>  $extra
     * @return array<string, scalar|null>
     */
    private function campaignVars(Campaign $campaign, array $extra = []): array
    {
        $value = $campaign->is_barter ? null : $campaign->creator_cache;

        return array_merge([
            'nome_campanha' => $campaign->name,
            'nome_empresa' => $campaign->company?->name,
            'data_limite' => optional($campaign->end_date)?->isoFormat('D MMM YYYY'),
            'valor_campanha' => $value !== null && (float) $value > 0 ? (string) $value : null,
            'campaign_id' => $campaign->id,
            'company_id' => $campaign->company_id,
            'link_campanha' => FrontendUrl::to('/campaigns/'.$campaign->id),
        ], $extra);
    }
}
