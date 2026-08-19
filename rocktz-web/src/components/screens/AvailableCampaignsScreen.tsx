"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  ExternalLink,
  FileText,
  Gift,
  Info,
  Layers,
  Megaphone,
  Search,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { api } from "@/lib/api";
import { alertApiError, alertSuccess, alertWarning } from "@/lib/alerts";
import { cn } from "@/lib/cn";
import { usePrivacy } from "@/lib/privacy";
import type { Campaign, CampaignCreator } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { intlLocale, normalizeLocale } from "@/i18n/locales";

const EXTRA_NICHES = ["ugc", "fashion", "tech", "lifestyle", "food"] as const;
type FormatFilter = "all" | "paid" | "barter";
type ViewMode = "grid" | "detailed";

function briefingStr(campaign: Campaign, key: string) {
  const value = campaign.briefing?.[key];
  return typeof value === "string" && value.trim() ? value : "";
}

function cacheValue(campaign: Campaign) {
  return Number(campaign.creator_cache || campaign.creators_budget || 0);
}

function AvailableInner() {
  const user = useAuth();
  const { t, i18n } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const { formatCurrency } = usePrivacy();
  const locale = intlLocale(normalizeLocale(i18n.language));
  const isCreator = user.role === "creator";
  const canApply = isCreator && (user.creator?.status === "active" || user.creator?.status === "review");

  const [items, setItems] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [format, setFormat] = useState<FormatFilter>("all");
  const [segment, setSegment] = useState("all");
  const [view, setView] = useState<ViewMode>("grid");
  const [briefing, setBriefing] = useState<Campaign | null>(null);
  const [applying, setApplying] = useState<Campaign | null>(null);
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);

  async function load() {
    try {
      setItems((await api.availableCampaigns()).data);
    } catch (err) {
      await alertApiError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const myApps = useMemo(() => {
    const map: Record<number, CampaignCreator> = {};
    if (!user.creator?.id) return map;
    for (const campaign of items) {
      const row = campaign.applications?.find((app) => app.creator_id === user.creator?.id);
      if (row) map[campaign.id] = row;
    }
    return map;
  }, [items, user.creator?.id]);

  const companySegments = [...new Set(items.map((c) => c.company?.segment).filter((s): s is string => Boolean(s)))];
  const segmentOptions = ["all", ...companySegments, ...EXTRA_NICHES.filter((n) => !companySegments.includes(n))];

  const filtered = items.filter((campaign) => {
    const companyName = campaign.company?.name || "";
    const companySegment = campaign.company?.segment || "";
    const product = briefingStr(campaign, "product");
    const keyMessage = briefingStr(campaign, "key_message");
    const term = search.trim().toLowerCase();
    const textMatch =
      !term ||
      campaign.name.toLowerCase().includes(term) ||
      companyName.toLowerCase().includes(term) ||
      companySegment.toLowerCase().includes(term) ||
      product.toLowerCase().includes(term) ||
      (campaign.objective || "").toLowerCase().includes(term) ||
      keyMessage.toLowerCase().includes(term);
    if (!textMatch) return false;
    if (segment !== "all") {
      const label = t(`available.niches.${segment}`, { defaultValue: segment }).toLowerCase();
      const match =
        companySegment.toLowerCase().includes(segment.toLowerCase()) ||
        product.toLowerCase().includes(label) ||
        campaign.name.toLowerCase().includes(label) ||
        companySegment.toLowerCase().includes(label);
      if (!match) return false;
    }
    if (format === "barter" && !campaign.is_barter) return false;
    if (format === "paid" && campaign.is_barter) return false;
    return true;
  });

  function statusLabel(status: string, long = false) {
    if (status === "briefing") return t("available.statusBriefing");
    return long ? t("available.statusSelectionLong") : t("available.statusSelection");
  }

  function fmtDate(value?: string | null) {
    return value ? new Date(`${value}T00:00:00`).toLocaleDateString(locale) : t("available.toDefine");
  }

  function openApply(campaign: Campaign) {
    setBriefing(null);
    setApplying(campaign);
    setNotes("");
  }

  async function onApply(event: FormEvent) {
    event.preventDefault();
    if (!applying) return;
    if (!notes.trim()) {
      await alertWarning(t("available.notesRequired"), t("available.notesRequiredText"));
      return;
    }
    setSending(true);
    try {
      await api.applyCampaign(applying.id, {
        notes: notes.trim(),
        amount: cacheValue(applying) || null,
        delivery_type: applying.is_barter ? "barter" : "ugc",
      });
      await alertSuccess(t("available.sentTitle"), t("available.sent", { name: applying.name }));
      setApplying(null);
      setNotes("");
      load();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setSending(false);
    }
  }

  function ApplicationActions({ campaign, compact = false }: { campaign: Campaign; compact?: boolean }) {
    const mine = myApps[campaign.id];
    if (mine) {
      const badge =
        mine.application_status === "approved" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-extrabold text-emerald-700"><CheckCircle2 size={12} /> {t("available.selected")}</span>
        ) : mine.application_status === "rejected" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-500">{t("available.notSelected")}</span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700"><Clock size={12} /> {t("available.pending")}</span>
        );
      return (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex h-9 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50">{badge}</div>
          <button type="button" onClick={() => setBriefing(campaign)} className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-brand-primary hover:bg-slate-50">
            <FileText size={13} /> {t("available.seeBriefing")}
          </button>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setBriefing(campaign)} className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-slate-100 text-xs font-bold tracking-wider text-slate-800 uppercase hover:bg-slate-200">
          <FileText size={13} /> {compact ? t("available.briefing") : t("available.seeBriefing")}
        </button>
        {canApply ? (
          <button type="button" onClick={() => openApply(campaign)} className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-brand-primary text-xs font-bold tracking-wider text-white uppercase shadow-sm shadow-indigo-600/20 hover:bg-indigo-600">
            <Send size={13} /> {t("available.apply")}
          </button>
        ) : (
          <div />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-16">
      <div className="relative overflow-hidden rounded-[28px] border border-white/5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-8 text-white shadow-xl sm:p-10">
        <div className="relative z-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1 text-[11px] font-extrabold tracking-widest text-indigo-300 uppercase">
                <Sparkles size={13} className="text-indigo-300" /> {t("available.badge")}
              </span>
              <span className="rounded-lg border border-emerald-500/30 bg-emerald-950/60 px-3 py-1 text-[11px] font-extrabold tracking-wider text-emerald-300 uppercase">
                {t("available.openCount", { count: items.length })}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{t("available.title")}</h1>
            <p className="mt-2 text-xs leading-relaxed text-slate-300 sm:text-sm">{t("available.subtitle")}</p>
          </div>
          <div className="relative z-10 flex shrink-0 items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 font-medium backdrop-blur-md">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold tracking-wider text-indigo-200 uppercase">{t("available.opportunities")}</span>
              <span className="mt-0.5 text-2xl font-black text-white">{items.length}</span>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold tracking-wider text-indigo-200 uppercase">{t("available.myApps")}</span>
              <span className="mt-0.5 text-2xl font-black text-indigo-300">{Object.keys(myApps).length}</span>
            </div>
          </div>
        </div>
      </div>

      {user.creator?.status === "review" ? (
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border-2 border-amber-400/60 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 p-4 shadow-xs sm:flex-row sm:items-center sm:p-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm"><Clock size={20} /></div>
            <div>
              <h4 className="m-0 flex flex-wrap items-center gap-2 text-sm font-bold text-amber-950">
                {t("available.reviewTitle")}
                <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-extrabold text-amber-900 uppercase">{t("available.reviewBadge")}</span>
              </h4>
              <p className="mt-0.5 text-xs leading-relaxed text-amber-800">{t("available.reviewHint")}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-5 md:flex-row">
        <div className="relative w-full md:w-96">
          <Search size={16} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("available.searchPh")} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-8 pl-10 text-xs font-medium text-slate-900 outline-none focus:border-brand-primary focus:bg-white" />
          {search ? <button type="button" onClick={() => setSearch("")} className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-600"><X size={14} /></button> : null}
        </div>
        <div className="flex w-full items-center justify-between gap-3 overflow-x-auto md:w-auto md:justify-end">
          <div className="flex shrink-0 items-center rounded-xl border border-slate-200/60 bg-slate-100 p-1">
            {([["all", t("available.formatAll")], ["paid", t("available.formatPaid")], ["barter", t("available.formatBarter")]] as const).map(([key, label]) => (
              <button key={key} type="button" onClick={() => setFormat(key)} className={cn("flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all", format === key ? (key === "paid" ? "bg-white text-emerald-700 shadow-sm" : key === "barter" ? "bg-white text-purple-700 shadow-sm" : "bg-white text-slate-900 shadow-sm") : "text-slate-500 hover:text-slate-800")}>
                {key === "paid" ? <DollarSign size={13} /> : null}
                {key === "barter" ? <Gift size={13} /> : null}
                {label}
              </button>
            ))}
          </div>
          <div className="flex shrink-0 items-center rounded-xl border border-slate-200/60 bg-slate-100 p-1">
            <button type="button" onClick={() => setView("grid")} className={cn("flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold", view === "grid" ? "bg-white text-brand-primary shadow-sm" : "text-slate-500 hover:text-slate-800")}>
              <Layers size={14} /> {t("available.viewCards")}
            </button>
            <button type="button" onClick={() => setView("detailed")} className={cn("flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold", view === "detailed" ? "bg-white text-brand-primary shadow-sm" : "text-slate-500 hover:text-slate-800")}>
              <FileText size={14} /> {t("available.viewList")}
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="mr-1 shrink-0 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">{t("available.segments")}</span>
        {segmentOptions.slice(0, 8).map((value) => {
          const label = value === "all" ? t("available.segmentAll") : t(`available.niches.${value}`, { defaultValue: value.charAt(0).toUpperCase() + value.slice(1) });
          const active = segment === value;
          return (
            <button key={value} type="button" onClick={() => setSegment(value)} className={cn("shrink-0 cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-all", active ? "border-slate-900 bg-slate-900 text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50")}>
              {label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-16">
          <div className="h-9 w-9 animate-spin rounded-full border-t-2 border-b-2 border-brand-primary" />
        </div>
      ) : !filtered.length ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-slate-200 bg-white p-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-slate-400"><Sparkles size={28} /></div>
          <div className="max-w-md">
            <h3 className="text-base font-bold text-slate-900">{t("available.emptyTitle")}</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{t("available.emptyHint")}</p>
          </div>
          {search || segment !== "all" || format !== "all" ? (
            <button type="button" onClick={() => { setSearch(""); setSegment("all"); setFormat("all"); }} className="cursor-pointer rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200">{t("available.clearFilters")}</button>
          ) : null}
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((campaign) => {
            const cache = cacheValue(campaign);
            const segmentLabel = campaign.company?.segment ? t(`available.niches.${campaign.company.segment}`, { defaultValue: campaign.company.segment }) : t("available.advertising");
            return (
              <article key={campaign.id} className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:border-brand-primary hover:shadow-md">
                <div className="relative aspect-[16/10] overflow-hidden bg-slate-900">
                  {campaign.image_url ? <img src={campaign.image_url} alt={campaign.name} className="h-full w-full object-cover transition-all duration-500 group-hover:scale-105" referrerPolicy="no-referrer" /> : <div className="h-full w-full bg-gradient-to-br from-slate-800 via-indigo-950 to-slate-900" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute top-3 left-3">
                    <span className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-white uppercase backdrop-blur-md">
                      <Building2 size={11} className="text-indigo-300" /> {campaign.company?.name || t("available.partnerBrand")}
                    </span>
                  </div>
                  <div className="absolute top-3 right-3">
                    <span className="rounded-full bg-indigo-600 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white uppercase shadow-sm">{statusLabel(campaign.status)}</span>
                  </div>
                  <div className="absolute right-3 bottom-3 left-3 flex items-end justify-between text-white">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold tracking-wider text-indigo-200 uppercase">{campaign.is_barter ? t("available.compensation") : t("available.suggestedCache")}</span>
                      <span className="text-base font-black text-emerald-400">{campaign.is_barter ? t("available.barterPay") : formatCurrency(cache)}</span>
                    </div>
                    <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-medium text-slate-200 backdrop-blur-sm">{segmentLabel}</span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col justify-between gap-4 p-5">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-base leading-snug font-bold text-slate-900 transition-colors group-hover:text-brand-primary">{campaign.name}</h3>
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                      <Calendar size={13} className="shrink-0 text-slate-400" />
                      <span>{t("available.until", { start: fmtDate(campaign.start_date), end: fmtDate(campaign.end_date) })}</span>
                    </div>
                    {briefingStr(campaign, "product") ? (
                      <div className="flex flex-col gap-0.5 rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                        <span className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">{t("available.productFocus")}</span>
                        <span className="line-clamp-1 text-xs font-bold text-slate-800">{briefingStr(campaign, "product")}</span>
                      </div>
                    ) : null}
                    <p className="line-clamp-3 text-xs leading-relaxed text-slate-600">{campaign.objective || briefingStr(campaign, "key_message") || t("available.defaultObjective")}</p>
                  </div>
                  <div className="mt-2 border-t border-slate-100 pt-3">
                    <ApplicationActions campaign={campaign} compact />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {filtered.map((campaign) => {
            const cache = cacheValue(campaign);
            const mine = myApps[campaign.id];
            const segmentLabel = campaign.company?.segment ? t(`available.niches.${campaign.company.segment}`, { defaultValue: campaign.company.segment }) : t("available.advertising");
            return (
              <article key={campaign.id} className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all hover:border-brand-primary/80 lg:flex-row">
                <div className="relative h-56 shrink-0 overflow-hidden bg-slate-900 lg:h-auto lg:w-80">
                  {campaign.image_url ? <img src={campaign.image_url} alt={campaign.name} className="h-full w-full object-cover transition-all duration-500 group-hover:scale-105" referrerPolicy="no-referrer" /> : <div className="h-full w-full bg-gradient-to-br from-slate-800 via-indigo-950 to-slate-900" />}
                  <div className="absolute top-4 left-4">
                    <span className="inline-flex w-fit items-center gap-1 rounded-lg border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-white uppercase backdrop-blur-md">
                      <Building2 size={11} className="text-indigo-300" /> {campaign.company?.name || t("available.partnerBrand")}
                    </span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col justify-between gap-6 p-6 sm:p-8">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col justify-between gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
                      <div>
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider text-brand-primary uppercase">{statusLabel(campaign.status, true)}</span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-500 uppercase">{segmentLabel}</span>
                        </div>
                        <h2 className="text-xl font-black text-slate-900 transition-colors group-hover:text-brand-primary">{campaign.name}</h2>
                      </div>
                      <div className="hidden shrink-0 flex-col items-end lg:flex">
                        <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">{campaign.is_barter ? t("available.compensation") : t("available.suggestedCache")}</span>
                        <span className="text-xl font-black text-emerald-600">{campaign.is_barter ? t("available.barterPay") : formatCurrency(cache)}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
                      <div className="flex flex-col gap-1.5 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                        <span className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-wider text-slate-500 uppercase"><Info size={13} className="text-brand-primary" /> {t("available.objective")}</span>
                        <p className="m-0 leading-relaxed text-slate-700">{campaign.objective || t("available.defaultObjectiveLong")}</p>
                      </div>
                      <div className="flex flex-col gap-1.5 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                        <span className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-wider text-slate-500 uppercase"><Megaphone size={13} className="text-indigo-600" /> {t("available.productMessage")}</span>
                        <p className="m-0 font-semibold text-slate-800">{briefingStr(campaign, "product") ? t("available.focus", { product: briefingStr(campaign, "product") }) : t("available.defaultProduct")}</p>
                        <p className="m-0 mt-0.5 text-[11px] leading-relaxed text-slate-600">{briefingStr(campaign, "key_message") || t("available.defaultKey")}</p>
                      </div>
                      {briefingStr(campaign, "must_have") ? (
                        <div className="flex flex-col gap-1.5 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
                          <span className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-wider text-emerald-700 uppercase"><CheckCircle2 size={13} /> {t("available.mustHave")}</span>
                          <p className="m-0 text-[11px] leading-relaxed whitespace-pre-line text-slate-700">{briefingStr(campaign, "must_have")}</p>
                        </div>
                      ) : null}
                      {briefingStr(campaign, "donts") ? (
                        <div className="flex flex-col gap-1.5 rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
                          <span className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-wider text-rose-700 uppercase"><AlertCircle size={13} /> {t("available.donts")}</span>
                          <p className="m-0 text-[11px] leading-relaxed whitespace-pre-line text-slate-700">{briefingStr(campaign, "donts")}</p>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 font-semibold"><Calendar size={13} className="text-slate-400" /> {t("available.period", { start: fmtDate(campaign.start_date), end: fmtDate(campaign.end_date) })}</div>
                      {briefingStr(campaign, "hashtags") ? <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-1.5 font-mono text-[11px] text-indigo-700">{briefingStr(campaign, "hashtags")}</div> : null}
                      {briefingStr(campaign, "coupon") ? <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700">{t("available.coupon", { code: briefingStr(campaign, "coupon") })}</div> : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
                    <div className="text-xs font-medium text-slate-500">
                      {mine?.application_status === "approved" ? <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-100 px-3.5 py-1.5 text-xs font-black text-emerald-800"><CheckCircle2 size={14} /> {t("available.approvedLong")}</span>
                        : mine?.application_status === "rejected" ? <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3.5 py-1.5 text-xs font-bold text-slate-600">{t("available.rejectedLong")}</span>
                        : mine ? <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-100/80 px-3.5 py-1.5 text-xs font-bold text-amber-800"><Clock size={14} /> {t("available.pendingLong")}</span>
                        : t("available.applyHint")}
                    </div>
                    <div className="flex items-center gap-2.5">
                      <button type="button" onClick={() => setBriefing(campaign)} className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-slate-100 px-4 text-xs font-bold tracking-wider text-slate-800 uppercase hover:bg-slate-200">
                        <FileText size={14} /> {t("available.seeFullBriefing")}
                      </button>
                      {!mine && canApply ? (
                        <button type="button" onClick={() => openApply(campaign)} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-brand-primary px-6 text-xs font-bold tracking-wider text-white uppercase shadow-md shadow-indigo-600/20 hover:bg-indigo-600">
                          <Send size={14} /> {t("available.applyCampaign")}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {briefing ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-6">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-xl bg-indigo-50 p-2.5 text-brand-primary"><FileText size={20} /></div>
                  <div>
                    <h3 className="m-0 text-base font-bold text-slate-900">{briefing.name}</h3>
                    <p className="m-0 text-xs text-slate-400">{t("available.briefingSubtitle")}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setBriefing(null)} className="cursor-pointer rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X size={20} /></button>
              </div>
              <div className="flex flex-col gap-6 overflow-y-auto p-6 text-xs font-medium">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-1 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">{t("available.product")}</span>
                    <span className="text-sm font-bold text-slate-900">{briefingStr(briefing, "product") || t("available.notInformed")}</span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">{t("available.keyMessage")}</span>
                    <span className="text-xs font-bold text-slate-900">{briefingStr(briefing, "key_message") || t("available.notInformedF")}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                  <span className="flex items-center gap-1 text-[10px] font-extrabold tracking-wider text-emerald-700 uppercase"><CheckCircle2 size={13} /> {t("available.mustHaveTitle")}</span>
                  <p className="m-0 text-xs leading-relaxed whitespace-pre-line text-slate-800">{briefingStr(briefing, "must_have") || t("available.noExtra")}</p>
                </div>
                <div className="flex flex-col gap-1.5 rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
                  <span className="flex items-center gap-1 text-[10px] font-extrabold tracking-wider text-rose-700 uppercase"><AlertCircle size={13} /> {t("available.dontsTitle")}</span>
                  <p className="m-0 text-xs leading-relaxed whitespace-pre-line text-slate-800">{briefingStr(briefing, "donts") || t("available.noRestrictions")}</p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-1 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">{t("available.cta")}</span>
                    <span className="text-xs font-bold text-slate-900">{briefingStr(briefing, "cta") || t("available.free")}</span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">{t("available.hashtags")}</span>
                    <span className="font-mono text-xs text-indigo-700">{briefingStr(briefing, "hashtags") || t("available.none")}</span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">{t("available.discount")}</span>
                    <span className="text-xs font-bold text-emerald-700">{briefingStr(briefing, "coupon") || t("available.noneM")}</span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">{t("available.supportLink")}</span>
                    {briefingStr(briefing, "link") ? (
                      <a href={briefingStr(briefing, "link")} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 truncate text-xs font-bold text-brand-primary hover:underline">{briefingStr(briefing, "link")} <ExternalLink size={12} /></a>
                    ) : <span className="text-xs text-slate-400">{t("available.noLink")}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 p-4 sm:p-6">
                <button type="button" onClick={() => setBriefing(null)} className="cursor-pointer rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200">{tc("close")}</button>
                {!myApps[briefing.id] && canApply ? (
                  <button type="button" onClick={() => openApply(briefing)} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-brand-primary px-5 text-xs font-bold tracking-wider text-white uppercase shadow-md shadow-indigo-600/20 hover:bg-indigo-600">
                    <Send size={13} /> {t("available.applyNow")}
                  </button>
                ) : null}
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {applying ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-6">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-xl bg-indigo-50 p-2.5 text-brand-primary"><Send size={20} /></div>
                  <div>
                    <h3 className="m-0 text-base font-bold text-slate-900">{t("available.applyModal")}</h3>
                    <p className="m-0 text-xs text-slate-400">{applying.name}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setApplying(null)} className="cursor-pointer rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
              </div>
              <form noValidate onSubmit={onApply} className="flex flex-col gap-5 p-6 text-xs font-medium">
                <div className="flex flex-col gap-2 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold tracking-wider text-brand-primary uppercase">{t("available.howItWorks")}</span>
                    <button type="button" onClick={() => setBriefing(applying)} className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-bold text-brand-primary hover:underline">
                      <FileText size={13} /> {t("available.consultBriefing")}
                    </button>
                  </div>
                  <p className="m-0 leading-relaxed text-slate-600">{t("available.howItWorksText")}</p>
                </div>
                {applying.is_barter ? (
                  <div className="flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 p-3.5 text-xs font-bold text-purple-900">
                    <Gift size={16} /> {t("available.barterBanner")}
                  </div>
                ) : null}
                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center justify-between text-[10px] font-bold tracking-wider text-slate-700 uppercase">
                    <span>{t("available.helpLabel")} *</span>
                    <span className="font-normal text-slate-400 normal-case">{t("available.required")}</span>
                  </label>
                  <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("available.notesPh")} className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs font-medium leading-relaxed outline-none focus:border-brand-primary focus:bg-white" />
                </div>
                <div className="mt-2 flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
                  <button type="button" onClick={() => setApplying(null)} className="cursor-pointer rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900">{tc("cancel")}</button>
                  <button disabled={sending} className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-primary px-6 text-xs font-bold tracking-wider text-white uppercase shadow-md shadow-indigo-600/20 hover:bg-indigo-600 disabled:opacity-50">
                    {sending ? t("available.sending") : <><Send size={14} /> {t("available.confirm")}</>}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function AvailableCampaignsScreen() {
  return (
    <AuthenticatedShell>
      <AvailableInner />
    </AuthenticatedShell>
  );
}
