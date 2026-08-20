"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  Building2,
  Calendar,
  CalendarCheck,
  Camera,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  DollarSign,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  Film,
  Instagram,
  Layers,
  Mic,
  Newspaper,
  Package,
  Pin,
  Plus,
  Radio,
  Repeat,
  ScrollText,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
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
import { getCalendarDays, localDateStr, toDateKey } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import { usePrivacy } from "@/lib/privacy";
import type { Company, Creator, PlanningItem, RecurringContract } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { intlLocale, normalizeLocale } from "@/i18n/locales";

type InnerTab = "contracts" | "planning" | "calendar" | "creator_calendar";

const CONTENT_TYPES = ["reel", "story", "post", "tiktok", "youtube", "live", "pinterest", "blog", "podcast", "unboxing", "ugc", "event", "other"] as const;
const ITEM_STATUSES = ["planned", "in_production", "review", "approved", "rejected", "published"] as const;
const CONTRACT_STATUSES = ["active", "paused", "finished"] as const;

const TYPE_STYLE: Record<string, { bg: string; text: string; border: string; icon: LucideIcon }> = {
  reel: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-100", icon: Film },
  story: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-100", icon: Instagram },
  post: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100", icon: Layers },
  tiktok: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-100", icon: Clapperboard },
  youtube: { bg: "bg-red-50", text: "text-red-700", border: "border-red-100", icon: Video },
  live: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-100", icon: Radio },
  live_instagram: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-100", icon: Radio },
  live_tiktok: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-100", icon: Radio },
  live_youtube: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-100", icon: Radio },
  pinterest: { bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-100", icon: Pin },
  blog: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-100", icon: Newspaper },
  podcast: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-100", icon: Mic },
  unboxing: { bg: "bg-fuchsia-50", text: "text-fuchsia-700", border: "border-fuchsia-100", icon: Package },
  ugc: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-100", icon: Camera },
  event: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-100", icon: Calendar },
  other: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200", icon: Sparkles },
};

const QUOTA_PILLS: { keys: string[]; type: string; labelKey: string }[] = [
  { keys: ["reels", "reel"], type: "reel", labelKey: "quotaReel" },
  { keys: ["stories", "story"], type: "story", labelKey: "quotaStory" },
  { keys: ["posts", "post"], type: "post", labelKey: "quotaPost" },
  { keys: ["tiktok", "tiktoks"], type: "tiktok", labelKey: "quotaTiktok" },
  { keys: ["youtube"], type: "youtube", labelKey: "quotaYoutube" },
  { keys: ["live", "lives"], type: "live", labelKey: "quotaLive" },
  { keys: ["live_instagram"], type: "live_instagram", labelKey: "quotaLiveInstagram" },
  { keys: ["live_tiktok"], type: "live_tiktok", labelKey: "quotaLiveTiktok" },
  { keys: ["live_youtube"], type: "live_youtube", labelKey: "quotaLiveYoutube" },
  { keys: ["pinterest", "pins"], type: "pinterest", labelKey: "quotaPinterest" },
  { keys: ["blog", "artigos", "articles"], type: "blog", labelKey: "quotaBlog" },
  { keys: ["podcast", "podcasts"], type: "podcast", labelKey: "quotaPodcast" },
  { keys: ["unboxing", "unboxings"], type: "unboxing", labelKey: "quotaUnboxing" },
  { keys: ["ugc", "ugcs"], type: "ugc", labelKey: "quotaUgc" },
  { keys: ["event", "events"], type: "event", labelKey: "quotaEvent" },
  { keys: ["other", "outro"], type: "other", labelKey: "quotaOther" },
];

const EMPTY_CONTRACT = {
  title: "",
  company_id: "",
  monthly_fee: "",
  objective: "",
  start_date: "",
  end_date: "",
  status: "active",
};

const EMPTY_CONTENT = {
  contract_id: "",
  creator_id: "",
  content_type: "reel",
  title: "",
  description: "",
  briefing: "",
  planned_date: "",
  month: "",
};

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

function quotaValue(deliverables: Record<string, number> | undefined, keys: string[]) {
  return keys.reduce((sum, key) => sum + Number(deliverables?.[key] || 0), 0);
}

function creatorQuota(deliverables: Record<string, number> | undefined) {
  return QUOTA_PILLS.reduce((sum, pill) => sum + quotaValue(deliverables, pill.keys), 0);
}

function creatorCost(row: NonNullable<RecurringContract["creators"]>[number]) {
  return Number(row.monthly_cache ?? row.monthly_fee ?? 0);
}

function itemInMonth(item: PlanningItem, month: string) {
  return item.month === month || Boolean(item.planned_date?.startsWith(month));
}

function itemStatusClass(status: string) {
  if (status === "published") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "approved") return "bg-blue-50 text-blue-700 border-blue-200";
  if (status === "review") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "in_production") return "bg-purple-50 text-purple-700 border-purple-200";
  if (status === "rejected") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function TypeBadge({ type, short }: { type: string; short?: boolean }) {
  const { t } = useTranslation("app");
  const style = TYPE_STYLE[type] || TYPE_STYLE.other;
  const Icon = style.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-extrabold uppercase", style.bg, style.text, style.border)}>
      <Icon size={11} />
      {t(short ? `recurring.shortFormats.${type}` : `recurring.formats.${type}`, { defaultValue: type })}
    </span>
  );
}

export function RecurringInner({ embedded: _embedded = false }: { embedded?: boolean }) {
  const user = useAuth();
  const { t, i18n } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const { formatCurrency } = usePrivacy();
  const locale = intlLocale(normalizeLocale(i18n.language));
  const canManage = user.role === "admin" || user.role === "company";
  const isAdmin = user.role === "admin";
  const isCreator = user.role === "creator";

  const [contracts, setContracts] = useState<RecurringContract[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [innerTab, setInnerTab] = useState<InnerTab>("contracts");
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [companyFilter, setCompanyFilter] = useState("all");
  const [creatorFilter, setCreatorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [contractModal, setContractModal] = useState(false);
  const [editingContract, setEditingContract] = useState<RecurringContract | null>(null);
  const [contractForm, setContractForm] = useState(EMPTY_CONTRACT);
  const [contentModal, setContentModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PlanningItem | null>(null);
  const [contentForm, setContentForm] = useState(EMPTY_CONTENT);
  const [details, setDetails] = useState<RecurringContract | null>(null);
  const [viewingItem, setViewingItem] = useState<PlanningItem | null>(null);

  async function load() {
    try {
      setContracts((await api.recurring()).data);
    } catch (err) {
      await alertApiError(err);
    }
  }

  useEffect(() => {
    load();
    api.companies("?status=active").then((res) => setCompanies(res.data)).catch(() => undefined);
    api.creators().then((res) => setCreators(res.data)).catch(() => undefined);
  }, []);

  const contentItems = useMemo<PlanningItem[]>(() => {
    return contracts.flatMap((contract) =>
      (contract.items || []).map((item) => ({
        ...item,
        company_id: item.company_id ?? contract.company_id,
        company: item.company ?? (contract.company ? { id: contract.company.id, name: contract.company.name } : null),
      })),
    );
  }, [contracts]);

  const knownCreators = useMemo(() => {
    const map = new Map<number, { id: number; artistic_name: string; full_name: string; photo_url: string | null }>();
    for (const creator of creators) {
      map.set(creator.id, creator);
    }
    for (const contract of contracts) {
      for (const row of contract.creators || []) {
        if (row.creator) map.set(row.creator.id, row.creator);
      }
    }
    return [...map.values()];
  }, [contracts, creators]);

  const filteredContracts = contracts.filter((contract) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || contract.title.toLowerCase().includes(term) || (contract.company?.name || "").toLowerCase().includes(term);
    const matchesCompany = companyFilter === "all" || String(contract.company_id) === companyFilter;
    return matchesSearch && matchesCompany;
  });

  const filteredItems = contentItems.filter((item) => {
    const matchesMonth = itemInMonth(item, selectedMonth);
    const matchesCompany = companyFilter === "all" || String(item.company_id) === companyFilter;
    const matchesCreator = creatorFilter === "all" || String(item.creator_id) === creatorFilter;
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesType = typeFilter === "all" || item.content_type === typeFilter;
    return matchesMonth && matchesCompany && matchesCreator && matchesStatus && matchesType;
  });

  const activeContracts = contracts.filter((c) => c.status === "active");
  const monthItems = contentItems.filter((item) => itemInMonth(item, selectedMonth));
  const publishedMonth = monthItems.filter((item) => item.status === "published").length;
  const monthPercent = monthItems.length ? Math.round((publishedMonth / monthItems.length) * 100) : 0;
  const monthLabel = new Date(`${selectedMonth}-02`).toLocaleDateString(locale, { month: "long", year: "numeric" });
  const agendaCreatorId = creatorFilter !== "all" ? Number(creatorFilter) : knownCreators[0]?.id;
  const agendaCreator = knownCreators.find((c) => c.id === agendaCreatorId);
  const agendaItems = filteredItems.filter((item) => !agendaCreatorId || item.creator_id === agendaCreatorId);

  function openContractModal(contract?: RecurringContract) {
    if (contract) {
      setEditingContract(contract);
      setContractForm({
        title: contract.title,
        company_id: String(contract.company_id),
        monthly_fee: contract.monthly_fee != null ? String(contract.monthly_fee) : "",
        objective: contract.objective || "",
        start_date: contract.start_date || "",
        end_date: contract.end_date || "",
        status: contract.status || "active",
      });
    } else {
      setEditingContract(null);
      setContractForm({
        ...EMPTY_CONTRACT,
        monthly_fee: "0",
        company_id: user.role === "company" && user.company?.id ? String(user.company.id) : companies[0] ? String(companies[0].id) : "",
        start_date: new Date().toISOString().slice(0, 10),
      });
    }
    setContractModal(true);
  }

  function openContentModal(opts?: { contractId?: number; creatorId?: number; item?: PlanningItem; date?: string }) {
    if (opts?.item) {
      setEditingItem(opts.item);
      setContentForm({
        contract_id: String(opts.item.recurring_contract_id),
        creator_id: String(opts.item.creator_id),
        content_type: opts.item.content_type || "reel",
        title: /\s+\d+\/\d+$/.test((opts.item.title || "").trim()) ? "" : (opts.item.title || ""),
        description: opts.item.description || "",
        briefing: opts.item.briefing || opts.item.briefing_note || "",
        planned_date: opts.item.planned_date || "",
        month: opts.item.month || selectedMonth,
      });
    } else {
      setEditingItem(null);
      setContentForm({
        ...EMPTY_CONTENT,
        contract_id: opts?.contractId ? String(opts.contractId) : contracts[0] ? String(contracts[0].id) : "",
        creator_id: opts?.creatorId ? String(opts.creatorId) : "",
        planned_date: opts?.date || "",
        month: opts?.date?.slice(0, 7) || selectedMonth,
      });
    }
    setContentModal(true);
  }

  async function onSaveContract(event: FormEvent) {
    event.preventDefault();
    if (!contractForm.title.trim()) {
      await alertWarning(t("recurring.titleRequired"), t("recurring.titleRequiredText"));
      return;
    }
    if (isAdmin && !contractForm.company_id) {
      await alertWarning(t("recurring.companyRequired"), t("recurring.companyRequiredText"));
      return;
    }
    const companyId = isAdmin ? Number(contractForm.company_id) : user.company?.id;
    if (!editingContract) {
      const selectedCompany = isAdmin
        ? companies.find((company) => company.id === companyId)
        : user.company
          ? { id: user.company.id, status: user.company.status }
          : companies.find((company) => company.id === companyId);
      if (selectedCompany && selectedCompany.status !== "active") {
        await alertWarning(t("recurring.companyNotApproved"), t("recurring.companyNotApprovedText"));
        return;
      }
    }
    const body = {
      title: contractForm.title,
      company_id: companyId,
      monthly_fee: contractForm.monthly_fee ? Number(contractForm.monthly_fee) : null,
      objective: contractForm.objective || null,
      start_date: contractForm.start_date || null,
      end_date: contractForm.end_date || null,
      status: contractForm.status,
    };
    try {
      if (editingContract) {
        await api.updateRecurring(editingContract.id, body);
        await alertSuccess(t("recurring.updated"));
      } else {
        await api.createRecurring(body);
        await alertSuccess(t("recurring.created"));
      }
      setContractModal(false);
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function onSaveContent(event: FormEvent) {
    event.preventDefault();
    if (!contentForm.contract_id || !contentForm.creator_id || !contentForm.title.trim()) {
      await alertWarning(t("recurring.contentIncomplete"), t("recurring.contentIncompleteText"));
      return;
    }
    const body = {
      creator_id: Number(contentForm.creator_id),
      content_type: contentForm.content_type,
      title: contentForm.title,
      description: contentForm.description || null,
      briefing: contentForm.briefing || null,
      planned_date: contentForm.planned_date || null,
      month: contentForm.month || selectedMonth,
    };
    try {
      if (editingItem) {
        await api.updatePlanningItem(editingItem.id, body);
        await alertSuccess(t("recurring.contentUpdated"));
      } else {
        await api.addPlanningItem(Number(contentForm.contract_id), body);
        await alertSuccess(t("recurring.contentCreated"));
      }
      setContentModal(false);
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function onDeleteContract(contract: RecurringContract) {
    if (!(await alertConfirm(t("recurring.deleteTitle"), t("recurring.deleteText", { title: contract.title })))) return;
    try {
      await api.deleteRecurring(contract.id);
      await alertSuccess(t("recurring.deleted"));
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function onReset() {
    if (!(await alertConfirm(t("recurring.resetTitle"), t("recurring.resetText"), t("recurring.resetConfirm")))) return;
    try {
      await api.resetRecurring();
      await alertSuccess(t("recurring.resetDone"));
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function onDeleteItem(item: PlanningItem) {
    if (!(await alertConfirm(t("recurring.contentDeleteTitle"), t("recurring.contentDeleteText", { title: item.title })))) return;
    try {
      await api.deletePlanningItem(item.id);
      await alertSuccess(t("recurring.contentDeleted"));
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function onStatusChange(item: PlanningItem, status: string) {
    try {
      await api.updatePlanningItem(item.id, { status });
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  const companyOptions = [{ value: "all", label: t("recurring.allCompanies") }, ...companies.map((c) => ({ value: String(c.id), label: c.name }))];
  const creatorOptions = [{ value: "all", label: t("recurring.allCreators") }, ...knownCreators.map((c) => ({ value: String(c.id), label: c.artistic_name || c.full_name }))];
  const typeOptions = [{ value: "all", label: t("recurring.allFormats") }, ...CONTENT_TYPES.map((type) => ({ value: type, label: t(`recurring.formats.${type}`) }))];
  const itemStatusOptions = [{ value: "all", label: t("recurring.allStatuses") }, ...ITEM_STATUSES.map((status) => ({ value: status, label: t(`recurring.itemStatus.${status}`) }))];
  const selectedContract = contracts.find((c) => String(c.id) === contentForm.contract_id);
  const contentCreatorOptions = (selectedContract?.creators || [])
    .map((row) => row.creator)
    .filter(Boolean)
    .map((creator) => ({ value: String(creator!.id), label: creator!.artistic_name || creator!.full_name }));
  const fallbackCreatorOptions = knownCreators.map((c) => ({ value: String(c.id), label: c.artistic_name || c.full_name }));

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:gap-6">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2 text-xs font-bold tracking-wider whitespace-nowrap text-brand-primary uppercase">
            <Repeat size={14} className="shrink-0" /> {t("recurring.breadcrumb")}
          </div>
          <h2 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl lg:text-3xl">{t("recurring.title")}</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">{t("recurring.subtitle")}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
          {isAdmin ? (
            <button type="button" onClick={onReset} className="inline-flex w-full shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 shadow-xs transition-colors hover:bg-rose-100 sm:w-auto">
              <Trash2 size={15} className="shrink-0" /> {t("recurring.reset")}
            </button>
          ) : null}
          {canManage ? (
            <button type="button" onClick={() => openContentModal()} className="inline-flex w-full shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:w-auto">
              <Plus size={16} className="shrink-0 text-slate-500" /> {t("recurring.addContent")}
            </button>
          ) : null}
          {canManage ? (
            <button type="button" onClick={() => openContractModal()} className="inline-flex w-full shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-brand-primary px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-100 transition-all hover:bg-indigo-600 sm:w-auto">
              <Plus size={16} className="shrink-0" /> {t("recurring.new")}
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={t("recurring.kpiActive")} value={String(activeContracts.length)} hint={t("recurring.kpiActiveHint")} hintClass="text-emerald-600" icon={Repeat} iconClass="bg-indigo-50 text-brand-primary" />
        <KpiCard label={t("recurring.kpiCreators")} value={String(contracts.reduce((sum, c) => sum + (c.creators?.length || 0), 0))} hint={t("recurring.kpiCreatorsHint")} icon={Users} iconClass="bg-emerald-50 text-emerald-600" />
        <KpiCard
          label={t("recurring.kpiDeliveries")}
          value={`${publishedMonth}`}
          suffix={`/ ${monthItems.length}`}
          hint={monthItems.length ? t("recurring.kpiDeliveriesHint", { percent: monthPercent }) : t("recurring.kpiDeliveriesEmpty")}
          hintClass="text-indigo-600"
          icon={CalendarCheck}
          iconClass="bg-amber-50 text-amber-600"
        />
        {isCreator ? (
          <KpiCard
            label={t("recurring.kpiMyCache")}
            value={formatCurrency(contracts.reduce((sum, contract) => sum + (contract.creators || []).reduce((inner, row) => inner + creatorCost(row), 0), 0))}
            hint={t("recurring.kpiMyCacheHint")}
            hintClass="text-slate-400"
            icon={DollarSign}
            iconClass="bg-violet-50 text-violet-600"
          />
        ) : (
          <KpiCard label={t("recurring.kpiRevenue")} value={formatCurrency(activeContracts.reduce((sum, c) => sum + Number(c.monthly_fee || 0), 0))} hint={t("recurring.kpiRevenueHint")} hintClass="text-slate-400" icon={DollarSign} iconClass="bg-violet-50 text-violet-600" />
        )}
      </div>

      <div className="flex items-center justify-between gap-4 border-b border-slate-200">
        <div className="flex min-w-0 flex-1 items-end gap-4 overflow-x-auto hide-scrollbar lg:gap-8">
          {([
            ["contracts", Building2, t("recurring.tabContracts"), contracts.length],
            ["planning", Layers, t("recurring.tabPlanning"), contentItems.length],
            ["calendar", Calendar, t("recurring.tabCalendar"), null],
            ["creator_calendar", UserCheck, t("recurring.tabCreatorCalendar"), null],
          ] as const).map(([id, Icon, label, count]) => (
            <button
              key={id}
              type="button"
              onClick={() => setInnerTab(id)}
              className={cn(
                "relative flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap pb-4 text-sm font-bold transition-all",
                innerTab === id ? "border-b-2 border-brand-primary text-brand-primary" : "border-b-2 border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              <Icon size={16} className="shrink-0" />
              {label}
              {count != null ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-extrabold text-slate-600">{count}</span> : null}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2 pb-3">
          <button type="button" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))} className="cursor-pointer rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50" title={t("recurring.prevMonth")}>
            <ChevronLeft size={16} />
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-sm">
            <Calendar size={14} className="shrink-0 text-slate-400" />
            <span className="capitalize">{monthLabel}</span>
            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="sr-only" />
          </label>
          <button type="button" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))} className="cursor-pointer rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50" title={t("recurring.nextMonth")}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {innerTab === "contracts" ? (
        <div className="space-y-6">
          <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm sm:flex-row">
            <div className="relative w-full flex-1">
              <Search className="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" size={16} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("recurring.searchPh")} className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-4 pl-10 text-xs font-medium text-slate-800 outline-none focus:border-brand-primary" />
            </div>
            <div className="w-full sm:w-56">
              <Select2Field theme="light" value={companyFilter} options={companyOptions} onChange={setCompanyFilter} />
            </div>
          </div>

          {!filteredContracts.length ? (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Repeat size={24} />
              </div>
              <h3 className="text-base font-bold text-slate-800">{t("recurring.emptyTitle")}</h3>
              <p className="mx-auto max-w-md text-xs text-slate-500">{t("recurring.emptyText")}</p>
              {canManage ? (
                <button type="button" onClick={() => openContractModal()} className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-xs font-bold text-white hover:bg-indigo-600">
                  <Plus size={14} /> {t("recurring.new")}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {filteredContracts.map((contract) => {
                const fee = Number(contract.monthly_fee || 0);
                const cost = (contract.creators || []).reduce((sum, row) => sum + creatorCost(row), 0);
                const remaining = fee - cost;
                const months = contractMonths(contract.start_date, contract.end_date);
                const margin = fee > 0 ? Math.round((remaining / fee) * 100) : 0;
                return (
                  <article key={contract.id} className="@container flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition-all hover:shadow-md">
                    <div className="border-b border-slate-100 p-4 sm:p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                            <span className="max-w-full truncate rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-0.5 text-xs font-black tracking-wider text-brand-primary uppercase">{contract.company?.name || t("campaigns.company")}</span>
                            <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase", contract.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : contract.status === "paused" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-100 text-slate-600")}>
                              {contract.status === "active" ? "● " : ""}
                              {t(`status.${contract.status}`, { defaultValue: contract.status })}
                            </span>
                            {canManage && fee ? <span className="max-w-full truncate rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-700">{t("recurring.monthly", { value: formatCurrency(fee) })}</span> : null}
                            {canManage && contract.end_date && months > 1 && fee ? <span className="max-w-full truncate rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold text-indigo-700">{t("recurring.periodTotal", { value: formatCurrency(fee * months), months })}</span> : null}
                            {canManage && fee ? (
                              <span className={cn("max-w-full truncate rounded-full border px-2 py-0.5 text-[10px] font-black", remaining >= 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700")}>
                                {t("recurring.balance", { value: formatCurrency(remaining) })}
                              </span>
                            ) : null}
                          </div>
                          <h3 className="mt-1 truncate text-lg font-bold text-slate-900 transition-colors hover:text-brand-primary">
                            <Link href={`/recurring/${contract.id}`}>{contract.title}</Link>
                          </h3>
                          {contract.objective ? <p className="mt-1 line-clamp-2 text-xs text-slate-500">{contract.objective}</p> : null}
                        </div>
                        {canManage ? (
                          <div className="flex shrink-0 items-center gap-1">
                            <button type="button" onClick={() => openContractModal(contract)} className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" title={t("recurring.edit")}>
                              <Edit3 size={16} />
                            </button>
                            {isAdmin ? (
                              <button type="button" onClick={() => onDeleteContract(contract)} className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600" title={t("recurring.delete")}>
                                <Trash2 size={16} />
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      {canManage && fee > 0 ? (
                        <div className="mt-4 grid grid-cols-1 gap-2 rounded-xl border border-slate-200/70 bg-slate-50/80 p-2.5 @[520px]:grid-cols-3">
                          <BudgetCell label={t("recurring.budgetMonthly")} value={formatCurrency(fee)} hint={t("recurring.perMonth")} />
                          <BudgetCell label={t("recurring.creatorsLabel", { count: contract.creators?.length || 0 })} value={formatCurrency(cost)} hint={t("recurring.perMonth")} />
                          <BudgetCell
                            label={t("recurring.remaining")}
                            value={formatCurrency(remaining)}
                            hint={remaining >= 0 ? `+${margin}%` : t("recurring.deficit")}
                            tone={remaining >= 0 ? "positive" : "negative"}
                          />
                        </div>
                      ) : isCreator && cost > 0 ? (
                        <div className="mt-4 grid grid-cols-1 gap-2 rounded-xl border border-slate-200/70 bg-slate-50/80 p-2.5">
                          <BudgetCell label={t("recurringDetail.monthlyCache")} value={formatCurrency(cost)} hint={t("recurring.perMonth")} />
                        </div>
                      ) : null}
                    </div>

                    <div className="bg-slate-50/40 p-6">
                      <span className="mb-2 block text-[10px] font-bold tracking-wider text-slate-400 uppercase">{t("recurring.quota")}</span>
                      <div className="flex flex-wrap gap-2">
                        {QUOTA_PILLS.map((pill) => {
                          const count = (contract.creators || []).reduce((sum, row) => sum + quotaValue(row.monthly_deliverables, pill.keys), 0);
                          if (!count) return null;
                          const style = TYPE_STYLE[pill.type] || TYPE_STYLE.other;
                          const Icon = style.icon;
                          return (
                            <span key={pill.type} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-bold whitespace-nowrap", style.bg, style.text, style.border)}>
                              <Icon size={13} /> {t(`recurring.${pill.labelKey}`, { count })}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 p-4 text-xs @[520px]:flex-row @[520px]:items-center @[520px]:justify-between">
                      <div className="flex min-w-0 flex-wrap items-center gap-3">
                        {(contract.creators || []).length ? (
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="flex items-center -space-x-2 overflow-hidden py-0.5">
                              {(contract.creators || []).slice(0, 10).map((row) => (
                                <div key={row.id} className="relative inline-block shrink-0 rounded-full ring-2 ring-white">
                                  <UserAvatar src={row.creator?.photo_url} name={row.creator?.artistic_name || row.creator?.full_name} size="custom" shape="circle" className="h-8 w-8" textClassName="text-xs" />
                                </div>
                              ))}
                            </div>
                            <span className="shrink-0 rounded-lg border border-slate-200/80 bg-white px-2 py-1 text-xs font-bold whitespace-nowrap text-slate-700">
                              {t((contract.creators || []).length === 1 ? "recurring.creatorOne" : "recurring.creatorMany", { count: (contract.creators || []).length })}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/60 bg-white px-2.5 py-1 text-xs text-slate-400 italic">
                            <Users size={13} /> {t("recurring.noCreators")}
                          </span>
                        )}
                        {contract.start_date ? (
                          <>
                            <div className="hidden h-4 w-px bg-slate-200 @[520px]:block" />
                            <span className="flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap text-slate-500">
                              <Calendar size={13} className="shrink-0 text-slate-400" />
                              {t("recurring.start", { date: new Date(`${contract.start_date}T00:00:00`).toLocaleDateString(locale) })}
                            </span>
                          </>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/recurring/${contract.id}`} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-primary px-3.5 py-1.5 text-xs font-bold whitespace-nowrap text-white shadow-sm shadow-indigo-100 hover:bg-indigo-600">
                          <ExternalLink size={13} className="shrink-0" /> {t("recurring.manage")}
                        </Link>
                        <button type="button" onClick={() => setDetails(contract)} className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold whitespace-nowrap text-slate-700 hover:bg-slate-100">
                          {t("recurring.details")}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setInnerTab("planning");
                            setCompanyFilter(String(contract.company_id));
                          }}
                          className="inline-flex shrink-0 cursor-pointer items-center gap-1 text-xs font-bold whitespace-nowrap text-brand-primary hover:underline"
                        >
                          {t("recurring.viewGrid")} <ChevronRight size={14} className="shrink-0" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {innerTab === "planning" ? (
        <div className="space-y-6">
          <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm md:flex-row">
            <div>
              <h3 className="text-base font-bold text-slate-900">{t("recurring.planningTitle", { month: monthLabel })}</h3>
              <p className="mt-0.5 text-xs text-slate-500">{t("recurring.planningHint")}</p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
              <div className="w-full sm:w-44"><Select2Field theme="light" value={companyFilter} options={companyOptions} onChange={setCompanyFilter} /></div>
              <div className="w-full sm:w-44"><Select2Field theme="light" value={creatorFilter} options={creatorOptions} onChange={setCreatorFilter} /></div>
              {canManage ? (
                <button type="button" onClick={() => openContentModal()} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-600">
                  <Plus size={14} /> {t("recurring.newContent")}
                </button>
              ) : null}
            </div>
          </div>

          {contracts.filter((c) => companyFilter === "all" || String(c.company_id) === companyFilter).map((contract) => (
            <div key={contract.id} className="space-y-6 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
              <div className="flex flex-col justify-between gap-2 border-b border-slate-100 pb-4 md:flex-row md:items-center">
                <div>
                  <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider text-brand-primary uppercase">{contract.company?.name}</span>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">{contract.title}</h3>
                </div>
                {canManage ? (
                  <button type="button" onClick={() => openContentModal({ contractId: contract.id })} className="inline-flex cursor-pointer items-center gap-1.5 self-start rounded-lg border border-indigo-100 px-3 py-1.5 text-xs font-bold text-brand-primary transition-colors hover:bg-indigo-50 md:self-auto">
                    <Plus size={14} /> {t("recurring.addMonthItem")}
                  </button>
                ) : null}
              </div>

              {(contract.creators || []).filter((row) => creatorFilter === "all" || String(row.creator_id) === creatorFilter).map((row) => {
                const items = contentItems.filter((item) => item.recurring_contract_id === contract.id && item.creator_id === row.creator_id && itemInMonth(item, selectedMonth));
                const quota = creatorQuota(row.monthly_deliverables);
                const published = items.filter((item) => item.status === "published").length;
                return (
                  <div key={row.id} className="space-y-4 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-5">
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-3">
                        <UserAvatar src={row.creator?.photo_url} name={row.creator?.artistic_name || row.creator?.full_name} size="custom" shape="circle" className="h-10 w-10 border border-slate-200" textClassName="text-sm font-bold" />
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">{row.creator?.artistic_name || row.creator?.full_name}</h4>
                          <p className="text-[11px] text-slate-500">{t("recurring.monthlyGoal", { count: quota })}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="block text-xs font-extrabold text-slate-800">{t("recurring.registered", { done: items.length, total: quota })}</span>
                          <span className="block text-[10px] font-bold text-emerald-600">{t("recurring.publishedCount", { count: published })}</span>
                        </div>
                        {canManage ? (
                          <button type="button" onClick={() => openContentModal({ contractId: contract.id, creatorId: row.creator_id })} className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-100">
                            <Plus size={13} /> {t("recurringDetail.items")}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {!items.length ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-xs text-slate-400">
                        {t("recurring.noPlanning", { month: selectedMonth })}
                        {canManage ? (
                          <button type="button" onClick={() => openContentModal({ contractId: contract.id, creatorId: row.creator_id })} className="ml-2 cursor-pointer font-bold text-brand-primary underline">
                            {t("recurring.createFirst")}
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {items.map((item) => (
                          <div key={item.id} className="flex flex-col justify-between space-y-3 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm transition-all hover:border-indigo-200">
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <TypeBadge type={item.content_type} short />
                                <div className="w-[132px]">
                                  <Select2Field theme="light" value={item.status} options={ITEM_STATUSES.map((status) => ({ value: status, label: t(`recurring.itemStatus.${status}`) }))} onChange={(value) => onStatusChange(item, value)} triggerClassName={cn("h-7 rounded-full px-2 text-[10px] font-bold uppercase", itemStatusClass(item.status))} />
                                </div>
                              </div>
                              <button type="button" onClick={() => setViewingItem(item)} className="mt-2.5 line-clamp-2 cursor-pointer text-left text-xs font-bold text-slate-900 hover:text-brand-primary">
                                {item.title}
                              </button>
                              {item.description ? <p className="mt-1 line-clamp-2 text-[11px] text-slate-600">{item.description}</p> : null}
                              {item.briefing || item.briefing_note || item.script || item.references ? (
                                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                  {item.briefing || item.briefing_note ? (
                                    <button type="button" onClick={() => setViewingItem(item)} className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold whitespace-nowrap text-slate-700 hover:border-indigo-200 hover:text-brand-primary">
                                      <FileText size={11} /> {t("recurringDetail.viewBriefing")}
                                    </button>
                                  ) : null}
                                  {item.script ? (
                                    <button type="button" onClick={() => setViewingItem(item)} className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-indigo-100 bg-indigo-50 px-2 py-1 text-[10px] font-bold whitespace-nowrap text-brand-primary hover:border-indigo-200 hover:bg-white">
                                      <ScrollText size={11} /> {t("recurringDetail.viewScript")}
                                    </button>
                                  ) : null}
                                  {item.references ? (
                                    <button type="button" onClick={() => setViewingItem(item)} className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold whitespace-nowrap text-indigo-600 hover:bg-indigo-50">
                                      <ExternalLink size={11} /> {t("recurringDetail.viewReferences")}
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                            <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] text-slate-400">
                              <span className="font-semibold text-slate-600">{item.planned_date ? t("recurring.dateLabel", { date: new Date(`${item.planned_date}T00:00:00`).toLocaleDateString(locale) }) : t("recurring.noDate")}</span>
                              <div className="flex items-center gap-1">
                                <button type="button" onClick={() => setViewingItem(item)} className="cursor-pointer rounded p-1 text-slate-400 hover:bg-indigo-50 hover:text-brand-primary"><Eye size={13} /></button>
                                {canManage ? <button type="button" onClick={() => openContentModal({ contractId: contract.id, creatorId: row.creator_id, item })} className="cursor-pointer rounded p-1 text-slate-400 hover:text-slate-700"><Edit3 size={13} /></button> : null}
                                {canManage ? <button type="button" onClick={() => onDeleteItem(item)} className="cursor-pointer rounded p-1 text-slate-400 hover:text-rose-600"><Trash2 size={13} /></button> : null}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}

      {innerTab === "calendar" ? (
        <div className="space-y-6">
          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm md:flex-row md:items-center">
            <div>
              <h3 className="text-base font-bold text-slate-900">{t("recurring.calendarTitle", { month: monthLabel })}</h3>
              <p className="mt-0.5 text-xs text-slate-500">{t("recurring.calendarHint")}</p>
            </div>
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 md:w-auto">
              <Select2Field theme="light" value={companyFilter} options={companyOptions} onChange={setCompanyFilter} />
              <Select2Field theme="light" value={creatorFilter} options={creatorOptions} onChange={setCreatorFilter} />
              <Select2Field theme="light" value={typeFilter} options={typeOptions} onChange={setTypeFilter} />
              <Select2Field theme="light" value={statusFilter} options={itemStatusOptions} onChange={setStatusFilter} />
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/70 py-3 text-center text-xs font-extrabold tracking-wider text-slate-500 uppercase">
                  {[t("recurring.weekMon"), t("recurring.weekTue"), t("recurring.weekWed"), t("recurring.weekThu"), t("recurring.weekFri"), t("recurring.weekSat"), t("recurring.weekSun")].map((day) => (
                    <div key={day}>{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 auto-rows-[9.5rem] divide-x divide-y divide-slate-100">
                  {getCalendarDays(selectedMonth).map((cell) => {
                    const dayItems = filteredItems.filter((item) => toDateKey(item.planned_date) === cell.dateStr);
                    const isToday = cell.dateStr === localDateStr();
                    return (
                      <div key={cell.dateStr} className={cn("group flex h-full min-h-0 flex-col overflow-hidden p-2", cell.isCurrentMonth ? "bg-white" : "bg-slate-50/40 text-slate-300")}>
                        <div className="mb-1.5 flex shrink-0 items-center justify-between">
                          <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-extrabold", isToday ? "bg-brand-primary text-white" : cell.isCurrentMonth ? "text-slate-700" : "text-slate-300")}>{cell.dayNumber}</span>
                          <div className="flex items-center gap-1">
                            {dayItems.length > 1 ? (
                              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-black text-slate-500">{dayItems.length}</span>
                            ) : null}
                            {cell.isCurrentMonth && canManage ? (
                              <button type="button" onClick={() => openContentModal({ date: cell.dateStr })} className="cursor-pointer rounded p-1 text-[10px] font-bold text-brand-primary opacity-0 transition-all group-hover:opacity-100 hover:bg-indigo-50">
                                {t("recurring.addDay")}
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pr-0.5">
                          {dayItems.map((item) => (
                            <button key={item.id} type="button" onClick={() => setViewingItem(item)} className={cn("w-full cursor-pointer rounded-lg border p-1.5 text-left text-[10px] font-bold transition-all hover:scale-[1.02]", itemStatusClass(item.status))}>
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[9px] font-black uppercase opacity-80">{t(`recurring.shortFormats.${item.content_type}`, { defaultValue: item.content_type })}</span>
                                <span className="truncate text-[9px] font-semibold">{item.creator?.artistic_name}</span>
                              </div>
                              <p className="mt-0.5 truncate font-bold">{item.title}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {innerTab === "creator_calendar" ? (
        <div className="space-y-6">
          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <UserAvatar src={agendaCreator?.photo_url} name={agendaCreator?.artistic_name || agendaCreator?.full_name} size="custom" shape="rounded-2xl" className="h-12 w-12 border border-slate-200 shadow-xs" textClassName="text-lg font-bold" />
              <div>
                <h3 className="text-base font-bold text-slate-900">{t("recurring.creatorAgenda", { name: agendaCreator?.artistic_name || agendaCreator?.full_name || "—" })}</h3>
                <p className="text-xs text-slate-500">{t("recurring.creatorAgendaHint")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold tracking-wider text-slate-500 uppercase">{t("recurring.selectCreator")}</span>
              <div className="w-56">
                <Select2Field theme="light" value={agendaCreatorId ? String(agendaCreatorId) : ""} options={knownCreators.map((c) => ({ value: String(c.id), label: c.artistic_name || c.full_name }))} onChange={setCreatorFilter} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-4">
                <h4 className="text-sm font-bold text-slate-900">{t("recurring.deadlines", { month: selectedMonth })}</h4>
                {canManage ? (
                  <button type="button" onClick={() => openContentModal({ creatorId: agendaCreatorId })} className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-600">
                    <Plus size={13} /> {t("recurring.schedule")}
                  </button>
                ) : null}
              </div>
              {!agendaItems.length ? (
                <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-12 text-center">
                  <Calendar size={28} className="mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-slate-700">{t("recurring.noPosts")}</p>
                  <p className="text-[11px] text-slate-400">{t("recurring.noPostsHint")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {agendaItems.slice().sort((a, b) => (a.planned_date || "").localeCompare(b.planned_date || "")).map((item) => (
                    <div key={item.id} className="space-y-3 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all hover:border-indigo-200">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="mb-1 flex items-center gap-2">
                            <span className="rounded-md border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-black text-brand-primary uppercase">{item.company?.name || contracts.find((c) => c.id === item.recurring_contract_id)?.company?.name}</span>
                            <TypeBadge type={item.content_type} short />
                          </div>
                          <h4 className="mt-1 text-sm font-bold text-slate-900">{item.title}</h4>
                        </div>
                        <div className="w-[140px]">
                          <Select2Field theme="light" value={item.status} options={ITEM_STATUSES.map((status) => ({ value: status, label: t(`recurring.itemStatus.${status}`) }))} onChange={(value) => onStatusChange(item, value)} triggerClassName={cn("h-7 rounded-full px-2 text-[10px] font-bold uppercase", itemStatusClass(item.status))} />
                        </div>
                      </div>
                      {item.description ? <p className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">{item.description}</p> : null}
                      <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                        <span className="flex items-center gap-1.5 font-bold text-slate-700">
                          <Calendar size={13} className="text-slate-400" />
                          {item.planned_date ? t("recurring.publishOn", { date: new Date(`${item.planned_date}T00:00:00`).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" }) }) : t("recurring.noDate")}
                        </span>
                        <button type="button" onClick={() => setViewingItem(item)} className="inline-flex cursor-pointer items-center gap-1 text-xs font-bold text-brand-primary hover:underline">
                          <Eye size={13} /> {t("recurring.fullBriefing")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
                <h4 className="border-b border-slate-100 pb-3 text-sm font-bold text-slate-900">{t("recurring.summary", { month: selectedMonth })}</h4>
                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-700">
                  <span>{t("recurring.totalPlanned")}</span>
                  <strong className="text-sm font-extrabold text-slate-900">{agendaItems.length}</strong>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs font-semibold text-emerald-900">
                  <span>{t("recurring.publishedDone")}</span>
                  <strong className="text-sm font-extrabold">{agendaItems.filter((i) => i.status === "published").length}</strong>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-purple-100 bg-purple-50/60 p-3 text-xs font-semibold text-purple-900">
                  <span>{t("recurring.inProgress")}</span>
                  <strong className="text-sm font-extrabold">{agendaItems.filter((i) => i.status === "in_production" || i.status === "review").length}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {contractModal ? (
        <div className="app-modal-overlay fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-0 backdrop-blur-sm sm:p-4">
          <div className="app-modal-panel relative z-10 my-auto flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-brand-primary">
                  <Repeat size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{editingContract ? t("recurring.modalEdit") : t("recurring.modalTitle")}</h3>
                  <p className="text-xs text-slate-500">{t("recurring.modalSubtitle")}</p>
                </div>
              </div>
              <button type="button" onClick={() => setContractModal(false)} className="cursor-pointer rounded-lg p-2 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form noValidate onSubmit={onSaveContract} className="flex flex-1 flex-col gap-5 overflow-y-auto p-5 sm:p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">{t("recurring.companyLabel")}</span>
                  {isAdmin ? (
                    <Select2Field
                      theme="light"
                      placeholder={t("recurring.companyPh")}
                      value={contractForm.company_id}
                      options={companies.map((company) => ({ value: String(company.id), label: company.name }))}
                      onChange={(value) => setContractForm({ ...contractForm, company_id: value })}
                      triggerClassName="h-10 rounded-xl px-3.5 text-xs font-bold text-slate-800"
                    />
                  ) : (
                    <input
                      readOnly
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-bold text-slate-800 outline-none"
                      value={user.company?.name || companies.find((company) => String(company.id) === contractForm.company_id)?.name || ""}
                    />
                  )}
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">{t("recurring.projectTitle")}</span>
                  <input
                    className="h-10 w-full rounded-xl border border-slate-200 px-3.5 text-xs font-medium text-slate-800 outline-none focus:border-brand-primary"
                    placeholder={t("recurring.projectTitlePh")}
                    value={contractForm.title}
                    onChange={(e) => setContractForm({ ...contractForm, title: e.target.value })}
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">{t("recurring.objectiveLabel")}</span>
                <textarea
                  rows={3}
                  className="h-20 w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-brand-primary"
                  placeholder={t("recurring.objectivePh")}
                  value={contractForm.objective}
                  onChange={(e) => setContractForm({ ...contractForm, objective: e.target.value })}
                />
              </label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">{t("recurring.startDate")}</span>
                  <input
                    type="date"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3.5 text-xs font-bold text-slate-800 outline-none focus:border-brand-primary"
                    value={contractForm.start_date}
                    onChange={(e) => setContractForm({ ...contractForm, start_date: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">{t("recurring.fee")}</span>
                  <input
                    type="number"
                    min={0}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3.5 text-xs font-bold text-slate-800 outline-none focus:border-brand-primary"
                    placeholder="0"
                    value={contractForm.monthly_fee}
                    onChange={(e) => setContractForm({ ...contractForm, monthly_fee: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">{t("recurring.contractStatus")}</span>
                  <Select2Field
                    theme="light"
                    value={contractForm.status}
                    options={CONTRACT_STATUSES.map((status) => ({ value: status, label: t(`status.${status}`) }))}
                    onChange={(value) => setContractForm({ ...contractForm, status: value })}
                    triggerClassName="h-10 rounded-xl px-3.5 text-xs font-bold text-slate-800"
                  />
                </label>
              </div>
              {editingContract ? (
                <>
                  <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px]">
                    <div className="flex items-center justify-between text-slate-500">
                      <span>{t("recurring.projectBudget")}</span>
                      <span className="font-bold text-slate-800">{formatCurrency(Number(contractForm.monthly_fee || 0))}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500">
                      <span>{t("recurring.creatorsCost", { count: editingContract.creators?.length || 0 })}</span>
                      <span className="font-bold text-slate-700">{formatCurrency((editingContract.creators || []).reduce((sum, row) => sum + creatorCost(row), 0))}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
                      <span className="font-bold text-slate-700">{t("recurring.remainingBalance")}</span>
                      <span className={cn("font-black", Number(contractForm.monthly_fee || 0) - (editingContract.creators || []).reduce((sum, row) => sum + creatorCost(row), 0) >= 0 ? "text-emerald-600" : "text-rose-600")}>
                        {formatCurrency(Number(contractForm.monthly_fee || 0) - (editingContract.creators || []).reduce((sum, row) => sum + creatorCost(row), 0))}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="text-xs font-bold tracking-wider text-slate-800 uppercase">{t("recurring.allocatedCreators", { count: editingContract.creators?.length || 0 })}</span>
                    <Link href={`/recurring/${editingContract.id}`} className="inline-flex items-center gap-1 text-xs font-bold text-brand-primary hover:underline">
                      <ExternalLink size={12} /> {t("recurring.manageOnProject")}
                    </Link>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-indigo-100/60 bg-indigo-50/50 p-4 text-xs">
                  <div className="flex items-start gap-2.5">
                    <div className="shrink-0 rounded-xl bg-brand-primary p-2 text-white">
                      <Users size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{t("recurring.allocateTitle")}</h4>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{t("recurring.allocateBody")}</p>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 border-t border-slate-100 bg-white pt-4">
                {editingContract ? (
                  <button
                    type="button"
                    onClick={() => { setContractModal(false); void onDeleteContract(editingContract); }}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-100"
                  >
                    <Trash2 size={14} /> {t("recurring.delete")}
                  </button>
                ) : null}
                <button type="button" onClick={() => setContractModal(false)} className="flex-1 cursor-pointer rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
                  {tc("cancel")}
                </button>
                <button type="submit" className="flex-1 cursor-pointer rounded-xl bg-brand-primary py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-100 hover:bg-indigo-600">
                  {editingContract ? t("recurring.saveChanges") : t("recurring.createSubmit")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {contentModal ? (
        <div className="app-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-0 sm:p-4">
          <form noValidate onSubmit={onSaveContent} className="app-modal-panel w-full max-w-lg space-y-3 rounded-3xl bg-white p-6">
            <h2 className="text-xl font-black">{editingItem ? t("recurring.contentEdit") : t("recurring.contentModal")}</h2>
            <Select2Field theme="light" placeholder={t("recurring.tabContracts")} value={contentForm.contract_id} options={contracts.map((c) => ({ value: String(c.id), label: `${c.company?.name || ""} · ${c.title}` }))} onChange={(value) => setContentForm({ ...contentForm, contract_id: value, creator_id: "" })} />
            <Select2Field theme="light" placeholder={t("recurringDetail.creator")} value={contentForm.creator_id} options={contentCreatorOptions.length ? contentCreatorOptions : fallbackCreatorOptions} onChange={(value) => setContentForm({ ...contentForm, creator_id: value })} />
            <Select2Field theme="light" placeholder={t("recurring.contentType")} value={contentForm.content_type} options={CONTENT_TYPES.map((type) => ({ value: type, label: t(`recurring.formats.${type}`) }))} onChange={(value) => setContentForm({ ...contentForm, content_type: value })} />
            <label className="block text-xs font-bold text-slate-600">
              {t("recurring.contentTitle")}
              <input className="mt-1 h-11 w-full rounded-xl border px-4 text-sm font-semibold" placeholder={t("recurringDetail.pautaTitlePh")} value={contentForm.title} onChange={(e) => setContentForm({ ...contentForm, title: e.target.value })} />
            </label>
            <label className="text-xs font-bold text-slate-500">{t("recurring.contentDate")}<input type="date" className="mt-1 h-11 w-full rounded-xl border px-4 text-sm" value={contentForm.planned_date} onChange={(e) => setContentForm({ ...contentForm, planned_date: e.target.value, month: e.target.value.slice(0, 7) || contentForm.month })} /></label>
            <textarea className="min-h-24 w-full rounded-xl border px-4 py-3" placeholder={t("recurring.contentBriefing")} value={contentForm.briefing} onChange={(e) => setContentForm({ ...contentForm, briefing: e.target.value })} />
            <div className="flex gap-2">
              <button type="button" onClick={() => setContentModal(false)} className="flex-1 rounded-xl border py-3 font-bold">{tc("cancel")}</button>
              <button className="flex-1 rounded-xl bg-brand-primary py-3 font-bold text-white">{tc("save")}</button>
            </div>
          </form>
        </div>
      ) : null}

      {details ? (
        <div className="app-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-0 sm:p-4">
          <div className="app-modal-panel w-full max-w-lg space-y-4 rounded-3xl bg-white p-6">
            <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-0.5 text-xs font-black tracking-wider text-brand-primary uppercase">{details.company?.name}</span>
            <h2 className="text-xl font-black text-slate-900">{details.title}</h2>
            {details.objective ? <p className="text-sm text-slate-600">{details.objective}</p> : null}
            {canManage && details.monthly_fee != null ? <p className="text-sm font-bold text-slate-800">{formatCurrency(details.monthly_fee)}</p> : null}
            <div className="flex flex-wrap gap-2">
              {(details.creators || []).map((row) => (
                <span key={row.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold">
                  <UserAvatar src={row.creator?.photo_url} name={row.creator?.artistic_name} size="xs" shape="circle" />
                  {row.creator?.artistic_name}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setDetails(null)} className="flex-1 rounded-xl border py-3 font-bold">{t("recurring.close")}</button>
              <Link href={`/recurring/${details.id}`} className="flex-1 rounded-xl bg-brand-primary py-3 text-center font-bold text-white">{t("recurring.manage")}</Link>
            </div>
          </div>
        </div>
      ) : null}

      {viewingItem ? (
        <div className="app-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:p-4">
          <div className="app-modal-panel relative w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 p-6">
              <div>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-black tracking-wider text-brand-primary uppercase">{viewingItem.company?.name || contracts.find((c) => c.id === viewingItem.recurring_contract_id)?.company?.name}</span>
                  <TypeBadge type={viewingItem.content_type} short />
                </div>
                <h3 className="text-xl font-bold text-slate-900">{viewingItem.title}</h3>
                <p className="mt-1 text-xs text-slate-500">{t("recurring.responsible")} <strong className="text-slate-800">{viewingItem.creator?.artistic_name || viewingItem.creator?.full_name}</strong></p>
              </div>
              <button type="button" onClick={() => setViewingItem(null)} className="cursor-pointer rounded-lg p-2 text-slate-400 hover:bg-slate-100">{tc("cancel")}</button>
            </div>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6 text-sm text-slate-600">
              {viewingItem.description ? <p>{viewingItem.description}</p> : null}
              {viewingItem.briefing || viewingItem.briefing_note ? (
                <div>
                  <span className="mb-1.5 block text-[10px] font-bold tracking-wider text-slate-500 uppercase">{t("recurringDetail.pautaBriefingLabel")}</span>
                  <p className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs leading-relaxed whitespace-pre-line text-slate-700">{viewingItem.briefing || viewingItem.briefing_note}</p>
                </div>
              ) : null}
              {viewingItem.script ? (
                <div>
                  <span className="mb-1.5 block text-[10px] font-bold tracking-wider text-brand-primary uppercase">{t("recurringDetail.pautaScriptLabel")}</span>
                  <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed whitespace-pre-line text-slate-700">{viewingItem.script}</p>
                </div>
              ) : null}
              {viewingItem.references ? (
                <div>
                  <span className="mb-1.5 block text-[10px] font-bold tracking-wider text-indigo-600 uppercase">{t("recurringDetail.pautaReferencesLabel")}</span>
                  {/^https?:\/\//i.test(viewingItem.references) ? (
                    <a href={viewingItem.references} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1.5 truncate text-xs font-bold text-brand-primary hover:underline">
                      <ExternalLink size={12} className="shrink-0" /> {viewingItem.references}
                    </a>
                  ) : (
                    <p className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs leading-relaxed whitespace-pre-line text-slate-700">{viewingItem.references}</p>
                  )}
                </div>
              ) : null}
              <p className="text-xs font-bold text-slate-500">{viewingItem.planned_date ? t("recurring.dateLabel", { date: new Date(`${viewingItem.planned_date}T00:00:00`).toLocaleDateString(locale) }) : t("recurring.noDate")}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BudgetCell({ label, value, hint, tone = "neutral" }: { label: string; value: string; hint?: string; tone?: "neutral" | "positive" | "negative" }) {
  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-lg border p-2.5",
        tone === "positive" && "border-emerald-200/70 bg-emerald-50/70",
        tone === "negative" && "border-rose-200/70 bg-rose-50/70",
        tone === "neutral" && "border-slate-200/60 bg-white/80",
      )}
    >
      <span
        className={cn(
          "block truncate text-[9px] font-extrabold tracking-wider uppercase",
          tone === "positive" && "text-emerald-700",
          tone === "negative" && "text-rose-700",
          tone === "neutral" && "text-slate-400",
        )}
      >
        {label}
      </span>
      <p
        className={cn(
          "mt-1 break-words text-[13px] leading-tight font-black tabular-nums @[520px]:text-sm",
          tone === "positive" && "text-emerald-700",
          tone === "negative" && "text-rose-700",
          tone === "neutral" && "text-slate-900",
        )}
      >
        {value}
      </p>
      {hint ? <span className="mt-0.5 block truncate text-[9px] font-semibold text-slate-400">{hint}</span> : null}
    </div>
  );
}

function KpiCard({ label, value, suffix, hint, hintClass, icon: Icon, iconClass }: { label: string; value: string; suffix?: string; hint: string; hintClass?: string; icon: LucideIcon; iconClass: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-bold tracking-wider text-slate-400 uppercase">{label}</span>
        <span className="mt-1 block text-xl leading-tight font-black break-words text-slate-900 tabular-nums sm:text-2xl">
          {value}
          {suffix ? <span className="text-xs font-semibold text-slate-400"> {suffix}</span> : null}
        </span>
        <span className={cn("mt-0.5 block truncate text-[10px] font-semibold", hintClass || "text-slate-500")}>{hint}</span>
      </div>
      <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", iconClass)}>
        <Icon size={22} />
      </div>
    </div>
  );
}

export function RecurringScreen() {
  return (
    <AuthenticatedShell>
      <RecurringInner />
    </AuthenticatedShell>
  );
}
