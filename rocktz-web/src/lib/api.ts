import i18n from "@/i18n/config";
import type { AuthUser } from "@/lib/auth";
import { ApiError, laravelFetch, laravelUpload, type UploadProgressHandler } from "@/lib/laravel";
import type {
  AppNotification,
  Campaign,
  CampaignCreator,
  Company,
  CompanyLandingPage,
  CompanyLandingSignup,
  CompanyLandingMetrics,
  Creator,
  DashboardStats,
  MetricsJobStatus,
  PlanningItem,
  PostMetricsSyncResult,
  RecurringContract,
  SocialSyncResult,
} from "@/lib/types";

type List<T> = { data: T[] };
type Item<T> = { data: T };

type Queued<T> = T & { status?: MetricsJobStatus; message?: string };

const QUEUE_POLL_MS = 2000;
const QUEUE_TIMEOUT_MS = 120_000;

async function waitForQueuedJob<T extends Queued<object>>(started: T, poll: () => Promise<T>): Promise<T> {
  let current = started;
  const began = Date.now();
  while (current.status === "queued" || current.status === "running") {
    if (Date.now() - began > QUEUE_TIMEOUT_MS) {
      throw new ApiError(i18n.t("app:campaignDetail.metricsQueueTimeout"), 408);
    }
    await new Promise((resolve) => setTimeout(resolve, QUEUE_POLL_MS));
    current = await poll();
  }
  return current;
}

export const api = {
  dashboard: () => laravelFetch<DashboardStats>("/dashboard"),
  nav: () => laravelFetch<{ unread: number; pending_applications: number }>("/nav"),
  creators: (query = "") => laravelFetch<List<Creator>>(`/creators${query}`),
  creator: (id: number | string) => laravelFetch<Item<Creator>>(`/creators/${id}`),
  createCreator: (body: unknown) => laravelFetch<Item<Creator>>("/creators", { method: "POST", body: JSON.stringify(body) }),
  updateCreator: (id: number, body: unknown) => laravelFetch<Item<Creator>>(`/creators/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  approveCreator: (id: number) => laravelFetch<Item<Creator>>(`/creators/${id}/approve`, { method: "POST" }),
  rejectCreator: (id: number, reason?: string) => laravelFetch<Item<Creator>>(`/creators/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  updateCreatorPassword: (id: number, password: string) => laravelFetch<{ message: string }>(`/creators/${id}/password`, { method: "POST", body: JSON.stringify({ password }) }),
  deleteCreator: (id: number) => laravelFetch<{ message: string }>(`/creators/${id}`, { method: "DELETE" }),
  resetCasting: () => laravelFetch<{ message: string; deleted: number }>("/creators/reset-casting", { method: "POST" }),
  addPortfolio: (id: number, body: unknown) => laravelFetch(`/creators/${id}/portfolio`, { method: "POST", body: JSON.stringify(body) }),
  removePortfolio: (id: number, video: number) => laravelFetch(`/creators/${id}/portfolio/${video}`, { method: "DELETE" }),
  acceptContract: (id: number, body: unknown) => laravelFetch(`/creators/${id}/contract`, { method: "POST", body: JSON.stringify(body) }),
  syncCreatorSocial: async (id: number, body: { network?: "instagram" | "tiktok" | "youtube"; handle?: string; handles?: Partial<Record<"instagram" | "tiktok" | "youtube", string>>; force?: boolean }) => {
    const path = `/creators/${id}/social-sync`;
    const started = await laravelFetch<Item<Creator> & { sync?: Record<string, SocialSyncResult>; status?: MetricsJobStatus }>(path, {
      method: "POST",
      body: JSON.stringify({ force: true, ...body }),
    });
    const query = body.network ? `?network=${encodeURIComponent(body.network)}` : "";
    return waitForQueuedJob(started, () => laravelFetch(`${path}${query}`));
  },

  companies: (query = "") => laravelFetch<List<Company>>(`/companies${query}`),
  company: (id: number | string) => laravelFetch<Item<Company>>(`/companies/${id}`),
  createCompany: (body: unknown) => laravelFetch<Item<Company>>("/companies", { method: "POST", body: JSON.stringify(body) }),
  updateCompany: (id: number, body: unknown) => laravelFetch<Item<Company>>(`/companies/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  approveCompany: (id: number) => laravelFetch<Item<Company>>(`/companies/${id}/approve`, { method: "POST" }),
  rejectCompany: (id: number) => laravelFetch<Item<Company>>(`/companies/${id}/reject`, { method: "POST" }),
  deleteCompany: (id: number) => laravelFetch<{ message: string }>(`/companies/${id}`, { method: "DELETE" }),
  rotateCompanyInviteCode: (id: number) => laravelFetch<Item<Company>>(`/companies/${id}/invite-code`, { method: "POST" }),
  toggleFavorite: (companyId: number, creatorId: number) => laravelFetch<Item<Company>>(`/companies/${companyId}/favorites/${creatorId}`, { method: "POST" }),
  publicLanding: (slug: string) => laravelFetch<Item<CompanyLandingPage>>(`/landings/${encodeURIComponent(slug)}`),
  trackLandingEvent: (slug: string, event: "view" | "cta_click" | "signup_started") =>
    laravelFetch<{ ok: boolean }>(`/landings/${encodeURIComponent(slug)}/events`, { method: "POST", body: JSON.stringify({ event }) }),
  claimLanding: (slug: string) => laravelFetch<Item<CompanyLandingSignup>>(`/landings/${encodeURIComponent(slug)}/claim`, { method: "POST" }),
  companyLanding: (companyId: number) => laravelFetch<Item<CompanyLandingPage>>(`/companies/${companyId}/landing`),
  updateCompanyLanding: (companyId: number, body: unknown) =>
    laravelFetch<Item<CompanyLandingPage>>(`/companies/${companyId}/landing`, { method: "PATCH", body: JSON.stringify(body) }),
  publishCompanyLanding: (companyId: number) =>
    laravelFetch<Item<CompanyLandingPage>>(`/companies/${companyId}/landing/publish`, { method: "POST" }),
  disableCompanyLanding: (companyId: number) =>
    laravelFetch<Item<CompanyLandingPage>>(`/companies/${companyId}/landing/disable`, { method: "POST" }),
  companyLandingSignups: (companyId: number, query = "") =>
    laravelFetch<List<CompanyLandingSignup> & { metrics?: CompanyLandingMetrics }>(`/companies/${companyId}/landing/signups${query}`),
  updateLandingSignup: (companyId: number, signupId: number, status: string) =>
    laravelFetch<Item<CompanyLandingSignup>>(`/companies/${companyId}/landing/signups/${signupId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  createCompanyUser: (companyId: number, body: unknown) => laravelFetch(`/companies/${companyId}/users`, { method: "POST", body: JSON.stringify(body) }),
  updateCompanyUser: (companyId: number, userId: number, body: unknown) => laravelFetch(`/companies/${companyId}/users/${userId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteCompanyUser: (companyId: number, userId: number) => laravelFetch(`/companies/${companyId}/users/${userId}`, { method: "DELETE" }),

  campaigns: (query = "") => laravelFetch<List<Campaign>>(`/campaigns${query}`),
  resetCampaigns: () => laravelFetch<{ message: string; deleted: number }>("/campaigns/reset", { method: "POST" }),
  availableCampaigns: () => laravelFetch<List<Campaign>>("/campaigns/available"),
  campaign: (id: number | string) => laravelFetch<Item<Campaign>>(`/campaigns/${id}`),
  createCampaign: (body: unknown) => laravelFetch<Item<Campaign>>("/campaigns", { method: "POST", body: JSON.stringify(body) }),
  updateCampaign: (id: number, body: unknown) => laravelFetch<Item<Campaign>>(`/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  approveCampaignAgency: (id: number, body?: { agency_fee_percent?: number }) =>
    laravelFetch<Item<Campaign>>(`/campaigns/${id}/approve-agency`, { method: "POST", body: JSON.stringify(body ?? {}) }),
  deleteCampaign: (id: number) => laravelFetch<{ message: string }>(`/campaigns/${id}`, { method: "DELETE" }),
  applyCampaign: (id: number, body: unknown) => laravelFetch<Item<CampaignCreator>>(`/campaigns/${id}/apply`, { method: "POST", body: JSON.stringify(body) }),
  assignCreator: (id: number, body: unknown) => laravelFetch<Item<CampaignCreator>>(`/campaigns/${id}/assign`, { method: "POST", body: JSON.stringify(body) }),
  updateParticipation: (id: number, body: unknown) => laravelFetch<Item<CampaignCreator>>(`/campaign-creators/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteParticipation: (id: number) => laravelFetch<{ message: string }>(`/campaign-creators/${id}`, { method: "DELETE" }),
  syncCampaignPostMetrics: async (id: number, body?: { campaign_creator_id?: number }) => {
    const path = `/campaigns/${id}/post-metrics-sync`;
    const started = await laravelFetch<Item<Campaign> & { sync?: Record<string, PostMetricsSyncResult>; status?: MetricsJobStatus }>(path, {
      method: "POST",
      body: JSON.stringify({ force: true, ...body }),
    });
    const query = body?.campaign_creator_id ? `?campaign_creator_id=${body.campaign_creator_id}` : "";
    return waitForQueuedJob(started, () => laravelFetch(`${path}${query}`));
  },
  syncRecurringPostMetrics: async (id: number, body?: { month?: string; content_planning_item_id?: number }) => {
    const path = `/recurring-contracts/${id}/post-metrics-sync`;
    const started = await laravelFetch<Item<RecurringContract> & { sync?: Record<string, PostMetricsSyncResult>; status?: MetricsJobStatus }>(path, {
      method: "POST",
      body: JSON.stringify({ force: true, ...body }),
    });
    const params = new URLSearchParams();
    if (body?.month) params.set("month", body.month);
    if (body?.content_planning_item_id) params.set("content_planning_item_id", String(body.content_planning_item_id));
    const query = params.toString() ? `?${params.toString()}` : "";
    return waitForQueuedJob(started, () => laravelFetch(`${path}${query}`));
  },

  recurring: (query = "") => laravelFetch<List<RecurringContract>>(`/recurring-contracts${query}`),
  recurringOne: (id: number | string) => laravelFetch<Item<RecurringContract>>(`/recurring-contracts/${id}`),
  createRecurring: (body: unknown) => laravelFetch<Item<RecurringContract>>("/recurring-contracts", { method: "POST", body: JSON.stringify(body) }),
  updateRecurring: (id: number, body: unknown) => laravelFetch<Item<RecurringContract>>(`/recurring-contracts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  approveRecurringAgency: (id: number) => laravelFetch<Item<RecurringContract>>(`/recurring-contracts/${id}/approve-agency`, { method: "POST" }),
  addRecurringCreator: (id: number, body: unknown) => laravelFetch(`/recurring-contracts/${id}/creators`, { method: "POST", body: JSON.stringify(body) }),
  generateRecurringMonthDemands: (id: number, body: { creator_id: number; month: string }) =>
    laravelFetch<{ message: string; created: number; data: RecurringContract }>(`/recurring-contracts/${id}/generate-month-demands`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteRecurringCreator: (contractId: number, rowId: number) => laravelFetch<{ message: string }>(`/recurring-contracts/${contractId}/creators/${rowId}`, { method: "DELETE" }),
  addPlanningItem: (id: number, body: unknown) => laravelFetch<Item<PlanningItem>>(`/recurring-contracts/${id}/items`, { method: "POST", body: JSON.stringify(body) }),
  updatePlanningItem: (id: number, body: unknown) => laravelFetch<Item<PlanningItem>>(`/content-planning-items/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deletePlanningItem: (id: number) => laravelFetch<{ message: string }>(`/content-planning-items/${id}`, { method: "DELETE" }),
  deleteRecurring: (id: number) => laravelFetch<{ message: string }>(`/recurring-contracts/${id}`, { method: "DELETE" }),
  resetRecurring: () => laravelFetch<{ message: string; deleted: number }>("/recurring-contracts/reset", { method: "POST" }),

  notifications: (query = "") => laravelFetch<List<AppNotification>>(`/notifications${query}`),
  markRead: (id: number) => laravelFetch(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () => laravelFetch("/notifications/read-all", { method: "POST" }),
  deleteNotification: (id: number) => laravelFetch(`/notifications/${id}`, { method: "DELETE" }),

  adminUsers: () => laravelFetch<List<AuthUser>>("/admin-users"),
  createAdmin: (body: unknown) => laravelFetch<Item<AuthUser>>("/admin-users", { method: "POST", body: JSON.stringify(body) }),
  deleteAdmin: (id: number) => laravelFetch(`/admin-users/${id}`, { method: "DELETE" }),
  users: (query = "") => laravelFetch<List<AuthUser>>(`/users${query}`),
  createUser: (body: unknown) => laravelFetch<Item<AuthUser>>("/users", { method: "POST", body: JSON.stringify(body) }),
  updateUser: (id: number, body: unknown) => laravelFetch<Item<AuthUser>>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteUser: (id: number) => laravelFetch(`/users/${id}`, { method: "DELETE" }),
  notificationPreferences: () => laravelFetch<{ data: { opportunities: boolean; campaign_updates: boolean; new_demands: boolean; deadline_reminders: boolean; delivery_updates: boolean; promotional: boolean } }>("/notification-preferences"),
  updateNotificationPreferences: (body: unknown) => laravelFetch<{ data: { opportunities: boolean; campaign_updates: boolean; new_demands: boolean; deadline_reminders: boolean; delivery_updates: boolean; promotional: boolean } }>("/notification-preferences", { method: "PATCH", body: JSON.stringify(body) }),
  mailTemplates: () => laravelFetch<{ data: Array<{ id: number; key: string; audience: string; category: string; enabled: boolean; reminder_offsets: number[] | null; required_variables: string[]; variables: string[] }>; sending: { sending_enabled: boolean; env_enabled: boolean; stored_enabled: boolean } }>("/mail/templates"),
  mailTemplate: (id: number) => laravelFetch<{ data: { id: number; key: string; audience: string; category: string; enabled: boolean; reminder_offsets: number[] | null; required_variables: string[]; variables: string[]; current: Record<string, { subject: string; greeting: string; body: string; cta_label: string }> } }>(`/mail/templates/${id}`),
  updateMailTemplate: (id: number, body: unknown) => laravelFetch(`/mail/templates/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  restoreMailTemplate: (id: number, locale: string) => laravelFetch(`/mail/templates/${id}/restore`, { method: "POST", body: JSON.stringify({ locale }) }),
  previewMailTemplate: (id: number) => laravelFetch<{ html: string }>(`/mail/templates/${id}/preview`, { method: "POST" }),
  testMailTemplate: (id: number) => laravelFetch<{ message: string }>(`/mail/templates/${id}/test`, { method: "POST" }),
  mailSettings: () => laravelFetch<{ data: { sending_enabled: boolean; env_enabled: boolean; stored_enabled: boolean } }>("/mail/settings"),
  updateMailSettings: (body: { sending_enabled: boolean }) => laravelFetch<{ data: { sending_enabled: boolean; env_enabled: boolean; stored_enabled: boolean }; message: string }>("/mail/settings", { method: "PATCH", body: JSON.stringify(body) }),
  mailMessages: (query = "") => laravelFetch<{ data: Array<{ id: number; email: string; template_key: string; subject: string; status: string; attempts: number; failure_reason: string | null; provider_id: string | null; created_at: string; user?: { role?: string } }> }>(`/mail/messages${query}`),
  uploadMedia: (file: Blob, filename = "file.bin", onProgress?: UploadProgressHandler, signal?: AbortSignal) => {
    const body = new FormData();
    body.append("file", file, filename);
    return laravelUpload<{ data: { id: number; url: string; filename: string; path: string; size?: number } }>("/media", body, onProgress, signal);
  },
  updateMe: (body: { name?: string; avatar_url?: string | null }) => laravelFetch<{ user: AuthUser }>("/auth/me", { method: "PATCH", body: JSON.stringify(body) }),
};

export function money(value?: number | null, currency?: string | null) {
  if (value == null) return "—";
  const code = (currency || "BRL").toUpperCase();
  try {
    return value.toLocaleString("pt-BR", { style: "currency", currency: code });
  } catch {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
}
