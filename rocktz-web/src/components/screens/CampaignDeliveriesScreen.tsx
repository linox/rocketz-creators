"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Calendar, DollarSign, Gift, Handshake, Lock, Megaphone, Plus, Repeat, Search, Sparkles, Video } from "lucide-react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { RecurringInner } from "@/components/screens/RecurringScreen";
import { Select2Field } from "@/components/Select2Field";
import { UserAvatar } from "@/components/UserAvatar";
import { api } from "@/lib/api";
import { alertApiError, alertSuccess, alertWarning } from "@/lib/alerts";
import { cn } from "@/lib/cn";
import { usePrivacy } from "@/lib/privacy";
import type { Campaign, CampaignCreator, Company } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { intlLocale, normalizeLocale } from "@/i18n/locales";

const STATUSES = ["briefing", "selection", "approval", "production", "published", "finished"] as const;

const STATUS_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  briefing: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  selection: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  approval: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  production: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  published: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  finished: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-300" },
};

const STATUS_LABEL_KEY: Record<(typeof STATUSES)[number], string> = {
  briefing: "deliveries.statusBriefing",
  selection: "deliveries.statusSelection",
  approval: "deliveries.statusApproval",
  production: "deliveries.statusProduction",
  published: "deliveries.statusPublished",
  finished: "deliveries.statusFinished",
};

function isApprovedCreator(row: CampaignCreator) {
  return !row.application_status || row.application_status === "approved";
}

function formatRange(
  start: string | null | undefined,
  end: string | null | undefined,
  locale: string,
  t: (key: string, opts?: Record<string, string>) => string,
) {
  if (!start && !end) return t("campaigns.noDate");
  const fmt = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString(locale);
  if (start && end) return t("campaigns.dateRange", { start: fmt(start), end: fmt(end) });
  return fmt(start || end || "");
}

const EMPTY_FORM = {
  name: "",
  company_id: "",
  objective: "",
  total_budget: "",
  start_date: "",
  end_date: "",
  is_secret: false,
  is_direct_contract: false,
  is_barter: false,
  barter_details: "",
};

function DeliveriesInner() {
  const user = useAuth();
  const router = useRouter();
  const { t, i18n } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const { formatCurrency } = usePrivacy();
  const locale = intlLocale(normalizeLocale(i18n.language));
  const canManage = user.role === "admin" || user.role === "company";
  const isAdmin = user.role === "admin";

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeTab, setActiveTab] = useState<"campaigns" | "recurring">("campaigns");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  async function load() {
    try {
      setCampaigns((await api.campaigns()).data);
    } catch (err) {
      await alertApiError(err);
    }
  }

  useEffect(() => {
    load();
    if (canManage) {
      api.companies().then((res) => setCompanies(res.data)).catch(() => undefined);
    }
  }, [canManage]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "recurring") setActiveTab("recurring");
    if (params.get("new") === "true") setOpen(true);
  }, []);

  function setTab(tab: "campaigns" | "recurring") {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    url.searchParams.delete("new");
    window.history.replaceState({}, "", url);
  }

  const filteredCampaigns = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return campaigns.filter((campaign) => {
      const companyName = campaign.company?.name ?? "";
      const matchesSearch =
        !term ||
        campaign.name.toLowerCase().includes(term) ||
        (campaign.objective ?? "").toLowerCase().includes(term) ||
        companyName.toLowerCase().includes(term);
      if (!matchesSearch) return false;
      if (statusFilter === "all") return true;
      return campaign.status === statusFilter;
    });
  }, [campaigns, searchQuery, statusFilter]);

  const totalCampaignsCount = campaigns.length;
  const activeCampaignsCount = campaigns.filter((campaign) => campaign.status !== "finished").length;
  const totalBudgetManaged = campaigns.reduce(
    (acc, campaign) => acc + (campaign.is_barter || campaign.is_direct_contract ? 0 : Number(campaign.total_budget) || 0),
    0,
  );

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!form.name || (isAdmin && !form.company_id) || !form.start_date || !form.end_date) {
      await alertWarning(tc("alerts.incompleteTitle"), t("deliveries.incomplete"));
      return;
    }
    try {
      const created = await api.createCampaign({
        name: form.name,
        company_id: isAdmin ? Number(form.company_id) : user.company?.id,
        objective: form.objective,
        total_budget: form.is_barter ? 0 : form.total_budget ? Number(form.total_budget) : null,
        start_date: form.start_date,
        end_date: form.end_date,
        status: "briefing",
        is_secret: form.is_secret,
        is_direct_contract: form.is_direct_contract,
        is_barter: form.is_barter,
        barter_details: form.is_barter ? form.barter_details : null,
      });
      setOpen(false);
      setForm(EMPTY_FORM);
      await alertSuccess(t("campaigns.created"));
      router.push(`/campaigns/${created.data.id}`);
    } catch (err) {
      await alertApiError(err);
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-16">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-4">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-bold tracking-wider text-brand-primary uppercase">
              <Video size={16} /> {t("deliveries.breadcrumb")}
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 lg:text-3xl">{t("deliveries.title")}</h1>
            <p className="mt-1 text-xs font-medium text-slate-500">{t("deliveries.subtitle")}</p>
          </div>

          {activeTab === "campaigns" && canManage ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border-none bg-brand-primary px-4 py-2.5 text-xs font-extrabold text-white shadow-md shadow-indigo-100 transition-all hover:bg-indigo-600"
            >
              <Plus size={16} className="stroke-[2.5]" /> {t("deliveries.new")}
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2 border-b border-slate-200 pt-2">
          <button
            type="button"
            onClick={() => setTab("campaigns")}
            className={cn(
              "-mb-[2px] flex cursor-pointer items-center gap-2 border-b-2 px-5 pb-3 text-sm font-extrabold transition-all",
              activeTab === "campaigns"
                ? "rounded-t-xl border-brand-primary bg-indigo-50/70 text-brand-primary"
                : "rounded-t-xl border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800",
            )}
          >
            <Megaphone size={18} className={activeTab === "campaigns" ? "text-brand-primary" : "text-slate-400"} />
            {t("deliveries.tabCampaigns")}
            {campaigns.length > 0 ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-black",
                  activeTab === "campaigns" ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600",
                )}
              >
                {campaigns.length}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setTab("recurring")}
            className={cn(
              "-mb-[2px] flex cursor-pointer items-center gap-2 border-b-2 px-5 pb-3 text-sm font-extrabold transition-all",
              activeTab === "recurring"
                ? "rounded-t-xl border-brand-primary bg-indigo-50/70 text-brand-primary"
                : "rounded-t-xl border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800",
            )}
          >
            <Repeat size={18} className={activeTab === "recurring" ? "text-brand-primary" : "text-slate-400"} />
            {t("deliveries.tabRecurring")}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-black",
                activeTab === "recurring" ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600",
              )}
            >
              {t("deliveries.recurringBadge")}
            </span>
          </button>
        </div>
      </header>

      {activeTab === "recurring" ? (
        <RecurringInner embedded />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-brand-primary">
                    <Megaphone size={15} />
                  </div>
                  <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">{t("deliveries.kpiActive")}</span>
                </div>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-brand-primary">{t("deliveries.kpiActiveBadge")}</span>
              </div>
              <div className="flex items-baseline gap-1.5 pt-3">
                <span className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">{activeCampaignsCount}</span>
                <span className="text-xs font-semibold text-slate-400">{t("deliveries.kpiActiveOf", { count: totalCampaignsCount })}</span>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <DollarSign size={15} />
                  </div>
                  <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">{t("deliveries.kpiBudget")}</span>
                </div>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{t("deliveries.kpiBudgetBadge")}</span>
              </div>
              <div className="flex items-baseline gap-1.5 pt-3">
                <span className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">{formatCurrency(totalBudgetManaged)}</span>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <Sparkles size={15} />
                  </div>
                  <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">{t("deliveries.kpiDetails")}</span>
                </div>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">{t("deliveries.kpiDetailsBadge")}</span>
              </div>
              <div className="flex items-baseline gap-1.5 pt-3">
                <span className="text-xs font-black text-slate-800 sm:text-sm">{t("deliveries.kpiDetailsText")}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs md:flex-row">
            <div className="relative w-full md:w-80">
              <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder={t("deliveries.searchPh")}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-4 pl-9 text-xs font-medium outline-none transition-all focus:border-brand-primary focus:bg-white"
              />
            </div>

            <div className="flex w-full items-center gap-1.5 overflow-x-auto md:w-auto">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={cn(
                  "cursor-pointer rounded-lg px-3 py-1.5 text-[11px] font-bold whitespace-nowrap transition-all",
                  statusFilter === "all" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                {t("deliveries.filterAll", { count: campaigns.length })}
              </button>
              {STATUSES.map((status) => {
                const count = campaigns.filter((campaign) => campaign.status === status).length;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      "cursor-pointer rounded-lg px-3 py-1.5 text-[11px] font-bold whitespace-nowrap transition-all",
                      statusFilter === status ? "bg-brand-primary text-white shadow-xs" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {t(STATUS_LABEL_KEY[status])} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {filteredCampaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white p-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-brand-primary">
                <Megaphone size={28} />
              </div>
              <h3 className="text-base font-bold text-slate-800">{t("deliveries.emptyTitle")}</h3>
              <p className="max-w-md text-xs text-slate-500">{t("deliveries.emptyHint")}</p>
              {canManage ? (
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="mt-2 flex items-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-indigo-600"
                >
                  <Plus size={14} /> {t("deliveries.createCampaign")}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredCampaigns.map((campaign) => {
                const companyName = campaign.company?.name || t("deliveries.client");
                const assigned = campaign.applications ?? [];
                const approved = assigned.filter(isApprovedCreator);
                const pendingCount = campaign.pending_applications ?? 0;
                const totalBudget = Number(campaign.total_budget) || 0;
                const castingCost = approved.reduce((acc, row) => acc + (Number(row.amount) || 0), 0);
                const remainingBudget = totalBudget - castingCost;
                const completedDeliveries = approved.filter((row) => row.delivery_status === "published" || row.delivery_status === "approved").length;
                const totalDeliveries = approved.length;
                const progress = totalDeliveries > 0 ? Math.round((completedDeliveries / totalDeliveries) * 100) : 0;
                const statusCfg = STATUS_STYLE[campaign.status] || STATUS_STYLE.briefing;
                const specialMode = campaign.is_barter || campaign.is_direct_contract;

                return (
                  <article
                    key={campaign.id}
                    className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs transition-all hover:border-brand-primary/60 hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4 p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <UserAvatar
                            src={campaign.company?.logo_url}
                            name={companyName}
                            size="custom"
                            shape="circle"
                            className="h-10 w-10 border border-slate-200"
                            textClassName="text-xs font-black"
                          />
                          <div className="min-w-0">
                            <span className="block truncate text-[11px] font-extrabold tracking-wider text-brand-primary uppercase">{companyName}</span>
                            <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                              <Calendar size={11} /> {formatRange(campaign.start_date, campaign.end_date, locale, t)}
                            </span>
                          </div>
                        </div>
                        <span className={cn("rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase", statusCfg.bg, statusCfg.text, statusCfg.border)}>
                          {t(STATUS_LABEL_KEY[campaign.status as (typeof STATUSES)[number]] ?? "deliveries.statusBriefing")}
                        </span>
                      </div>

                      <div>
                        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                          {campaign.is_secret ? (
                            <span className="flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[9px] font-bold text-rose-700">
                              <Lock size={9} /> {t("campaigns.secret")}
                            </span>
                          ) : null}
                          {campaign.is_direct_contract ? (
                            <span className="flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                              <Handshake size={9} /> {t("campaigns.directContract")}
                            </span>
                          ) : null}
                          {campaign.is_barter ? (
                            <span className="flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700">
                              <Gift size={9} /> {t("campaigns.barter")}
                            </span>
                          ) : null}
                          {pendingCount > 0 ? (
                            <span className="flex animate-pulse items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[9px] font-extrabold text-rose-700">
                              ● {pendingCount > 1 ? t("deliveries.candidatesMany", { count: pendingCount }) : t("deliveries.candidatesOne", { count: pendingCount })}
                            </span>
                          ) : null}
                        </div>
                        <h3 className="line-clamp-1 text-base font-bold text-slate-900 transition-colors group-hover:text-brand-primary">
                          <Link href={`/campaigns/${campaign.id}`}>{campaign.name}</Link>
                        </h3>
                        {campaign.objective ? <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{campaign.objective}</p> : null}
                      </div>

                      <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200/70 bg-slate-50/80 p-2.5 text-[11px] sm:grid-cols-3">
                        <div className="flex flex-col justify-between rounded-lg border border-slate-200/60 bg-white/90 p-2">
                          <span className="block text-[9px] font-extrabold tracking-wider text-slate-400 uppercase">{t("deliveries.totalBudget")}</span>
                          <span className="mt-0.5 truncate text-xs font-black text-slate-900">
                            {campaign.is_barter ? t("deliveries.barter") : campaign.is_direct_contract ? t("deliveries.direct") : formatCurrency(totalBudget)}
                          </span>
                        </div>
                        <div className="flex flex-col justify-between rounded-lg border border-slate-200/60 bg-white/90 p-2">
                          <span className="block truncate text-[9px] font-extrabold tracking-wider text-slate-400 uppercase">{t("deliveries.casting", { count: approved.length })}</span>
                          <span className="mt-0.5 truncate text-xs font-black text-slate-700">
                            {campaign.is_barter ? t("deliveries.barter") : campaign.is_direct_contract ? t("deliveries.contract") : formatCurrency(castingCost)}
                          </span>
                        </div>
                        <div
                          className={cn(
                            "flex flex-col justify-between rounded-lg border p-2",
                            specialMode
                              ? "border-indigo-200/60 bg-indigo-50/60"
                              : remainingBudget >= 0
                                ? "border-emerald-200/70 bg-emerald-50/70"
                                : "border-rose-200/70 bg-rose-50/70",
                          )}
                        >
                          <span
                            className={cn(
                              "block truncate text-[9px] font-extrabold tracking-wider uppercase",
                              specialMode ? "text-indigo-700" : remainingBudget >= 0 ? "text-emerald-700" : "text-rose-700",
                            )}
                          >
                            {specialMode ? t("deliveries.modality") : t("deliveries.margin")}
                          </span>
                          <span
                            className={cn(
                              "mt-0.5 block truncate text-xs font-black",
                              specialMode ? "text-indigo-700" : remainingBudget >= 0 ? "text-emerald-700" : "text-rose-700",
                            )}
                          >
                            {campaign.is_barter ? t("deliveries.barter") : campaign.is_direct_contract ? t("deliveries.direct") : formatCurrency(remainingBudget)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-2 overflow-hidden">
                            {approved.slice(0, 4).map((row) => (
                              <div key={row.id} className="inline-block rounded-full ring-2 ring-white" title={row.creator?.artistic_name || row.creator?.full_name || undefined}>
                                <UserAvatar
                                  src={row.creator?.photo_url}
                                  name={row.creator?.artistic_name || row.creator?.full_name || t("deliveries.client")}
                                  size="custom"
                                  shape="circle"
                                  className="h-6 w-6"
                                  textClassName="text-[8px]"
                                />
                              </div>
                            ))}
                            {approved.length > 4 ? (
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[9px] font-black text-slate-700 ring-2 ring-white">
                                +{approved.length - 4}
                              </div>
                            ) : null}
                          </div>
                          <span className="text-[11px] font-bold text-slate-500">
                            {approved.length === 1 ? t("deliveries.creatorOne", { count: approved.length }) : t("deliveries.creatorMany", { count: approved.length })}
                          </span>
                        </div>
                        {totalDeliveries > 0 ? (
                          <div className="min-w-[88px] text-right">
                            <span className="block text-[10px] font-extrabold text-slate-600">{t("deliveries.progress", { done: completedDeliveries, total: totalDeliveries })}</span>
                            <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-200">
                              <div className="h-full rounded-full bg-brand-primary" style={{ width: `${progress}%` }} />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/90 px-5 py-3.5">
                      <span className="text-[11px] font-bold text-slate-400">
                        {totalDeliveries === 0 ? t("deliveries.noCreators") : t("deliveries.pending", { count: totalDeliveries - completedDeliveries })}
                      </span>
                      <Link
                        href={`/campaigns/${campaign.id}`}
                        className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-brand-primary px-3.5 py-1.5 text-xs font-extrabold text-white no-underline shadow-xs transition-all hover:bg-indigo-600"
                      >
                        {t("deliveries.viewCampaign")} <ArrowRight size={13} />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {open ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-3 sm:p-4">
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              aria-label={tc("close")}
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="relative z-10 my-auto flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-white p-5 sm:p-6">
                <div>
                  <h2 className="text-xl font-bold text-[#0F172A]">{t("campaigns.modalTitle")}</h2>
                  <p className="text-xs text-slate-500">{t("campaigns.modalSubtitle")}</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="cursor-pointer border-none bg-transparent p-1 font-bold text-slate-400 hover:text-slate-700">
                  ✕
                </button>
              </div>
              <form noValidate className="flex flex-1 flex-col gap-4 overflow-y-auto p-5 sm:p-6" onSubmit={onCreate}>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.name")}</label>
                  <input
                    placeholder={t("campaigns.namePh")}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold outline-none focus:border-brand-primary"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {isAdmin ? (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.company")}</label>
                      <Select2Field
                        theme="light"
                        placeholder={t("campaigns.companyPh")}
                        value={form.company_id}
                        options={companies.map((company) => ({ value: String(company.id), label: company.name }))}
                        onChange={(value) => setForm({ ...form, company_id: value })}
                      />
                    </div>
                  ) : null}
                  <div className={cn("flex flex-col gap-1.5", !isAdmin && "sm:col-span-2")}>
                    <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.budget")}</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      disabled={form.is_barter}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold outline-none focus:border-brand-primary disabled:bg-slate-100"
                      value={form.total_budget}
                      onChange={(event) => setForm({ ...form, total_budget: event.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.startDate")}</label>
                    <input
                      type="date"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand-primary"
                      value={form.start_date}
                      onChange={(event) => setForm({ ...form, start_date: event.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.endDate")}</label>
                    <input
                      type="date"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand-primary"
                      value={form.end_date}
                      onChange={(event) => setForm({ ...form, end_date: event.target.value })}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.objective")}</label>
                  <textarea
                    rows={3}
                    placeholder={t("deliveries.objectivePh")}
                    className="w-full resize-none rounded-xl border border-slate-200 p-3 text-xs font-medium outline-none focus:border-brand-primary"
                    value={form.objective}
                    onChange={(event) => setForm({ ...form, objective: event.target.value })}
                  />
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <span className="block text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">{t("deliveries.specialOptions")}</span>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
                      <input type="checkbox" checked={form.is_secret} onChange={(event) => setForm({ ...form, is_secret: event.target.checked })} className="rounded text-brand-primary" />
                      {t("deliveries.secretNda")}
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.is_direct_contract}
                        onChange={(event) => setForm({ ...form, is_direct_contract: event.target.checked })}
                        className="rounded text-brand-primary"
                      />
                      {t("deliveries.directCompany")}
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-amber-700">
                      <input type="checkbox" checked={form.is_barter} onChange={(event) => setForm({ ...form, is_barter: event.target.checked })} className="rounded text-amber-500" />
                      {t("deliveries.barterProducts")}
                    </label>
                  </div>
                  {form.is_barter ? (
                    <div className="pt-2">
                      <label className="mb-1 block text-[10px] font-bold tracking-wider text-amber-700 uppercase">{t("deliveries.barterDetails")}</label>
                      <input
                        placeholder={t("deliveries.barterDetailsPh")}
                        className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-medium outline-none focus:border-amber-400"
                        value={form.barter_details}
                        onChange={(event) => setForm({ ...form, barter_details: event.target.value })}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
                  <button type="button" onClick={() => setOpen(false)} className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100">
                    {tc("cancel")}
                  </button>
                  <button className="rounded-xl bg-brand-primary px-5 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-indigo-600">{t("deliveries.modalSave")}</button>
                </div>
              </form>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function CampaignDeliveriesScreen() {
  return (
    <AuthenticatedShell>
      <DeliveriesInner />
    </AuthenticatedShell>
  );
}
