import { laravelFetch } from "@/lib/laravel";
import type {
  AppNotification,
  Campaign,
  CampaignCreator,
  Company,
  Creator,
  DashboardStats,
  PlanningItem,
  RecurringContract,
} from "@/lib/types";
import type { AuthUser } from "@/lib/auth";

type List<T> = { data: T[] };
type Item<T> = { data: T };

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

  companies: (query = "") => laravelFetch<List<Company>>(`/companies${query}`),
  company: (id: number | string) => laravelFetch<Item<Company>>(`/companies/${id}`),
  createCompany: (body: unknown) => laravelFetch<Item<Company>>("/companies", { method: "POST", body: JSON.stringify(body) }),
  updateCompany: (id: number, body: unknown) => laravelFetch<Item<Company>>(`/companies/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  approveCompany: (id: number) => laravelFetch<Item<Company>>(`/companies/${id}/approve`, { method: "POST" }),
  rejectCompany: (id: number) => laravelFetch<Item<Company>>(`/companies/${id}/reject`, { method: "POST" }),
  toggleFavorite: (companyId: number, creatorId: number) => laravelFetch<Item<Company>>(`/companies/${companyId}/favorites/${creatorId}`, { method: "POST" }),
  createCompanyUser: (companyId: number, body: unknown) => laravelFetch(`/companies/${companyId}/users`, { method: "POST", body: JSON.stringify(body) }),
  deleteCompanyUser: (companyId: number, userId: number) => laravelFetch(`/companies/${companyId}/users/${userId}`, { method: "DELETE" }),

  campaigns: (query = "") => laravelFetch<List<Campaign>>(`/campaigns${query}`),
  resetCampaigns: () => laravelFetch<{ message: string; deleted: number }>("/campaigns/reset", { method: "POST" }),
  availableCampaigns: () => laravelFetch<List<Campaign>>("/campaigns/available"),
  campaign: (id: number | string) => laravelFetch<Item<Campaign>>(`/campaigns/${id}`),
  createCampaign: (body: unknown) => laravelFetch<Item<Campaign>>("/campaigns", { method: "POST", body: JSON.stringify(body) }),
  updateCampaign: (id: number, body: unknown) => laravelFetch<Item<Campaign>>(`/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteCampaign: (id: number) => laravelFetch<{ message: string }>(`/campaigns/${id}`, { method: "DELETE" }),
  applyCampaign: (id: number, body: unknown) => laravelFetch<Item<CampaignCreator>>(`/campaigns/${id}/apply`, { method: "POST", body: JSON.stringify(body) }),
  assignCreator: (id: number, body: unknown) => laravelFetch<Item<CampaignCreator>>(`/campaigns/${id}/assign`, { method: "POST", body: JSON.stringify(body) }),
  updateParticipation: (id: number, body: unknown) => laravelFetch<Item<CampaignCreator>>(`/campaign-creators/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteParticipation: (id: number) => laravelFetch<{ message: string }>(`/campaign-creators/${id}`, { method: "DELETE" }),

  recurring: () => laravelFetch<List<RecurringContract>>("/recurring-contracts"),
  recurringOne: (id: number | string) => laravelFetch<Item<RecurringContract>>(`/recurring-contracts/${id}`),
  createRecurring: (body: unknown) => laravelFetch<Item<RecurringContract>>("/recurring-contracts", { method: "POST", body: JSON.stringify(body) }),
  updateRecurring: (id: number, body: unknown) => laravelFetch<Item<RecurringContract>>(`/recurring-contracts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  addRecurringCreator: (id: number, body: unknown) => laravelFetch(`/recurring-contracts/${id}/creators`, { method: "POST", body: JSON.stringify(body) }),
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
  uploadMedia: (file: Blob, filename = "avatar.jpg") => {
    const body = new FormData();
    body.append("file", file, filename);
    return laravelFetch<{ data: { id: number; url: string; filename: string; path: string } }>("/media", { method: "POST", body });
  },
  updateMe: (body: { name?: string; avatar_url?: string | null }) => laravelFetch<{ user: AuthUser }>("/auth/me", { method: "PATCH", body: JSON.stringify(body) }),
};

export function money(value?: number | null) {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
