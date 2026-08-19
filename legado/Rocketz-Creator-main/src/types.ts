import { CreatorContractAuditRecord } from './data/creatorContractTerms';
export type { CreatorContractAuditRecord };

export type CreatorStatus = 'active' | 'review' | 'paused' | 'rejected';
export type CampaignStatus = 'briefing' | 'selection' | 'approval' | 'production' | 'published' | 'finished';
export type DeliveryStatus = 'pending' | 'sent' | 'revision' | 'approved' | 'published';
export type SignatureStatus = 'pending' | 'sent' | 'signed';
export type ApprovalFlowType = 'script_and_video' | 'video_only' | 'script_only';
export type StageApprovalStatus = 'pending' | 'submitted' | 'approved' | 'revision';

export interface PortfolioVideo {
  id: string;
  title: string;
  url: string;
  description?: string;
  uploadedAt: string;
}

export interface Creator {
  id: string;
  fullName: string;
  artisticName: string;
  photoUrl?: string;
  document: string;
  cpf?: string;
  whatsapp: string;
  email: string;
  city: string;
  state: string;
  birthDate: string;
  pixKey: string;
  bankDetails: string;
  socials: {
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    kwai?: string;
    blog?: string;
    pinterest?: string;
    twitch?: string;
    twitter?: string;
    linkedin?: string;
  };
  metrics: {
    followers: number;
    avgViews: number;
    avgEngagement: number;
  };
  categories: string[];
  pricing: {
    story?: number;
    reel?: number;
    post?: number;
    tiktok?: number;
    youtube?: number;
    live?: number;
    pinterest?: number;
    blog?: number;
    podcast?: number;
    unboxing?: number;
    ugc?: number;
    combo?: number;
  };
  acceptsExchange: boolean;
  acceptsPaidTraffic: boolean;
  acceptsExclusivity: boolean;
  bio?: string;
  workAffinities?: string[];
  internalNotes: string;
  status: CreatorStatus;
  role?: 'admin' | 'creator' | string;
  manualPassword?: string;
  passwordUpdatedAt?: string;
  passwordUpdatedBy?: string;
  portfolio?: PortfolioVideo[];
  contractAcceptance?: CreatorContractAuditRecord;
  createdAt: any;
}

export interface CompanyContact {
  name: string;
  role: string;
  email: string;
  whatsapp: string;
}

export interface Company {
  id: string;
  name: string;
  cnpj: string;
  segment: string;
  responsibleName: string;
  whatsapp: string;
  email: string;
  city: string;
  observations: string;
  logo?: string;
  logoUrl?: string;
  contacts?: CompanyContact[];
  favoriteCreators?: string[];
  status?: 'active' | 'pending' | 'rejected';
  createdAt: any;
}

export interface CampaignDeliverablesPerCreator {
  summary?: string;
  reels?: number;
  stories?: number;
  tiktok?: number;
  ugc?: number;
  posts?: number;
  youtube?: number;
  deadlineDays?: number;
  guidelines?: string;
}

export interface Campaign {
  id: string;
  name: string;
  companyId: string;
  objective: string;
  startDate: string;
  endDate: string;
  totalBudget: number;
  agencyFee: number;
  creatorsBudget: number;
  status: CampaignStatus;
  imageUrl?: string;
  creatorCache?: number;
  isSecret?: boolean;
  isDirectContract?: boolean;
  isBarter?: boolean;
  barterDetails?: string;
  approvalFlow?: ApprovalFlowType;
  deliverablesPerCreator?: CampaignDeliverablesPerCreator;
  briefing: {
    product: string;
    keyMessage: string;
    mustHave: string;
    donts: string;
    cta: string;
    hashtags: string;
    link: string;
    coupon: string;
    attachments: string[];
  };
  createdAt: any;
}

export interface CampaignCreator {
  id: string;
  campaignId: string;
  creatorId: string;
  deliveryType: string;
  amount: number;
  deliveryDate: string;
  postDate: string;
  deliveryStatus: DeliveryStatus;
  paymentStatus: 'pending' | 'paid';
  notes: string;
  applicationStatus?: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  revisionDetails?: string;
  scriptStatus?: StageApprovalStatus;
  scriptFeedback?: string;
  scriptSubmittedAt?: any;
  videoStatus?: StageApprovalStatus;
  videoFeedback?: string;
  videoSubmittedAt?: any;
  signature: {
    status: SignatureStatus;
    sentAt: any;
    signedAt: any;
    contractUrl: string;
  };
  content: {
    script: string;
    videoUrl: string;
    imageUrl: string;
    publishedLink: string;
    storyPrints: string[];
    metrics: {
      reach: number;
      impressions: number;
      clicks: number;
      views: number;
      engagement: number;
    };
  };
}

export interface MonthlyDeliverables {
  reels?: number;
  stories?: number;
  posts?: number;
  tiktok?: number;
  youtube?: number;
  live?: number;
  pinterest?: number;
  blog?: number;
  podcast?: number;
  unboxing?: number;
  ugc?: number;
  other?: string;
}

export interface RecurringCreatorConfig {
  creatorId: string;
  creatorName?: string;
  artisticName?: string;
  monthlyCache?: number;
  monthlyFee?: number;
  deliverablesFee?: number;
  monthlyDeliverables: MonthlyDeliverables;
  notes?: string;
}

export type ContentPlanningStatus = 'planned' | 'in_production' | 'review' | 'approved' | 'rejected' | 'published';

export type ContentType = 
  | 'reel' 
  | 'story' 
  | 'post' 
  | 'tiktok' 
  | 'youtube' 
  | 'live' 
  | 'pinterest' 
  | 'blog' 
  | 'podcast' 
  | 'unboxing' 
  | 'ugc' 
  | 'event' 
  | 'other';

export interface ContentPlanningItem {
  id: string;
  recurringContractId: string;
  companyId: string;
  creatorId: string;
  creatorName?: string;
  month: string; // YYYY-MM format, e.g. "2026-08"
  contentType: ContentType;
  title: string;
  description?: string;
  briefingNote?: string;
  briefing?: string;
  references?: string;
  script?: string;
  caption?: string;
  plannedDate?: string;
  status: ContentPlanningStatus;
  approvalFlow?: ApprovalFlowType;
  scriptStatus?: StageApprovalStatus;
  scriptFeedback?: string;
  scriptSubmittedAt?: any;
  videoStatus?: StageApprovalStatus;
  videoFeedback?: string;
  videoSubmittedAt?: any;
  publishedUrl?: string;
  mediaUrl?: string;
  submissionUrl?: string;
  submissionNotes?: string;
  submittedAt?: any;
  feedbackNote?: string;
  reviewedAt?: any;
  createdAt?: any;
}

export interface RecurringContract {
  id: string;
  companyId: string;
  companyName?: string;
  title: string;
  objective?: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'paused' | 'finished';
  monthlyFee?: number;
  notes?: string;
  creators: RecurringCreatorConfig[];
  createdAt: any;
}

