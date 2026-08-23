"use client";

import { FormEvent, useState } from "react";
import {
  Camera,
  Clapperboard,
  FileText,
  Gift,
  Handshake,
  Instagram,
  Layers,
  Lock,
  Megaphone,
  Package,
  Sparkles,
  Video,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { CampaignImageUpload } from "@/components/CampaignImageUpload";
import { AgencyFeePercentField } from "@/components/AgencyFeePercentField";
import { Select2Field } from "@/components/Select2Field";
import { api } from "@/lib/api";
import { DEFAULT_AGENCY_FEE_PERCENT, parseAgencyFeePercent } from "@/lib/agency-fee";
import { alertApiError, alertSuccess, alertWarning } from "@/lib/alerts";
import { cn } from "@/lib/cn";
import type { Company } from "@/lib/types";
import { moneyCurrency } from "@/lib/geo";
import { usePrivacy } from "@/lib/privacy";

type Tab = "geral" | "entregas" | "briefing";
type Flow = "script_and_video" | "video_only" | "script_only";

function formatSummary(counts: Record<string, number>) {
  const parts: string[] = [];
  if (counts.reels) parts.push(`${counts.reels}x Reel${counts.reels > 1 ? "s" : ""}`);
  if (counts.stories) parts.push(`${counts.stories}x Stories`);
  if (counts.tiktok) parts.push(`${counts.tiktok}x TikTok`);
  if (counts.ugc) parts.push(`${counts.ugc}x UGC`);
  if (counts.posts) parts.push(`${counts.posts}x Feed/Post${counts.posts > 1 ? "s" : ""}`);
  if (counts.youtube) parts.push(`${counts.youtube}x YouTube`);
  return parts.join(" + ");
}

function QtyCard({
  icon: Icon,
  iconClass,
  title,
  hint,
  value,
  onChange,
}: {
  icon: typeof Clapperboard;
  iconClass: string;
  title: string;
  hint: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
      <div className="flex items-center gap-2">
        <div className={cn("rounded-lg p-1.5", iconClass)}>
          <Icon size={16} />
        </div>
        <div>
          <span className="block text-xs font-bold text-slate-800">{title}</span>
          <span className="text-[10px] text-slate-400">{hint}</span>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-slate-50 p-1">
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))} className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white font-black text-slate-700 hover:bg-slate-100">
          -
        </button>
        <span className="text-sm font-black text-slate-900">{value}</span>
        <button type="button" onClick={() => onChange(value + 1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white font-black text-slate-700 hover:bg-slate-100">
          +
        </button>
      </div>
    </div>
  );
}

export function CreateCampaignModal({
  open,
  onClose,
  isAdmin,
  companies,
  defaultCompanyId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  companies: Company[];
  defaultCompanyId?: number | null;
  onCreated: () => void;
}) {
  const { t } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const { formatCurrency } = usePrivacy();
  const [tab, setTab] = useState<Tab>("geral");
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState("");
  const [agencyFeePercent, setAgencyFeePercent] = useState(String(DEFAULT_AGENCY_FEE_PERCENT));
  const [creatorCache, setCreatorCache] = useState("");
  const [isSecret, setIsSecret] = useState(false);
  const [isDirect, setIsDirect] = useState(false);
  const [isBarter, setIsBarter] = useState(false);
  const [barterDetails, setBarterDetails] = useState("");
  const [flow, setFlow] = useState<Flow>("script_and_video");
  const [reels, setReels] = useState(0);
  const [stories, setStories] = useState(0);
  const [tiktok, setTiktok] = useState(0);
  const [ugc, setUgc] = useState(0);
  const [posts, setPosts] = useState(0);
  const [youtube, setYoutube] = useState(0);
  const [summary, setSummary] = useState("");
  const [deadlineDays, setDeadlineDays] = useState(5);
  const [guidelines, setGuidelines] = useState("");
  const [briefing, setBriefing] = useState({
    product: "",
    key_message: "",
    must_have: "",
    donts: "",
    cta: "",
    coupon: "",
    hashtags: "",
    link: "",
  });
  const selectedCompany = companies.find((company) => String(company.id) === (isAdmin ? companyId : String(defaultCompanyId || "")));
  const currency = moneyCurrency(selectedCompany);

  if (!open) return null;

  const counts = { reels, stories, tiktok, ugc, posts, youtube };
  const autoSummary = formatSummary(counts);

  function reset() {
    setTab("geral");
    setName("");
    setCompanyId("");
    setImageUrl("");
    setStartDate("");
    setEndDate("");
    setBudget("");
    setAgencyFeePercent(String(DEFAULT_AGENCY_FEE_PERCENT));
    setCreatorCache("");
    setIsSecret(false);
    setIsDirect(false);
    setIsBarter(false);
    setBarterDetails("");
    setFlow("script_and_video");
    setReels(0);
    setStories(0);
    setTiktok(0);
    setUgc(0);
    setPosts(0);
    setYoutube(0);
    setSummary("");
    setDeadlineDays(5);
    setGuidelines("");
    setBriefing({ product: "", key_message: "", must_have: "", donts: "", cta: "", coupon: "", hashtags: "", link: "" });
  }

  function close() {
    reset();
    onClose();
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || (isAdmin && !companyId) || !startDate || !endDate) {
      setTab("geral");
      await alertWarning(tc("alerts.incompleteTitle"), t("campaigns.incomplete"));
      return;
    }
    if (!isAdmin) {
      const own = companies.find((company) => company.id === defaultCompanyId);
      if (own && own.status !== "active") {
        await alertWarning(t("campaigns.companyNotApproved"), t("campaigns.companyNotApprovedText"));
        return;
      }
    } else {
      const selected = companies.find((company) => String(company.id) === companyId);
      if (selected && selected.status !== "active") {
        await alertWarning(t("campaigns.companyNotApproved"), t("campaigns.companyNotApprovedText"));
        return;
      }
    }
    if (!isBarter && (!creatorCache.trim() || Number(creatorCache) <= 0)) {
      setTab("geral");
      await alertWarning(tc("alerts.incompleteTitle"), t("campaigns.creatorCacheRequired"));
      return;
    }
    const feePercent = parseAgencyFeePercent(agencyFeePercent);
    if (isAdmin && !isBarter && feePercent == null) {
      setTab("geral");
      await alertWarning(tc("alerts.incompleteTitle"), t("campaigns.agencyFeeInvalid"));
      return;
    }
    setSaving(true);
    try {
      const created = await api.createCampaign({
        name: name.trim(),
        company_id: isAdmin ? Number(companyId) : defaultCompanyId,
        start_date: startDate,
        end_date: endDate,
        total_budget: isBarter ? 0 : budget ? Number(budget) : null,
        creator_cache: creatorCache ? Number(creatorCache) : null,
        agency_fee_percent: isAdmin ? feePercent ?? DEFAULT_AGENCY_FEE_PERCENT : undefined,
        image_url: imageUrl || null,
        is_secret: isSecret,
        is_direct_contract: isDirect,
        is_barter: isBarter,
        barter_details: isBarter ? barterDetails : null,
        status: "briefing",
        approval_flow: flow,
        deliverables: {
          reels,
          stories,
          tiktok,
          ugc,
          posts,
          youtube,
          summary: summary.trim() || autoSummary || null,
          deadline_days: deadlineDays,
          guidelines: guidelines || null,
        },
        briefing,
      });
      await alertSuccess(created.data.status === "pending_agency" ? t("campaigns.createdPending") : t("campaigns.created"));
      reset();
      onClose();
      onCreated();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setSaving(false);
    }
  }

  const tabBtn = (id: Tab, Icon: typeof Megaphone, label: string, dot?: boolean) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded-t-xl border-b-2 px-4 py-2.5 text-xs font-bold transition-all",
        tab === id ? "border-brand-primary bg-white text-brand-primary shadow-xs" : "border-transparent text-slate-500 hover:text-slate-800",
      )}
    >
      <Icon size={14} /> {label}
      {dot ? <span className="h-2 w-2 rounded-full bg-emerald-500" /> : null}
    </button>
  );

  const flowCard = (id: Flow, Icon: typeof FileText, title: string, hint: string, badge: string, recommended?: boolean) => (
    <button
      type="button"
      onClick={() => setFlow(id)}
      className={cn(
        "flex cursor-pointer flex-col justify-between gap-2 rounded-2xl border p-3.5 text-left transition-all",
        flow === id ? "border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-2 ring-indigo-500/20" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-black">
          <Icon size={14} className={flow === id ? "text-indigo-600" : "text-slate-400"} />
          {title}
        </span>
        <span className={cn("flex h-4 w-4 items-center justify-center rounded-full border text-[10px]", flow === id ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300")}>
          {flow === id ? "✓" : ""}
        </span>
      </div>
      <p className="text-[10px] leading-snug text-slate-500">{hint}</p>
      <span className={cn("self-start rounded-md border px-2 py-0.5 text-[9px] font-bold", recommended ? "border-indigo-100 bg-white/80 text-indigo-600" : "border-slate-200 bg-white/80 text-slate-600")}>
        {badge}
      </span>
    </button>
  );

  return (
    <div className="app-modal-overlay fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-3 sm:p-4">
      <button type="button" className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={close} aria-label={tc("close")} />
      <div className="app-modal-panel relative z-10 my-auto flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-white p-5 sm:p-6">
          <div>
            <h2 className="text-xl font-black text-[#0F172A]">{t("campaigns.modalTitle")}</h2>
            <p className="mt-0.5 text-xs text-[#64748B]">{t("campaigns.modalSubtitle")}</p>
          </div>
          <button type="button" onClick={close} className="rounded-lg p-1 font-bold text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            ✕
          </button>
        </div>

        <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-slate-200 bg-slate-50/70 px-4 pt-2 hide-scrollbar sm:px-6">
          {tabBtn("geral", Megaphone, t("campaigns.stepGeneral"))}
          {tabBtn("entregas", Package, t("campaigns.stepDeliverables"), reels + stories + tiktok + ugc + posts + youtube > 0)}
          {tabBtn("briefing", FileText, t("campaigns.stepBriefing"))}
        </div>

        <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
          <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
            {tab === "geral" ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.name")} *</label>
                  <input placeholder={t("campaigns.namePh")} className="w-full rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium outline-none focus:border-brand-primary" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                {isAdmin ? (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.company")} *</label>
                    <Select2Field theme="light" placeholder={t("campaigns.companyPh")} value={companyId} options={companies.map((company) => ({ value: String(company.id), label: company.name }))} onChange={setCompanyId} />
                  </div>
                ) : null}

                <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3">
                  <CampaignImageUpload value={imageUrl} onChange={setImageUrl} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.startDate")} *</label>
                    <input type="date" className="w-full rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-semibold outline-none focus:border-brand-primary" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.endDate")} *</label>
                    <input type="date" className="w-full rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-semibold outline-none focus:border-brand-primary" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>

                <div className={`grid gap-4 ${isAdmin ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2"}`}>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.creatorCache", { currency })}{!isBarter ? " *" : ""}</label>
                    <input type="number" min="0" step="0.01" placeholder={t("campaigns.creatorCachePh")} disabled={isBarter} className="w-full rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-semibold outline-none focus:border-brand-primary disabled:bg-slate-100" value={creatorCache} onChange={(e) => setCreatorCache(e.target.value)} />
                    <span className="text-[10px] leading-relaxed text-[#64748B]">{t("campaigns.creatorCacheHint")}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.budget", { currency })}</label>
                      {isBarter ? <span className="text-[10px] font-bold text-amber-600">{t("campaigns.budgetOptional")}</span> : null}
                    </div>
                    <input type="number" placeholder={t("campaigns.budgetPh")} className="w-full rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-semibold outline-none focus:border-brand-primary" value={budget} onChange={(e) => setBudget(e.target.value)} />
                  </div>
                  {isAdmin ? (
                    <AgencyFeePercentField
                      value={agencyFeePercent}
                      onChange={setAgencyFeePercent}
                      totalBudget={isBarter ? 0 : budget ? Number(budget) : 0}
                      formatCurrency={(amount) => formatCurrency(amount, currency)}
                      disabled={isBarter}
                    />
                  ) : null}
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <input type="checkbox" checked={isSecret} onChange={(e) => setIsSecret(e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600" />
                  <span>
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <Lock size={12} className="text-rose-500" /> {t("campaigns.secretTitle")}
                    </span>
                    <span className="mt-1 block text-[10px] leading-relaxed text-[#64748B]">{t("campaigns.secretHint")}</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                  <input type="checkbox" checked={isDirect} onChange={(e) => setIsDirect(e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600" />
                  <span>
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <Handshake size={12} className="text-emerald-600" /> {t("campaigns.directTitle")}
                    </span>
                    <span className="mt-1 block text-[10px] leading-relaxed text-[#64748B]">{t("campaigns.directHint")}</span>
                  </span>
                </label>
                <div className="flex flex-col gap-3 rounded-xl border border-amber-100 bg-amber-50/40 p-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input type="checkbox" checked={isBarter} onChange={(e) => setIsBarter(e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-600" />
                    <span>
                      <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <Gift size={12} className="text-amber-500" /> {t("campaigns.barterTitle")}
                      </span>
                      <span className="mt-1 block text-[10px] leading-relaxed text-[#64748B]">{t("campaigns.barterHint")}</span>
                    </span>
                  </label>
                  {isBarter ? (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.barterDetailsLabel")}</label>
                      <textarea value={barterDetails} onChange={(e) => setBarterDetails(e.target.value)} placeholder={t("campaigns.barterDetailsPh")} className="h-20 w-full resize-none rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs outline-none focus:border-brand-primary" />
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            {tab === "entregas" ? (
              <>
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                  <div className="mb-1 flex items-center gap-2 text-xs font-bold text-indigo-900">
                    <Package size={16} className="text-brand-primary" /> {t("campaigns.packTitle")}
                  </div>
                  <p className="text-[11px] leading-relaxed text-indigo-700/80">{t("campaigns.packHint")}</p>
                </div>
                <div className="space-y-2">
                  <label className="block text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.approvalLabel")}</label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {flowCard("script_and_video", FileText, t("campaigns.flowScriptVideo"), t("campaigns.flowScriptVideoHint"), t("campaigns.flowScriptVideoBadge"), true)}
                    {flowCard("video_only", Video, t("campaigns.flowVideo"), t("campaigns.flowVideoHint"), t("campaigns.flowVideoBadge"))}
                    {flowCard("script_only", FileText, t("campaigns.flowScript"), t("campaigns.flowScriptHint"), t("campaigns.flowScriptBadge"))}
                  </div>
                </div>
                <div>
                  <label className="mb-2.5 block text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.qtyLabel")}</label>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <QtyCard icon={Clapperboard} iconClass="bg-indigo-50 text-indigo-600" title={t("campaigns.fmtReels")} hint={t("campaigns.fmtReelsHint")} value={reels} onChange={setReels} />
                    <QtyCard icon={Instagram} iconClass="bg-amber-50 text-amber-600" title={t("campaigns.fmtStories")} hint={t("campaigns.fmtStoriesHint")} value={stories} onChange={setStories} />
                    <QtyCard icon={Clapperboard} iconClass="bg-rose-50 text-rose-600" title={t("campaigns.fmtTiktok")} hint={t("campaigns.fmtTiktokHint")} value={tiktok} onChange={setTiktok} />
                    <QtyCard icon={Camera} iconClass="bg-teal-50 text-teal-600" title={t("campaigns.fmtUgc")} hint={t("campaigns.fmtUgcHint")} value={ugc} onChange={setUgc} />
                    <QtyCard icon={Layers} iconClass="bg-emerald-50 text-emerald-600" title={t("campaigns.fmtPosts")} hint={t("campaigns.fmtPostsHint")} value={posts} onChange={setPosts} />
                    <QtyCard icon={Video} iconClass="bg-red-50 text-red-600" title={t("campaigns.fmtYoutube")} hint={t("campaigns.fmtYoutubeHint")} value={youtube} onChange={setYoutube} />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.summaryLabel")}</label>
                    <button type="button" onClick={() => setSummary(autoSummary)} className="text-[10px] font-bold text-brand-primary hover:underline">
                      {t("campaigns.summaryAuto")}
                    </button>
                  </div>
                  <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder={autoSummary || t("campaigns.summaryPh")} className="w-full rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-semibold outline-none focus:border-brand-primary" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.deadlineLabel")}</label>
                  <div className="flex items-center gap-3">
                    <input type="number" min={1} max={60} value={deadlineDays} onChange={(e) => setDeadlineDays(Number(e.target.value) || 5)} className="w-32 rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm font-bold outline-none focus:border-brand-primary" />
                    <span className="text-xs font-medium text-slate-500">{t("campaigns.deadlineHint")}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.guidelinesLabel")}</label>
                  <textarea value={guidelines} onChange={(e) => setGuidelines(e.target.value)} placeholder={t("campaigns.guidelinesPh")} className="h-24 w-full resize-none rounded-lg border border-[#E2E8F0] px-3.5 py-2.5 text-xs text-slate-700 outline-none focus:border-brand-primary" />
                </div>
              </>
            ) : null}

            {tab === "briefing" ? (
              <>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-1 flex items-center gap-2 text-xs font-bold text-slate-900">
                    <FileText size={16} className="text-brand-primary" /> {t("campaigns.briefingBoxTitle")}
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500">{t("campaigns.briefingBoxHint")}</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.briefingProduct")}</label>
                  <input value={briefing.product} onChange={(e) => setBriefing({ ...briefing, product: e.target.value })} placeholder={t("campaigns.briefingProductPh")} className="w-full rounded-lg border border-[#E2E8F0] px-4 py-2 text-xs font-medium outline-none focus:border-brand-primary" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.briefingMessage")}</label>
                  <textarea value={briefing.key_message} onChange={(e) => setBriefing({ ...briefing, key_message: e.target.value })} placeholder={t("campaigns.briefingMessagePh")} className="h-16 w-full resize-none rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs outline-none focus:border-brand-primary" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold tracking-wider text-emerald-700 uppercase">{t("campaigns.briefingMust")}</label>
                    <textarea value={briefing.must_have} onChange={(e) => setBriefing({ ...briefing, must_have: e.target.value })} placeholder={t("campaigns.briefingMustPh")} className="h-20 w-full resize-none rounded-lg border border-emerald-200 bg-emerald-50/20 px-3 py-2 text-xs outline-none focus:border-emerald-500" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold tracking-wider text-rose-700 uppercase">{t("campaigns.briefingDonts")}</label>
                    <textarea value={briefing.donts} onChange={(e) => setBriefing({ ...briefing, donts: e.target.value })} placeholder={t("campaigns.briefingDontsPh")} className="h-20 w-full resize-none rounded-lg border border-rose-200 bg-rose-50/20 px-3 py-2 text-xs outline-none focus:border-rose-500" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-wider text-brand-primary uppercase">{t("campaigns.briefingCta")}</label>
                  <input value={briefing.cta} onChange={(e) => setBriefing({ ...briefing, cta: e.target.value })} placeholder={t("campaigns.briefingCtaPh")} className="w-full rounded-lg border border-[#E2E8F0] px-4 py-2 text-xs font-medium outline-none focus:border-brand-primary" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.briefingCoupon")}</label>
                    <input value={briefing.coupon} onChange={(e) => setBriefing({ ...briefing, coupon: e.target.value })} placeholder={t("campaigns.briefingCouponPh")} className="w-full rounded-lg border border-[#E2E8F0] px-4 py-2 text-xs font-medium outline-none focus:border-brand-primary" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.briefingHashtags")}</label>
                    <input value={briefing.hashtags} onChange={(e) => setBriefing({ ...briefing, hashtags: e.target.value })} placeholder={t("campaigns.briefingHashtagsPh")} className="w-full rounded-lg border border-[#E2E8F0] px-4 py-2 text-xs font-medium outline-none focus:border-brand-primary" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.briefingLink")}</label>
                  <input value={briefing.link} onChange={(e) => setBriefing({ ...briefing, link: e.target.value })} placeholder="https://..." className="w-full rounded-lg border border-[#E2E8F0] px-4 py-2 text-xs font-medium outline-none focus:border-brand-primary" />
                </div>
              </>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#E2E8F0] bg-white px-5 py-4 sm:px-6">
            <button type="button" onClick={close} className="rounded-xl border border-[#E2E8F0] px-5 py-2.5 text-sm font-bold text-[#64748B] hover:bg-slate-50">
              {tc("cancel")}
            </button>
            <div className="flex items-center gap-2">
              {tab === "geral" ? (
                <button type="button" onClick={() => setTab("entregas")} className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-200">
                  {t("campaigns.nextDeliverables")}
                </button>
              ) : null}
              {tab === "entregas" ? (
                <button type="button" onClick={() => setTab("briefing")} className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-200">
                  {t("campaigns.nextBriefing")}
                </button>
              ) : null}
              <button disabled={saving} className="flex items-center gap-1.5 rounded-xl bg-brand-primary px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-600 disabled:opacity-60">
                <Sparkles size={16} /> {t("campaigns.saveCreate")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
