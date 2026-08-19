export type Creator = {
  id: number;
  user_id: number | null;
  role?: string | null;
  full_name: string;
  artistic_name: string;
  photo_url: string | null;
  whatsapp: string | null;
  email?: string | null;
  city: string | null;
  state: string | null;
  bio: string | null;
  document: string | null;
  cpf: string | null;
  pix_key: string | null;
  bank_details: string | null;
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
  portfolio?: { id: number; title: string; url: string; description: string | null; uploaded_at?: string | null }[];
  contract_acceptance?: { id: number; status: string; accepted_at: string | null; full_name: string } | null;
};

export type Company = {
  id: number;
  name: string;
  cnpj: string | null;
  segment: string | null;
  responsible_name: string | null;
  whatsapp: string | null;
  email: string | null;
  city: string | null;
  observations: string | null;
  logo_url: string | null;
  objective: string | null;
  status: string;
  contacts?: { id: number; name: string; role: string | null; email: string | null; whatsapp: string | null }[];
  favorite_creator_ids?: number[];
  users?: { id: number; email: string | null; name: string | null; status: string | null }[];
};

export type Campaign = {
  id: number;
  company_id: number;
  company?: { id: number; name: string; logo_url: string | null; status: string };
  name: string;
  objective: string | null;
  start_date: string | null;
  end_date: string | null;
  total_budget: number | null;
  agency_fee: number | null;
  creators_budget: number | null;
  status: string;
  image_url: string | null;
  is_secret: boolean;
  is_barter: boolean;
  barter_details: string | null;
  approval_flow: string | null;
  briefing?: Record<string, string | string[] | null> | null;
  deliverables?: Record<string, string | number | null> | null;
  applications?: CampaignCreator[];
  pending_applications?: number;
};

export type CampaignCreator = {
  id: number;
  campaign_id: number;
  creator_id: number;
  creator?: { id: number; full_name: string; artistic_name: string; photo_url: string | null; status: string; city?: string; state?: string };
  campaign?: { id: number; name: string; status: string; image_url: string | null };
  delivery_type: string | null;
  amount: number | null;
  delivery_date: string | null;
  delivery_status: string | null;
  application_status: string | null;
  rejection_reason: string | null;
  script_status: string | null;
  video_status: string | null;
  script_feedback: string | null;
  video_feedback: string | null;
  content?: { script: string | null; video_url: string | null; image_url: string | null; published_link: string | null } | null;
};

export type RecurringContract = {
  id: number;
  company_id: number;
  company?: { id: number; name: string; logo_url: string | null };
  title: string;
  objective: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  monthly_fee: number | null;
  notes: string | null;
  creators?: {
    id: number;
    creator_id: number;
    creator: { id: number; artistic_name: string; full_name: string; photo_url: string | null } | null;
    monthly_fee: number | null;
  }[];
  items?: PlanningItem[];
};

export type PlanningItem = {
  id: number;
  recurring_contract_id: number;
  creator_id: number;
  creator?: { id: number; artistic_name: string; full_name: string; photo_url: string | null } | null;
  month: string;
  content_type: string;
  title: string;
  description: string | null;
  briefing: string | null;
  planned_date: string | null;
  status: string;
  submission_url: string | null;
  media_url: string | null;
  published_url: string | null;
  submission_notes: string | null;
  feedback_note: string | null;
};

export type AppNotification = {
  id: number;
  title: string;
  message: string;
  type: string;
  link: string | null;
  read: boolean;
  created_at: string | null;
};

export type DashboardStats = {
  total_creators?: number;
  active_creators?: number;
  pending_approval_creators?: number;
  running_campaigns?: number;
  finished_campaigns?: number;
  total_campaign_value?: number;
  pending_signatures?: number;
  upcoming_deliveries?: number;
  campaigns?: number;
  approved_campaigns?: number;
  pending_applications?: number;
  status?: string;
  revenue?: { name: string; value: number }[];
  signatures?: { id: number; creator_name?: string | null; creator_artistic: string; campaign_name: string; status: string }[];
  deliveries?: { id: number; creator_artistic: string; campaign_name: string; type: string; delivery_status: string; date: string }[];
};
