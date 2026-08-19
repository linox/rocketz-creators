"use client";

import { useEffect, useMemo, useState } from "react";
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

type FilterTab = "all" | "unread" | "applications" | "deliveries" | "contracts";
type RoleFilter = "admin_only" | "all";

const FILTERS: FilterTab[] = ["all", "unread", "applications", "deliveries", "contracts"];

function resolveNotificationHref(notif: AppNotification, user: AuthUser): string | null {
  let targetLink = notif.link;

  if (targetLink) {
    targetLink = targetLink
      .replace("/deliveries", "/campaign-deliveries")
      .replace("/recurring-contracts", "/recurring");

    if (user.role === "creator" && user.creator?.id && targetLink.startsWith("/creators/")) {
      targetLink = targetLink.replace(/\/creators\/[^?#]+/, `/creators/${user.creator.id}`);
    }

    return targetLink;
  }

  if (notif.type === "contract" || notif.recurring_contract_id) {
    if (user.role === "creator" && user.creator?.id) return `/creators/${user.creator.id}`;
    if (user.role === "company") return "/company-dashboard";
    return notif.recurring_contract_id ? `/recurring/${notif.recurring_contract_id}` : "/recurring";
  }

  if (notif.type === "delivery_review") {
    if (user.role === "admin") return "/campaign-deliveries";
    if (user.role === "creator") return "/creator-dashboard";
    return "/company-dashboard";
  }

  if (notif.campaign_id && user.role === "admin") return `/campaigns/${notif.campaign_id}`;
  if (notif.creator_id && user.role === "admin") return `/creators/${notif.creator_id}`;
  if (user.role === "creator" && user.creator?.id) return `/creators/${user.creator.id}`;
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

function notificationStyle(type: string, t: (key: string) => string) {
  switch (type) {
    case "application":
      return { label: t("notifications.types.application"), icon: UserPlus, bg: "bg-indigo-50 text-indigo-600 border-indigo-100" };
    case "approval":
      return { label: t("notifications.types.approval"), icon: CheckCircle2, bg: "bg-emerald-50 text-emerald-600 border-emerald-100" };
    case "rejection":
      return { label: t("notifications.types.rejection"), icon: XCircle, bg: "bg-rose-50 text-rose-600 border-rose-100" };
    case "delivery_review":
      return { label: t("notifications.types.delivery_review"), icon: FileText, bg: "bg-amber-50 text-amber-600 border-amber-100" };
    case "contract":
      return { label: t("notifications.types.contract"), icon: Repeat, bg: "bg-purple-50 text-purple-600 border-purple-100" };
    default:
      return { label: t("notifications.types.general"), icon: Bell, bg: "bg-slate-50 text-slate-600 border-slate-100" };
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

function NotificationsInner() {
  const user = useAuth();
  const router = useRouter();
  const { t } = useTranslation("app");
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("admin_only");

  async function load() {
    try {
      const res = await api.notifications();
      setItems(res.data);
    } catch (err) {
      await alertApiError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const scopedItems = useMemo(() => {
    if (user.role !== "admin") return items;
    if (roleFilter !== "admin_only") return items;
    return items.filter((n) => n.target_role === "admin" || !n.target_role || n.target_role === "all");
  }, [items, roleFilter, user.role]);

  const filteredNotifications = useMemo(() => {
    return scopedItems.filter((n) => {
      if (filter === "unread") return !n.read;
      if (filter === "applications") return n.type === "application";
      if (filter === "deliveries") return n.type === "delivery_review" || n.type === "approval" || n.type === "rejection";
      if (filter === "contracts") return n.type === "contract";
      return true;
    });
  }, [scopedItems, filter]);

  const unreadCount = scopedItems.filter((n) => !n.read).length;

  function tabLabel(tab: FilterTab) {
    if (tab === "all") return t("notifications.tabAll");
    if (tab === "unread") return t("notifications.tabUnread", { count: unreadCount });
    if (tab === "applications") return t("notifications.tabApplications");
    if (tab === "deliveries") return t("notifications.tabDeliveries");
    return t("notifications.tabContracts");
  }

  async function handleMarkAsRead(id: number) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
    try {
      await api.markRead(id);
    } catch (err) {
      await alertApiError(err);
      load();
    }
  }

  async function handleDelete(id: number) {
    setItems((prev) => prev.filter((item) => item.id !== id));
    try {
      await api.deleteNotification(id);
    } catch (err) {
      await alertApiError(err);
      load();
    }
  }

  async function handleMarkAllRead() {
    if (unreadCount === 0) return;
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    try {
      await api.markAllRead();
    } catch (err) {
      await alertApiError(err);
      load();
    }
  }

  async function handleNotificationClick(notif: AppNotification) {
    if (!notif.read) await handleMarkAsRead(notif.id);
    const href = resolveNotificationHref(notif, user);
    if (href) router.push(href);
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="m-0 flex items-center gap-2 text-2xl font-black text-[#0F172A]">
              <Bell className="text-brand-primary" size={24} />
              {t("notifications.title")}
            </h1>
            {unreadCount > 0 ? (
              <span className="animate-pulse rounded-full bg-rose-500 px-2.5 py-0.5 text-[10px] font-black tracking-wider text-white uppercase shadow-md shadow-rose-200">
                {t("notifications.new", { count: unreadCount })}
              </span>
            ) : null}
          </div>
          <p className="m-1 mt-1 text-xs font-medium text-[#64748B]">{t("notifications.subtitle")}</p>
        </div>

        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-bold tracking-wider text-slate-700 uppercase shadow-sm transition-all hover:bg-slate-100"
          >
            <Check size={14} />
            {t("notifications.markAll")}
          </button>
        ) : null}
      </header>

      {user.role === "admin" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-brand-primary" />
            <span className="text-xs font-extrabold text-slate-800">{t("notifications.permissionLabel")}</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-indigo-100 bg-white p-1 shadow-xs">
            <button
              type="button"
              onClick={() => setRoleFilter("admin_only")}
              className={cn(
                "cursor-pointer rounded-lg px-3 py-1 text-xs font-bold transition-all",
                roleFilter === "admin_only" ? "bg-brand-primary text-white shadow-xs" : "text-slate-600 hover:text-slate-900",
              )}
            >
              {t("notifications.agencyOnly")}
            </button>
            <button
              type="button"
              onClick={() => setRoleFilter("all")}
              className={cn(
                "cursor-pointer rounded-lg px-3 py-1 text-xs font-bold transition-all",
                roleFilter === "all" ? "bg-brand-primary text-white shadow-xs" : "text-slate-600 hover:text-slate-900",
              )}
            >
              {t("notifications.systemAll")}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-2 overflow-x-auto border-b border-[#E2E8F0] pb-0.5">
        {FILTERS.map((tab) => {
          const isActive = filter === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={cn(
                "cursor-pointer border-b-2 px-4 py-3 text-xs font-extrabold tracking-wider whitespace-nowrap uppercase transition-all",
                isActive ? "border-brand-primary text-brand-primary" : "border-transparent text-slate-500 hover:text-slate-900",
              )}
            >
              {tabLabel(tab)}
            </button>
          );
        })}
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
          <p className="mx-auto mt-1 max-w-sm text-xs text-slate-400">{t("notifications.emptyFiltered")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {filteredNotifications.map((notif) => {
              const style = notificationStyle(notif.type, t);
              const Icon = style.icon;
              const destination = targetLabel(notif.target_role, t);
              return (
                <motion.div
                  key={notif.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className={cn(
                    "group relative flex flex-col justify-between gap-4 rounded-2xl border bg-white p-5 transition-all hover:shadow-lg hover:shadow-indigo-900/5 md:flex-row md:items-center",
                    notif.read ? "border-slate-200 opacity-80 hover:opacity-100" : "border-indigo-100 shadow-xs shadow-indigo-100/30",
                  )}
                >
                  {!notif.read ? (
                    <span className="absolute top-1/2 left-2 h-2 w-2 -translate-y-1/2 rounded-full bg-brand-primary shadow-sm shadow-brand-primary" />
                  ) : null}

                  <div className="flex flex-1 items-start gap-4">
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-xs", style.bg)}>
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-black tracking-wider uppercase", style.bg)}>
                          {style.label}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                          <Clock size={10} /> {formatTimeAgo(notif.created_at, t)}
                        </span>
                        {destination ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-slate-400 uppercase">
                            {destination}
                          </span>
                        ) : null}
                      </div>
                      <h4 className="mt-1.5 text-sm leading-snug font-bold text-slate-900">{notif.title}</h4>
                      <p className="mt-1 text-xs leading-relaxed font-medium text-slate-600">{notif.message}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 self-end md:self-center">
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(notif)}
                      title={t("notifications.goToActionTitle")}
                      className="flex h-8 cursor-pointer items-center gap-1.5 rounded-xl border border-indigo-100 bg-indigo-50 px-3 text-[10px] font-black tracking-wider text-brand-primary uppercase shadow-xs transition-all hover:bg-brand-primary hover:text-white"
                    >
                      <span>{t("notifications.goToAction")}</span>
                      <ExternalLink size={11} />
                    </button>

                    {!notif.read ? (
                      <button
                        type="button"
                        onClick={() => handleMarkAsRead(notif.id)}
                        title={t("notifications.markReadTitle")}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                      >
                        <Check size={13} />
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => handleDelete(notif.id)}
                      title={t("notifications.deleteTitle")}
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </motion.div>
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
