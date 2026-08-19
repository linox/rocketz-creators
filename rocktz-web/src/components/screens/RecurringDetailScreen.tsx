"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CalendarCheck,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clapperboard,
  DollarSign,
  Edit3,
  FileText,
  Film,
  Instagram,
  Layers,
  PieChart,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  Users,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { Select2Field } from "@/components/Select2Field";
import { UserAvatar } from "@/components/UserAvatar";
import { api } from "@/lib/api";
import { alertApiError, alertConfirm, alertSuccess, alertWarning } from "@/lib/alerts";
import { cn } from "@/lib/cn";
import { usePrivacy } from "@/lib/privacy";
import type { Creator, PlanningItem, RecurringContract } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { intlLocale, normalizeLocale } from "@/i18n/locales";

type ContractCreator = NonNullable<RecurringContract["creators"]>[number];
type StatusFilter = "all" | "owing" | "completed" | "no_demand";
type ViewTab = "creators" | "calendar";

const CONTENT_TYPES = ["reel", "story", "post", "tiktok", "youtube", "ugc"] as const;
const QUOTA_FIELDS = [
  ["reels", "quotaReels"],
  ["stories", "quotaStories"],
  ["posts", "quotaPosts"],
  ["tiktok", "quotaTiktok"],
  ["youtube", "quotaYoutube"],
  ["ugc", "quotaUgc"],
] as const;

const TYPE_STYLE: Record<string, { bg: string; text: string; border: string; icon: LucideIcon }> = {
  reel: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-100", icon: Film },
  story: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-100", icon: Instagram },
  post: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100", icon: Layers },
  tiktok: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-100", icon: Clapperboard },
  youtube: { bg: "bg-red-50", text: "text-red-700", border: "border-red-100", icon: Video },
  ugc: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-100", icon: Camera },
  other: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200", icon: Sparkles },
};

const EMPTY_CREATOR_FORM = { creator_id: "", monthly_cache: "", notes: "", reels: "4", stories: "8", posts: "0", tiktok: "0", youtube: "0", ugc: "0" };
const EMPTY_PAUTA = { title: "", content_type: "reel", planned_date: "", briefing: "" };

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(value: string, delta: number) {
  const [y, m] = value.split("-").map(Number);
  const next = new Date(y, m - 1 + delta, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

function contractMonths(start?: string | null, end?: string | null) {
  if (!start || !end) return 1;
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 1;
  return Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1);
}

function quotaTotal(deliverables?: Record<string, number>) {
  return Object.values(deliverables || {}).reduce((sum, value) => sum + (typeof value === "number" ? Number(value) : 0), 0);
}

function creatorCost(row: ContractCreator) {
  return Number(row.monthly_cache ?? row.monthly_fee ?? 0);
}

function itemInMonth(item: PlanningItem, month: string) {
  return item.month === month || Boolean(item.planned_date?.startsWith(month));
}

function isDone(status: string) {
  return status === "published" || status === "approved";
}

function daysInMonth(month: string) {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m, 0).getDate();
}

function DetailInner() {
  const user = useAuth();
  const router = useRouter();
  const { t, i18n } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const { formatCurrency } = usePrivacy();
  const locale = intlLocale(normalizeLocale(i18n.language));
  const id = usePathname().split("/").filter(Boolean).pop() ?? "";
  const canManage = user.role === "admin" || user.role === "company";
  const isAdmin = user.role === "admin";

  const [contract, setContract] = useState<RecurringContract | null>(null);
  const [catalog, setCatalog] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewTab>("creators");
  const [selectedCreatorId, setSelectedCreatorId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [showCompleted, setShowCompleted] = useState(false);

  const [creatorModal, setCreatorModal] = useState(false);
  const [editingCreator, setEditingCreator] = useState<ContractCreator | null>(null);
  const [creatorForm, setCreatorForm] = useState(EMPTY_CREATOR_FORM);
  const [pautaModal, setPautaModal] = useState(false);
  const [editingPauta, setEditingPauta] = useState<PlanningItem | null>(null);
  const [pautaForm, setPautaForm] = useState(EMPTY_PAUTA);
  const [pautaCreatorId, setPautaCreatorId] = useState<number | null>(null);

  async function load() {
    if (!id || id === "_") return;
    try {
      const data = (await api.recurringOne(id)).data;
      setContract(data);
      if (!selectedCreatorId && data.creators?.length) {
        setSelectedCreatorId(data.creators[0].creator_id);
      }
    } catch (err) {
      await alertApiError(err);
      setContract(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    if (user.role !== "creator") api.creators("?status=active").then((res) => setCatalog(res.data)).catch(() => undefined);
  }, [id, user.role]);

  const items = contract?.items ?? [];
  const allocated = contract?.creators ?? [];
  const monthLabel = new Date(`${selectedMonth}-02`).toLocaleDateString(locale, { month: "long", year: "numeric" });

  function profile(row: ContractCreator) {
    const extra = catalog.find((c) => c.id === row.creator_id);
    return {
      artistic_name: row.creator?.artistic_name || extra?.artistic_name || "",
      full_name: row.creator?.full_name || extra?.full_name || "",
      photo_url: row.creator?.photo_url || extra?.photo_url || null,
      city: row.creator?.city || extra?.city || null,
      state: row.creator?.state || extra?.state || null,
      categories: row.creator?.categories?.length ? row.creator.categories : extra?.categories || [],
      socials: row.creator?.socials || extra?.socials || {},
    };
  }

  function summary(row: ContractCreator) {
    const creatorItems = items.filter((item) => item.creator_id === row.creator_id && itemInMonth(item, selectedMonth));
    const quota = quotaTotal(row.monthly_deliverables);
    const completedCount = creatorItems.filter((item) => isDone(item.status)).length;
    const statusCategory: StatusFilter = quota === 0 ? "no_demand" : completedCount >= quota ? "completed" : "owing";
    return {
      quota,
      completedCount,
      missingToComplete: Math.max(0, quota - completedCount),
      statusCategory,
      items: creatorItems,
    };
  }

  const statusCounts = useMemo(() => {
    let owing = 0;
    let completed = 0;
    let no_demand = 0;
    allocated.forEach((row) => {
      const cat = summary(row).statusCategory;
      if (cat === "owing") owing += 1;
      else if (cat === "completed") completed += 1;
      else no_demand += 1;
    });
    return { all: allocated.length, owing, completed, no_demand };
  }, [allocated, items, selectedMonth]);

  const segments = [...new Set(allocated.flatMap((row) => profile(row).categories).filter(Boolean))].sort((a, b) => a.localeCompare(b, locale));
  const states = [...new Set(allocated.map((row) => (profile(row).state || "").trim().toUpperCase()).filter(Boolean))].sort();

  const filteredCreators = allocated
    .filter((row) => statusFilter === "all" || summary(row).statusCategory === statusFilter)
    .filter((row) => segmentFilter === "all" || profile(row).categories.some((cat) => cat.trim().toLowerCase() === segmentFilter.toLowerCase()))
    .filter((row) => stateFilter === "all" || (profile(row).state || "").toUpperCase() === stateFilter)
    .filter((row) => {
      const term = search.trim().toLowerCase();
      if (!term) return true;
      const info = profile(row);
      return [info.artistic_name, info.full_name, info.socials.instagram, info.city, info.state, info.categories.join(" ")].join(" ").toLowerCase().includes(term);
    })
    .sort((a, b) => profile(a).artistic_name.localeCompare(profile(b).artistic_name, locale, { sensitivity: "base" }));

  const selectedRow = allocated.find((row) => row.creator_id === selectedCreatorId) || filteredCreators[0] || allocated[0];
  const selectedInfo = selectedRow ? profile(selectedRow) : null;
  const selectedSummary = selectedRow ? summary(selectedRow) : null;
  const selectedPautas = selectedRow ? selectedSummary!.items.filter((item) => (showCompleted ? true : !isDone(item.status))) : [];
  const completedPautas = selectedSummary?.items.filter((item) => isDone(item.status)).length || 0;

  const fee = Number(contract?.monthly_fee || 0);
  const cost = allocated.reduce((sum, row) => sum + creatorCost(row), 0);
  const remaining = fee - cost;
  const months = contractMonths(contract?.start_date, contract?.end_date);
  const margin = fee > 0 ? Math.round((remaining / fee) * 100) : 0;

  function openCreatorModal(row?: ContractCreator) {
    if (row) {
      setEditingCreator(row);
      const d = row.monthly_deliverables || {};
      setCreatorForm({
        creator_id: String(row.creator_id),
        monthly_cache: String(row.monthly_cache ?? row.monthly_fee ?? 0),
        notes: row.notes || "",
        reels: String(d.reels ?? d.reel ?? 0),
        stories: String(d.stories ?? d.story ?? 0),
        posts: String(d.posts ?? d.post ?? 0),
        tiktok: String(d.tiktok ?? 0),
        youtube: String(d.youtube ?? 0),
        ugc: String(d.ugc ?? 0),
      });
    } else {
      setEditingCreator(null);
      setCreatorForm({ ...EMPTY_CREATOR_FORM, creator_id: catalog[0] ? String(catalog[0].id) : "" });
    }
    setCreatorModal(true);
  }

  function openPautaModal(creatorId: number, item?: PlanningItem) {
    setPautaCreatorId(creatorId);
    if (item) {
      setEditingPauta(item);
      setPautaForm({ title: item.title, content_type: item.content_type || "reel", planned_date: item.planned_date || "", briefing: item.briefing || item.briefing_note || "" });
    } else {
      setEditingPauta(null);
      setPautaForm({ ...EMPTY_PAUTA, planned_date: `${selectedMonth}-01` });
    }
    setPautaModal(true);
  }

  async function onSaveCreator(event: FormEvent) {
    event.preventDefault();
    if (!contract) return;
    if (!creatorForm.creator_id) {
      await alertWarning(t("recurringDetail.creatorRequired"), t("recurringDetail.creatorRequiredText"));
      return;
    }
    try {
      await api.addRecurringCreator(contract.id, {
        creator_id: Number(creatorForm.creator_id),
        monthly_cache: creatorForm.monthly_cache ? Number(creatorForm.monthly_cache) : 0,
        notes: creatorForm.notes || null,
        monthly_deliverables: {
          reels: Number(creatorForm.reels) || 0,
          stories: Number(creatorForm.stories) || 0,
          posts: Number(creatorForm.posts) || 0,
          tiktok: Number(creatorForm.tiktok) || 0,
          youtube: Number(creatorForm.youtube) || 0,
          ugc: Number(creatorForm.ugc) || 0,
        },
      });
      await alertSuccess(editingCreator ? t("recurringDetail.creatorUpdated") : t("recurringDetail.creatorSaved"));
      setCreatorModal(false);
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function onSavePauta(event: FormEvent) {
    event.preventDefault();
    if (!contract || !pautaCreatorId) return;
    if (!pautaForm.title.trim()) {
      await alertWarning(t("recurringDetail.pautaIncomplete"), t("recurringDetail.incomplete"));
      return;
    }
    const body = {
      creator_id: pautaCreatorId,
      title: pautaForm.title,
      content_type: pautaForm.content_type,
      planned_date: pautaForm.planned_date || null,
      month: (pautaForm.planned_date || selectedMonth).slice(0, 7),
      briefing: pautaForm.briefing || null,
    };
    try {
      if (editingPauta) {
        await api.updatePlanningItem(editingPauta.id, body);
        await alertSuccess(t("recurringDetail.pautaUpdated"));
      } else {
        await api.addPlanningItem(contract.id, body);
        await alertSuccess(t("recurringDetail.pautaSaved"));
      }
      setPautaModal(false);
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function onDeleteProject() {
    if (!contract) return;
    if (!(await alertConfirm(t("recurringDetail.deleteTitle"), t("recurringDetail.deleteText", { title: contract.title })))) return;
    try {
      await api.deleteRecurring(contract.id);
      await alertSuccess(t("recurringDetail.deleted"));
      router.push("/campaign-deliveries/?tab=recurring");
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function onRemoveCreator(row: ContractCreator) {
    if (!contract) return;
    const name = profile(row).artistic_name;
    if (!(await alertConfirm(t("recurringDetail.removeCreatorTitle"), t("recurringDetail.removeCreatorText", { name })))) return;
    try {
      await api.deleteRecurringCreator(contract.id, row.id);
      await alertSuccess(t("recurringDetail.removedCreator"));
      if (selectedCreatorId === row.creator_id) setSelectedCreatorId(null);
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function onDeletePauta(item: PlanningItem) {
    if (!(await alertConfirm(t("recurringDetail.pautaDeleteTitle"), t("recurringDetail.pautaDeleteText", { title: item.title })))) return;
    try {
      await api.deletePlanningItem(item.id);
      await alertSuccess(t("recurringDetail.pautaDeleted"));
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function onToggleDone(item: PlanningItem) {
    try {
      await api.updatePlanningItem(item.id, { status: isDone(item.status) ? "planned" : "approved" });
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">{tc("loadingContract")}</p>;
  }

  if (!contract) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h2 className="mb-2 text-xl font-bold text-slate-800">{t("recurringDetail.notFoundTitle")}</h2>
        <p className="mb-4 text-sm text-slate-500">{t("recurringDetail.notFoundHint")}</p>
        <Link href="/campaign-deliveries/?tab=recurring" className="rounded-xl bg-brand-primary px-4 py-2 text-xs font-bold text-white">{t("recurringDetail.backList")}</Link>
      </div>
    );
  }

  const statusLabel = contract.status === "active" ? t("recurringDetail.activeProject") : contract.status === "paused" ? t("recurringDetail.paused") : t("recurringDetail.finished");

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="flex items-center justify-between">
        <Link href="/campaign-deliveries/?tab=recurring" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-500 shadow-sm transition-all hover:text-brand-primary">
          <ArrowLeft size={14} /> {t("recurringDetail.back")}
        </Link>
        {canManage ? (
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <button type="button" onClick={onDeleteProject} className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-500 shadow-sm transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600">
                <Trash2 size={14} /> {t("recurringDetail.deleteProject")}
              </button>
            ) : null}
            <button type="button" onClick={() => openCreatorModal()} className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-600">
              <Plus size={14} /> {t("recurringDetail.addCreator")}
            </button>
          </div>
        ) : null}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <UserAvatar src={contract.company?.logo_url} name={contract.company?.name} size="custom" shape="rounded-2xl" className="h-14 w-14 border border-indigo-100 shadow-sm" textClassName="text-base font-black" />
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2.5">
              <span className="rounded-full border border-indigo-200 bg-indigo-100 px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider text-brand-primary uppercase">{contract.company?.name}</span>
              <span className={cn("rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase", contract.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : contract.status === "paused" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-100 text-slate-700")}>
                {contract.status === "active" ? "● " : ""}{statusLabel}
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">{contract.title}</h1>
            {contract.objective ? <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">{contract.objective}</p> : null}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3.5 border-t border-slate-100 pt-5 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile icon={DollarSign} iconClass="bg-indigo-100/80 text-brand-primary" label={t("recurringDetail.budget")} badge={t("recurringDetail.clientFee")} value={formatCurrency(fee)} unit={t("recurringDetail.perMonth")} extra={contract.end_date && months > 1 ? { label: t("recurringDetail.periodTotal"), value: formatCurrency(fee * months) } : undefined} />
          <MetricTile icon={Users} iconClass="bg-blue-100/80 text-blue-700" label={t("recurringDetail.creatorsCost")} badge={t(allocated.length === 1 ? "recurringDetail.creatorOne" : "recurringDetail.creatorMany", { count: allocated.length })} badgeClass="bg-blue-50 text-blue-700 border-blue-200" value={formatCurrency(cost)} unit={t("recurringDetail.perMonth")} extra={contract.end_date && months > 1 ? { label: t("recurringDetail.periodTotal"), value: formatCurrency(cost * months) } : undefined} />
          <div className={cn("flex flex-col justify-between gap-2.5 rounded-2xl border p-4 shadow-2xs", remaining >= 0 ? "border-emerald-200/70 bg-emerald-50/40" : "border-rose-200/70 bg-rose-50/40")}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg", remaining >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}><PieChart size={13} /></div>
                <span className="truncate text-[10px] font-extrabold tracking-wider text-slate-600 uppercase">{t("recurringDetail.margin")}</span>
              </div>
              {fee > 0 ? <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black", remaining >= 0 ? "border-emerald-200 bg-emerald-100 text-emerald-800" : "border-rose-200 bg-rose-100 text-rose-800")}>{remaining >= 0 ? t("recurringDetail.marginBadge", { percent: margin }) : t("recurringDetail.deficit")}</span> : null}
            </div>
            <div className="flex items-baseline justify-between gap-2 border-t border-slate-200/50 pt-1">
              <span className={cn("text-xl font-black tracking-tight", remaining >= 0 ? "text-emerald-700" : "text-rose-700")}>{formatCurrency(remaining)}</span>
              <span className="text-xs font-semibold text-slate-400">{t("recurringDetail.perMonth")}</span>
            </div>
          </div>
          <div className="flex flex-col justify-between gap-2.5 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-100/80 text-amber-800"><Calendar size={13} /></div>
                <span className="truncate text-[10px] font-extrabold tracking-wider text-slate-500 uppercase">{t("recurringDetail.term")}</span>
              </div>
              <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-800">{months} {t(months === 1 ? "recurringDetail.monthOne" : "recurringDetail.monthMany")}</span>
            </div>
            <div className="border-t border-slate-200/50 pt-1">
              <span className="text-xs font-black text-slate-800">
                {contract.start_date ? new Date(`${contract.start_date}T00:00:00`).toLocaleDateString(locale) : t("recurringDetail.noStart")}
                {contract.end_date ? ` → ${new Date(`${contract.end_date}T00:00:00`).toLocaleDateString(locale)}` : ` ${t("recurringDetail.continuous")}`}
              </span>
              <p className="text-[10px] font-semibold text-slate-400">{contract.end_date ? t("recurringDetail.duration", { count: months }) : t("recurringDetail.indefinite")}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={() => setView("creators")} className={cn("inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all", view === "creators" ? "bg-slate-900 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
            <Users size={14} /> {t("recurringDetail.tabCreators", { count: allocated.length })}
          </button>
          <button type="button" onClick={() => setView("calendar")} className={cn("inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all", view === "calendar" ? "bg-slate-900 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
            <Calendar size={14} /> {t("recurringDetail.tabCalendar")}
          </button>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-[11px] font-bold tracking-wider text-slate-400 uppercase sm:inline">{t("recurringDetail.refMonth")}</span>
            <button type="button" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))} className="cursor-pointer rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50"><ChevronLeft size={14} /></button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm">
              <Calendar size={13} className="text-slate-400" />
              <span className="capitalize">{monthLabel}</span>
              <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="sr-only" />
            </label>
            <button type="button" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))} className="cursor-pointer rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50"><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>

      {view === "creators" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="flex flex-col gap-4 lg:col-span-5">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-xs font-black tracking-wider text-slate-600 uppercase">
                <Users size={14} className="text-brand-primary" /> {t("recurringDetail.allocated", { count: allocated.length })}
              </h3>
              <div className="flex items-center gap-2">
                {allocated.length ? (
                  <button type="button" onClick={() => setExpandedIds(expandedIds.length === allocated.length ? [] : allocated.map((row) => row.creator_id))} className="cursor-pointer rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-200 hover:text-slate-800">
                    {expandedIds.length === allocated.length ? t("recurringDetail.collapseAll") : t("recurringDetail.expandAll")}
                  </button>
                ) : null}
                {canManage ? (
                  <button type="button" onClick={() => openCreatorModal()} className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-bold text-brand-primary hover:underline">
                    <Plus size={12} /> {t("recurringDetail.add")}
                  </button>
                ) : null}
              </div>
            </div>

            {allocated.length ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("recurringDetail.searchPh")} className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-8 pl-9 text-xs font-medium outline-none focus:border-brand-primary" />
                  {search ? <button type="button" onClick={() => setSearch("")} className="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={13} /></button> : null}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Select2Field theme="light" value={segmentFilter} options={[{ value: "all", label: t("recurringDetail.allSegments") }, ...segments.map((seg) => ({ value: seg, label: seg }))]} onChange={setSegmentFilter} />
                  <Select2Field theme="light" value={stateFilter} options={[{ value: "all", label: t("recurringDetail.allStates") }, ...states.map((st) => ({ value: st, label: st }))]} onChange={setStateFilter} />
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  {([
                    ["all", t("recurringDetail.filterAll"), statusCounts.all, "bg-slate-900 text-white border-slate-900", "bg-white text-slate-600 border-slate-200"],
                    ["owing", t("recurringDetail.filterOwing"), statusCounts.owing, "bg-rose-600 text-white border-rose-600", "bg-white text-rose-700 border-rose-200"],
                    ["completed", t("recurringDetail.filterDone"), statusCounts.completed, "bg-emerald-700 text-white border-emerald-700", "bg-white text-emerald-700 border-emerald-200"],
                    ["no_demand", t("recurringDetail.filterNone"), statusCounts.no_demand, "bg-slate-700 text-white border-slate-700", "bg-white text-slate-600 border-slate-200"],
                  ] as const).map(([key, label, count, active, idle]) => (
                    <button key={key} type="button" onClick={() => setStatusFilter(key)} className={cn("flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold whitespace-nowrap", statusFilter === key ? active : idle)}>
                      {key === "owing" ? <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500" /> : null}
                      {key === "completed" ? <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" /> : null}
                      <span>{label}</span>
                      <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-black", statusFilter === key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600")}>{count}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {!allocated.length ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-brand-primary"><Users size={24} /></div>
                <h4 className="text-sm font-bold text-slate-800">{t("recurringDetail.noAllocated")}</h4>
                <p className="max-w-xs text-xs text-slate-500">{t("recurringDetail.noAllocatedHint")}</p>
                {canManage ? <button type="button" onClick={() => openCreatorModal()} className="cursor-pointer rounded-xl bg-brand-primary px-4 py-2 text-xs font-bold text-white hover:bg-indigo-600">{t("recurringDetail.addCreatorNow")}</button> : null}
              </div>
            ) : !filteredCreators.length ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
                <Search size={24} className="text-slate-300" />
                <h4 className="text-xs font-bold text-slate-700">{t("recurringDetail.noMatch")}</h4>
                <p className="max-w-xs text-[11px] text-slate-400">{search ? t("recurringDetail.noMatchSearch", { term: search }) : t("recurringDetail.noMatchFilters")}</p>
                <button type="button" onClick={() => { setSearch(""); setSegmentFilter("all"); setStateFilter("all"); setStatusFilter("all"); }} className="mt-1 cursor-pointer rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200">{t("recurringDetail.clearFilters")}</button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {filteredCreators.map((row) => {
                  const info = profile(row);
                  const stats = summary(row);
                  const selected = selectedRow?.creator_id === row.creator_id;
                  const expanded = expandedIds.includes(row.creator_id);
                  return (
                    <div key={row.id} onClick={() => setSelectedCreatorId(row.creator_id)} className={cn("relative cursor-pointer overflow-hidden rounded-2xl border bg-white shadow-sm transition-all", selected ? "border-brand-primary bg-indigo-50/10 ring-2 ring-indigo-500/10 shadow-md" : "border-slate-200 hover:border-slate-300", stats.statusCategory === "owing" && "border-rose-200/80 bg-rose-50/10")}>
                      {stats.statusCategory === "owing" ? <div className="absolute top-0 right-0 z-10 flex items-center gap-1 rounded-bl-lg bg-rose-500 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-white uppercase"><AlertTriangle size={10} /> {t("recurringDetail.owingRibbon")}</div> : null}
                      {stats.statusCategory === "completed" ? <div className="absolute top-0 right-0 z-10 flex items-center gap-1 rounded-bl-lg bg-emerald-600 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-white uppercase"><Check size={10} /> {t("recurringDetail.doneRibbon")}</div> : null}
                      <div className="space-y-3 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <UserAvatar src={info.photo_url} name={info.artistic_name || info.full_name} size="custom" shape="rounded-xl" className="h-11 w-11 shrink-0 border border-slate-200" textClassName="text-sm font-bold" />
                            <div className="min-w-0 flex-1">
                              <h4 className="truncate text-sm font-bold text-slate-900">{info.artistic_name || info.full_name}</h4>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                <span className="truncate text-[11px] text-slate-400">{info.socials.instagram ? `@${info.socials.instagram.replace(/^@/, "")}` : t("recurringDetail.partner")}</span>
                                {info.city || info.state ? <span className="rounded-md border border-slate-200 bg-slate-100 px-1.5 text-[10px] font-bold text-slate-600">📍 {info.city ? `${info.city}/` : ""}{info.state || ""}</span> : null}
                                {info.categories.slice(0, 2).map((cat) => <span key={cat} className="rounded-md border border-indigo-100 bg-indigo-50 px-1.5 text-[9px] font-extrabold text-indigo-700">{cat}</span>)}
                              </div>
                            </div>
                          </div>
                          <button type="button" onClick={(e) => { e.stopPropagation(); setExpandedIds((prev) => prev.includes(row.creator_id) ? prev.filter((item) => item !== row.creator_id) : [...prev, row.creator_id]); }} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200">
                            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-2 border-t border-slate-100 pt-2.5 sm:grid-cols-2">
                          <div className="rounded-xl border border-slate-200/60 bg-slate-50/90 p-2.5">
                            <span className="block text-[9px] font-extrabold tracking-wider text-slate-400 uppercase">{t("recurringDetail.monthlyCache")}</span>
                            <div className="mt-0.5 flex items-baseline gap-1">
                              <span className="text-sm font-black text-slate-900">{formatCurrency(creatorCost(row))}</span>
                              <span className="text-[10px] font-semibold text-slate-400">{t("recurringDetail.perMonth")}</span>
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-200/60 bg-slate-50/90 p-2.5">
                            <span className="block text-[9px] font-extrabold tracking-wider text-slate-400 uppercase">{t("recurringDetail.deliveriesMonth", { month: selectedMonth })}</span>
                            <div className="mt-0.5 flex items-center justify-between gap-1.5">
                              {stats.statusCategory === "owing" ? (
                                <span className="truncate rounded-md border border-rose-200 bg-rose-100/80 px-2 py-0.5 text-[10px] font-extrabold text-rose-600">{t("recurringDetail.missing", { missing: stats.missingToComplete, done: stats.completedCount, total: stats.quota })}</span>
                              ) : stats.statusCategory === "completed" ? (
                                <span className="truncate rounded-md border border-emerald-200 bg-emerald-100/80 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">{t("recurringDetail.doneCount", { done: stats.completedCount, total: stats.quota })}</span>
                              ) : (
                                <span className="truncate rounded-md border border-slate-300/60 bg-slate-200/70 px-2 py-0.5 text-[10px] font-bold text-slate-500">{t(stats.completedCount === 1 ? "recurringDetail.deliveredCount" : "recurringDetail.deliveredCountMany", { count: stats.completedCount })}</span>
                              )}
                              {canManage ? (
                                <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedCreatorId(row.creator_id); openPautaModal(row.creator_id); }} className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-brand-primary px-2 py-1 text-[10px] font-bold text-white hover:bg-indigo-600">
                                  <Plus size={11} /> {t("recurringDetail.addBrief")}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        {expanded ? (
                          <div className="space-y-3 border-t border-slate-100 pt-3">
                            <div className="space-y-1.5">
                              <span className="block text-[9px] font-extrabold tracking-wider text-slate-400 uppercase">{t("recurringDetail.quotas")}</span>
                              <div className="flex flex-wrap gap-1.5">
                                {quotaTotal(row.monthly_deliverables) === 0 ? <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{t("recurringDetail.noQuota")}</span> : Object.entries(row.monthly_deliverables || {}).filter(([, n]) => Number(n) > 0).map(([key, n]) => (
                                  <span key={key} className="rounded-md border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold text-indigo-700">{n} {key}</span>
                                ))}
                              </div>
                            </div>
                            {canManage ? (
                              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-2">
                                <button type="button" onClick={(e) => { e.stopPropagation(); openCreatorModal(row); }} className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-200"><Edit3 size={12} /> {t("recurringDetail.editContract")}</button>
                                {isAdmin ? <button type="button" onClick={(e) => { e.stopPropagation(); void onRemoveCreator(row); }} className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-100"><Trash2 size={12} /> {t("recurringDetail.remove")}</button> : null}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 lg:col-span-7">
            {selectedRow && selectedInfo && selectedSummary ? (
              <div className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
                  <div>
                    <span className="text-[10px] font-bold tracking-wider text-brand-primary uppercase">{t("recurringDetail.monthBriefs", { month: selectedMonth })}</span>
                    <h3 className="flex flex-wrap items-center gap-2 text-lg font-black text-slate-900">
                      {selectedInfo.artistic_name || selectedInfo.full_name}
                      {selectedSummary.statusCategory === "owing" ? <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-600">⚠️ {t("recurringDetail.owingMonth")}</span> : <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-600">✓ {t("recurringDetail.onTrack")}</span>}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {selectedInfo.city || selectedInfo.state ? <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">📍 {selectedInfo.city ? `${selectedInfo.city}/` : ""}{selectedInfo.state || ""}</span> : null}
                      {selectedInfo.categories.map((cat) => <span key={cat} className="rounded-md border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold text-indigo-700">🏷️ {cat}</span>)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setShowCompleted(!showCompleted)} className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold", showCompleted ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100")}>
                      <CheckCircle2 size={13} /> {showCompleted ? t("recurringDetail.hideCompleted") : t("recurringDetail.seeCompleted", { count: completedPautas })}
                    </button>
                    {canManage ? (
                      <button type="button" onClick={() => openPautaModal(selectedRow.creator_id)} className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-brand-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-600">
                        <Plus size={13} /> {t("recurringDetail.newBrief")}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 sm:grid-cols-4">
                  <MiniStat label={t("recurringDetail.monthlyCache")} value={formatCurrency(creatorCost(selectedRow))} hint={t("recurringDetail.perMonth")} icon={DollarSign} />
                  <MiniStat label={t("recurringDetail.meta")} value={String(selectedSummary.quota)} hint={t("recurringDetail.deliveriesUnit")} icon={Target} />
                  <MiniStat label={t("recurringDetail.completed")} value={String(selectedSummary.completedCount)} hint={`(${selectedSummary.quota ? Math.round((selectedSummary.completedCount / selectedSummary.quota) * 100) : 0}%)`} icon={CheckCircle2} valueClass="text-emerald-700" labelClass="text-emerald-600" />
                  <div className={cn("flex flex-col justify-between gap-1 rounded-xl border p-3 shadow-2xs", selectedSummary.statusCategory === "owing" ? "border-rose-200 bg-rose-50/70" : "border-slate-200/70 bg-white")}>
                    <div className="flex items-center justify-between">
                      <span className={cn("truncate text-[9px] font-extrabold tracking-wider uppercase", selectedSummary.statusCategory === "owing" ? "text-rose-600" : "text-slate-400")}>{selectedSummary.statusCategory === "owing" ? t("recurringDetail.pending") : t("recurringDetail.status")}</span>
                      {selectedSummary.statusCategory === "owing" ? <AlertTriangle size={12} className="text-rose-600" /> : <Check size={12} className="text-emerald-600" />}
                    </div>
                    <span className={cn("truncate text-sm font-black", selectedSummary.statusCategory === "owing" ? "text-rose-700" : "text-emerald-700")}>
                      {selectedSummary.statusCategory === "owing" ? t("recurringDetail.missingShort", { count: selectedSummary.missingToComplete }) : selectedSummary.quota > 0 ? t("recurringDetail.allDelivered") : t("recurringDetail.noDemand")}
                    </span>
                  </div>
                </div>

                {!selectedPautas.length ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
                    <div className="rounded-full bg-white p-3 text-slate-400 shadow-sm"><FileText size={22} /></div>
                    <h4 className="text-xs font-bold text-slate-700">{t("recurringDetail.emptyPending", { month: selectedMonth })}</h4>
                    <p className="max-w-xs text-[11px] leading-relaxed text-slate-400">{completedPautas > 0 ? t("recurringDetail.emptyAllDone", { count: completedPautas }) : t("recurringDetail.emptyPendingHint")}</p>
                    {canManage ? <button type="button" onClick={() => openPautaModal(selectedRow.creator_id)} className="mt-2 cursor-pointer rounded-xl bg-brand-primary px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-600">{t("recurringDetail.addMonthBrief")}</button> : null}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {selectedPautas.map((item) => {
                      const style = TYPE_STYLE[item.content_type] || TYPE_STYLE.other;
                      const Icon = style.icon;
                      const done = isDone(item.status);
                      return (
                        <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-indigo-200">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", style.bg, style.text, style.border)}><Icon size={18} /></div>
                              <div>
                                <div className="mb-0.5 flex flex-wrap items-center gap-2">
                                  <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-black uppercase", style.bg, style.text, style.border)}>{t(`recurring.shortFormats.${item.content_type}`, { defaultValue: item.content_type })}</span>
                                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[9px] font-extrabold text-slate-700 uppercase">{t(`recurring.itemStatus.${item.status}`, { defaultValue: item.status })}</span>
                                </div>
                                <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                                {item.briefing || item.briefing_note ? <p className="mt-1 text-[11px] text-slate-500">{item.briefing || item.briefing_note}</p> : null}
                              </div>
                            </div>
                            {canManage ? (
                              <div className="flex shrink-0 items-center gap-1">
                                <button type="button" onClick={() => onToggleDone(item)} className={cn("rounded-lg border px-2.5 py-1 text-xs font-bold", done ? "border-emerald-300 bg-emerald-100 text-emerald-800" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>{done ? t("recurringDetail.reopen") : t("recurringDetail.markDone")}</button>
                                <button type="button" onClick={() => openPautaModal(selectedRow.creator_id, item)} className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700"><Edit3 size={13} /></button>
                                <button type="button" onClick={() => onDeletePauta(item)} className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600"><Trash2 size={13} /></button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-400">{t("recurringDetail.noAllocated")}</div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900"><CalendarCheck size={18} className="text-brand-primary" /> {t("recurringDetail.calendarTitle", { title: contract.title })}</h3>
            <p className="text-xs text-slate-500">{t("recurringDetail.calendarHint", { month: selectedMonth })}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: daysInMonth(selectedMonth) }, (_, i) => i + 1).map((day) => {
              const dateStr = `${selectedMonth}-${String(day).padStart(2, "0")}`;
              const dayItems = items.filter((item) => item.planned_date === dateStr);
              return (
                <div key={day} className={cn("flex min-h-[110px] flex-col justify-between rounded-2xl border p-3", dayItems.length ? "border-indigo-200 bg-indigo-50/20 shadow-sm" : "border-slate-100 bg-slate-50/50")}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs font-black text-slate-800">{t("recurringDetail.day", { day })}</span>
                    {dayItems.length ? <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-black text-brand-primary">{t(dayItems.length === 1 ? "recurringDetail.dayOne" : "recurringDetail.dayMany", { count: dayItems.length })}</span> : null}
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5">
                    {dayItems.map((item) => (
                      <div key={item.id} className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-2 text-[11px] shadow-2xs">
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate font-bold text-slate-800">{item.title}</span>
                          <span className="shrink-0 rounded border border-indigo-100 bg-indigo-50 px-1.5 text-[9px] font-extrabold text-indigo-700">{t(`recurring.shortFormats.${item.content_type}`, { defaultValue: item.content_type })}</span>
                        </div>
                        <span className="truncate text-[10px] text-slate-500">👤 {item.creator?.artistic_name || allocated.find((row) => row.creator_id === item.creator_id)?.creator?.artistic_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {creatorModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <form noValidate onSubmit={onSaveCreator} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="flex items-center gap-2 text-base font-black text-slate-900"><Users size={18} className="text-brand-primary" /> {editingCreator ? t("recurringDetail.modalEdit") : t("recurringDetail.modalAdd")}</h3>
              <button type="button" onClick={() => setCreatorModal(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="space-y-3 text-xs">
              <Select2Field theme="light" placeholder={t("recurringDetail.selectCreator")} value={creatorForm.creator_id} options={catalog.map((c) => ({ value: String(c.id), label: `${c.artistic_name || c.full_name}${c.city ? ` (${c.city}/${c.state || ""})` : ""}` }))} onChange={(value) => setCreatorForm({ ...creatorForm, creator_id: value })} disabled={Boolean(editingCreator)} />
              <input className="h-11 w-full rounded-xl border bg-slate-50 px-4" placeholder={t("recurringDetail.cache")} value={creatorForm.monthly_cache} onChange={(e) => setCreatorForm({ ...creatorForm, monthly_cache: e.target.value })} />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {QUOTA_FIELDS.map(([key, labelKey]) => (
                  <label key={key} className="font-bold text-slate-700">
                    {t(`recurringDetail.${labelKey}`)}
                    <input className="mt-1 h-10 w-full rounded-xl border bg-slate-50 px-3" value={creatorForm[key]} onChange={(e) => setCreatorForm({ ...creatorForm, [key]: e.target.value })} />
                  </label>
                ))}
              </div>
              <textarea className="min-h-20 w-full rounded-xl border bg-slate-50 px-4 py-3" placeholder={t("recurringDetail.notes")} value={creatorForm.notes} onChange={(e) => setCreatorForm({ ...creatorForm, notes: e.target.value })} />
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setCreatorModal(false)} className="flex-1 rounded-xl border py-3 font-bold">{tc("cancel")}</button>
              <button className="flex-1 rounded-xl bg-brand-primary py-3 font-bold text-white">{t("recurringDetail.saveCreator")}</button>
            </div>
          </form>
        </div>
      ) : null}

      {pautaModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <form noValidate onSubmit={onSavePauta} className="w-full max-w-lg space-y-3 rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-black">{editingPauta ? t("recurringDetail.pautaEdit") : t("recurringDetail.pautaModal")}</h2>
            <Select2Field theme="light" placeholder={t("recurringDetail.pautaType")} value={pautaForm.content_type} options={CONTENT_TYPES.map((type) => ({ value: type, label: t(`recurring.formats.${type}`) }))} onChange={(value) => setPautaForm({ ...pautaForm, content_type: value })} />
            <input className="h-11 w-full rounded-xl border px-4" placeholder={t("recurringDetail.pautaTitle")} value={pautaForm.title} onChange={(e) => setPautaForm({ ...pautaForm, title: e.target.value })} />
            <label className="text-xs font-bold text-slate-500">{t("recurringDetail.pautaDate")}<input type="date" className="mt-1 h-11 w-full rounded-xl border px-4 text-sm" value={pautaForm.planned_date} onChange={(e) => setPautaForm({ ...pautaForm, planned_date: e.target.value })} /></label>
            <textarea className="min-h-24 w-full rounded-xl border px-4 py-3" placeholder={t("recurringDetail.pautaBriefing")} value={pautaForm.briefing} onChange={(e) => setPautaForm({ ...pautaForm, briefing: e.target.value })} />
            <div className="flex gap-2">
              <button type="button" onClick={() => setPautaModal(false)} className="flex-1 rounded-xl border py-3 font-bold">{tc("cancel")}</button>
              <button className="flex-1 rounded-xl bg-brand-primary py-3 font-bold text-white">{tc("save")}</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function MetricTile({ icon: Icon, iconClass, label, badge, badgeClass, value, unit, extra }: { icon: LucideIcon; iconClass: string; label: string; badge: string; badgeClass?: string; value: string; unit: string; extra?: { label: string; value: string } }) {
  return (
    <div className="flex flex-col justify-between gap-2.5 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 shadow-2xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg", iconClass)}><Icon size={13} /></div>
          <span className="truncate text-[10px] font-extrabold tracking-wider text-slate-500 uppercase">{label}</span>
        </div>
        <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold", badgeClass || "border-slate-200 bg-white text-slate-500")}>{badge}</span>
      </div>
      <div className="border-t border-slate-200/50 pt-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xl font-black tracking-tight text-slate-900">{value}</span>
          <span className="text-xs font-semibold text-slate-400">{unit}</span>
        </div>
        {extra ? <div className="mt-1 flex items-center justify-between border-t border-slate-200/40 pt-1 text-[11px] text-slate-500"><span className="font-semibold text-slate-400">{extra.label}</span><span className="font-extrabold text-indigo-700">{extra.value}</span></div> : null}
      </div>
    </div>
  );
}

function MiniStat({ label, value, hint, icon: Icon, valueClass, labelClass }: { label: string; value: string; hint: string; icon: LucideIcon; valueClass?: string; labelClass?: string }) {
  return (
    <div className="flex flex-col justify-between gap-1 rounded-xl border border-slate-200/70 bg-white p-3 shadow-2xs">
      <div className="flex items-center justify-between gap-1">
        <span className={cn("truncate text-[9px] font-extrabold tracking-wider uppercase", labelClass || "text-slate-400")}>{label}</span>
        <Icon size={12} className="text-brand-primary" />
      </div>
      <div className="flex items-baseline gap-1 pt-0.5">
        <span className={cn("truncate text-sm font-black", valueClass || "text-slate-900")}>{value}</span>
        <span className="text-[10px] font-semibold text-slate-400">{hint}</span>
      </div>
    </div>
  );
}

export function RecurringDetailScreen() {
  return (
    <AuthenticatedShell>
      <DetailInner />
    </AuthenticatedShell>
  );
}
