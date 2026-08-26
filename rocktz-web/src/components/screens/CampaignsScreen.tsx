"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { safeHttpUrl } from "@/lib/safe-http-url";
import {
  AlertTriangle,
  Archive,
  ArrowUpRight,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Clapperboard,
  DollarSign,
  ExternalLink,
  FileText,
  Gift,
  Handshake,
  Instagram,
  Layers,
  Lock,
  Megaphone,
  Package,
  Plus,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { ApproveAgencyCampaignModal } from "@/components/ApproveAgencyCampaignModal";
import { CampaignSubmittedVideo } from "@/components/CampaignSubmittedVideo";
import { CreateCampaignModal } from "@/components/CreateCampaignModal";
import { UserAvatar } from "@/components/UserAvatar";
import { api } from "@/lib/api";
import { isPendingAgency } from "@/lib/agency-approval";
import { alertApiError, alertConfirm, alertSuccess, alertWarning } from "@/lib/alerts";
import { cn } from "@/lib/cn";
import { usePrivacy } from "@/lib/privacy";
import { moneyCurrency } from "@/lib/geo";
import type { Campaign, CampaignCreator, Company } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { intlLocale, normalizeLocale } from "@/i18n/locales";

const ACTIVE_STATUSES = ["pending_agency", "briefing", "selection", "production", "published"] as const;

const STATUS_PILL: Record<string, string> = {
  pending_agency: "bg-amber-50 text-amber-800 border-amber-200",
  briefing: "bg-blue-50 text-blue-600 border-blue-100",
  selection: "bg-purple-50 text-purple-600 border-purple-100",
  production: "bg-indigo-50 text-indigo-600 border-indigo-100",
  published: "bg-emerald-50 text-emerald-600 border-emerald-100",
  finished: "bg-slate-900/80 text-slate-300 border-white/10",
};

type MaterialRow = CampaignCreator & { campaignName: string; companyName: string; companyLogo: string | null };

function countValue(value?: string | number | null) {
  return Number(value ?? 0) || 0;
}

function formatDeliverablesSummary(deliverables?: Campaign["deliverables"]) {
  if (!deliverables) return "";
  if (typeof deliverables.summary === "string" && deliverables.summary.trim()) return deliverables.summary.trim();
  const parts: string[] = [];
  const reels = countValue(deliverables.reels);
  const stories = countValue(deliverables.stories);
  const tiktok = countValue(deliverables.tiktok);
  const ugc = countValue(deliverables.ugc);
  const posts = countValue(deliverables.posts);
  const youtube = countValue(deliverables.youtube);
  if (reels) parts.push(`${reels}x Reel${reels > 1 ? "s" : ""}`);
  if (stories) parts.push(`${stories}x Stories`);
  if (tiktok) parts.push(`${tiktok}x TikTok`);
  if (ugc) parts.push(`${ugc}x UGC`);
  if (posts) parts.push(`${posts}x Feed/Post${posts > 1 ? "s" : ""}`);
  if (youtube) parts.push(`${youtube}x YouTube`);
  return parts.join(" + ");
}

function formatRange(start: string | null | undefined, end: string | null | undefined, locale: string, t: (key: string, opts?: Record<string, string>) => string) {
  if (!start && !end) return t("campaigns.noDate");
  const fmt = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString(locale);
  if (start && end) return t("campaigns.dateRange", { start: fmt(start), end: fmt(end) });
  return fmt(start || end || "");
}

function getFormatBadge(deliveryType = "") {
  const dt = deliveryType.toLowerCase();
  if (dt.includes("reel")) return { label: "Reel", icon: Clapperboard, color: "bg-indigo-50 text-indigo-700 border-indigo-200" };
  if (dt.includes("storie") || dt.includes("story")) return { label: "Stories", icon: Instagram, color: "bg-amber-50 text-amber-700 border-amber-200" };
  if (dt.includes("tiktok")) return { label: "TikTok", icon: Clapperboard, color: "bg-rose-50 text-rose-700 border-rose-200" };
  if (dt.includes("youtube") || dt.includes("video") || dt.includes("vídeo")) return { label: "YouTube", icon: Video, color: "bg-red-50 text-red-700 border-red-200" };
  if (dt.includes("ugc")) return { label: "UGC", icon: Camera, color: "bg-teal-50 text-teal-700 border-teal-200" };
  if (dt.includes("post") || dt.includes("feed")) return { label: "Feed / Post", icon: Layers, color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  return { label: deliveryType || "Material", icon: FileText, color: "bg-slate-100 text-slate-700 border-slate-200" };
}

function getPlatformBadge(deliveryType = "") {
  const dt = deliveryType.toLowerCase();
  if (dt.includes("tiktok")) return { name: "TikTok", color: "bg-rose-50 text-rose-700 border-rose-200" };
  if (dt.includes("youtube")) return { name: "YouTube", color: "bg-red-50 text-red-700 border-red-200" };
  return { name: "Instagram", color: "bg-pink-50 text-pink-700 border-pink-200" };
}

function CampaignCard({
  campaign,
  finished,
  dateLabel,
  formatCurrency,
  isAdmin,
  onApprove,
}: {
  campaign: Campaign;
  finished?: boolean;
  dateLabel: string;
  formatCurrency: (value?: number | null, currency?: string | null) => string;
  isAdmin?: boolean;
  onApprove?: (campaign: Campaign) => void;
}) {
  const { t } = useTranslation("app");
  const companyName = campaign.company?.name || t("campaigns.client");
  const summary = formatDeliverablesSummary(campaign.deliverables);
  const pending = campaign.pending_applications ?? 0;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-[20px] border bg-white shadow-sm transition-all",
        finished
          ? "border-slate-200 opacity-90 hover:opacity-100"
          : "border-[#E2E8F0] hover:border-brand-primary hover:shadow-md",
      )}
    >
      <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-slate-900">
        {campaign.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={campaign.image_url} alt={campaign.name} referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className={cn("flex h-full w-full flex-col items-center justify-center p-6 text-center", finished ? "bg-slate-800" : "bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950")}>
            {finished ? <Archive size={24} className="mb-1 text-slate-400" /> : <Megaphone size={22} className="mb-2 text-white/80" />}
            <span className="max-w-[200px] truncate text-xs font-bold text-white/90">{campaign.name}</span>
          </div>
        )}

        <div className="pointer-events-none absolute top-3 right-3 left-3 flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn("rounded-full border px-2.5 py-0.5 text-[9px] font-bold tracking-wider uppercase shadow-xs backdrop-blur-md", STATUS_PILL[campaign.status] ?? STATUS_PILL.briefing)}>
              {finished ? t("campaigns.finishedBadge") : t(`status.${campaign.status}`, { defaultValue: campaign.status })}
            </span>
            {campaign.is_secret ? (
              <span className="flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-950/80 px-2 py-0.5 text-[9px] font-bold tracking-wider text-rose-300 uppercase backdrop-blur-md">
                <Lock size={10} /> {t("campaigns.secret")}
              </span>
            ) : null}
            {campaign.is_direct_contract ? (
              <span className="flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-950/80 px-2 py-0.5 text-[9px] font-bold tracking-wider text-emerald-300 uppercase backdrop-blur-md">
                <Handshake size={10} /> {t("campaigns.directContract")}
              </span>
            ) : null}
            {campaign.is_barter ? (
              <span className="flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-950/80 px-2 py-0.5 text-[9px] font-bold tracking-wider text-amber-300 uppercase backdrop-blur-md">
                <Gift size={10} /> {t("campaigns.barter")}
              </span>
            ) : null}
          </div>
          {!finished && pending > 0 ? (
            <span className="animate-pulse rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-black tracking-wider text-slate-950 uppercase shadow-md">
              ● {pending > 1 ? t("campaigns.pendingMany", { count: pending }) : t("campaigns.pendingOne", { count: pending })}
            </span>
          ) : null}
        </div>

        <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/80 px-2.5 py-1 shadow-lg backdrop-blur-md">
          <UserAvatar src={campaign.company?.logo_url} name={companyName} size="custom" shape="rounded-lg" className="h-5 w-5 border border-white/20" textClassName="text-[8px]" />
          <span className="max-w-[130px] truncate text-[10px] font-bold tracking-wide text-white">{companyName}</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className={cn("line-clamp-1 text-[17px] font-bold text-[#0F172A] transition-colors", !finished && "group-hover:text-brand-primary")}>
            <Link href={`/campaigns/${campaign.id}`}>{campaign.name}</Link>
          </h3>
          <Link href={`/campaigns/${campaign.id}`} className="ml-2 shrink-0 text-slate-400 transition-colors hover:text-brand-primary">
            <ArrowUpRight size={18} />
          </Link>
        </div>

        {summary ? (
          <div className={cn("mb-2 flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold", finished ? "border-slate-200 bg-slate-100 text-slate-600" : "border-indigo-100/80 bg-indigo-50/70 text-indigo-700")}>
            <Package size={13} className={cn("shrink-0", finished ? "text-slate-500" : "text-brand-primary")} />
            <span className="truncate">
              {summary} <span className={cn("text-[10px] font-medium", finished ? "font-normal text-slate-400" : "text-indigo-500")}>{t("campaigns.perCreator")}</span>
            </span>
          </div>
        ) : null}

        {isPendingAgency(campaign.status) ? (
          <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] font-semibold text-amber-900">
            {t("campaigns.awaitingAgencyHint")}
          </div>
        ) : null}

        <div className="mt-auto space-y-2.5 pt-2">
          <div className="flex items-center gap-2.5 text-xs text-[#64748B]">
            <Calendar size={13} className="shrink-0 text-slate-400" />
            <span>{dateLabel}</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs font-bold text-[#0F172A]">
            {campaign.is_barter ? (
              <>
                <Gift size={13} className="shrink-0 text-amber-500" />
                <span className="text-amber-600">{t("campaigns.barterFull")}</span>
              </>
            ) : (
              <>
                <DollarSign size={13} className={cn("shrink-0", finished ? "text-slate-400" : "text-brand-primary")} />
                <span>{campaign.is_direct_contract ? t("campaigns.directContract") : formatCurrency(campaign.total_budget, moneyCurrency(campaign))}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[#F1F5F9] bg-[#F8FAFC] px-5 py-3.5">
        {finished ? (
          <span className="text-[11px] font-medium text-slate-400">{t("campaigns.completed")}</span>
        ) : (
          <Link href={`/campaigns/${campaign.id}?tab=selection`} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800">
            <Users size={14} /> {t("campaigns.casting")}
          </Link>
        )}
        <div className="flex items-center gap-2">
          {isAdmin && isPendingAgency(campaign.status) && onApprove ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                onApprove(campaign);
              }}
              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-black tracking-wider text-white uppercase hover:bg-emerald-700"
            >
              {t("campaigns.approveAgency")}
            </button>
          ) : null}
          <Link href={`/campaigns/${campaign.id}`} className={cn("text-[11px] font-bold tracking-wider uppercase hover:underline", finished ? "text-slate-700 hover:text-brand-primary" : "text-brand-primary")}>
            {finished ? t("campaigns.viewReport") : t("campaigns.manage")} →
          </Link>
        </div>
      </div>
    </motion.article>
  );
}

function CampaignsInner() {
  const user = useAuth();
  const { t, i18n } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const { formatCurrency } = usePrivacy();
  const locale = intlLocale(normalizeLocale(i18n.language));
  const isAdmin = user.role === "admin";
  const canManage = user.role === "admin" || user.role === "company";

  const [items, setItems] = useState<Campaign[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeView, setActiveView] = useState<"active" | "finished" | "materials">("active");
  const [statusFilter, setStatusFilter] = useState("all");
  const [materialFilter, setMaterialFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [approvingCampaign, setApprovingCampaign] = useState<Campaign | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [revisionFeedback, setRevisionFeedback] = useState<Record<number, string>>({});
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  async function load() {
    try {
      const res = await api.campaigns("?include=content");
      setItems(res.data);
    } catch (err) {
      await alertApiError(err);
    }
  }

  useEffect(() => {
    load();
    if (isAdmin) {
      api.companies("?status=active").then((res) => setCompanies(res.data)).catch(() => undefined);
    }
  }, [isAdmin]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "true") setOpen(true);
    if (params.get("tab") === "materials") setActiveView("materials");
    if (params.get("tab") === "finished") setActiveView("finished");
  }, []);

  const activeCampaigns = useMemo(() => items.filter((campaign) => campaign.status !== "finished"), [items]);
  const finishedCampaigns = useMemo(() => items.filter((campaign) => campaign.status === "finished"), [items]);
  const filteredActive = useMemo(
    () => activeCampaigns.filter((campaign) => statusFilter === "all" || campaign.status === statusFilter),
    [activeCampaigns, statusFilter],
  );

  const materials = useMemo<MaterialRow[]>(
    () =>
      items.flatMap((campaign) =>
        (campaign.applications ?? []).map((row) => ({
          ...row,
          campaignName: campaign.name,
          companyName: campaign.company?.name || t("campaigns.client"),
          companyLogo: campaign.company?.logo_url ?? null,
        })),
      ),
    [items, t],
  );

  const pendingMaterials = materials.filter((row) => row.delivery_status === "sent" || row.delivery_status === "pending" || row.content?.script || row.content?.video_url);
  const filteredMaterials = materials.filter((row) => {
    if (materialFilter === "pending") return row.delivery_status === "sent" || row.delivery_status === "pending";
    if (materialFilter === "revision") return row.delivery_status === "revision";
    if (materialFilter === "approved") return row.delivery_status === "approved";
    if (materialFilter === "published") return row.delivery_status === "published";
    return true;
  });

  async function resetCampaigns() {
    if (!(await alertConfirm(t("campaigns.resetTitle"), t("campaigns.resetText"), t("campaigns.resetConfirm")))) return;
    try {
      await api.resetCampaigns();
      await alertSuccess(t("campaigns.resetSuccess"), t("campaigns.resetSuccessBody"));
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function approveMaterial(row: MaterialRow) {
    setUpdatingId(row.id);
    try {
      await api.updateParticipation(row.id, { delivery_status: "approved", revision_details: "" });
      await alertSuccess(t("campaigns.approvedOk"));
      load();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setUpdatingId(null);
    }
  }

  async function requestRevision(row: MaterialRow) {
    const feedback = (revisionFeedback[row.id] ?? "").trim();
    if (!feedback) {
      await alertWarning(tc("alerts.incompleteTitle"), t("campaigns.revisionRequired"));
      return;
    }
    setUpdatingId(row.id);
    try {
      await api.updateParticipation(row.id, { delivery_status: "revision", revision_details: feedback });
      await alertSuccess(t("campaigns.revisionOk"));
      load();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setUpdatingId(null);
    }
  }

  function deliveryLabel(status: string | null) {
    if (status === "approved") return t("campaigns.deliveryApproved");
    if (status === "revision") return t("campaigns.deliveryRevision");
    if (status === "sent") return t("campaigns.deliverySent");
    if (status === "published") return t("campaigns.deliveryPublished");
    return t("campaigns.deliveryPending");
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="m-0 text-xl font-bold text-[#0F172A] sm:text-[28px]">{t("campaigns.title")}</h1>
          <p className="mt-1 text-[14px] text-[#64748B]">{t("campaigns.subtitle")}</p>
        </div>
        {canManage ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            {isAdmin ? (
              <button
                type="button"
                onClick={resetCampaigns}
                title={t("campaigns.resetHint")}
                className="flex h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-4 text-xs font-bold text-rose-600 shadow-xs transition-all hover:bg-rose-50"
              >
                <Trash2 size={15} />
                {t("campaigns.reset")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-brand-primary px-6 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-600 active:scale-95"
            >
              <Plus size={18} />
              {t("campaigns.new")}
            </button>
          </div>
        ) : null}
      </header>

      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 pb-1 hide-scrollbar">
        <button
          type="button"
          onClick={() => setActiveView("active")}
          className={cn(
            "relative flex cursor-pointer items-center gap-2 px-3 pb-3.5 text-sm font-bold whitespace-nowrap transition-all",
            activeView === "active" ? "border-b-2 border-brand-primary text-brand-primary" : "text-slate-500 hover:text-slate-800",
          )}
        >
          <Megaphone size={16} />
          {t("campaigns.tabActive")}
          <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-xs font-black text-brand-primary">{activeCampaigns.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveView("finished")}
          className={cn(
            "relative flex cursor-pointer items-center gap-2 px-3 pb-3.5 text-sm font-bold whitespace-nowrap transition-all",
            activeView === "finished" ? "border-b-2 border-brand-primary text-brand-primary" : "text-slate-500 hover:text-slate-800",
          )}
        >
          <Archive size={16} />
          {t("campaigns.tabFinished")}
          <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-black text-slate-600">{finishedCampaigns.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveView("materials")}
          className={cn(
            "relative flex cursor-pointer items-center gap-2 px-3 pb-3.5 text-sm font-bold whitespace-nowrap transition-all",
            activeView === "materials" ? "border-b-2 border-brand-primary text-brand-primary" : "text-slate-500 hover:text-slate-800",
          )}
        >
          <Layers size={16} />
          {t("campaigns.tabMaterials")}
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-black text-amber-700">{pendingMaterials.length}</span>
        </button>
      </div>

      {activeView === "active" ? (
        <div className="space-y-6">
          <div className="flex items-center overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white px-2 py-2 shadow-sm">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={cn(
                  "cursor-pointer rounded-lg px-4 py-2 text-[10px] font-bold tracking-wider uppercase transition-all",
                  statusFilter === "all" ? "bg-brand-primary text-white" : "text-[#64748B] hover:bg-[#F1F5F9]",
                )}
              >
                {t("campaigns.filterAll", { count: activeCampaigns.length })}
              </button>
              {ACTIVE_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    "cursor-pointer rounded-lg px-4 py-2 text-[10px] font-bold tracking-wider whitespace-nowrap uppercase transition-all",
                    statusFilter === status ? "bg-brand-primary text-white" : "text-[#64748B] hover:bg-[#F1F5F9]",
                  )}
                >
                  {t(`status.${status}`)}
                </button>
              ))}
            </div>
          </div>

          {filteredActive.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white py-16 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                <Megaphone size={24} />
              </div>
              <p className="text-sm font-bold text-slate-700">{t("campaigns.emptyActive")}</p>
              <p className="mt-1 text-xs text-slate-400">{t("campaigns.emptyActiveHint")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredActive.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  dateLabel={formatRange(campaign.start_date, campaign.end_date, locale, t)}
                  formatCurrency={formatCurrency}
                  isAdmin={isAdmin}
                  onApprove={setApprovingCampaign}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {activeView === "finished" ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-slate-200 p-2.5 text-slate-700">
                <Archive size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{t("campaigns.finishedHistory")}</h3>
                <p className="text-xs text-slate-500">{t("campaigns.finishedHistoryHint")}</p>
              </div>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-black text-slate-600">{t("campaigns.finishedCount", { count: finishedCampaigns.length })}</span>
          </div>

          {finishedCampaigns.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white py-16 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                <Archive size={24} />
              </div>
              <p className="text-sm font-bold text-slate-700">{t("campaigns.emptyFinished")}</p>
              <p className="mt-1 text-xs text-slate-400">{t("campaigns.emptyFinishedHint")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {finishedCampaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  finished
                  dateLabel={t("campaigns.period", {
                    start: campaign.start_date ? new Date(`${campaign.start_date}T00:00:00`).toLocaleDateString(locale) : "—",
                    end: campaign.end_date ? new Date(`${campaign.end_date}T00:00:00`).toLocaleDateString(locale) : "—",
                  })}
                  formatCurrency={formatCurrency}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {activeView === "materials" ? (
        <div className="space-y-6">
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-2 text-xs font-bold tracking-wider text-slate-400 uppercase">{t("campaigns.materialsFilter")}</span>
              {(
                [
                  ["all", t("campaigns.materialsAll", { count: materials.length }), "bg-brand-primary"],
                  ["pending", t("campaigns.materialsPending", { count: materials.filter((row) => row.delivery_status === "sent" || row.delivery_status === "pending").length }), "bg-amber-500"],
                  ["revision", t("campaigns.materialsRevision", { count: materials.filter((row) => row.delivery_status === "revision").length }), "bg-rose-500"],
                  ["approved", t("campaigns.materialsApproved", { count: materials.filter((row) => row.delivery_status === "approved").length }), "bg-emerald-600"],
                ] as const
              ).map(([key, label, activeClass]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMaterialFilter(key)}
                  className={cn(
                    "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
                    materialFilter === key ? `${activeClass} text-white` : "bg-slate-50 text-slate-600 hover:bg-slate-100",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filteredMaterials.length === 0 ? (
            <div className="space-y-3 rounded-3xl border border-slate-200 bg-white py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                <Layers size={24} />
              </div>
              <h3 className="text-base font-bold text-slate-800">{t("campaigns.materialsEmpty")}</h3>
              <p className="mx-auto max-w-sm text-xs text-slate-400">{t("campaigns.materialsEmptyHint")}</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-black tracking-wider text-slate-500 uppercase">
                      <th className="px-4 py-3.5">{t("campaigns.colCreator")}</th>
                      <th className="px-4 py-3.5">{t("campaigns.colProfile")}</th>
                      <th className="px-4 py-3.5">{t("campaigns.colType")}</th>
                      <th className="px-4 py-3.5">{t("campaigns.colFormat")}</th>
                      <th className="px-4 py-3.5">{t("campaigns.colPlatform")}</th>
                      <th className="px-4 py-3.5">{t("campaigns.colCampaign")}</th>
                      <th className="px-4 py-3.5">{t("campaigns.colStatus")}</th>
                      <th className="px-4 py-3.5 text-right">{t("campaigns.colExpand")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredMaterials.map((row) => {
                      const expanded = expandedId === row.id;
                      const format = getFormatBadge(row.delivery_type ?? "");
                      const platform = getPlatformBadge(row.delivery_type ?? "");
                      const hasVideo = Boolean(row.content?.video_url);
                      const isScriptOnly = Boolean(row.content?.script) && !hasVideo;
                      const FormatIcon = format.icon;

                      return (
                        <Fragment key={row.id}>
                          <tr className={cn("transition-colors hover:bg-slate-50/70", expanded && "bg-indigo-50/30")}>
                            <td className="px-4 py-4 font-bold text-slate-900">
                              <div className="flex items-center gap-3">
                                <UserAvatar src={row.creator?.photo_url} name={row.creator?.artistic_name || row.creator?.full_name} size="custom" shape="circle" className="h-9 w-9 border border-slate-200 shadow-xs" textClassName="text-xs" />
                                <div>
                                  <span className="block font-bold text-slate-900">{row.creator?.artistic_name || row.creator?.full_name}</span>
                                  {row.creator?.full_name ? <span className="text-[10px] font-normal text-slate-400">{row.creator.full_name}</span> : null}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <Link href={`/creators/${row.creator_id}`} className="flex items-center gap-1 text-xs font-bold text-brand-primary hover:underline">
                                @{row.creator?.artistic_name || t("campaigns.client")} <ExternalLink size={11} />
                              </Link>
                            </td>
                            <td className="px-4 py-4">
                              {hasVideo ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-black tracking-wider text-red-700 uppercase">
                                  <Video size={12} /> {t("campaigns.typeVideo")}
                                </span>
                              ) : isScriptOnly ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-black tracking-wider text-blue-700 uppercase">
                                  <FileText size={12} /> {t("campaigns.typeScript")}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                                  {t("campaigns.typePending")}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <span className={cn("inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-bold", format.color)}>
                                <FormatIcon size={13} /> {row.delivery_type || t("campaigns.material")}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase", platform.color)}>{platform.name}</span>
                            </td>
                            <td className="px-4 py-4">
                              <Link href={`/campaigns/${row.campaign_id}`} className="block max-w-[160px] truncate font-bold text-slate-800 hover:text-brand-primary hover:underline">
                                {row.campaignName}
                              </Link>
                              <span className="text-[10px] text-slate-400">{row.companyName}</span>
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className={cn(
                                  "rounded-full border px-2.5 py-1 text-[10px] font-black tracking-wider uppercase",
                                  row.delivery_status === "approved"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : row.delivery_status === "revision"
                                      ? "border-rose-200 bg-rose-50 text-rose-700"
                                      : row.delivery_status === "sent"
                                        ? "border-amber-200 bg-amber-50 text-amber-700"
                                        : row.delivery_status === "published"
                                          ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                                          : "border-slate-200 bg-slate-100 text-slate-600",
                                )}
                              >
                                ● {deliveryLabel(row.delivery_status)}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <button
                                type="button"
                                onClick={() => setExpandedId(expanded ? null : row.id)}
                                className={cn(
                                  "inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all",
                                  expanded ? "bg-slate-800 text-white" : "border border-indigo-100 bg-indigo-50 text-brand-primary hover:bg-indigo-100",
                                )}
                              >
                                {expanded ? t("campaigns.collapse") : t("campaigns.expand")}
                              </button>
                            </td>
                          </tr>
                          {expanded ? (
                            <tr>
                              <td colSpan={8} className="border-b border-slate-200 bg-slate-50/70 p-0">
                              <div className="space-y-6 p-6">
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                      <div className="flex items-center gap-2">
                                        <FileText size={16} className="text-brand-primary" />
                                        <h4 className="text-sm font-bold text-slate-900">{t("campaigns.scriptTitle")}</h4>
                                      </div>
                                      <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">{t("campaigns.scriptSubmitted")}</span>
                                    </div>
                                    {row.content?.script ? (
                                      <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs leading-relaxed font-medium whitespace-pre-wrap text-slate-700">
                                        {row.content.script}
                                      </div>
                                    ) : (
                                      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-4 text-center text-xs text-slate-400 italic">{t("campaigns.noScript")}</p>
                                    )}
                                    {row.notes ? (
                                      <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-xs text-amber-900">
                                        <span className="mb-0.5 block font-bold">{t("campaigns.creatorNotes")}</span>
                                        {row.notes}
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                      <div className="flex items-center gap-2">
                                        <Video size={16} className="text-red-500" />
                                        <h4 className="text-sm font-bold text-slate-900">{t("campaigns.mediaTitle")}</h4>
                                      </div>
                                      <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">{t("campaigns.mediaFile")}</span>
                                    </div>
                                    {row.content?.video_url ? (
                                      <div className="space-y-3">
                                        <CampaignSubmittedVideo
                                          key={row.id}
                                          videoUrl={row.content.video_url}
                                          fileSize={row.content.video_file_size}
                                        />
                                        {row.content.published_link ? (
                                          <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                                            <span className="truncate text-xs font-bold text-emerald-900">{t("campaigns.publishedPost")}</span>
                                            <a href={safeHttpUrl(row.content.published_link)} target="_blank" rel="noreferrer" className="text-xs font-bold text-emerald-700 hover:underline">
                                              {t("campaigns.viewPost")} ↗
                                            </a>
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : (
                                      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-4 text-center text-xs text-slate-400 italic">{t("campaigns.noVideo")}</p>
                                    )}
                                    {row.revision_details ? (
                                      <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs text-rose-900">
                                        <span className="mb-0.5 flex items-center gap-1 font-bold">
                                          <AlertTriangle size={12} className="text-rose-600" /> {t("campaigns.lastRevision")}
                                        </span>
                                        {row.revision_details}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>

                                {canManage ? (
                                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                      <h4 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                                        <CheckCircle2 size={16} className="text-brand-primary" />
                                        {t("campaigns.decisionTitle")}
                                      </h4>
                                      <span className="text-xs text-slate-400">{t("campaigns.decisionHint")}</span>
                                    </div>
                                    <div className="flex flex-col items-start gap-3 sm:flex-row">
                                      <textarea
                                        value={revisionFeedback[row.id] ?? row.revision_details ?? ""}
                                        onChange={(event) => setRevisionFeedback((prev) => ({ ...prev, [row.id]: event.target.value }))}
                                        placeholder={t("campaigns.revisionPh")}
                                        className="h-20 w-full flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-800 outline-none transition-all focus:border-brand-primary focus:bg-white"
                                      />
                                      <div className="flex w-full shrink-0 gap-2 sm:w-48 sm:flex-col">
                                        <button
                                          type="button"
                                          disabled={updatingId === row.id}
                                          onClick={() => requestRevision(row)}
                                          className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-xs font-bold text-rose-700 transition-all hover:bg-rose-100 disabled:opacity-50"
                                        >
                                          <AlertTriangle size={14} /> {t("campaigns.requestRevision")}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={updatingId === row.id}
                                          onClick={() => approveMaterial(row)}
                                          className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-100 transition-all hover:bg-emerald-700 disabled:opacity-50"
                                        >
                                          <Check size={14} /> {t("campaigns.approveMaterial")}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}

      <CreateCampaignModal
        open={open}
        onClose={() => setOpen(false)}
        isAdmin={isAdmin}
        companies={companies}
        defaultCompanyId={user.company?.id}
        onCreated={load}
      />
      {approvingCampaign ? (
        <ApproveAgencyCampaignModal
          campaign={approvingCampaign}
          onClose={() => setApprovingCampaign(null)}
          onApproved={() => {
            setApprovingCampaign(null);
            load();
          }}
        />
      ) : null}
    </div>
  );
}

export function CampaignsScreen() {
  return (
    <AuthenticatedShell>
      <CampaignsInner />
    </AuthenticatedShell>
  );
}
