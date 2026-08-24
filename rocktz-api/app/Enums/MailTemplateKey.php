<?php

namespace App\Enums;

enum MailTemplateKey: string
{
    case CreatorRegistered = 'creator.registered';
    case CreatorApproved = 'creator.approved';
    case CreatorRejected = 'creator.rejected';
    case CampaignOpportunity = 'campaign.opportunity';
    case CampaignApplicationReceived = 'campaign.application_received';
    case CampaignApplicationApproved = 'campaign.application_approved';
    case CampaignApplicationRejected = 'campaign.application_rejected';
    case DemandAssigned = 'demand.assigned';
    case DemandReminder = 'demand.reminder';
    case DeliveryRevisionRequested = 'delivery.revision_requested';
    case DeliveryApproved = 'delivery.approved';
    case DemandUpdated = 'demand.updated';
    case CompanyRegistered = 'company.registered';
    case CompanyApproved = 'company.approved';
    case CompanyRejected = 'company.rejected';
    case CampaignCreatorApplied = 'campaign.creator_applied';
    case DeliverySubmitted = 'delivery.submitted';
    case DeliveryPendingReviewReminder = 'delivery.pending_review_reminder';
    case CampaignPublished = 'campaign.published';
    case AdminCreatorPending = 'admin.creator_pending';
    case AdminCompanyPending = 'admin.company_pending';
    case AdminCampaignPending = 'admin.campaign_pending';
    case AdminDeliveryStuck = 'admin.delivery_stuck';
    case AdminDemandOverdue = 'admin.demand_overdue';
    case AdminCampaignStartingEmpty = 'admin.campaign_starting_empty';
    case AdminSendFailed = 'admin.send_failed';
    case AdminFailureVolume = 'admin.failure_volume';
    case PasswordReset = 'auth.password_reset';
    case TwoFactorCode = 'auth.two_factor';

    public function audience(): MailTemplateAudience
    {
        return match ($this) {
            self::CompanyRegistered,
            self::CompanyApproved,
            self::CompanyRejected,
            self::CampaignCreatorApplied,
            self::DeliverySubmitted,
            self::DeliveryPendingReviewReminder,
            self::CampaignPublished => MailTemplateAudience::Company,
            self::AdminCreatorPending,
            self::AdminCompanyPending,
            self::AdminCampaignPending,
            self::AdminDeliveryStuck,
            self::AdminDemandOverdue,
            self::AdminCampaignStartingEmpty,
            self::AdminSendFailed,
            self::AdminFailureVolume => MailTemplateAudience::Admin,
            default => MailTemplateAudience::Creator,
        };
    }

    public function category(): MailTemplateCategory
    {
        return match ($this) {
            self::CampaignOpportunity => MailTemplateCategory::Opportunity,
            self::DemandReminder, self::DeliveryPendingReviewReminder => MailTemplateCategory::Reminder,
            self::AdminDeliveryStuck,
            self::AdminDemandOverdue,
            self::AdminCampaignStartingEmpty,
            self::AdminFailureVolume => MailTemplateCategory::Digest,
            default => MailTemplateCategory::Operational,
        };
    }

    public function preferenceFlag(): ?string
    {
        return match ($this) {
            self::CampaignOpportunity => 'opportunities',
            self::DemandReminder, self::DeliveryPendingReviewReminder => 'deadline_reminders',
            self::CampaignCreatorApplied, self::CampaignPublished => 'campaign_updates',
            default => null,
        };
    }

    public function isOptional(): bool
    {
        return $this->preferenceFlag() !== null;
    }

    /**
     * Optional flags that may suppress this template. Operational keys with null cannot be disabled.
     *
     * @return list<string>
     */
    public function requiredVariables(): array
    {
        return match ($this) {
            self::CreatorRegistered => ['link_cadastro'],
            self::CreatorApproved => ['link_plataforma'],
            self::CreatorRejected => ['link_cadastro'],
            self::CampaignOpportunity,
            self::CampaignApplicationReceived,
            self::CampaignApplicationApproved,
            self::CampaignApplicationRejected,
            self::CampaignPublished,
            self::CampaignCreatorApplied => ['link_campanha'],
            self::DemandAssigned,
            self::DemandReminder,
            self::DeliveryRevisionRequested,
            self::DeliveryApproved,
            self::DemandUpdated,
            self::DeliverySubmitted,
            self::DeliveryPendingReviewReminder => ['link_demanda'],
            self::CompanyRegistered,
            self::CompanyApproved,
            self::CompanyRejected => ['link_plataforma'],
            self::PasswordReset => ['link_plataforma'],
            self::TwoFactorCode => ['codigo'],
            default => ['link_plataforma'],
        };
    }

    /**
     * @return list<string>
     */
    public function highlightKeys(): array
    {
        return match ($this) {
            self::CampaignOpportunity => ['nome_empresa', 'nome_campanha', 'data_limite', 'valor_campanha'],
            self::CampaignApplicationApproved => ['nome_campanha', 'nome_empresa', 'data_entrega'],
            self::DemandAssigned => ['nome_campanha', 'nome_empresa', 'nome_demanda', 'data_entrega', 'valor_campanha'],
            self::DemandReminder => ['nome_demanda', 'data_limite'],
            self::DeliveryRevisionRequested => ['nome_campanha', 'nome_demanda', 'solicitacao_modificacao', 'data_limite'],
            self::DemandUpdated => ['nome_demanda', 'data_limite', 'motivo_reprovacao'],
            self::CampaignCreatorApplied => ['nome_criador', 'nome_campanha'],
            self::DeliverySubmitted => ['nome_criador', 'nome_campanha', 'nome_demanda', 'data_entrega'],
            self::CampaignPublished => ['nome_campanha', 'data_limite'],
            self::CreatorRejected => ['motivo_reprovacao'],
            self::CampaignApplicationRejected => ['nome_campanha'],
            self::TwoFactorCode => ['codigo'],
            default => [],
        };
    }

    /**
     * @return list<int>
     */
    public function defaultReminderOffsets(): array
    {
        return match ($this) {
            self::DemandReminder, self::DeliveryPendingReviewReminder => [3, 1, 0, -1],
            default => [],
        };
    }
}
