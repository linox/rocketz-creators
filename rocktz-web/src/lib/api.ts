import i18n from "@/i18n/config";
import type { AuthUser } from "@/lib/auth";
import { ApiError, laravelFetch } from "@/lib/laravel";
import type {
  AppNotification,
  Campaign,
  CampaignCreator,
  Company,
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
  creators: (query = "") => laravelFetch<List<Creator>>(`/creators${query}`),
  creator: (id: number | string) => laravelFetch<Item<Creator>>(`/creators/${id}`),
  createCreator: (body: unknown) => laravelFetch<Item<Creator>>("/creators", { method: "POST", body: JSON.stringify(body) }),
  updateCreator: (id: number, body: unknown) => laravelFetch<Item<Creator>>(`/creators/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  approveCreator: (id: number) => laravelFetch<Item<Creator>>(`/creators/${id}/approve`, { method: "POST" }),
  rejectCreator: (id: number, reason?: string) => laravelFetch<Item<Creator>>(`/creators/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  updateCreatorPassword: (id: number, password: string) => laravelFetch<{ message: string }>(`/creators/${id}/password`, { method: "POST", body: JSON.stringify({ password }) }),
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
  toggleFavorite: (companyId: number, creatorId: number) => laravelFetch<Item<Company>>(`/companies/${companyId}/favorites/${creatorId}`, { method: "POST" }),
  createCompanyUser: (companyId: number, body: unknown) => laravelFetch(`/companies/${companyId}/users`, { method: "POST", body: JSON.stringify(body) }),
  updateCompanyUser: (companyId: number, userId: number, body: unknown) => laravelFetch(`/companies/${companyId}/users/${userId}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteCompanyUser: (companyId: number, userId: number) => laravelFetch(`/companies/${companyId}/users/${userId}`, { method: "DELETE" }),

  campaigns: (query = "") => laravelFetch<List<Campaign>>(`/campaigns${query}`),
  resetCampaigns: () => laravelFetch<{ message: string; deleted: number }>("/campaigns/reset", { method: "POST" }),
  availableCampaigns: () => laravelFetch<List<Campaign>>("/campaigns/available"),
  campaign: (id: number | string) => laravelFetch<Item<Campaign>>(`/campaigns/${id}`),
  createCampaign: (body: unknown) => laravelFetch<Item<Campaign>>("/campaigns", { method: "POST", body: JSON.stringify(body) }),
  updateCampaign: (id: number, body: unknown) => laravelFetch<Item<Campaign>>(`/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  approveCampaignAgency: (id: number) => laravelFetch<Item<Campaign>>(`/campaigns/${id}/approve-agency`, { method: "POST" }),
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

  recurring: () => laravelFetch<List<RecurringContract>>("/recurring-contracts"),
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
  uploadMedia: (file: Blob, filename = "file.bin") => {
    const body = new FormData();
    body.append("file", file, filename);
    return laravelFetch<{ data: { id: number; url: string; filename: string; path: string; size?: number } }>("/media", { method: "POST", body });
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
