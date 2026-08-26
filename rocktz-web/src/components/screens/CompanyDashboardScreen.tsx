"use client";

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Copy,
  DollarSign,
  Eye,
  EyeOff,
  FileText,
  Heart,
  Layers,
  Megaphone,
  Plus,
  RefreshCw,
  Repeat,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { AppModal } from "@/components/AppModal";
import { ApproveAgencyCampaignModal } from "@/components/ApproveAgencyCampaignModal";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { Select2Field } from "@/components/Select2Field";
import { UserAvatar } from "@/components/UserAvatar";
import { CampaignSubmittedVideo } from "@/components/CampaignSubmittedVideo";
import { api } from "@/lib/api";
import { isPendingAgency } from "@/lib/agency-approval";
import { alertApiError, alertConfirm, alertSuccess, alertWarning } from "@/lib/alerts";
import { cn } from "@/lib/cn";
import { formatLocation, moneyCurrency } from "@/lib/geo";
import { usePrivacy } from "@/lib/privacy";
import type { Campaign, Company, CompanyLandingPage, Creator, PlanningItem, RecurringContract } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { intlLocale, normalizeLocale } from "@/i18n/locales";

type DashTab = "overview" | "campaigns" | "recurring" | "favorites";

type PendingApproval = {
  key: string;
  source: "campaign" | "recurring";
  stage: "script" | "video" | "recurring";
  title: string;
  creatorName: string;
  creatorPhoto?: string | null;
  participationId?: number;
  planningId?: number;
  href: string;
  demandStatus: string;
  approvalStatus: string;
  script?: string | null;
  videoUrl?: string | null;
  videoFileSize?: number | null;
};

function demandStatusTone(status: string) {
  if (status === "approved" || status === "published" || status === "finished") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (status === "review" || status === "production" || status === "in_production" || status === "approval") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (status === "revision" || status === "rejected") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function approvalStatusTone(status: string) {
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "revision") return "border-rose-200 bg-rose-50 text-rose-800";
  if (status === "submitted" || status === "sent") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function hasApprovalMaterial(item: PendingApproval) {
  return Boolean(item.script?.trim() || item.videoUrl?.trim());
}

function isActiveCampaign(status: string) {
  return status === "briefing" || status === "selection" || status === "production";
}

function CompanyDashboardInner() {
  const user = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, i18n } = useTranslation("app");
  const { formatCurrency, hideValues, toggleHideValues } = usePrivacy();
  const locale = intlLocale(normalizeLocale(i18n.language));
  const isAdmin = user.role === "admin";
  const queryCompanyId = Number(searchParams.get("companyId") || 0);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [recurring, setRecurring] = useState<RecurringContract[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [landing, setLanding] = useState<CompanyLandingPage | null>(null);
  const [tab, setTab] = useState<DashTab>("overview");
  const [loading, setLoading] = useState(true);
  const [favSearch, setFavSearch] = useState("");
  const [materialItem, setMaterialItem] = useState<PendingApproval | null>(null);
  const [approvingCampaign, setApprovingCampaign] = useState<Campaign | null>(null);

  const companyId = isAdmin
    ? (queryCompanyId || companies[0]?.id || 0)
    : (user.company?.id ?? 0);

  useEffect(() => {
    if (!isAdmin) return;
    api.companies().then((res) => setCompanies(res.data)).catch(alertApiError);
  }, [isAdmin]);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      api.company(companyId).then((res) => setCompany(res.data)),
      api.campaigns("?include=content").then((res) => setCampaigns(res.data.filter((item) => item.company_id === companyId))),
      api.recurring("?include=items").then((res) => setRecurring(res.data.filter((item) => item.company_id === companyId))),
      api.creators().then((res) => setCreators(res.data)),
      api.companyLanding(companyId).then((res) => setLanding(res.data)).catch(() => setLanding(null)),
    ])
      .catch(alertApiError)
      .finally(() => setLoading(false));
  }, [companyId]);

  function selectCompany(id: string) {
    router.replace(`/company-dashboard?companyId=${id}`);
  }

  const activeCampaigns = useMemo(
    () => campaigns.filter((campaign) => isActiveCampaign(campaign.status)),
    [campaigns],
  );
  const finishedCampaigns = useMemo(
    () => campaigns.filter((campaign) => campaign.status === "finished"),
    [campaigns],
  );
  const activeRecurring = useMemo(
    () => recurring.filter((contract) => contract.status === "active"),
    [recurring],
  );
  const pendingAgencyCampaigns = useMemo(
    () => campaigns.filter((campaign) => isPendingAgency(campaign.status)),
    [campaigns],
  );
  const pendingAgencyRecurring = useMemo(
    () => recurring.filter((contract) => isPendingAgency(contract.status)),
    [recurring],
  );
  const pendingAgencyCount = pendingAgencyCampaigns.length + pendingAgencyRecurring.length;

  async function approveAgencyCampaign(campaign: Campaign) {
    setApprovingCampaign(campaign);
  }

  async function approveAgencyRecurring(contract: RecurringContract) {
    try {
      await api.approveRecurringAgency(contract.id);
      await alertSuccess(t("recurring.approvedAgency"));
      setRecurring((current) => current.map((item) => (item.id === contract.id ? { ...item, status: "active" } : item)));
    } catch (err) {
      await alertApiError(err);
    }
  }

  const allApplications = useMemo(
    () => campaigns.flatMap((campaign) => (campaign.applications ?? []).map((row) => ({ campaign, row }))),
    [campaigns],
  );

  const castingCreatorIds = useMemo(() => {
    const ids = new Set<number>();
    for (const { row } of allApplications) {
      if (row.application_status === "approved" || !row.application_status) ids.add(row.creator_id);
    }
    for (const contract of activeRecurring) {
      for (const row of contract.creators ?? []) ids.add(row.creator_id);
    }
    return ids;
  }, [allApplications, activeRecurring]);

  const publishedDeliveries = allApplications.filter(
    ({ row }) => row.delivery_status === "published" || row.delivery_status === "approved",
  ).length;

  const plannedDeliveries = allApplications.length + activeRecurring.reduce((acc, contract) => {
    return acc + (contract.creators ?? []).reduce((sum, row) => {
      const d = row.monthly_deliverables ?? {};
      return sum + Object.values(d).reduce((n, v) => n + (Number(v) || 0), 0);
    }, 0);
  }, 0);

  const campaignBudget = campaigns.reduce((sum, campaign) => {
    if (campaign.is_barter || campaign.is_direct_contract) return sum;
    return sum + (Number(campaign.total_budget) || 0);
  }, 0);

  const contractMonthlyValue = (contract: RecurringContract) => {
    if (contract.monthly_fee) return Number(contract.monthly_fee);
    return (contract.creators ?? []).reduce((inner, row) => inner + (Number(row.monthly_cache ?? row.monthly_fee) || 0), 0);
  };

  const recurringMonthly = activeRecurring.reduce((sum, contract) => sum + contractMonthlyValue(contract), 0);

  const pendingApprovals = useMemo(() => {
    const items: PendingApproval[] = [];

    for (const { campaign, row } of allApplications) {
      const name = row.creator?.artistic_name || row.creator?.full_name || "—";
      const staged = (campaign.approval_flow || "script_and_video") === "script_and_video";
      const material = {
        script: row.content?.script ?? null,
        videoUrl: row.content?.video_url ?? null,
        videoFileSize: row.content?.video_file_size ?? null,
      };
      if (row.script_status === "submitted" || row.script_status === "revision"
        || (row.delivery_status === "sent" && row.content?.script && !row.content?.video_url && row.script_status !== "approved")) {
        items.push({
          key: `script-${row.id}`,
          source: "campaign",
          stage: "script",
          title: t("companyDash.overview.scriptTitle", { name: campaign.name }),
          creatorName: name,
          creatorPhoto: row.creator?.photo_url,
          participationId: row.id,
          href: `/campaigns/${campaign.id}?tab=entregas`,
          demandStatus: row.delivery_status || campaign.status,
          approvalStatus: row.script_status || "submitted",
          ...material,
        });
      }
      const scriptReady = staged ? row.script_status === "approved" : true;
      if (scriptReady && (row.video_status === "submitted" || row.video_status === "revision"
        || (row.delivery_status === "sent" && row.content?.video_url && row.video_status !== "approved"))) {
        items.push({
          key: `video-${row.id}`,
          source: "campaign",
          stage: "video",
          title: t("companyDash.overview.videoTitle", { name: campaign.name }),
          creatorName: name,
          creatorPhoto: row.creator?.photo_url,
          participationId: row.id,
          href: `/campaigns/${campaign.id}?tab=entregas`,
          demandStatus: row.delivery_status || campaign.status,
          approvalStatus: row.video_status || row.delivery_status || "submitted",
          ...material,
        });
      }
    }

    for (const contract of recurring) {
      for (const item of (contract.items ?? []) as PlanningItem[]) {
        const staged = (item.approval_flow || "script_and_video") === "script_and_video";
        const name = item.creator?.artistic_name || item.creator?.full_name || "—";
        const material = {
          script: item.script ?? null,
          videoUrl: item.media_url || item.submission_url || null,
        };
        if (item.script_status === "submitted" || item.script_status === "revision") {
          items.push({
            key: `recurring-script-${item.id}`,
            source: "recurring",
            stage: "script",
            title: t("companyDash.overview.scriptTitle", { name: item.title || contract.title }),
            creatorName: name,
            creatorPhoto: item.creator?.photo_url,
            planningId: item.id,
            href: `/campaign-deliveries?tab=recurring`,
            demandStatus: item.status,
            approvalStatus: item.script_status || "submitted",
            ...material,
          });
        }
        const scriptReady = staged ? item.script_status === "approved" : true;
        const videoPending = item.video_status === "submitted"
          || item.video_status === "revision"
          || (item.status === "review" && Boolean(item.media_url || item.submission_url) && item.script_status !== "submitted");
        if (scriptReady && videoPending) {
          items.push({
            key: `recurring-video-${item.id}`,
            source: "recurring",
            stage: "video",
            title: t("companyDash.overview.videoTitle", { name: item.title || contract.title }),
            creatorName: name,
            creatorPhoto: item.creator?.photo_url,
            planningId: item.id,
            href: `/campaign-deliveries?tab=recurring`,
            demandStatus: item.status,
            approvalStatus: item.video_status || "submitted",
            ...material,
          });
        } else if (!staged && item.status === "review" && item.script_status !== "submitted" && item.video_status !== "submitted") {
          items.push({
            key: `recurring-${item.id}`,
            source: "recurring",
            stage: "recurring",
            title: item.title || contract.title,
            creatorName: name,
            creatorPhoto: item.creator?.photo_url,
            planningId: item.id,
            href: `/recurring/${contract.id}`,
            demandStatus: item.status,
            approvalStatus: item.video_status || item.script_status || item.status,
            ...material,
          });
        }
      }
    }

    return items;
  }, [allApplications, recurring, t]);

  const favorites = creators.filter((creator) => creator.status === "active" && company?.favorite_creator_ids?.includes(creator.id));
  const pendingInviteCreators = creators.filter(
    (creator) => creator.status === "review" && creator.invited_by_company_id === company?.id,
  );
  const favQuery = favSearch.trim().toLowerCase();
  const favoriteList = (favQuery
    ? favorites.filter((creator) => `${creator.artistic_name} ${creator.full_name ?? ""} ${Object.values(creator.socials || {}).join(" ")}`.toLowerCase().includes(favQuery))
    : favorites);

  function demandStatusLabel(status: string) {
    if (status === "sent") return t("campaignDetail.inReview");
    if (status === "pending") return t("campaignDetail.waiting");
    if (status === "revision") return t("campaignDetail.adjustments");
    return t(`status.${status}`, { defaultValue: status });
  }

  function approvalStatusLabel(status: string) {
    if (status === "submitted" || status === "sent") return t("companyDash.overview.approvalWaiting");
    if (status === "revision") return t("companyDash.overview.approvalRevision");
    return t(`status.${status}`, { defaultValue: t("status.pending") });
  }

  async function copyInviteCode() {
    if (!company?.creator_invite_code) return;
    try {
      await navigator.clipboard.writeText(company.creator_invite_code);
      await alertSuccess(t("companyDash.inviteCode.copied"));
    } catch {
      await alertWarning(t("companyDash.inviteCode.copyFailTitle"), t("companyDash.inviteCode.copyFail"));
    }
  }

  async function rotateInviteCode() {
    if (!company) return;
    if (!(await alertConfirm(t("companyDash.inviteCode.regenerateTitle"), t("companyDash.inviteCode.regenerateText"), t("companyDash.inviteCode.regenerateConfirm")))) {
      return;
    }
    try {
      const res = await api.rotateCompanyInviteCode(company.id);
      setCompany(res.data);
      await alertSuccess(t("companyDash.inviteCode.regenerated"));
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function openMaterial(item: PendingApproval) {
    if (!hasApprovalMaterial(item)) {
      await alertWarning(t("companyDash.overview.noMaterialTitle"), t("companyDash.overview.noMaterial"));
      return;
    }
    setMaterialItem(item);
  }

  async function approvePending(item: PendingApproval) {
    try {
      if (item.participationId) {
        if (item.stage === "script") {
          await api.updateParticipation(item.participationId, { script_status: "approved", script_feedback: "" });
        } else {
          await api.updateParticipation(item.participationId, {
            video_status: "approved",
            delivery_status: "approved",
            video_feedback: "",
          });
        }
      } else if (item.planningId) {
        if (item.stage === "script") {
          await api.updatePlanningItem(item.planningId, {
            script_status: "approved",
            script_feedback: "",
            status: "in_production",
            feedback_note: "",
          });
        } else if (item.stage === "video") {
          await api.updatePlanningItem(item.planningId, {
            video_status: "approved",
            video_feedback: "",
            status: "approved",
            feedback_note: "",
          });
        } else {
          await api.updatePlanningItem(item.planningId, { status: "approved", feedback_note: "" });
        }
      }
      await alertSuccess(
        item.stage === "script"
          ? t("deliveries.inbox.scriptApprovedWaiting")
          : t("companyDash.overview.approvedOk"),
      );
      const [campRes, recRes] = await Promise.all([api.campaigns("?include=content"), api.recurring("?include=items")]);
      setCampaigns(campRes.data.filter((item) => item.company_id === companyId));
      setRecurring(recRes.data.filter((item) => item.company_id === companyId));
    } catch (err) {
      await alertApiError(err);
    }
  }

  if (!companyId && !loading) {
    return <p className="text-sm text-slate-500">{t("companyDash.noCompany")}</p>;
  }

  if (loading || !company) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-t-2 border-b-2 border-brand-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-8 pb-16">
      <header className="flex min-w-0 flex-col justify-between gap-6 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-md sm:p-6 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <span className="inline-block max-w-full truncate rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[10px] font-black tracking-widest text-indigo-600 uppercase">
            {t("companyDash.header.badge")}
          </span>
          <div className="mt-3 flex min-w-0 items-center gap-3">
            <UserAvatar
              src={company.logo_url}
              name={company.name}
              size="custom"
              shape="rounded-xl"
              className="h-12 w-12 shrink-0 border border-slate-200 shadow-xs"
              textClassName="text-base font-black"
            />
            <h1 className="m-0 truncate text-xl font-extrabold text-[#0F172A] sm:text-2xl">{company.name}</h1>
          </div>
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[#64748B]">{t("companyDash.header.hint")}</p>
        </div>

        {isAdmin ? (
          <div className="flex w-full min-w-0 shrink-0 flex-col gap-2 md:w-[280px]">
            <label className="truncate text-[10px] font-extrabold tracking-wider text-slate-500 uppercase">{t("companyDash.header.selectCompany")}</label>
            <Select2Field
              theme="light"
              value={String(companyId)}
              options={companies.map((row) => ({ value: String(row.id), label: row.name }))}
              onChange={selectCompany}
              placeholder={t("companyDash.header.selectCompanyPh")}
            />
          </div>
        ) : null}
      </header>

      <div className="flex min-w-0 flex-col justify-between gap-4 overflow-hidden rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 shadow-sm sm:flex-row sm:items-center sm:p-5">
        <div className="min-w-0">
          <p className="m-0 text-[10px] font-extrabold tracking-wider text-indigo-600 uppercase">{t("companyDash.inviteCode.title")}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-indigo-900/80">{company.status === "pending" ? t("companyDash.inviteCode.pendingHint") : t("companyDash.inviteCode.hint")}</p>
        </div>
        <div className="flex min-w-0 items-center gap-2 sm:w-[280px]">
          <code className="flex-1 truncate rounded-lg border border-indigo-200 bg-white px-3 py-2 text-center text-sm font-black tracking-[0.18em] text-slate-900">
            {company.creator_invite_code || "—"}
          </code>
          <button type="button" onClick={copyInviteCode} title={t("companyDash.inviteCode.copy")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50">
            <Copy size={15} />
          </button>
          <button type="button" onClick={rotateInviteCode} title={t("companyDash.inviteCode.regenerate")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      <div className="flex min-w-0 flex-col justify-between gap-4 overflow-hidden rounded-2xl border border-violet-100 bg-violet-50/70 p-4 shadow-sm sm:flex-row sm:items-center sm:p-5">
        <div className="min-w-0">
          <p className="m-0 text-[10px] font-extrabold tracking-wider text-violet-700 uppercase">{t("companyLanding.title")}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-violet-950/80">
            {t("companyLanding.metrics.signups")}: {landing?.metrics?.signups_completed ?? 0}
            {" · "}
            {t("status.pending")}: {landing?.metrics?.pending ?? 0}
            {" · "}
            {t("companyLanding.metrics.approved")}: {landing?.metrics?.approved ?? 0}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={isAdmin ? `/company-landing?companyId=${companyId}` : "/company-landing"} className="rounded-lg bg-violet-700 px-3 py-2 text-[11px] font-bold text-white hover:bg-violet-800">
            {t("companyLanding.title")}
          </Link>
          <Link href={isAdmin ? `/company-landing/signups?companyId=${companyId}` : "/company-landing/signups"} className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-[11px] font-bold text-violet-800">
            {t("companyLanding.viewSignups")}
          </Link>
        </div>
      </div>

      {company.status === "pending" ? (
        <div className="flex min-w-0 flex-col items-start justify-between gap-4 overflow-hidden rounded-2xl border-2 border-amber-400/60 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 p-4 shadow-sm sm:flex-row sm:items-center sm:p-5">
          <div className="flex min-w-0 items-start gap-3.5 sm:items-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
              <Clock size={22} className="shrink-0" />
            </div>
            <div className="min-w-0">
              <h4 className="m-0 truncate text-sm font-bold text-amber-950">
                {isAdmin ? t("companyDash.pending.adminTitle") : t("companyDash.pending.companyTitle")}
              </h4>
              <p className="mt-0.5 line-clamp-2 max-w-xl text-xs text-amber-800">
                {isAdmin ? t("companyDash.pending.adminBody") : t("companyDash.pending.companyBody")}
              </p>
            </div>
          </div>
          {isAdmin ? (
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await api.approveCompany(company.id);
                  setCompany(res.data);
                  await alertSuccess(t("companyDash.pending.approvedOk"));
                } catch (err) {
                  await alertApiError(err);
                }
              }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold whitespace-nowrap text-white shadow-md hover:bg-emerald-700"
            >
              <CheckCircle2 size={16} className="shrink-0" /> {t("companyDash.pending.approve")}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
        <KpiCard
          icon={DollarSign}
          label={t("companyDash.kpi.budgetLabel")}
          value={formatCurrency(campaignBudget, moneyCurrency(company))}
          hint={t("companyDash.kpi.budgetHint")}
          action={(
            <button
              type="button"
              onClick={toggleHideValues}
              title={hideValues ? t("companyDash.kpi.toggleValuesShow") : t("companyDash.kpi.toggleValuesHide")}
              className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
            >
              {hideValues ? <EyeOff size={16} className="shrink-0 text-amber-600" /> : <Eye size={16} className="shrink-0" />}
            </button>
          )}
        />
        <KpiCard
          icon={Megaphone}
          label={t("companyDash.kpi.activeCampaignsLabel")}
          value={(
            <>
              {activeCampaigns.length}{" "}
              <span className="text-sm font-semibold text-slate-500">{t("companyDash.kpi.activeWord")}</span>
            </>
          )}
          hint={t("companyDash.kpi.finishedHint", { count: finishedCampaigns.length })}
        />
        <KpiCard
          icon={Users}
          label={t("companyDash.kpi.castingLabel")}
          value={String(castingCreatorIds.size)}
          hint={t("companyDash.kpi.castingHint")}
        />
        <KpiCard
          icon={CheckCircle2}
          label={t("companyDash.kpi.publishedLabel")}
          value={(
            <>
              {publishedDeliveries}
              <span className="text-sm font-semibold text-slate-400">
                {" / "}
                {Math.max(plannedDeliveries, allApplications.length)}
              </span>
            </>
          )}
          hint={t("companyDash.kpi.publishedHint")}
        />
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
        <div className="flex min-w-0 flex-nowrap gap-4 border-b border-slate-200 sm:gap-6">
          {([
            ["overview", Sparkles, t("companyDash.tabs.overview"), "text-indigo-600"],
            ["campaigns", Megaphone, t("companyDash.tabs.campaigns", { count: campaigns.length }), "text-indigo-600"],
            ["recurring", Repeat, t("companyDash.tabs.recurring", { count: activeRecurring.length }), "text-purple-600"],
            ["favorites", Heart, t("companyDash.tabs.favorites"), "text-indigo-600"],
          ] as const).map(([key, Icon, label, activeColor]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "relative flex shrink-0 cursor-pointer items-center gap-2 border-none bg-transparent pb-3 text-xs font-extrabold tracking-wider whitespace-nowrap uppercase outline-none transition-all sm:text-sm",
                tab === key ? `${activeColor} font-black` : "text-slate-400 hover:text-slate-600",
              )}
            >
              <Icon size={16} className="shrink-0" />
              <span>{label}</span>
              {tab === key ? <span className={cn("absolute inset-x-0 bottom-0 h-0.5", key === "recurring" ? "bg-purple-600" : "bg-indigo-600")} /> : null}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" ? (
        <div className="flex min-w-0 flex-col gap-8">
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
            <MetricMini icon={Layers} iconClass="bg-indigo-50 text-indigo-600" label={t("companyDash.overview.opsLabel")} value={String(activeCampaigns.length + activeRecurring.length)} hint={t("companyDash.overview.opsHint", { camps: activeCampaigns.length, recurring: activeRecurring.length })} />
            <MetricMini icon={Users} iconClass="bg-purple-50 text-purple-600" label={t("companyDash.overview.creatorsLabel")} value={String(castingCreatorIds.size)} hint={t("companyDash.overview.creatorsHint")} />
            <MetricMini
              icon={CheckCircle2}
              iconClass="bg-emerald-50 text-emerald-600"
              label={t("companyDash.overview.publishedLabel")}
              value={(
                <>
                  {publishedDeliveries}
                  <span className="text-base font-semibold text-slate-400 sm:text-lg">
                    {" / "}
                    {Math.max(plannedDeliveries, allApplications.length)}
                  </span>
                </>
              )}
              hint={t("companyDash.overview.publishedPlannedHint")}
            />
            <MetricMini icon={DollarSign} iconClass="bg-amber-50 text-amber-600" label={t("companyDash.overview.investmentLabel")} value={formatCurrency(campaignBudget + recurringMonthly, moneyCurrency(company))} hint={t("companyDash.overview.investmentHint")} />
          </div>

          <div className="flex min-w-0 flex-col gap-4 overflow-hidden rounded-2xl border border-amber-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex min-w-0 flex-col justify-between gap-2 border-b border-amber-100 pb-3 sm:flex-row sm:items-center">
              <h3 className="m-0 truncate text-sm font-black tracking-wider text-slate-900 uppercase">
                {t("companyDash.inviteCode.pendingTitle", { count: pendingInviteCreators.length })}
              </h3>
              <Link href="/creators?status=review" className="text-[11px] font-bold text-brand-primary hover:underline">
                {t("companyDash.inviteCode.viewCasting")}
              </Link>
            </div>
            {pendingInviteCreators.length === 0 ? (
              <p className="m-0 text-sm text-slate-500">{t("companyDash.inviteCode.pendingEmpty")}</p>
            ) : (
              <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
                {pendingInviteCreators.map((creator) => (
                  <article key={creator.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                    <Link href={`/creators/${creator.id}`} className="flex min-w-0 items-center gap-3">
                      <UserAvatar src={creator.photo_url} name={creator.artistic_name} size="custom" shape="rounded-xl" className="h-10 w-10 shrink-0" textClassName="text-xs" />
                      <div className="min-w-0">
                        <h4 className="m-0 truncate text-sm font-bold text-slate-900">@{creator.artistic_name}</h4>
                        {creator.full_name ? <p className="m-0 truncate text-[11px] text-slate-500">{creator.full_name}</p> : null}
                      </div>
                    </Link>
                    <button
                      type="button"
                      className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700"
                      onClick={async () => {
                        try {
                          await api.approveCreator(creator.id);
                          setCreators((current) => current.map((row) => (row.id === creator.id ? { ...row, status: "active" } : row)));
                          await alertSuccess(t("creators.approved"));
                        } catch (err) {
                          await alertApiError(err);
                        }
                      }}
                    >
                      {t("creators.approve")}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex min-w-0 flex-col justify-between gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-2">
                <div className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-amber-500" />
                <h3 className="m-0 flex min-w-0 items-center gap-2 text-sm font-black tracking-wider text-slate-900 uppercase">
                  <Clock size={16} className="shrink-0 text-amber-600" />
                  <span className="truncate">{t("companyDash.overview.approvalsTitle", { count: pendingApprovals.length })}</span>
                </h3>
              </div>
              <span className="shrink-0 text-xs font-medium text-slate-400 sm:max-w-[280px] sm:truncate">{t("companyDash.overview.approvalsHint")}</span>
            </div>

            {pendingApprovals.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <CheckCircle2 size={28} className="shrink-0 text-emerald-500" />
                <p className="m-0 text-xs font-bold text-slate-700">{t("companyDash.overview.approvalsEmpty")}</p>
                <span className="text-[11px] text-slate-400">{t("companyDash.overview.approvalsEmptyHint")}</span>
              </div>
            ) : (
              <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pendingApprovals.map((item) => (
                  <div key={item.key} className="flex min-w-0 flex-col gap-3 overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50 p-4 shadow-xs">
                    <div className="flex min-w-0 flex-col gap-2">
                      <span className={cn(
                        "w-fit max-w-full truncate rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase",
                        item.stage === "script" ? "border-amber-200 bg-amber-100 text-amber-800"
                          : item.stage === "video" ? "border-purple-200 bg-purple-100 text-purple-800"
                            : "border-indigo-200 bg-indigo-100 text-indigo-800",
                      )}>
                        {item.stage === "script" ? t("companyDash.overview.stageScript") : item.stage === "video" ? t("companyDash.overview.stageVideo") : t("companyDash.overview.stageRecurring")}
                      </span>
                      <h4 className="m-0 truncate text-xs font-bold text-slate-900">{item.title}</h4>
                      <div className="flex min-w-0 items-center gap-2">
                        <UserAvatar src={item.creatorPhoto} name={item.creatorName} size="custom" shape="circle" className="h-6 w-6 shrink-0 border border-slate-200" textClassName="text-[10px]" />
                        <span className="truncate text-xs font-semibold text-slate-700">@{item.creatorName}</span>
                      </div>
                      <div className="mt-1 flex flex-col gap-1.5 rounded-lg border border-slate-200/80 bg-white p-2.5">
                        <div className="flex min-w-0 items-center justify-between gap-2">
                          <span className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">{t("companyDash.overview.demandStatus")}</span>
                          <span className={cn("max-w-[60%] truncate rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase", demandStatusTone(item.demandStatus))}>
                            {demandStatusLabel(item.demandStatus)}
                          </span>
                        </div>
                        <div className="flex min-w-0 items-center justify-between gap-2">
                          <span className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">{t("companyDash.overview.approvalStatus")}</span>
                          <span className={cn("max-w-[60%] truncate rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase", approvalStatusTone(item.approvalStatus))}>
                            {approvalStatusLabel(item.approvalStatus)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 border-t border-slate-200/60 pt-3 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => void openMaterial(item)}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] font-bold whitespace-nowrap text-slate-700 hover:bg-slate-100"
                      >
                        <FileText size={12} className="shrink-0" /> {t("companyDash.overview.viewMaterial")}
                      </button>
                      <Link
                        href={item.href}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] font-bold whitespace-nowrap text-slate-700 hover:bg-slate-100"
                      >
                        <Eye size={12} className="shrink-0" /> {t("companyDash.overview.review")}
                      </Link>
                      <button
                        type="button"
                        onClick={() => void approvePending(item)}
                        className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-2 text-[11px] font-bold whitespace-nowrap text-white hover:bg-emerald-700"
                      >
                        <CheckCircle2 size={12} className="shrink-0" /> {t("companyDash.overview.approve")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-2 lg:gap-8">
            {pendingAgencyCount > 0 ? (
              <div className="lg:col-span-2 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                <div className="mb-3 flex items-start gap-2">
                  <Clock size={16} className="mt-0.5 shrink-0 text-amber-700" />
                  <div>
                    <h3 className="m-0 text-xs font-black tracking-wider text-amber-950 uppercase">{t("companyDash.agencyPending.title", { count: pendingAgencyCount })}</h3>
                    <p className="m-0 mt-1 text-[11px] font-medium text-amber-900">{t("companyDash.agencyPending.hint")}</p>
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {pendingAgencyCampaigns.map((campaign) => (
                    <div key={`camp-${campaign.id}`} className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2.5">
                      <Link href={`/campaigns/${campaign.id}`} className="min-w-0 truncate text-xs font-bold text-slate-800 hover:text-brand-primary">
                        {campaign.name}
                        <span className="ml-2 text-[10px] font-semibold text-amber-700">{t("companyDash.agencyPending.campaign")}</span>
                      </Link>
                      {isAdmin ? (
                        <button type="button" onClick={() => void approveAgencyCampaign(campaign)} className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-black text-white uppercase hover:bg-emerald-700">
                          {t("companyDash.agencyPending.approve")}
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {pendingAgencyRecurring.map((contract) => (
                    <div key={`rec-${contract.id}`} className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2.5">
                      <Link href={`/recurring/${contract.id}`} className="min-w-0 truncate text-xs font-bold text-slate-800 hover:text-brand-primary">
                        {contract.title}
                        <span className="ml-2 text-[10px] font-semibold text-amber-700">{t("companyDash.agencyPending.recurring")}</span>
                      </Link>
                      {isAdmin ? (
                        <button type="button" onClick={() => void approveAgencyRecurring(contract)} className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-black text-white uppercase hover:bg-emerald-700">
                          {t("companyDash.agencyPending.approve")}
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <SectionCard
              icon={<Megaphone size={18} className="shrink-0 text-indigo-600" />}
              title={t("companyDash.overview.activeCampaignsTitle", { count: activeCampaigns.length })}
              actionLabel={t("companyDash.overview.viewAll")}
              actionClass="text-indigo-600"
              onAction={() => setTab("campaigns")}
            >
              {activeCampaigns.length === 0 ? (
                <EmptyDashed>{t("companyDash.overview.noActiveCampaigns")}</EmptyDashed>
              ) : (
                <div className="flex flex-col gap-3">
                  {activeCampaigns.map((campaign) => {
                    const rows = campaign.applications ?? [];
                    const done = rows.filter((row) => row.delivery_status === "approved" || row.delivery_status === "published").length;
                    return (
                      <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="flex min-w-0 flex-col gap-2.5 overflow-hidden rounded-xl border border-slate-200/90 p-4 shadow-xs transition-all hover:border-indigo-400 hover:bg-indigo-50/20">
                        <div className="min-w-0">
                          <h4 className="m-0 truncate text-xs font-black text-slate-900">{campaign.name}</h4>
                          <span className="block truncate text-[10px] font-medium text-slate-400">
                            {t("companyDash.overview.dateRange", {
                              start: campaign.start_date || t("companyDash.overview.dateEmpty"),
                              end: campaign.end_date || t("companyDash.overview.dateEmpty"),
                            })}
                          </span>
                        </div>
                        <div className="flex min-w-0 items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px]">
                          <span className="flex min-w-0 items-center gap-1 truncate font-semibold text-slate-500">
                            <Users size={12} className="shrink-0 text-indigo-600" />
                            <span className="truncate">{t("companyDash.overview.creatorsAllocated", { count: rows.length })}</span>
                          </span>
                          <span className="shrink-0 font-bold whitespace-nowrap text-emerald-700">{t("companyDash.overview.deliveriesDone", { done, total: rows.length })}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full bg-indigo-600 transition-all" style={{ width: `${rows.length ? (done / rows.length) * 100 : 0}%` }} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <SectionCard
              icon={<Repeat size={18} className="shrink-0 text-purple-600" />}
              title={t("companyDash.overview.activeRecurringTitle", { count: activeRecurring.length })}
              actionLabel={t("companyDash.overview.viewCalendar")}
              actionClass="text-purple-600"
              onAction={() => setTab("recurring")}
            >
              {activeRecurring.length === 0 ? (
                <EmptyDashed>{t("companyDash.overview.noActiveRecurring")}</EmptyDashed>
              ) : (
                <div className="flex flex-col gap-3">
                  {activeRecurring.map((contract) => (
                    <Link key={contract.id} href={`/recurring/${contract.id}`} className="min-w-0 overflow-hidden rounded-xl border border-slate-200/90 p-4 shadow-xs transition-all hover:border-purple-400 hover:bg-purple-50/20">
                      <h4 className="m-0 truncate text-xs font-black text-slate-900">{contract.title}</h4>
                      <p className="mt-1 truncate text-[10px] text-slate-400">
                        {t("companyDash.overview.creatorsAllocated", { count: contract.creators?.length ?? 0 })}
                        {" · "}
                        {t("companyDash.overview.monthFee", { value: formatCurrency(contractMonthlyValue(contract), moneyCurrency(contract)) })}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      ) : null}

      {tab === "campaigns" ? (
        <div className="min-w-0 space-y-4">
          {user.role === "company" || isAdmin ? (
            <div className="flex justify-end">
              <Link href="/campaigns?new=true" className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2 text-xs font-bold text-white hover:bg-indigo-600">
                <Plus size={14} /> {t("companyDash.campaignsTab.new")}
              </Link>
            </div>
          ) : null}
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          {campaigns.length === 0 ? <EmptyDashed className="md:col-span-2">{t("companyDash.campaignsTab.empty")}</EmptyDashed> : null}
          {campaigns.map((campaign) => (
            <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-indigo-300">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <h3 className="m-0 min-w-0 truncate font-black text-slate-900">{campaign.name}</h3>
                <span className="shrink-0 rounded-md border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold tracking-wider whitespace-nowrap text-indigo-700 uppercase">
                  {t(`status.${campaign.status}`, { defaultValue: campaign.status })}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-slate-500">{campaign.objective || t("companyDash.campaignsTab.noObjective")}</p>
            </Link>
          ))}
        </div>
        </div>
      ) : null}

      {tab === "recurring" ? (
        <div className="min-w-0 space-y-3">
          {user.role === "company" || isAdmin ? (
            <div className="flex justify-end">
              <Link href="/recurring" className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2 text-xs font-bold text-white hover:bg-indigo-600">
                <Plus size={14} /> {t("companyDash.recurringTab.new")}
              </Link>
            </div>
          ) : null}
          {recurring.length === 0 ? <EmptyDashed>{t("companyDash.recurringTab.empty")}</EmptyDashed> : null}
          {recurring.map((row) => (
            <Link key={row.id} href={`/recurring/${row.id}`} className="block min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-purple-300">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <h3 className="m-0 min-w-0 truncate font-black text-slate-900">{row.title}</h3>
                <span className="shrink-0 rounded-md border border-purple-100 bg-purple-50 px-2 py-0.5 text-[10px] font-bold tracking-wider whitespace-nowrap text-purple-700 uppercase">
                  {t(`status.${row.status}`, { defaultValue: row.status })}
                </span>
              </div>
              <p className="mt-2 truncate text-xs text-slate-500">
                {t("companyDash.recurringTab.monthFee", { value: formatCurrency(contractMonthlyValue(row), moneyCurrency(row)) })}
              </p>
            </Link>
          ))}
        </div>
      ) : null}

      {tab === "favorites" ? (
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <input
              value={favSearch}
              onChange={(e) => setFavSearch(e.target.value)}
              placeholder={t("companyDash.favoritesTab.searchPh")}
              className="h-11 w-full max-w-md rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-brand-primary"
            />
            <Link href="/creators" className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-brand-primary px-4 text-xs font-bold text-white shadow-sm hover:bg-indigo-600">
              <Users size={14} />
              {t("companyDash.favoritesTab.viewCatalog")}
            </Link>
          </div>
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            {favoriteList.length === 0 ? <EmptyDashed className="md:col-span-2">{t("companyDash.favoritesTab.empty")}</EmptyDashed> : null}
            {favoriteList.map((creator) => (
              <article key={creator.id} className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <Link href={`/creators/${creator.id}`} className="flex min-w-0 items-center gap-3">
                  <UserAvatar src={creator.photo_url} name={creator.artistic_name} size="custom" shape="rounded-xl" className="h-12 w-12 shrink-0" textClassName="text-sm" />
                  <div className="min-w-0">
                    <h3 className="m-0 truncate font-black text-slate-900">@{creator.artistic_name}</h3>
                    <p className="m-0 truncate text-sm text-slate-500">{formatLocation(locale, creator) || "—"}</p>
                  </div>
                </Link>
                <button
                  type="button"
                  className="mt-3 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold whitespace-nowrap text-white"
                  onClick={async () => {
                    try {
                      const res = await api.toggleFavorite(company.id, creator.id);
                      setCompany(res.data);
                    } catch (err) {
                      await alertApiError(err);
                    }
                  }}
                >
                  {t("companyDash.favoritesTab.unfavorite")}
                </button>
              </article>
            ))}
          </div>
          <div className="min-w-0 border-t border-slate-100 pt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="m-0 truncate text-xs font-extrabold tracking-wider text-slate-500 uppercase">{t("companyDash.favoritesTab.browse")}</h4>
              <Link href="/creators" className="text-[11px] font-bold text-brand-primary hover:underline">
                {t("companyDash.favoritesTab.viewCatalog")}
              </Link>
            </div>
            <div className="grid min-w-0 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {creators.filter((creator) => creator.status === "active" && !company.favorite_creator_ids?.includes(creator.id)).slice(0, 12).map((creator) => (
                <article key={creator.id} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-4">
                  <Link href={`/creators/${creator.id}`} className="block min-w-0">
                    <h3 className="m-0 truncate text-sm font-bold text-slate-900 hover:text-brand-primary">@{creator.artistic_name}</h3>
                    <p className="m-0 mt-0.5 truncate text-[11px] text-slate-500">{formatLocation(locale, creator) || "—"}</p>
                  </Link>
                  <button
                    type="button"
                    className="mt-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold whitespace-nowrap text-slate-700 hover:bg-slate-50"
                    onClick={async () => {
                      try {
                        const res = await api.toggleFavorite(company.id, creator.id);
                        setCompany(res.data);
                      } catch (err) {
                        await alertApiError(err);
                      }
                    }}
                  >
                    {t("companyDash.favoritesTab.favor")}
                  </button>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {approvingCampaign ? (
        <ApproveAgencyCampaignModal
          campaign={approvingCampaign}
          onClose={() => setApprovingCampaign(null)}
          onApproved={(updated) => {
            setApprovingCampaign(null);
            setCampaigns((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
          }}
        />
      ) : null}
      {materialItem ? (
        <AppModal onClose={() => setMaterialItem(null)} zIndexClassName="z-[110]" panelClassName="max-w-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="min-w-0">
              <p className="m-0 text-[10px] font-bold tracking-wider text-slate-400 uppercase">{t("companyDash.overview.materialTitle")}</p>
              <h3 className="m-0 mt-1 truncate text-sm font-black text-slate-900">{materialItem.title}</h3>
              <p className="m-0 mt-0.5 truncate text-xs font-semibold text-slate-500">@{materialItem.creatorName}</p>
            </div>
            <button type="button" onClick={() => setMaterialItem(null)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <X size={16} />
            </button>
          </div>
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-5">
            {materialItem.script?.trim() ? (
              <div>
                <p className="mb-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase">{t("companyDash.overview.stageScript")}</p>
                <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-800">{materialItem.script}</pre>
              </div>
            ) : null}
            {materialItem.videoUrl?.trim() ? (
              <div>
                <p className="mb-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase">{t("companyDash.overview.stageVideo")}</p>
                <CampaignSubmittedVideo videoUrl={materialItem.videoUrl} fileSize={materialItem.videoFileSize} compact />
              </div>
            ) : null}
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
            <Link
              href={materialItem.href}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              onClick={() => setMaterialItem(null)}
            >
              <Eye size={13} /> {t("companyDash.overview.review")}
            </Link>
            <button type="button" onClick={() => setMaterialItem(null)} className="rounded-xl bg-brand-primary px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-600">
              {t("companyDash.overview.closeMaterial")}
            </button>
          </div>
        </AppModal>
      ) : null}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  action,
}: {
  icon: typeof Layers;
  label: string;
  value: ReactNode;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 sm:h-12 sm:w-12">
            <Icon size={22} className="shrink-0" />
          </div>
          <span className="min-w-0 pt-1 text-[10px] leading-snug font-bold tracking-wider text-slate-400 uppercase sm:text-xs">
            {label}
          </span>
        </div>
        {action}
      </div>
      <div className="min-w-0">
        <div className="text-xl leading-tight font-black break-words text-slate-900 tabular-nums sm:text-2xl">
          {value}
        </div>
        {hint ? <span className="mt-1 block text-[10px] leading-snug text-slate-400 sm:text-[11px]">{hint}</span> : null}
      </div>
    </div>
  );
}

function MetricMini({
  icon: Icon,
  iconClass,
  label,
  value,
  hint,
}: {
  icon: typeof Layers;
  iconClass: string;
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12", iconClass)}>
          <Icon size={22} className="shrink-0" />
        </div>
        <span className="min-w-0 pt-1 text-[10px] leading-snug font-extrabold tracking-wider text-slate-400 uppercase">
          {label}
        </span>
      </div>
      <div className="min-w-0">
        <div className="text-xl leading-tight font-black break-words text-slate-900 tabular-nums sm:text-2xl">
          {value}
        </div>
        {hint ? <span className="mt-1 block text-xs leading-snug font-semibold text-slate-500">{hint}</span> : null}
      </div>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  actionLabel,
  actionClass,
  onAction,
  children,
}: {
  icon: ReactNode;
  title: string;
  actionLabel: string;
  actionClass: string;
  onAction: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex min-w-0 items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <h3 className="m-0 truncate text-sm font-black tracking-wider text-slate-900 uppercase">{title}</h3>
        </div>
        <button type="button" onClick={onAction} className={cn("flex shrink-0 cursor-pointer items-center gap-1 text-xs font-bold whitespace-nowrap hover:underline", actionClass)}>
          {actionLabel} <ArrowRight size={12} className="shrink-0" />
        </button>
      </div>
      {children}
    </div>
  );
}

function EmptyDashed({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-400", className)}>
      {children}
    </div>
  );
}

export function CompanyDashboardScreen() {
  return (
    <AuthenticatedShell>
      <Suspense fallback={
        <div className="flex h-64 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-t-2 border-b-2 border-brand-primary" />
        </div>
      }>
        <CompanyDashboardInner />
      </Suspense>
    </AuthenticatedShell>
  );
}
