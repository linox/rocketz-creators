"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";
import {
  Bell,
  BellOff,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Repeat,
  ShieldCheck,
  Trash2,
  UserPlus,
  XCircle,
} from "lucide-react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { api } from "@/lib/api";
import { alertApiError } from "@/lib/alerts";
import type { AuthUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import type { AppNotification } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

type FilterTab = "all" | "unread" | "applications" | "deliveries" | "approvals" | "changes" | "contracts";
type RoleFilter = "admin_only" | "all";

const AGENCY_FILTERS: FilterTab[] = ["all", "unread", "applications", "deliveries", "contracts"];
const CREATOR_FILTERS: FilterTab[] = ["all", "unread", "approvals", "changes", "contracts"];

function resolveNotificationHref(notif: AppNotification, user: AuthUser): string | null {
  let targetLink = notif.link;

  if (targetLink) {
    targetLink = targetLink
      .replace("/deliveries", "/campaign-deliveries")
      .replace("/recurring-contracts", "/recurring");

    if (user.role === "creator" && user.creator?.id) {
      if (targetLink.includes("tab=recurring") || targetLink.startsWith("/recurring")) {
        return `/creators/${user.creator.id}?tab=recurring`;
      }
      if (targetLink.includes("tab=campaigns") || targetLink.startsWith("/campaigns")) {
        return `/creators/${user.creator.id}?tab=campaigns`;
      }
      if (targetLink.startsWith("/creators/")) {
        targetLink = targetLink.replace(/\/creators\/[^?#]+/, `/creators/${user.creator.id}`);
      }
    }

    return targetLink;
  }

  if (user.role === "creator" && user.creator?.id) {
    if (notif.type === "contract" || notif.recurring_contract_id) {
      return `/creators/${user.creator.id}?tab=recurring`;
    }
    if (notif.type === "approval" || notif.type === "delivery_review" || notif.type === "rejection" || notif.campaign_id) {
      return `/creators/${user.creator.id}?tab=campaigns`;
    }
    return `/creators/${user.creator.id}?tab=dashboard`;
  }

  if (notif.type === "contract" || notif.recurring_contract_id) {
    if (notif.recurring_contract_id) return `/recurring/${notif.recurring_contract_id}`;
    if (user.role === "company") return "/company-dashboard";
    return "/recurring";
  }

  if (notif.type === "delivery_review") {
    if (notif.campaign_id) return `/campaigns/${notif.campaign_id}`;
    if (notif.recurring_contract_id) return `/recurring/${notif.recurring_contract_id}`;
    if (user.role === "admin") return "/campaign-deliveries";
    return "/company-dashboard";
  }

  if (notif.campaign_id) return `/campaigns/${notif.campaign_id}`;
  if (notif.creator_id && user.role === "admin") return `/creators/${notif.creator_id}`;
  if (user.role === "company") return "/company-dashboard";
  return "/dashboard";
}

function formatTimeAgo(dateStr: string | null, t: (key: string, opts?: Record<string, unknown>) => string) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return t("notifications.time.now");
    if (diffMins < 60) return t("notifications.time.minutes", { count: diffMins });
    if (diffHours < 24) return t("notifications.time.hours", { count: diffHours });
    return t("notifications.time.days", { count: diffDays });
  } catch {
    return "";
  }
}

function notificationStyle(type: string, t: (key: string) => string, targetRole?: string | null) {
  switch (type) {
    case "application":
      return {
        label: t("notifications.types.application"),
        icon: UserPlus,
        chip: "border-indigo-100 bg-indigo-50 text-indigo-700",
        iconWrap: "border-indigo-100 bg-indigo-50 text-indigo-600",
      };
    case "approval":
      return {
        label: t("notifications.types.approval"),
        icon: CheckCircle2,
        chip: "border-emerald-100 bg-emerald-50 text-emerald-700",
        iconWrap: "border-emerald-100 bg-emerald-50 text-emerald-600",
      };
    case "rejection":
      return {
        label: t("notifications.types.rejection"),
        icon: XCircle,
        chip: "border-rose-100 bg-rose-50 text-rose-700",
        iconWrap: "border-rose-100 bg-rose-50 text-rose-600",
      };
    case "delivery_review":
      return {
        label: targetRole === "creator"
          ? t("notifications.types.change_request")
          : t("notifications.types.new_delivery"),
        icon: FileText,
        chip: "border-amber-100 bg-amber-50 text-amber-700",
        iconWrap: "border-amber-100 bg-amber-50 text-amber-600",
      };
    case "contract":
      return {
        label: t("notifications.types.contract"),
        icon: Repeat,
        chip: "border-purple-100 bg-purple-50 text-purple-700",
        iconWrap: "border-purple-100 bg-purple-50 text-purple-600",
      };
    default:
      return {
        label: t("notifications.types.general"),
        icon: Bell,
        chip: "border-slate-200 bg-slate-50 text-slate-600",
        iconWrap: "border-slate-200 bg-slate-50 text-slate-600",
      };
  }
}

function targetLabel(role: string | null | undefined, t: (key: string) => string) {
  if (!role) return null;
  if (role === "admin") return t("notifications.target.admin");
  if (role === "creator") return t("notifications.target.creator");
  if (role === "company") return t("notifications.target.company");
  if (role === "all") return t("notifications.target.all");
  return null;
}

function matchesTab(n: AppNotification, filter: FilterTab) {
  if (filter === "unread") return !n.read;
  if (filter === "applications") return n.type === "application";
  if (filter === "deliveries") return n.type === "delivery_review" || n.type === "approval" || n.type === "rejection";
  if (filter === "approvals") return n.type === "approval";
  if (filter === "changes") return n.type === "delivery_review" || n.type === "rejection";
  if (filter === "contracts") return n.type === "contract";
  return true;
}

function NotificationsInner() {
  const user = useAuth();
  const router = useRouter();
  const { t } = useTranslation("app");
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("admin_only");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.notifications();
      setItems(res.data);
    } catch (err) {
      if (!silent) await alertApiError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void load(true);
    }, 30000);
    return () => window.clearInterval(id);
  }, [load]);

  const scopedItems = useMemo(() => {
    if (user.role !== "admin") return items;
    if (roleFilter !== "admin_only") return items;
    return items.filter((n) => n.target_role === "admin" || !n.target_role || n.target_role === "all");
  }, [items, roleFilter, user.role]);

  const isCreator = user.role === "creator";
  const filters = isCreator ? CREATOR_FILTERS : AGENCY_FILTERS;

  const counts = useMemo(() => ({
    all: scopedItems.length,
    unread: scopedItems.filter((n) => !n.read).length,
    applications: scopedItems.filter((n) => n.type === "application").length,
    deliveries: scopedItems.filter((n) => n.type === "delivery_review" || n.type === "approval" || n.type === "rejection").length,
    approvals: scopedItems.filter((n) => n.type === "approval").length,
    changes: scopedItems.filter((n) => n.type === "delivery_review" || n.type === "rejection").length,
    contracts: scopedItems.filter((n) => n.type === "contract").length,
  }), [scopedItems]);

  const filteredNotifications = useMemo(
    () => scopedItems.filter((n) => matchesTab(n, filter)),
    [scopedItems, filter],
  );

  function tabLabel(tab: FilterTab) {
    if (tab === "all") return t("notifications.tabAll");
    if (tab === "unread") return t("notifications.tabUnread", { count: counts.unread });
    if (tab === "applications") return t("notifications.tabApplications");
    if (tab === "deliveries") return t("notifications.tabDeliveries");
    if (tab === "approvals") return t("notifications.tabApprovals");
    if (tab === "changes") return t("notifications.tabChanges");
    return t("notifications.tabContracts");
  }

  async function handleMarkAsRead(id: number) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
    try {
      await api.markRead(id);
    } catch (err) {
      await alertApiError(err);
      void load();
    }
  }

  async function handleDelete(id: number) {
    setItems((prev) => prev.filter((item) => item.id !== id));
    try {
      await api.deleteNotification(id);
    } catch (err) {
      await alertApiError(err);
      void load();
    }
  }

  async function handleMarkAllRead() {
    if (counts.unread === 0) return;
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    try {
      await api.markAllRead();
    } catch (err) {
      await alertApiError(err);
      void load();
    }
  }

  async function handleNotificationClick(notif: AppNotification) {
    if (!notif.read) await handleMarkAsRead(notif.id);
    const href = resolveNotificationHref(notif, user);
    if (href) router.push(href);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-10">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="m-0 flex items-center gap-2.5 text-xl font-bold text-[#0F172A] sm:text-[28px]">
              <Bell className="shrink-0 text-brand-primary" size={26} />
              {t("notifications.title")}
            </h1>
            {counts.unread > 0 ? (
              <span className="rounded-full bg-rose-500 px-2.5 py-0.5 text-[10px] font-black tracking-wider text-white uppercase shadow-md shadow-rose-200">
                {t("notifications.new", { count: counts.unread })}
              </span>
            ) : null}
          </div>
          <p className="mt-1 max-w-2xl text-[14px] text-[#64748B]">
            {isCreator ? t("notifications.subtitleCreator") : t("notifications.subtitle")}
          </p>
        </div>

        {counts.unread > 0 ? (
          <button
            type="button"
            onClick={() => void handleMarkAllRead()}
            className="inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold tracking-wider text-slate-700 uppercase shadow-sm transition-all hover:bg-slate-50"
          >
            <Check size={14} />
            {t("notifications.markAll")}
          </button>
        ) : null}
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(isCreator
          ? ([
              ["unread", counts.unread, t("notifications.summaryUnread"), "border-rose-100 bg-rose-50 text-rose-700"],
              ["approvals", counts.approvals, t("notifications.summaryApprovals"), "border-emerald-100 bg-emerald-50 text-emerald-700"],
              ["changes", counts.changes, t("notifications.summaryChanges"), "border-amber-100 bg-amber-50 text-amber-700"],
              ["contracts", counts.contracts, t("notifications.summaryContracts"), "border-purple-100 bg-purple-50 text-purple-700"],
            ] as const)
          : ([
              ["unread", counts.unread, t("notifications.summaryUnread"), "border-rose-100 bg-rose-50 text-rose-700"],
              ["applications", counts.applications, t("notifications.summaryApplications"), "border-indigo-100 bg-indigo-50 text-indigo-700"],
              ["deliveries", counts.deliveries, t("notifications.summaryDeliveries"), "border-amber-100 bg-amber-50 text-amber-700"],
              ["contracts", counts.contracts, t("notifications.summaryContracts"), "border-purple-100 bg-purple-50 text-purple-700"],
            ] as const)
        ).map(([key, count, label, tone]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-2xl border px-3 py-3 text-left transition hover:shadow-sm",
              filter === key ? "border-indigo-300 ring-2 ring-indigo-100" : "border-slate-200 bg-white",
            )}
          >
            <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-extrabold tracking-wider uppercase", tone)}>
              {label}
            </span>
            <div className="mt-2 text-2xl font-black tabular-nums text-slate-900">{count}</div>
          </button>
        ))}
      </div>

      {user.role === "admin" ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <ShieldCheck size={18} className="shrink-0 text-brand-primary" />
            <span className="text-xs font-extrabold text-slate-800">{t("notifications.permissionLabel")}</span>
          </div>
          <div className="flex w-full flex-wrap items-center gap-1 rounded-xl border border-indigo-100 bg-white p-1 shadow-xs sm:w-auto">
            <button
              type="button"
              onClick={() => setRoleFilter("admin_only")}
              className={cn(
                "flex-1 cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all sm:flex-none",
                roleFilter === "admin_only" ? "bg-brand-primary text-white shadow-xs" : "text-slate-600 hover:text-slate-900",
              )}
            >
              {t("notifications.agencyOnly")}
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter("all")}
              className={cn(
                "flex-1 cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all sm:flex-none",
                roleFilter === "all" ? "bg-brand-primary text-white shadow-xs" : "text-slate-600 hover:text-slate-900",
              )}
            >
              {t("notifications.systemAll")}
            </button>
          </div>
        </div>
      ) : null}

      <div className="-mx-1 overflow-x-auto px-1">
        <div className="flex min-w-0 items-center gap-1 border-b border-[#E2E8F0]">
          {filters.map((tab) => {
            const isActive = filter === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={cn(
                  "cursor-pointer border-b-2 px-3 py-3 text-xs font-extrabold tracking-wider whitespace-nowrap uppercase transition-all sm:px-4",
                  isActive ? "border-brand-primary text-brand-primary" : "border-transparent text-slate-500 hover:text-slate-900",
                )}
              >
                {tabLabel(tab)}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-100 bg-white py-20">
          <div className="mb-3 h-10 w-10 animate-spin rounded-full border-t-2 border-b-2 border-brand-primary" />
          <p className="text-xs font-bold tracking-wider text-slate-500 uppercase">{t("notifications.loading")}</p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="rounded-3xl border border-[#E2E8F0] bg-white p-8 py-20 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400">
            <BellOff size={28} />
          </div>
          <h3 className="text-base font-bold text-slate-700">{t("notifications.emptyTitle")}</h3>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-400">
            {isCreator ? t("notifications.emptyCreator") : t("notifications.emptyFiltered")}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {filteredNotifications.map((notif) => {
              const style = notificationStyle(notif.type, t, notif.target_role);
              const Icon = style.icon;
              const destination = isCreator ? null : targetLabel(notif.target_role, t);
              return (
                <motion.article
                  key={notif.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className={cn(
                    "relative flex flex-col gap-4 rounded-2xl border bg-white p-4 transition-all hover:shadow-md hover:shadow-indigo-900/5 sm:flex-row sm:items-center sm:p-5",
                    notif.read
                      ? "border-slate-200"
                      : "border-indigo-200 bg-indigo-50/20 shadow-xs shadow-indigo-100/40",
                  )}
                >
                  {!notif.read ? (
                    <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-brand-primary" />
                  ) : null}

                  <button
                    type="button"
                    onClick={() => void handleNotificationClick(notif)}
                    className="flex min-w-0 flex-1 cursor-pointer items-start gap-3.5 border-0 bg-transparent p-0 text-left"
                  >
                    <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border shadow-xs", style.iconWrap)}>
                      <Icon size={18} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-black tracking-wider uppercase", style.chip)}>
                          {style.label}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold whitespace-nowrap text-slate-400">
                          <Clock size={10} className="shrink-0" />
                          {formatTimeAgo(notif.created_at, t)}
                        </span>
                        {destination ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-slate-500 uppercase">
                            {destination}
                          </span>
                        ) : null}
                      </div>
                      <h4 className="mt-1.5 text-sm leading-snug font-bold text-slate-900">{notif.title}</h4>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed font-medium text-slate-600">{notif.message}</p>
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => void handleNotificationClick(notif)}
                      title={t("notifications.goToActionTitle")}
                      className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-indigo-100 bg-indigo-50 px-3 text-[10px] font-black tracking-wider text-brand-primary uppercase shadow-xs transition-all hover:bg-brand-primary hover:text-white"
                    >
                      <span>{t("notifications.goToAction")}</span>
                      <ExternalLink size={12} />
                    </button>

                    {!notif.read ? (
                      <button
                        type="button"
                        onClick={() => void handleMarkAsRead(notif.id)}
                        title={t("notifications.markReadTitle")}
                        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                      >
                        <Check size={14} />
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => void handleDelete(notif.id)}
                      title={t("notifications.deleteTitle")}
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export function NotificationsScreen() {
  return (
    <AuthenticatedShell>
      <NotificationsInner />
    </AuthenticatedShell>
  );
}
