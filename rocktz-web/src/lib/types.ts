export type Creator = {
  id: number;
  user_id?: number | null;
  role?: string | null;
  full_name?: string | null;
  artistic_name: string;
  photo_url: string | null;
  whatsapp?: string | null;
  email?: string | null;
  city: string | null;
  country?: string | null;
  state: string | null;
  bio: string | null;
  document?: string | null;
  cpf?: string | null;
  pix_key?: string | null;
  bank_details?: string | null;
  socials: Record<string, string>;
  metrics: Record<string, number>;
  categories: string[];
  pricing: Record<string, number>;
  work_affinities: string[];
  accepts_exchange: boolean;
  accepts_paid_traffic: boolean;
  accepts_exclusivity: boolean;
  internal_notes?: string | null;
  status: string;
  can_access_all_countries?: boolean;
  can_moderate?: boolean;
  invited_by_company_id?: number | null;
  invited_by_company?: { id: number; name: string } | null;
  landing_review?: {
    id: number;
    status: string;
    source?: string;
    reviewed_at?: string | null;
    created_at?: string | null;
  } | null;
  portfolio?: {
    id: number;
    title: string;
    url: string;
    description: string | null;
    orientation?: "horizontal" | "vertical" | null;
    file_size?: number;
    download_url?: string;
    uploaded_at?: string | null;
  }[];
  contract_acceptance?: { id: number; status: string; accepted_at: string | null; full_name: string } | null;
};

export type SocialSyncResult = {
  ok: boolean;
  cached?: boolean;
  handle?: string;
  followers?: number | null;
  views?: number | null;
  engagement?: number | null;
  message?: string;
};

export type MetricsJobStatus = "queued" | "running" | "done" | "failed";

export type Company = {
  id: number;
  name: string;
  cnpj: string | null;
  segment: string | null;
  responsible_name: string | null;
  whatsapp: string | null;
  email: string | null;
  city: string | null;
  country?: string | null;
  currency?: string | null;
  observations: string | null;
  logo_url: string | null;
  objective: string | null;
  status: string;
  contacts?: { id: number; name: string; role: string | null; email: string | null; whatsapp: string | null }[];
  favorite_creator_ids?: number[];
  users?: { id: number; email: string | null; name: string | null; status: string | null; can_publish_without_approval?: boolean }[];
  creator_invite_code?: string | null;
};

export type CompanyLandingPage = {
  id: number;
  company_id: number;
  company?: { id: number; name: string; logo_url: string | null; status: string } | null;
  slug: string;
  display_name: string;
  logo_url: string | null;
  banner_url: string | null;
  title: string | null;
  description: string | null;
  cta_text: string | null;
  primary_color: string;
  button_color: string;
  background_color: string;
  website_url: string | null;
  socials: Record<string, string>;
  status: "draft" | "published" | "disabled" | string;
  published_at?: string | null;
  metrics?: CompanyLandingMetrics | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CompanyLandingMetrics = {
  views: number;
  cta_clicks: number;
  signups_started: number;
  signups_completed: number;
  pending: number;
  reviewing: number;
  analyzed: number;
  approved: number;
  rejected: number;
  conversion_rate: number;
};

export type CompanyLandingSignup = {
  id: number;
  company_id: number;
  company_landing_page_id: number;
  creator_id: number;
  source: string;
  status: "pending" | "reviewing" | "approved" | "rejected" | string;
  reviewed_at?: string | null;
  reviewed_by?: { id: number; name: string } | null;
  creator?: Creator;
  created_at?: string | null;
};

export type Campaign = {
  id: number;
  company_id: number;
  company?: { id: number; name: string; logo_url: string | null; status: string; segment?: string | null; country?: string | null; currency?: string | null };
  name: string;
  objective: string | null;
  start_date: string | null;
  end_date: string | null;
  total_budget: number | null;
  agency_fee: number | null;
  agency_fee_percent?: number | null;
  creators_budget: number | null;
  creator_cache?: number | null;
  currency?: string | null;
  status: string;
  image_url: string | null;
  is_secret: boolean;
  is_direct_contract: boolean;
  is_barter: boolean;
  limit_by_city?: boolean;
  state?: string | null;
  city?: string | null;
  barter_details: string | null;
  has_custom_contract?: boolean;
  custom_contract_terms?: string | null;
  approval_flow: string | null;
  posting_profile?: "creator" | "brand" | string | null;
  briefing?: Record<string, string | string[] | null> | null;
  deliverables?: Record<string, string | number | null> | null;
  applications?: CampaignCreator[];
  pending_applications?: number;
  accepting_applications?: boolean;
};

export type PostMetrics = {
  network?: string | null;
  url?: string | null;
  likes?: number | null;
  comments?: number | null;
  views?: number | null;
  shares?: number | null;
  engagement?: number | null;
  synced_at?: number | null;
};

export type PostMetricsSyncResult = {
  ok: boolean;
  cached?: boolean;
  network?: string;
  likes?: number | null;
  comments?: number | null;
  views?: number | null;
  shares?: number | null;
  engagement?: number | null;
  message?: string;
};

export type CampaignCreator = {
  id: number;
  campaign_id: number;
  creator_id: number;
  creator?: {
    id: number;
    full_name?: string | null;
    artistic_name: string;
    photo_url: string | null;
    status: string;
    city?: string | null;
    country?: string | null;
    state?: string | null;
    whatsapp?: string | null;
    pix_key?: string | null;
    categories?: string[];
    metrics?: Record<string, number>;
    pricing?: Record<string, number>;
    socials?: Record<string, string>;
  };
  campaign?: { id: number; name: string; status: string; image_url: string | null; currency?: string | null };
  delivery_type: string | null;
  amount: number | null;
  delivery_date: string | null;
  delivery_status: string | null;
  payment_status?: string | null;
  payment_date?: string | null;
  application_status: string | null;
  notes: string | null;
  rejection_reason: string | null;
  revision_details: string | null;
  script_status: string | null;
  video_status: string | null;
  script_feedback: string | null;
  video_feedback: string | null;
  script_submitted_at?: string | null;
  video_submitted_at?: string | null;
  pending_upload_id?: string | null;
  upload_progress?: number | null;
  signature_status?: string | null;
  contract_url?: string | null;
  custom_contract_accepted_at?: string | null;
  post_date?: string | null;
  content?: {
    script: string | null;
    video_url: string | null;
    video_file_size?: number;
    video_download_url?: string | null;
    image_url: string | null;
    published_link: string | null;
    script_version?: number;
    video_version?: number;
    submission_versions?: SubmissionVersionEntry[];
    revision_history?: RevisionHistoryEntry[];
    story_prints?: unknown[];
    metrics?: PostMetrics;
  } | null;
};

export type SubmissionVersionEntry = {
  version: number;
  stage: string;
  submitted_at?: string;
  script?: string | null;
  media_url?: string | null;
  submission_url?: string | null;
  video_url?: string | null;
  video_file_size?: number | null;
};

export type RevisionHistoryEntry = {
  stage: string;
  note: string;
  requested_at?: string;
};

export type RecurringContract = {
  id: number;
  company_id: number;
  company?: { id: number; name: string; logo_url: string | null; country?: string | null; currency?: string | null };
  title: string;
  objective: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  monthly_fee: number | null;
  currency?: string | null;
  notes: string | null;
  creators?: {
    id: number;
    creator_id: number;
    creator: {
      id: number;
      artistic_name: string;
      full_name?: string | null;
      photo_url: string | null;
      city?: string | null;
      country?: string | null;
      state?: string | null;
      categories?: string[];
      socials?: Record<string, string>;
    } | null;
    monthly_fee: number | null;
    monthly_cache: number | null;
    monthly_deliverables?: Record<string, number>;
    notes?: string | null;
    start_date?: string | null;
    end_date?: string | null;
  }[];
  items?: PlanningItem[];
};

export type PlanningItem = {
  id: number;
  recurring_contract_id: number;
  company_id?: number;
  company?: { id: number; name: string; logo_url?: string | null } | null;
  creator_id: number;
  creator?: { id: number; artistic_name: string; full_name?: string | null; photo_url: string | null } | null;
  month: string;
  content_type: string;
  title: string;
  description: string | null;
  briefing: string | null;
  briefing_note?: string | null;
  briefing_fields?: {
    product?: string | null;
    key_message?: string | null;
    must_have?: string | null;
    donts?: string | null;
    cta?: string | null;
    hashtags?: string | null;
  } | null;
  references?: string | null;
  script?: string | null;
  caption?: string | null;
  planned_date: string | null;
  status: string;
  approval_flow?: string | null;
  posting_profile?: "creator" | "brand" | string | null;
  script_status?: string | null;
  video_status?: string | null;
  script_feedback?: string | null;
  video_feedback?: string | null;
  script_submitted_at?: string | null;
  video_submitted_at?: string | null;
  pending_upload_id?: string | null;
  upload_progress?: number | null;
  script_version?: number;
  video_version?: number;
  submission_versions?: SubmissionVersionEntry[];
  revision_history?: RevisionHistoryEntry[];
  submission_url: string | null;
  media_url: string | null;
  published_url: string | null;
  metrics?: PostMetrics;
  submission_notes: string | null;
  feedback_note: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
};

export type AppNotification = {
  id: number;
  title: string;
  message: string;
  type: string;
  target_role?: string | null;
  link: string | null;
  read: boolean;
  creator_id?: number | null;
  campaign_id?: number | null;
  recurring_contract_id?: number | null;
  created_at: string | null;
};

export type DashboardStats = {
  total_creators?: number;
  active_creators?: number;
  pending_approval_creators?: number;
  running_campaigns?: number;
  finished_campaigns?: number;
  total_campaign_value?: number;
  currency?: string | null;
  pending_signatures?: number;
  upcoming_deliveries?: number;
  campaigns?: number;
  approved_campaigns?: number;
  pending_applications?: number;
  status?: string;
  audience?: { network: string; followers: number; views: number; engagement: number }[];
  fees?: { paid: number; pending: number };
  activity?: { name: string; value: number }[];
  revenue?: { name: string; value: number }[];
  signatures?: { id: number; creator_name?: string | null; creator_artistic: string; campaign_name: string; status: string }[];
  deliveries?: { id: number; creator_artistic: string; campaign_name: string; type: string; delivery_status: string; date: string }[];
};
