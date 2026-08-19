# Modelo de domínio

Enums (string no MySQL + PHP Enum):

- UserRole: `admin|creator|company`
- CreatorStatus: `active|review|paused|rejected`
- CompanyStatus: `active|pending|rejected`
- CampaignStatus: `briefing|selection|approval|production|published|finished`
- DeliveryStatus: `pending|sent|revision|approved|published`
- SignatureStatus: `pending|sent|signed`
- ApprovalFlowType: `script_and_video|video_only|script_only`
- StageApprovalStatus: `pending|submitted|approved|revision`
- ApplicationStatus / PaymentStatus: `pending|approved|rejected` e `pending|paid`
- RecurringContractStatus: `active|paused|finished`
- ContentPlanningStatus: `planned|in_production|review|approved|rejected|published`
- ContentType: `reel|story|post|tiktok|youtube|live|pinterest|blog|podcast|unboxing|ugc|event|other`

Entidades: User, Creator, Company, CompanyUser, Campaign, CampaignCreator (participação única), RecurringContract, ContentPlanningItem, Notification, MediaFile, Consent, CreatorContractAcceptance.

JSON só em objetos livres do legado (sociais, métricas, pricing, attachments, monthly_deliverables).
