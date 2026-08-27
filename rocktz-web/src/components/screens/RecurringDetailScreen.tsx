"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { safeHttpUrl } from "@/lib/safe-http-url";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
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
  Clock,
  Columns2,
  DollarSign,
  Edit3,
  ExternalLink,
  FileText,
  Film,
  Instagram,
  LayoutGrid,
  History,
  Layers,
  MessageSquare,
  PieChart,
  Play,
  Plus,
  Radio,
  RefreshCw,
  ScrollText,
  Search,
  Sparkles,
  ThumbsUp,
  Trash2,
  Users,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { CampaignSubmittedVideo } from "@/components/CampaignSubmittedVideo";
import { VideoPlayer } from "@/components/VideoPlayer";
import { CreatorPautaSubmissionPanel } from "@/components/CreatorPautaSubmissionPanel";
import { PostingProfileCards } from "@/components/PostingProfileCards";
import { PautaBriefingFieldsForm } from "@/components/PautaBriefingFields";
import { PautaBriefingView } from "@/components/PautaBriefingView";
import { RecurringMetricsPanel } from "@/components/RecurringMetricsPanel";
import { Select2Field } from "@/components/Select2Field";
import { MoneyInput } from "@/components/MoneyInput";
import { UserAvatar } from "@/components/UserAvatar";
import { api } from "@/lib/api";
import { isPendingAgency } from "@/lib/agency-approval";
import { alertApiError, alertConfirm, alertSuccess, alertWarning } from "@/lib/alerts";
import { cn } from "@/lib/cn";
import { getCalendarDays, localDateStr, toDateKey } from "@/lib/calendar";
import { itemHasPautaBriefing, itemIsAwaitingPauta, isLivePautaType, parsePautaBriefing, pautaBriefingHasContent, pautaBriefingSummary, emptyPautaBriefing } from "@/lib/pauta-briefing";
import { isBrandPosting, normalizePostingProfile, type PostingProfile } from "@/lib/posting-profile";
import { usePrivacy } from "@/lib/privacy";
import { DEFAULT_COUNTRY, formatLocation, moneyCurrency } from "@/lib/geo";
import { moneyToMask, parseMoneyMask } from "@/lib/masks";
import type { Creator, PlanningItem, RecurringContract, RevisionHistoryEntry } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { intlLocale, normalizeLocale } from "@/i18n/locales";

type ContractCreator = NonNullable<RecurringContract["creators"]>[number];
type QuotaCategory = "owing" | "completed" | "no_demand";
type StatusFilter = "all" | "pending_approval" | "missing_pautas" | QuotaCategory;
type UpdateKind = "new_version" | "pending_approval" | null;
type RibbonKind = "new_version" | "pending_approval" | "missing_pautas" | "owing" | "completed";
type ViewTab = "creators" | "calendar" | "metrics";
type CreatorLayout = "split" | "grid";
type PautaViewSection = "briefing" | "script" | "references" | "video";
const LAYOUT_STORAGE_KEY = "rocktz.creatorLayout";

const CONTENT_TYPES = ["reel", "story", "post", "tiktok", "youtube", "live_instagram", "live_tiktok", "live_youtube", "live", "pinterest", "blog", "podcast", "unboxing", "ugc", "event", "other"] as const;
const PAUTA_STATUSES = ["planned", "in_production", "review", "approved", "published"] as const;
const FIELD_INPUT = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-bold text-slate-800 outline-none focus:border-brand-primary";
const FIELD_SELECT = "h-auto min-h-[44px] rounded-xl border-slate-200 bg-slate-50 px-3 py-3 text-xs font-bold text-slate-800";
const QUOTA_FIELDS = [
  ["reels", "quotaReelsInstagram"],
  ["stories", "quotaStoriesSeq"],
  ["posts", "quotaFeedPosts"],
  ["tiktok", "quotaTiktokShort"],
  ["ugc", "quotaUgcVideos"],
  ["youtube", "quotaYoutubeShort"],
  ["live_instagram", "quotaLiveInstagram"],
  ["live_tiktok", "quotaLiveTiktok"],
  ["live_youtube", "quotaLiveYoutube"],
] as const;

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
  ugc: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-100", icon: Camera },
  other: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200", icon: Sparkles },
};

const EMPTY_CREATOR_FORM = {
  creator_id: "",
  start_date: "",
  end_date: "",
  monthly_cache: "",
  notes: "",
  reels: "4",
  stories: "8",
  posts: "0",
  tiktok: "0",
  youtube: "0",
  ugc: "0",
  live_instagram: "0",
  live_tiktok: "0",
  live_youtube: "0",
};
const EMPTY_PAUTA = {
  title: "",
  content_type: "reel",
  planned_date: "",
  briefing: emptyPautaBriefing(),
  script: "",
  references: "",
  live_link: "",
  status: "planned",
  approval_flow: "script_and_video" as "script_and_video" | "video_only",
  posting_profile: "creator" as PostingProfile,
};

function isLivePauta(type: string) {
  return isLivePautaType(type);
}

function pautaVideoUrl(item: PlanningItem) {
  return item.media_url || item.submission_url || null;
}

type PautaVideoVersion = {
  version: number;
  url: string;
  submittedAt?: string;
  current: boolean;
};

function pautaVideoVersions(item: PlanningItem): PautaVideoVersion[] {
  const currentUrl = pautaVideoUrl(item);
  const byVersion = new Map<number, { version: number; url: string; submittedAt?: string }>();
  for (const entry of item.submission_versions ?? []) {
    if (entry.stage !== "video") continue;
    const url = (entry.video_url || entry.media_url || entry.submission_url || "").trim();
    if (!url) continue;
    byVersion.set(entry.version, {
      version: entry.version,
      url,
      submittedAt: entry.submitted_at,
    });
  }
  const currentVersion = item.video_version
    || (byVersion.size ? Math.max(...byVersion.keys()) : currentUrl ? 1 : 0);
  if (currentUrl && ![...byVersion.values()].some((entry) => entry.url === currentUrl)) {
    byVersion.set(currentVersion || 1, {
      version: currentVersion || 1,
      url: currentUrl,
      submittedAt: item.video_submitted_at ?? item.submitted_at ?? undefined,
    });
  }
  return [...byVersion.values()]
    .sort((a, b) => b.version - a.version)
    .map((entry) => ({
      ...entry,
      current: entry.version === (currentVersion || entry.version),
    }));
}

function pautaRevisionHistory(item: PlanningItem): RevisionHistoryEntry[] {
  const stored = (item.revision_history ?? []).filter((entry) => entry.note?.trim());
  if (stored.length > 0) {
    return [...stored].sort((a, b) => +new Date(b.requested_at || 0) - +new Date(a.requested_at || 0));
  }
  const fallback: RevisionHistoryEntry[] = [];
  if (item.script_feedback?.trim()) {
    fallback.push({
      stage: "script",
      note: item.script_feedback.trim(),
      requested_at: item.reviewed_at ?? undefined,
    });
  }
  const videoNote = (item.video_feedback || item.feedback_note || "").trim();
  if (videoNote && !fallback.some((entry) => entry.note === videoNote)) {
    fallback.push({
      stage: "video",
      note: videoNote,
      requested_at: item.reviewed_at ?? undefined,
    });
  }
  return fallback;
}

function todayIsoDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

function quotaEntries(deliverables?: Record<string, number>) {
  return QUOTA_PILLS
    .map((pill) => ({ ...pill, count: quotaValue(deliverables, pill.keys) }))
    .filter((pill) => pill.count > 0);
}

function quotaTotal(deliverables?: Record<string, number>) {
  return quotaEntries(deliverables).reduce((sum, pill) => sum + pill.count, 0);
}

function itemMatchesQuota(item: PlanningItem, keys: string[], type: string) {
  return item.content_type === type || keys.includes(item.content_type);
}

function creatorCost(row: ContractCreator) {
  return Number(row.monthly_cache ?? row.monthly_fee ?? 0);
}

function itemInMonth(item: PlanningItem, month: string) {
  return item.month === month || Boolean(item.planned_date?.startsWith(month));
}

function namedPautaTitle(title?: string | null) {
  const value = (title ?? "").trim();
  if (!value) return "";
  if (/\s+\d+\/\d+$/.test(value)) return "";
  return value;
}

function pautaSlot(monthItems: PlanningItem[], item: PlanningItem) {
  const same = monthItems
    .filter((row) => row.content_type === item.content_type)
    .sort((a, b) => a.id - b.id);
  const current = same.findIndex((row) => row.id === item.id) + 1;
  return { current: Math.max(1, current), total: Math.max(1, same.length) };
}

function isDone(status: string) {
  return status === "published" || status === "approved";
}

function needsScriptApproval(item: PlanningItem) {
  if (isLivePauta(item.content_type) || item.approval_flow === "video_only") return false;
  if (item.script_status === "approved" || !item.script?.trim()) return false;
  return item.script_status === "submitted"
    || (!item.script_status && (item.status === "review" || item.status === "in_production"));
}

function needsVideoApproval(item: PlanningItem) {
  if (isLivePauta(item.content_type)) return false;
  if (item.video_status === "approved") return false;
  const staged = item.approval_flow !== "video_only";
  if (staged && item.script_status !== "approved") return false;
  return item.video_status === "submitted"
    || Boolean(item.media_url || item.submission_url) && item.status === "review";
}

function isScriptRevisionRequested(item: PlanningItem) {
  return item.script_status === "revision";
}

function isVideoRevisionRequested(item: PlanningItem) {
  return item.video_status === "revision";
}

/** Submitted again after a revision request (feedback still stored until approve). */
function isScriptNewVersion(item: PlanningItem) {
  return item.script_status === "submitted" && Boolean(item.script_feedback?.trim());
}

function isVideoNewVersion(item: PlanningItem) {
  return item.video_status === "submitted" && Boolean(item.video_feedback?.trim());
}

function isMaterialNewVersion(item: PlanningItem) {
  return isScriptNewVersion(item) || isVideoNewVersion(item);
}

function isAwaitingBriefing(item: PlanningItem) {
  return itemIsAwaitingPauta(item);
}

function isPublished(item: PlanningItem) {
  return item.status === "published" || Boolean(item.published_url?.trim());
}

function isAwaitingPublishedLink(item: PlanningItem) {
  if (isPublished(item) || isAwaitingBriefing(item)) return false;
  if (isLivePauta(item.content_type)) return true;
  return item.status === "approved" || item.video_status === "approved";
}

function itemNeedsApproval(item: PlanningItem) {
  return needsScriptApproval(item) || needsVideoApproval(item);
}

function creatorRibbonKind(updateKind: UpdateKind, statusCategory: QuotaCategory, missingPautasCount: number): RibbonKind | null {
  if (updateKind === "new_version") return "new_version";
  if (updateKind === "pending_approval") return "pending_approval";
  if (missingPautasCount > 0) return "missing_pautas";
  if (statusCategory === "owing") return "owing";
  if (statusCategory === "completed") return "completed";
  return null;
}

const RIBBON_STYLE: Record<RibbonKind, { bar: string; Icon: LucideIcon; dot: string }> = {
  new_version: { bar: "bg-amber-500", Icon: RefreshCw, dot: "bg-amber-500" },
  pending_approval: { bar: "bg-violet-600", Icon: Sparkles, dot: "bg-violet-600" },
  missing_pautas: { bar: "bg-orange-500", Icon: FileText, dot: "bg-orange-500" },
  owing: { bar: "bg-rose-500", Icon: AlertTriangle, dot: "bg-rose-500" },
  completed: { bar: "bg-emerald-600", Icon: Check, dot: "bg-emerald-500" },
};

const CARD_TONE: Record<RibbonKind, string> = {
  new_version: "border-amber-200/80 bg-amber-50/10",
  pending_approval: "border-violet-200/80 bg-violet-50/10",
  missing_pautas: "border-orange-200/80 bg-orange-50/10",
  owing: "border-rose-200/80 bg-rose-50/10",
  completed: "border-emerald-200/80",
};

function CreatorRibbon({ kind, label }: { kind: RibbonKind | null; label: string }) {
  if (!kind) return null;
  const { bar, Icon } = RIBBON_STYLE[kind];
  return (
    <div className={cn("absolute top-0 right-0 z-10 flex items-center gap-1 rounded-bl-lg px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-white uppercase", bar)}>
      <Icon size={10} /> {label}
    </div>
  );
}

function DetailInner() {
  const user = useAuth();
  const router = useRouter();
  const { t, i18n } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const { formatCurrency: formatCurrencyRaw, formatNumber } = usePrivacy();
  const locale = intlLocale(normalizeLocale(i18n.language));
  const id = usePathname().split("/").filter(Boolean).pop() ?? "";
  const canManage = user.role === "admin" || user.role === "company";
  const isAdmin = user.role === "admin";
  const isCreator = user.role === "creator";
  const ownCreatorId = user.creator?.id ?? null;

  const [contract, setContract] = useState<RecurringContract | null>(null);
  const formatCurrency = (value?: number | null) => formatCurrencyRaw(value, moneyCurrency(contract));
  const [catalog, setCatalog] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewTab>("creators");
  const [creatorLayout, setCreatorLayout] = useState<CreatorLayout>("split");
  const [pautasModalOpen, setPautasModalOpen] = useState(false);
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
  const [viewingPauta, setViewingPauta] = useState<PlanningItem | null>(null);
  const [viewingPautaFocus, setViewingPautaFocus] = useState<PautaViewSection | null>(null);
  const [watchingVideoUrl, setWatchingVideoUrl] = useState<string | null>(null);
  const [reviseModal, setReviseModal] = useState<{ item: PlanningItem | null; note: string; stage: "script" | "video" }>({ item: null, note: "", stage: "script" });
  const [reviseSending, setReviseSending] = useState(false);
  const [revisionHistoryItem, setRevisionHistoryItem] = useState<PlanningItem | null>(null);
  const [liveLinkDraft, setLiveLinkDraft] = useState<Record<number, string>>({});
  const [titleDraft, setTitleDraft] = useState<Record<number, string>>({});
  const [generatingDemands, setGeneratingDemands] = useState(false);

  function openCreatorPanel(creatorId: number) {
    setSelectedCreatorId(creatorId);
    const mobile = typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches;
    if (mobile || creatorLayout === "grid") setPautasModalOpen(true);
  }

  async function load() {
    if (!id || id === "_") return;
    try {
      const data = (await api.recurringOne(id)).data;
      setContract(data);
      if (user.role === "creator" && user.creator?.id) {
        setSelectedCreatorId(user.creator.id);
      } else if (!selectedCreatorId && data.creators?.length) {
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

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (stored === "split" || stored === "grid") setCreatorLayout(stored);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!viewingPauta || !viewingPautaFocus) return;
    const el = document.getElementById(`pauta-view-${viewingPautaFocus}`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [viewingPauta, viewingPautaFocus]);

  function changeCreatorLayout(next: CreatorLayout) {
    setCreatorLayout(next);
    setPautasModalOpen(false);
    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const items = (contract?.items ?? []).filter((item) => !isCreator || !ownCreatorId || item.creator_id === ownCreatorId);
  const allocated = (contract?.creators ?? []).filter((row) => !isCreator || !ownCreatorId || row.creator_id === ownCreatorId);
  const monthLabel = new Date(`${selectedMonth}-02`).toLocaleDateString(locale, { month: "long", year: "numeric" });

  function profile(row: ContractCreator) {
    const extra = catalog.find((c) => c.id === row.creator_id);
    return {
      artistic_name: row.creator?.artistic_name || extra?.artistic_name || "",
      full_name: row.creator?.full_name || extra?.full_name || "",
      photo_url: row.creator?.photo_url || extra?.photo_url || null,
      city: row.creator?.city || extra?.city || null,
      country: row.creator?.country || extra?.country || null,
      state: row.creator?.state || extra?.state || null,
      categories: row.creator?.categories?.length ? row.creator.categories : extra?.categories || [],
      socials: row.creator?.socials || extra?.socials || {},
      followers: Number(extra?.metrics?.followers || 0),
    };
  }

  function summary(row: ContractCreator) {
    const creatorItems = items.filter((item) => item.creator_id === row.creator_id && itemInMonth(item, selectedMonth));
    const quota = quotaTotal(row.monthly_deliverables);
    const completedCount = creatorItems.filter((item) => isDone(item.status)).length;
    const statusCategory: QuotaCategory = quota === 0 ? "no_demand" : completedCount >= quota ? "completed" : "owing";
    const pendingItems = creatorItems.filter(itemNeedsApproval);
    const pendingApprovalCount = pendingItems.length;
    const newVersionCount = pendingItems.filter(isMaterialNewVersion).length;
    const awaitingBriefingCount = creatorItems.filter(isAwaitingBriefing).length;
    const ungeneratedCount = Math.max(0, quota - creatorItems.length);
    const missingPautasCount = awaitingBriefingCount + ungeneratedCount;
    const updateKind: UpdateKind = newVersionCount > 0 ? "new_version" : pendingApprovalCount > 0 ? "pending_approval" : null;
    const ribbon = creatorRibbonKind(updateKind, statusCategory, missingPautasCount);
    return {
      quota,
      completedCount,
      missingToComplete: Math.max(0, quota - completedCount),
      statusCategory,
      pendingApprovalCount,
      newVersionCount,
      awaitingBriefingCount,
      missingPautasCount,
      updateKind,
      ribbon,
      items: creatorItems,
    };
  }

  function ribbonLabel(kind: RibbonKind | null, short = false) {
    if (kind === "new_version") return t(short ? "recurringDetail.newVersionRibbonShort" : "recurringDetail.newVersionRibbon");
    if (kind === "pending_approval") return t(short ? "recurringDetail.newMaterialRibbonShort" : "recurringDetail.newMaterialRibbon");
    if (kind === "missing_pautas") return t(short ? "recurringDetail.missingPautasRibbonShort" : "recurringDetail.missingPautasRibbon");
    if (kind === "owing") return t("recurringDetail.owingRibbon");
    if (kind === "completed") return t("recurringDetail.doneRibbon");
    return t("recurringDetail.filterNone");
  }

  const statusCounts = useMemo(() => {
    let owing = 0;
    let completed = 0;
    let no_demand = 0;
    let pending_approval = 0;
    let missing_pautas = 0;
    allocated.forEach((row) => {
      const stats = summary(row);
      if (stats.statusCategory === "owing") owing += 1;
      else if (stats.statusCategory === "completed") completed += 1;
      else no_demand += 1;
      if (stats.pendingApprovalCount > 0) pending_approval += 1;
      if (stats.missingPautasCount > 0) missing_pautas += 1;
    });
    return { all: allocated.length, owing, completed, no_demand, pending_approval, missing_pautas };
  }, [allocated, items, selectedMonth]);

  const segments = [...new Set(allocated.flatMap((row) => profile(row).categories).filter(Boolean))].sort((a, b) => a.localeCompare(b, locale));
  const locationOptions = [...new Map(
    allocated.map((row) => {
      const info = profile(row);
      const country = (info.country || DEFAULT_COUNTRY).toUpperCase();
      const state = (info.state || "").trim().toUpperCase();
      const value = state ? `${country}:${state}` : country;
      return [value, formatLocation(locale, { state: info.state, country })] as const;
    }),
  ).entries()]
    .filter(([, label]) => Boolean(label))
    .sort((a, b) => a[1].localeCompare(b[1], locale))
    .map(([value, label]) => ({ value, label }));

  const filteredCreators = allocated
    .filter((row) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "pending_approval") return summary(row).pendingApprovalCount > 0;
      if (statusFilter === "missing_pautas") return summary(row).missingPautasCount > 0;
      return summary(row).statusCategory === statusFilter;
    })
    .filter((row) => segmentFilter === "all" || profile(row).categories.some((cat) => cat.trim().toLowerCase() === segmentFilter.toLowerCase()))
    .filter((row) => {
      if (stateFilter === "all") return true;
      const info = profile(row);
      const country = (info.country || DEFAULT_COUNTRY).toUpperCase();
      const state = (info.state || "").trim().toUpperCase();
      const value = state ? `${country}:${state}` : country;
      return value === stateFilter;
    })
    .filter((row) => {
      const term = search.trim().toLowerCase();
      if (!term) return true;
      const info = profile(row);
      return [info.artistic_name, info.full_name, Object.values(info.socials).join(" "), info.city, info.state, info.country, info.categories.join(" ")].join(" ").toLowerCase().includes(term);
    })
    .sort((a, b) => profile(a).artistic_name.localeCompare(profile(b).artistic_name, locale, { sensitivity: "base" }));

  const selectedRow = allocated.find((row) => row.creator_id === selectedCreatorId) || filteredCreators[0] || allocated[0];
  const selectedInfo = selectedRow ? profile(selectedRow) : null;
  const selectedSummary = selectedRow ? summary(selectedRow) : null;
  const selectedPautas = selectedRow ? selectedSummary!.items.filter((item) => (showCompleted ? true : !isPublished(item))) : [];
  const completedPautas = selectedSummary?.items.filter((item) => isPublished(item)).length || 0;

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
        start_date: row.start_date || contract?.start_date || todayIsoDate(),
        end_date: row.end_date || contract?.end_date || "",
        monthly_cache: moneyToMask(row.monthly_cache ?? row.monthly_fee ?? 0, moneyCurrency(contract)),
        notes: row.notes || "",
        reels: String(d.reels ?? d.reel ?? 0),
        stories: String(d.stories ?? d.story ?? 0),
        posts: String(d.posts ?? d.post ?? 0),
        tiktok: String(d.tiktok ?? 0),
        youtube: String(d.youtube ?? 0),
        ugc: String(d.ugc ?? 0),
        live_instagram: String(d.live_instagram ?? d.live ?? 0),
        live_tiktok: String(d.live_tiktok ?? 0),
        live_youtube: String(d.live_youtube ?? 0),
      });
    } else {
      setEditingCreator(null);
      setCreatorForm({
        ...EMPTY_CREATOR_FORM,
        creator_id: catalog[0] ? String(catalog[0].id) : "",
        start_date: contract?.start_date || todayIsoDate(),
        end_date: contract?.end_date || "",
      });
    }
    setCreatorModal(true);
  }

  function openPautaModal(creatorId: number, item?: PlanningItem) {
    setPautaCreatorId(creatorId);
    if (item) {
      setEditingPauta(item);
      setPautaForm({
        title: namedPautaTitle(item.title),
        content_type: item.content_type || "reel",
        planned_date: item.planned_date || "",
        briefing: parsePautaBriefing(item),
        script: item.script || "",
        references: item.references || "",
        live_link: item.published_url || "",
        status: PAUTA_STATUSES.includes(item.status as (typeof PAUTA_STATUSES)[number]) ? item.status : "planned",
        approval_flow: item.approval_flow === "video_only" ? "video_only" : "script_and_video",
        posting_profile: normalizePostingProfile(item.posting_profile),
      });
    } else {
      setEditingPauta(null);
      setPautaForm({ ...EMPTY_PAUTA, planned_date: `${selectedMonth}-01`, briefing: emptyPautaBriefing() });
    }
    setPautaModal(true);
  }

  function openPautaView(item: PlanningItem, focus?: PautaViewSection) {
    setViewingPauta(item);
    setViewingPautaFocus(focus ?? null);
  }

  function closePautaView() {
    setViewingPauta(null);
    setViewingPautaFocus(null);
  }

  const creatorBudgetPreview = useMemo(() => {
    if (!fee) return null;
    const editingId = editingCreator?.creator_id ?? (creatorForm.creator_id ? Number(creatorForm.creator_id) : null);
    const othersCost = allocated.filter((row) => row.creator_id !== editingId).reduce((sum, row) => sum + creatorCost(row), 0);
    const proposed = parseMoneyMask(creatorForm.monthly_cache, moneyCurrency(contract));
    return { total: fee, others: othersCost, remaining: fee - othersCost - proposed };
  }, [fee, allocated, editingCreator, creatorForm.creator_id, creatorForm.monthly_cache]);

  async function onSaveCreator(event: FormEvent) {
    event.preventDefault();
    if (!contract) return;
    if (!creatorForm.creator_id) {
      await alertWarning(t("recurringDetail.creatorRequired"), t("recurringDetail.creatorRequiredText"));
      return;
    }
    if (!creatorForm.start_date) {
      await alertWarning(tc("alerts.incompleteTitle"), t("recurringDetail.contractStartRequired"));
      return;
    }
    try {
      await api.addRecurringCreator(contract.id, {
        creator_id: Number(creatorForm.creator_id),
        start_date: creatorForm.start_date,
        end_date: creatorForm.end_date || null,
        monthly_cache: creatorForm.monthly_cache ? parseMoneyMask(creatorForm.monthly_cache, moneyCurrency(contract)) : 0,
        notes: creatorForm.notes || null,
        monthly_deliverables: {
          reels: Number(creatorForm.reels) || 0,
          stories: Number(creatorForm.stories) || 0,
          posts: Number(creatorForm.posts) || 0,
          tiktok: Number(creatorForm.tiktok) || 0,
          youtube: Number(creatorForm.youtube) || 0,
          ugc: Number(creatorForm.ugc) || 0,
          live_instagram: Number(creatorForm.live_instagram) || 0,
          live_tiktok: Number(creatorForm.live_tiktok) || 0,
          live_youtube: Number(creatorForm.live_youtube) || 0,
        },
      });
      await alertSuccess(editingCreator ? t("recurringDetail.creatorUpdated") : t("recurringDetail.creatorSaved"));
      setCreatorModal(false);
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function onGenerateMonthDemands(creatorId: number) {
    if (!contract) return;
    setGeneratingDemands(true);
    try {
      const res = await api.generateRecurringMonthDemands(contract.id, {
        creator_id: creatorId,
        month: selectedMonth,
      });
      setContract(res.data);
      await alertSuccess(res.message || t("recurringDetail.demandsGenerated", { count: res.created }));
    } catch (err) {
      await alertApiError(err);
    } finally {
      setGeneratingDemands(false);
    }
  }

  async function onSavePublishedLink(item: PlanningItem, url: string) {
    const trimmed = url.trim();
    if (!trimmed) {
      await alertWarning(tc("alerts.incompleteTitle"), t("campaignDetail.publishedLinkRequired"));
      return;
    }
    try {
      await api.updatePlanningItem(item.id, { published_url: trimmed });
      await alertSuccess(t("recurringDetail.publishedLinkSaved"));
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function onSaveLiveLink(item: PlanningItem, url: string) {
    const trimmed = url.trim();
    if (!trimmed) {
      await alertWarning(tc("alerts.incompleteTitle"), t("recurringDetail.liveLinkRequired"));
      return;
    }
    try {
      await api.updatePlanningItem(item.id, { published_url: trimmed, status: "published", approval_flow: "live_link" });
      await alertSuccess(t("recurringDetail.liveLinkSaved"));
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function onSavePauta(event: FormEvent) {
    event.preventDefault();
    if (!contract) return;
    const live = isLivePauta(pautaForm.content_type);
    if (!pautaCreatorId || !pautaForm.title.trim() || !pautaForm.content_type || !pautaForm.planned_date || (!live && !pautaBriefingHasContent(pautaForm.briefing))) {
      await alertWarning(tc("alerts.incompleteTitle"), live ? t("recurringDetail.pautaLiveIncompleteText") : t("recurringDetail.pautaIncompleteText"));
      return;
    }
    const body: Record<string, unknown> = {
      creator_id: pautaCreatorId,
      title: pautaForm.title.trim(),
      content_type: pautaForm.content_type,
      planned_date: pautaForm.planned_date,
      month: pautaForm.planned_date.slice(0, 7),
      briefing: pautaBriefingSummary(pautaForm.briefing),
      briefing_fields: pautaForm.briefing,
      script: live ? null : pautaForm.script.trim() || null,
      references: live ? null : pautaForm.references.trim() || null,
      status: live && pautaForm.live_link.trim() ? "published" : pautaForm.status,
    };
    if (live) {
      body.approval_flow = "live_link";
      body.published_url = pautaForm.live_link.trim() || null;
    } else {
      body.approval_flow = pautaForm.approval_flow;
    }
    body.posting_profile = pautaForm.posting_profile;
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

  async function approveAgency() {
    if (!contract) return;
    try {
      await api.approveRecurringAgency(contract.id);
      await alertSuccess(t("recurringDetail.approvedAgency"));
      load();
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
    if (!(await alertConfirm(t("recurringDetail.pautaDeleteTitle"), t("recurringDetail.pautaDeleteText", { title: namedPautaTitle(item.title) || t("recurringDetail.untitledPauta") })))) return false;
    try {
      await api.deletePlanningItem(item.id);
      await alertSuccess(t("recurringDetail.pautaDeleted"));
      load();
      return true;
    } catch (err) {
      await alertApiError(err);
      return false;
    }
  }

  async function onSavePautaTitle(item: PlanningItem) {
    const next = (titleDraft[item.id] ?? namedPautaTitle(item.title)).trim();
    const current = namedPautaTitle(item.title);
    if (next === current) return;
    try {
      await api.updatePlanningItem(item.id, { title: next || null });
      setContract((prev) => {
        if (!prev?.items) return prev;
        return { ...prev, items: prev.items.map((row) => (row.id === item.id ? { ...row, title: next } : row)) };
      });
      setTitleDraft((prev) => {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      });
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

  async function onApproveScript(item: PlanningItem) {
    if (!(await alertConfirm(t("recurringDetail.approveScriptTitle"), t("recurringDetail.approveScriptText")))) return;
    try {
      await api.updatePlanningItem(item.id, {
        script_status: "approved",
        script_feedback: "",
        status: "in_production",
        feedback_note: "",
      });
      await alertSuccess(t("recurringDetail.approveScriptOk"));
      if (viewingPauta?.id === item.id) closePautaView();
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function onApproveVideo(item: PlanningItem) {
    if (!(await alertConfirm(t("recurringDetail.approveVideoTitle"), t("recurringDetail.approveVideoText")))) return;
    try {
      await api.updatePlanningItem(item.id, {
        video_status: "approved",
        video_feedback: "",
        status: "approved",
        feedback_note: "",
      });
      await alertSuccess(t("recurringDetail.approveVideoOk"));
      if (viewingPauta?.id === item.id) closePautaView();
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function onRequestRevision() {
    const item = reviseModal.item;
    const note = reviseModal.note.trim();
    const stage = reviseModal.stage;
    if (!item) return;
    if (!note) {
      await alertWarning(
        tc("alerts.incompleteTitle"),
        t(stage === "video" ? "recurringDetail.reviseVideoRequired" : "recurringDetail.reviseScriptRequired"),
      );
      return;
    }
    setReviseSending(true);
    try {
      await api.updatePlanningItem(item.id, stage === "video"
        ? {
          video_status: "revision",
          video_feedback: note,
          status: "in_production",
          feedback_note: note,
        }
        : {
          script_status: "revision",
          script_feedback: note,
          status: "in_production",
          feedback_note: note,
        });
      await alertSuccess(t(stage === "video" ? "recurringDetail.reviseVideoOk" : "recurringDetail.reviseScriptOk"));
      setReviseModal({ item: null, note: "", stage: "script" });
      if (viewingPauta?.id === item.id) closePautaView();
      load();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setReviseSending(false);
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

  const statusLabel = isPendingAgency(contract.status)
    ? t("recurringDetail.pendingAgency")
    : contract.status === "active"
      ? t("recurringDetail.activeProject")
      : contract.status === "paused"
        ? t("recurringDetail.paused")
        : t("recurringDetail.finished");
  const viewingVideoVersions = viewingPauta ? pautaVideoVersions(viewingPauta) : [];

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="flex items-center justify-between">
        <Link href="/campaign-deliveries/?tab=recurring" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-500 shadow-sm transition-all hover:text-brand-primary">
          <ArrowLeft size={14} /> {t("recurringDetail.back")}
        </Link>
        {canManage ? (
          <div className="flex items-center gap-2">
            {isAdmin && isPendingAgency(contract.status) ? (
              <button type="button" onClick={() => void approveAgency()} className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700">
                <CheckCircle2 size={14} /> {t("recurringDetail.approveAgency")}
              </button>
            ) : null}
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
              <span className={cn(
                "rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase",
                contract.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : contract.status === "paused" ? "border-amber-200 bg-amber-50 text-amber-700"
                  : isPendingAgency(contract.status) ? "border-amber-300 bg-amber-50 text-amber-900"
                  : "border-slate-200 bg-slate-100 text-slate-700",
              )}>
                {contract.status === "active" ? "● " : ""}{statusLabel}
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">{contract.title}</h1>
            {contract.objective ? <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">{contract.objective}</p> : null}
            {isPendingAgency(contract.status) ? (
              <p className="mt-2 max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900">{t("recurringDetail.awaitingAgencyHint")}</p>
            ) : null}
          </div>
        </div>

        <div className={cn("mt-5 grid grid-cols-1 gap-3.5 border-t border-slate-100 pt-5 sm:grid-cols-2", !isCreator && "xl:grid-cols-4")}>
          {isCreator ? (
            allocated[0] ? (
              <MetricTile icon={DollarSign} iconClass="bg-indigo-100/80 text-brand-primary" label={t("recurringDetail.monthlyCache")} value={formatCurrency(creatorCost(allocated[0]))} unit={t("recurringDetail.perMonth")} />
            ) : null
          ) : (
            <>
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
            </>
          )}
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
            <Users size={14} /> {isCreator ? t("recurringDetail.tabMyDemands") : t("recurringDetail.tabCreators", { count: allocated.length })}
          </button>
          <button type="button" onClick={() => setView("calendar")} className={cn("inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all", view === "calendar" ? "bg-slate-900 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
            <Calendar size={14} /> {t("recurringDetail.tabCalendar")}
          </button>
          {!isCreator ? (
            <button type="button" onClick={() => setView("metrics")} className={cn("inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all", view === "metrics" ? "bg-slate-900 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
              <BarChart3 size={14} /> {t("recurringDetail.tabMetrics")}
            </button>
          ) : null}
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
        <div className={cn("grid grid-cols-1 gap-6", !isCreator && creatorLayout === "split" && "lg:grid-cols-12")}>
          {!isCreator ? (
          <div className={cn("flex flex-col gap-4", creatorLayout === "split" ? "lg:col-span-5" : "col-span-full")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-xs font-black tracking-wider text-slate-600 uppercase">
                <Users size={14} className="text-brand-primary" /> {t("recurringDetail.allocated", { count: allocated.length })}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5">
                  <button type="button" onClick={() => changeCreatorLayout("split")} title={t("recurringDetail.layoutSplitHint")} aria-label={t("recurringDetail.layoutSplitHint")} className={cn("inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-bold whitespace-nowrap", creatorLayout === "split" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100")}>
                    <Columns2 size={13} className="shrink-0" /> <span className="hidden sm:inline">{t("recurringDetail.layoutSplit")}</span>
                  </button>
                  <button type="button" onClick={() => changeCreatorLayout("grid")} title={t("recurringDetail.layoutGridHint")} aria-label={t("recurringDetail.layoutGridHint")} className={cn("inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-bold whitespace-nowrap", creatorLayout === "grid" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100")}>
                    <LayoutGrid size={13} className="shrink-0" /> <span className="hidden sm:inline">{t("recurringDetail.layoutGrid")}</span>
                  </button>
                </div>
                {allocated.length && creatorLayout === "split" ? (
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
                  <Select2Field theme="light" value={stateFilter} options={[{ value: "all", label: t("recurringDetail.allStates") }, ...locationOptions]} onChange={setStateFilter} />
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  {([
                    ["all", t("recurringDetail.filterAll"), statusCounts.all, "bg-slate-900 text-white border-slate-900", "bg-white text-slate-600 border-slate-200"],
                    ["pending_approval", t("recurringDetail.filterPendingApproval"), statusCounts.pending_approval, "bg-violet-700 text-white border-violet-700", "bg-white text-violet-700 border-violet-200"],
                    ["missing_pautas", t("recurringDetail.filterMissingPautas"), statusCounts.missing_pautas, "bg-orange-600 text-white border-orange-600", "bg-white text-orange-700 border-orange-200"],
                    ["owing", t("recurringDetail.filterOwing"), statusCounts.owing, "bg-rose-600 text-white border-rose-600", "bg-white text-rose-700 border-rose-200"],
                    ["completed", t("recurringDetail.filterDone"), statusCounts.completed, "bg-emerald-700 text-white border-emerald-700", "bg-white text-emerald-700 border-emerald-200"],
                    ["no_demand", t("recurringDetail.filterNone"), statusCounts.no_demand, "bg-slate-700 text-white border-slate-700", "bg-white text-slate-600 border-slate-200"],
                  ] as const).map(([key, label, count, active, idle]) => (
                    <button key={key} type="button" onClick={() => setStatusFilter(key)} className={cn("flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold whitespace-nowrap", statusFilter === key ? active : idle)}>
                      {key === "pending_approval" ? <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500" /> : null}
                      {key === "missing_pautas" ? <span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-500" /> : null}
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
              <div className={cn(creatorLayout === "grid" ? "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" : "flex flex-col gap-2.5")}>
                {filteredCreators.map((row) => {
                  const info = profile(row);
                  const stats = summary(row);
                  const deliveries = quotaEntries(row.monthly_deliverables);
                  const selected = selectedRow?.creator_id === row.creator_id;
                  const expanded = expandedIds.includes(row.creator_id);
                  const handle = info.socials.instagram ? `@${info.socials.instagram.replace(/^@/, "")}` : null;
                  const location = formatLocation(locale, info);

                  if (creatorLayout === "grid") {
                    return (
                      <div
                        key={row.id}
                        className={cn(
                          "group relative flex flex-col items-center overflow-hidden rounded-xl border bg-white p-2.5 text-center shadow-sm transition-all hover:border-indigo-200 hover:shadow-md",
                          stats.ribbon ? CARD_TONE[stats.ribbon] : "border-slate-200",
                        )}
                      >
                        {stats.updateKind || stats.missingPautasCount > 0 ? (
                          <CreatorRibbon kind={stats.ribbon} label={ribbonLabel(stats.ribbon, true)} />
                        ) : (
                          <span
                            className={cn("absolute top-2 right-2 h-2 w-2 rounded-full", stats.ribbon ? RIBBON_STYLE[stats.ribbon].dot : "bg-slate-300")}
                            title={ribbonLabel(stats.ribbon)}
                          />
                        )}
                        <UserAvatar src={info.photo_url} name={info.artistic_name || info.full_name} size="custom" shape="circle" className="mb-2 h-12 w-12 shrink-0 border border-slate-200" textClassName="text-xs font-bold" />
                        <h4 className="w-full truncate px-0.5 text-[11px] font-bold text-slate-900" title={info.artistic_name || info.full_name}>
                          {info.artistic_name || info.full_name}
                        </h4>
                        {handle ? <p className="mt-0.5 w-full truncate px-0.5 text-[9px] text-slate-400">{handle}</p> : null}
                        {info.followers > 0 ? (
                          <p className="mt-0.5 text-[9px] font-semibold text-slate-500">
                            {info.followers.toLocaleString(locale)} {t("recurringDetail.followers")}
                          </p>
                        ) : null}
                        {location ? <p className="mt-0.5 w-full truncate px-0.5 text-[9px] text-slate-400">📍 {location}</p> : null}
                        {info.categories[0] ? (
                          <span className="mt-1 max-w-full truncate rounded-md border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[8px] font-extrabold text-indigo-700">{info.categories[0]}</span>
                        ) : null}
                        {stats.updateKind || stats.missingPautasCount > 0 ? (
                          <div className="mt-1.5 flex max-w-full flex-wrap items-center justify-center gap-1">
                            {stats.updateKind ? (
                              <span className={cn(
                                "max-w-full truncate rounded-full px-2 py-0.5 text-[9px] font-extrabold",
                                stats.updateKind === "new_version" ? "bg-amber-50 text-amber-800" : "bg-violet-50 text-violet-700",
                              )}>
                                {stats.updateKind === "new_version"
                                  ? t("recurringDetail.newVersionCount", { count: stats.newVersionCount })
                                  : t("recurringDetail.pendingApprovalCount", { count: stats.pendingApprovalCount })}
                              </span>
                            ) : null}
                            {stats.missingPautasCount > 0 ? (
                              <span className="max-w-full truncate rounded-full bg-orange-50 px-2 py-0.5 text-[9px] font-extrabold text-orange-700">
                                {t("recurringDetail.missingPautasCount", { count: stats.missingPautasCount })}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                        <span
                          className={cn(
                            "mt-1.5 rounded-full px-2 py-0.5 text-[9px] font-extrabold",
                            stats.statusCategory === "owing"
                              ? "bg-rose-50 text-rose-600"
                              : stats.statusCategory === "completed"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500",
                          )}
                        >
                          {stats.quota === 0
                            ? t("recurringDetail.filterNone")
                            : stats.statusCategory === "owing"
                              ? t("recurringDetail.missing", { missing: stats.missingToComplete, done: stats.completedCount, total: stats.quota })
                              : t("recurringDetail.doneCount", { done: stats.completedCount, total: stats.quota })}
                        </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCreatorId(row.creator_id);
                            setPautasModalOpen(true);
                          }}
                          className="mt-2 inline-flex w-full cursor-pointer items-center justify-center gap-1 rounded-lg bg-brand-primary px-2 py-1.5 text-[10px] font-bold text-white hover:bg-indigo-600"
                        >
                          <FileText size={11} className="shrink-0" /> {t("recurringDetail.viewDemands")}
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div key={row.id} onClick={() => openCreatorPanel(row.creator_id)} className={cn("relative cursor-pointer overflow-hidden rounded-2xl border bg-white shadow-sm transition-all", selected ? "border-brand-primary bg-indigo-50/10 ring-2 ring-indigo-500/10 shadow-md" : stats.ribbon ? CARD_TONE[stats.ribbon] : "border-slate-200 hover:border-slate-300")}>
                      <CreatorRibbon kind={stats.ribbon} label={ribbonLabel(stats.ribbon)} />
                      <div className="space-y-3 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <UserAvatar src={info.photo_url} name={info.artistic_name || info.full_name} size="custom" shape="rounded-xl" className="h-11 w-11 shrink-0 border border-slate-200" textClassName="text-sm font-bold" />
                            <div className="min-w-0 flex-1">
                              <h4 className="truncate text-sm font-bold text-slate-900">{info.artistic_name || info.full_name}</h4>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                <span className="truncate text-[11px] text-slate-400">{info.socials.instagram ? `@${info.socials.instagram.replace(/^@/, "")}` : t("recurringDetail.partner")}</span>
                                {formatLocation(locale, info) ? <span className="rounded-md border border-slate-200 bg-slate-100 px-1.5 text-[10px] font-bold text-slate-600">📍 {formatLocation(locale, info)}</span> : null}
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
                              <div className="flex min-w-0 flex-wrap items-center gap-1">
                                {stats.updateKind ? (
                                  <span className={cn(
                                    "truncate rounded-md border px-2 py-0.5 text-[10px] font-extrabold",
                                    stats.updateKind === "new_version" ? "border-amber-200 bg-amber-100/80 text-amber-800" : "border-violet-200 bg-violet-100/80 text-violet-700",
                                  )}>
                                    {stats.updateKind === "new_version"
                                      ? t("recurringDetail.newVersionCount", { count: stats.newVersionCount })
                                      : t("recurringDetail.pendingApprovalCount", { count: stats.pendingApprovalCount })}
                                  </span>
                                ) : null}
                                {stats.missingPautasCount > 0 ? (
                                  <span className="truncate rounded-md border border-orange-200 bg-orange-100/80 px-2 py-0.5 text-[10px] font-extrabold text-orange-700">
                                    {t("recurringDetail.missingPautasCount", { count: stats.missingPautasCount })}
                                  </span>
                                ) : null}
                                {!stats.updateKind && stats.missingPautasCount === 0 && stats.statusCategory === "owing" ? (
                                  <span className="truncate rounded-md border border-rose-200 bg-rose-100/80 px-2 py-0.5 text-[10px] font-extrabold text-rose-600">{t("recurringDetail.missing", { missing: stats.missingToComplete, done: stats.completedCount, total: stats.quota })}</span>
                                ) : null}
                                {!stats.updateKind && stats.missingPautasCount === 0 && stats.statusCategory === "completed" ? (
                                  <span className="truncate rounded-md border border-emerald-200 bg-emerald-100/80 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">{t("recurringDetail.doneCount", { done: stats.completedCount, total: stats.quota })}</span>
                                ) : null}
                                {!stats.updateKind && stats.missingPautasCount === 0 && stats.statusCategory === "no_demand" ? (
                                  <span className="truncate rounded-md border border-slate-300/60 bg-slate-200/70 px-2 py-0.5 text-[10px] font-bold text-slate-500">{t(stats.completedCount === 1 ? "recurringDetail.deliveredCount" : "recurringDetail.deliveredCountMany", { count: stats.completedCount })}</span>
                                ) : null}
                                {stats.updateKind && stats.statusCategory === "owing" && stats.missingPautasCount === 0 ? (
                                  <span className="truncate rounded-md border border-rose-200 bg-rose-100/80 px-2 py-0.5 text-[10px] font-extrabold text-rose-600">{t("recurringDetail.missingShort", { count: stats.missingToComplete })}</span>
                                ) : null}
                              </div>
                              {canManage ? (
                                <button
                                  type="button"
                                  disabled={generatingDemands}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCreatorId(row.creator_id);
                                    const stats = summary(row);
                                    if (stats.quota > 0 && stats.items.length === 0) {
                                      void onGenerateMonthDemands(row.creator_id);
                                      return;
                                    }
                                    openPautaModal(row.creator_id);
                                  }}
                                  className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-brand-primary px-2 py-1 text-[10px] font-bold text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {(() => {
                                    const stats = summary(row);
                                    if (stats.quota > 0 && stats.items.length === 0) {
                                      return (
                                        <>
                                          <Layers size={11} /> {generatingDemands ? t("recurringDetail.generatingDemands") : t("recurringDetail.generateDemandsShort")}
                                        </>
                                      );
                                    }
                                    return (
                                      <>
                                        <Plus size={11} /> {t("recurringDetail.addBrief")}
                                      </>
                                    );
                                  })()}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1.5 border-t border-slate-100 pt-2.5">
                          <span className="block text-[9px] font-extrabold tracking-wider text-slate-400 uppercase">{t("recurringDetail.quotas")}</span>
                          <div className="flex flex-wrap gap-1.5">
                            {deliveries.length === 0 ? (
                              <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{t("recurringDetail.noQuota")}</span>
                            ) : deliveries.map((pill) => {
                              const typeItems = stats.items.filter((item) => itemMatchesQuota(item, pill.keys, pill.type));
                              const generated = typeItems.length;
                              const done = typeItems.filter((item) => isDone(item.status) || (isLivePauta(item.content_type) && Boolean(item.published_url))).length;
                              const awaiting = typeItems.filter(isAwaitingBriefing).length;
                              const style = TYPE_STYLE[pill.type] || TYPE_STYLE.other;
                              const Icon = style.icon;
                              const complete = done >= pill.count;
                              const missingSlots = generated < pill.count;
                              return (
                                <span
                                  key={pill.type}
                                  title={awaiting > 0
                                    ? t("recurringDetail.quotaAwaiting")
                                    : missingSlots
                                      ? t("recurringDetail.quotaMissing")
                                      : t(`recurring.shortFormats.${pill.type}`, { defaultValue: pill.type })}
                                  className={cn(
                                    "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] font-extrabold whitespace-nowrap",
                                    complete
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                      : missingSlots || awaiting > 0
                                        ? "border-orange-200 bg-orange-50 text-orange-800"
                                        : cn(style.bg, style.text, style.border),
                                  )}
                                >
                                  <Icon size={12} />
                                  <span>{t(`recurring.shortFormats.${pill.type}`, { defaultValue: pill.type })}</span>
                                  <span className="tabular-nums opacity-80">{t("recurringDetail.quotaProgress", { done: generated, total: pill.count })}</span>
                                  {complete ? <CheckCircle2 size={11} /> : null}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        {expanded && canManage ? (
                          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-2">
                            <button type="button" onClick={(e) => { e.stopPropagation(); openCreatorModal(row); }} className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-200"><Edit3 size={12} /> {t("recurringDetail.editContract")}</button>
                            {isAdmin ? <button type="button" onClick={(e) => { e.stopPropagation(); void onRemoveCreator(row); }} className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-100"><Trash2 size={12} /> {t("recurringDetail.remove")}</button> : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          ) : null}

          <div className={cn(
            isCreator && "flex flex-col gap-4",
            !isCreator && creatorLayout === "split" && !pautasModalOpen && "hidden lg:flex lg:col-span-7 lg:flex-col lg:gap-4",
            !isCreator && pautasModalOpen && "app-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm sm:p-4",
            !isCreator && creatorLayout === "grid" && !pautasModalOpen && "hidden",
          )}>
            {selectedRow && selectedInfo && selectedSummary ? (
              <div className={cn(
                "flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6",
                !isCreator && pautasModalOpen && "app-modal-panel relative max-h-[90vh] w-full max-w-4xl overflow-y-auto",
              )}>
                {!isCreator && pautasModalOpen ? (
                  <button type="button" onClick={() => setPautasModalOpen(false)} className="sticky top-0 z-10 -mt-1 mb-1 inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200">
                    <ArrowLeft size={14} /> {tc("back")}
                  </button>
                ) : null}
                <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
                  <div>
                    <span className="text-[10px] font-bold tracking-wider text-brand-primary uppercase">{t("recurringDetail.monthBriefs", { month: selectedMonth })}</span>
                    <h3 className="flex flex-wrap items-center gap-2 text-lg font-black text-slate-900">
                      {selectedInfo.artistic_name || selectedInfo.full_name}
                      {selectedSummary.updateKind === "new_version" ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800">{t("recurringDetail.newVersionMonth")}</span>
                      ) : selectedSummary.updateKind === "pending_approval" ? (
                        <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-bold text-violet-700">{t("recurringDetail.newMaterialMonth")}</span>
                      ) : null}
                      {selectedSummary.missingPautasCount > 0 ? (
                        <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-bold text-orange-700">{t("recurringDetail.missingPautasCount", { count: selectedSummary.missingPautasCount })}</span>
                      ) : selectedSummary.statusCategory === "owing" ? (
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-600">⚠️ {t("recurringDetail.owingMonth")}</span>
                      ) : (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-600">✓ {t("recurringDetail.onTrack")}</span>
                      )}
                    </h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {formatLocation(locale, selectedInfo) ? <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">📍 {formatLocation(locale, selectedInfo)}</span> : null}
                      {selectedInfo.categories.map((cat) => <span key={cat} className="rounded-md border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold text-indigo-700">🏷️ {cat}</span>)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setShowCompleted(!showCompleted)} className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold", showCompleted ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100")}>
                      <CheckCircle2 size={13} /> {showCompleted ? t("recurringDetail.hideCompleted") : t("recurringDetail.seeCompleted", { count: completedPautas })}
                    </button>
                    {canManage ? (
                      <button
                        type="button"
                        disabled={generatingDemands}
                        onClick={() => {
                          if (selectedSummary.quota > 0 && selectedSummary.items.length === 0) {
                            void onGenerateMonthDemands(selectedRow.creator_id);
                            return;
                          }
                          openPautaModal(selectedRow.creator_id);
                        }}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-brand-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {selectedSummary.quota > 0 && selectedSummary.items.length === 0 ? (
                          <>
                            <Layers size={13} />
                            {generatingDemands ? t("recurringDetail.generatingDemands") : t("recurringDetail.generateDemandsShort")}
                          </>
                        ) : (
                          <>
                            <Plus size={13} /> {t("recurringDetail.newBrief")}
                          </>
                        )}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 sm:grid-cols-4">
                  <MiniStat label={t("recurringDetail.monthlyCache")} value={formatCurrency(creatorCost(selectedRow))} hint={t("recurringDetail.perMonth")} icon={DollarSign} />
                  <MiniStat
                    label={t("recurringDetail.completed")}
                    value={`${selectedSummary.completedCount}/${selectedSummary.quota}`}
                    hint={`(${selectedSummary.quota ? Math.round((selectedSummary.completedCount / selectedSummary.quota) * 100) : 0}%)`}
                    icon={CheckCircle2}
                    valueClass="text-emerald-700"
                    labelClass="text-emerald-600"
                  />
                  <MiniStat
                    label={t("recurringDetail.awaitingPautasLabel")}
                    value={String(selectedSummary.missingPautasCount)}
                    hint={selectedSummary.missingPautasCount > 0 ? t("recurringDetail.missingPautasRibbon") : t("recurringDetail.onTrack")}
                    icon={FileText}
                    boxClass={selectedSummary.missingPautasCount > 0 ? "border-orange-200 bg-orange-50/70" : undefined}
                    valueClass={selectedSummary.missingPautasCount > 0 ? "text-orange-800" : undefined}
                    labelClass={selectedSummary.missingPautasCount > 0 ? "text-orange-700" : undefined}
                    iconClass={selectedSummary.missingPautasCount > 0 ? "text-orange-600" : undefined}
                  />
                  <MiniStat
                    label={t("recurringDetail.pendingApprovalLabel")}
                    value={String(selectedSummary.pendingApprovalCount)}
                    hint={selectedSummary.newVersionCount > 0
                      ? t("recurringDetail.newVersionCount", { count: selectedSummary.newVersionCount })
                      : selectedSummary.pendingApprovalCount > 0
                        ? t("recurringDetail.newMaterialRibbon")
                        : t("recurringDetail.noPendingApproval")}
                    icon={Sparkles}
                    boxClass={selectedSummary.updateKind === "new_version"
                      ? "border-amber-200 bg-amber-50/70"
                      : selectedSummary.pendingApprovalCount > 0
                        ? "border-violet-200 bg-violet-50/70"
                        : undefined}
                    valueClass={selectedSummary.updateKind === "new_version"
                      ? "text-amber-800"
                      : selectedSummary.pendingApprovalCount > 0
                        ? "text-violet-800"
                        : undefined}
                    labelClass={selectedSummary.updateKind === "new_version"
                      ? "text-amber-800"
                      : selectedSummary.pendingApprovalCount > 0
                        ? "text-violet-700"
                        : undefined}
                    iconClass={selectedSummary.updateKind === "new_version"
                      ? "text-amber-700"
                      : selectedSummary.pendingApprovalCount > 0
                        ? "text-violet-700"
                        : undefined}
                  />
                </div>

                {!selectedPautas.length ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
                    <div className="rounded-full bg-white p-3 text-slate-400 shadow-sm"><FileText size={22} /></div>
                    <h4 className="text-xs font-bold text-slate-700">{t("recurringDetail.emptyPending", { month: selectedMonth })}</h4>
                    <p className="max-w-sm text-[11px] leading-relaxed text-slate-400">
                      {completedPautas > 0
                        ? t("recurringDetail.emptyAllDone", { count: completedPautas })
                        : selectedSummary.quota > 0
                          ? t("recurringDetail.emptyGenerateHint", { count: selectedSummary.quota, month: selectedMonth })
                          : t("recurringDetail.emptyPendingHint")}
                    </p>
                    {canManage ? (
                      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                        {selectedSummary.quota > 0 && selectedSummary.items.length === 0 ? (
                          <button
                            type="button"
                            disabled={generatingDemands}
                            onClick={() => void onGenerateMonthDemands(selectedRow.creator_id)}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-brand-primary px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Layers size={13} />
                            {generatingDemands
                              ? t("recurringDetail.generatingDemands")
                              : t("recurringDetail.generateMonthDemands")}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => openPautaModal(selectedRow.creator_id)}
                          className={cn(
                            "cursor-pointer rounded-xl px-3.5 py-1.5 text-xs font-bold",
                            selectedSummary.quota > 0 && selectedSummary.items.length === 0
                              ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                              : "bg-brand-primary text-white hover:bg-indigo-600",
                          )}
                        >
                          {t("recurringDetail.addMonthBrief")}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {selectedPautas.map((item) => {
                      const style = TYPE_STYLE[item.content_type] || TYPE_STYLE.other;
                      const Icon = style.icon;
                      const done = isDone(item.status);
                      const briefing = itemHasPautaBriefing(item);
                      const live = isLivePauta(item.content_type);
                      const videoUrl = pautaVideoUrl(item);
                      const videoVersions = pautaVideoVersions(item);
                      const pendingApproval = itemNeedsApproval(item);
                      const newVersion = isMaterialNewVersion(item);
                      const videoRevisionRequested = isVideoRevisionRequested(item);
                      const scriptRevisionRequested = isScriptRevisionRequested(item);
                      const revisionRequested = scriptRevisionRequested || videoRevisionRequested;
                      const hasDetails = !live && Boolean(briefing || item.script || item.references || videoUrl || videoVersions.length);
                      const awaitingBriefing = isAwaitingBriefing(item);
                      const deadline = item.planned_date
                        ? t("recurringDetail.pautaDeadline", { date: new Date(`${item.planned_date}T00:00:00`).toLocaleDateString(locale) })
                        : t("recurringDetail.pautaNoDate");
                      const slot = pautaSlot(selectedSummary?.items ?? selectedPautas, item);
                      const displayTitle = namedPautaTitle(item.title);
                      return (
                        <div key={item.id} className={cn(
                          "flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm transition-all hover:border-indigo-200",
                          revisionRequested
                            ? "border-rose-300 bg-rose-50/40"
                            : newVersion
                              ? "border-amber-300 bg-amber-50/40"
                              : pendingApproval
                                ? "border-violet-200 bg-violet-50/30"
                                : awaitingBriefing
                                  ? "border-orange-300 bg-orange-50/40"
                                  : isAwaitingPublishedLink(item)
                                    ? "border-emerald-200 bg-emerald-50/20"
                                    : "border-slate-200",
                        )}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                              <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", style.bg, style.text, style.border)}><Icon size={18} /></div>
                              <div className="min-w-0 flex-1">
                                <div className="mb-0.5 flex flex-wrap items-center gap-2">
                                  <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-black uppercase", style.bg, style.text, style.border)}>
                                    {t(`recurring.shortFormats.${item.content_type}`, { defaultValue: item.content_type })}
                                    {slot.total > 1 ? ` ${slot.current}/${slot.total}` : ""}
                                  </span>
                                  <span className={cn(
                                    "rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase",
                                    revisionRequested
                                      ? "border-rose-200 bg-rose-50 text-rose-700"
                                      : newVersion
                                        ? "border-amber-200 bg-amber-50 text-amber-800"
                                        : pendingApproval
                                          ? "border-violet-200 bg-violet-50 text-violet-800"
                                          : awaitingBriefing
                                            ? "border-orange-200 bg-orange-50 text-orange-800"
                                            : isAwaitingPublishedLink(item)
                                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                              : "border-slate-200 bg-slate-100 text-slate-700",
                                  )}>
                                    {awaitingBriefing
                                      ? t("recurringDetail.awaitingBriefing")
                                      : scriptRevisionRequested
                                        ? t("recurringDetail.scriptRevisionBadge")
                                        : videoRevisionRequested
                                          ? t("recurringDetail.videoRevisionBadge")
                                          : isScriptNewVersion(item)
                                          ? t("recurringDetail.scriptNewVersionBadge")
                                          : isVideoNewVersion(item)
                                            ? t("recurringDetail.videoNewVersionBadge")
                                          : needsScriptApproval(item)
                                            ? t("recurringDetail.scriptPendingBadge")
                                            : needsVideoApproval(item)
                                              ? t("recurringDetail.videoPendingBadge")
                                            : item.script_status === "approved" && item.video_status !== "approved" && item.video_status !== "submitted" && item.video_status !== "revision"
                                              ? t("recurringDetail.waitingVideoBadge")
                                            : isAwaitingPublishedLink(item)
                                              ? t("recurringDetail.awaitingPublishedLink")
                                              : t(`recurring.itemStatus.${item.status}`, { defaultValue: item.status })}
                                  </span>
                                  {!live && item.approval_flow !== "video_only" ? (
                                    <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[9px] font-extrabold text-indigo-700 uppercase">
                                      {t("recurringDetail.pautaFlowScriptBadgeShort")}
                                    </span>
                                  ) : !live ? (
                                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-extrabold text-slate-600 uppercase">
                                      {t("recurringDetail.pautaFlowVideoBadgeShort")}
                                    </span>
                                  ) : null}
                                </div>
                                {canManage ? (
                                  <input
                                    type="text"
                                    value={titleDraft[item.id] ?? displayTitle}
                                    placeholder={t("recurringDetail.pautaTitleCardPh")}
                                    onChange={(e) => setTitleDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                    onBlur={() => void onSavePautaTitle(item)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") e.currentTarget.blur();
                                    }}
                                    className="mt-1 w-full min-w-[12rem] rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm font-bold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400 focus:border-brand-primary"
                                  />
                                ) : (
                                  <h4 className="text-sm font-bold text-slate-900">{displayTitle || t("recurringDetail.untitledPauta")}</h4>
                                )}
                              </div>
                            </div>
                            {canManage ? (
                              <div className="flex shrink-0 items-center gap-1">
                                <button type="button" onClick={() => onToggleDone(item)} className={cn("rounded-lg border px-2.5 py-1 text-xs font-bold whitespace-nowrap", done ? "border-emerald-300 bg-emerald-100 text-emerald-800" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>{done ? t("recurringDetail.reopen") : t("recurringDetail.markDone")}</button>
                                <button type="button" onClick={() => openPautaModal(selectedRow.creator_id, item)} className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700"><Edit3 size={13} /></button>
                                <button type="button" onClick={() => onDeletePauta(item)} className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600"><Trash2 size={13} /></button>
                              </div>
                            ) : null}
                          </div>
                          {live ? (
                            <div className="flex flex-col gap-2 rounded-xl border border-purple-100 bg-purple-50/40 p-3">
                              <span className="text-[10px] font-bold tracking-wider text-purple-700 uppercase">{t("recurringDetail.liveLinkLabel")}</span>
                              {item.published_url ? (
                                <a href={safeHttpUrl(item.published_url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 truncate text-xs font-bold text-brand-primary hover:underline">
                                  <ExternalLink size={12} className="shrink-0" /> {item.published_url}
                                </a>
                              ) : (
                                <p className="text-[11px] text-slate-500">{t("recurringDetail.liveLinkHint")}</p>
                              )}
                              {canManage ? (
                                <div className="flex flex-col gap-2 sm:flex-row">
                                  <input
                                    type="url"
                                    value={liveLinkDraft[item.id] ?? item.published_url ?? ""}
                                    onChange={(e) => setLiveLinkDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                    placeholder={t("recurringDetail.liveLinkPh")}
                                    className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-brand-primary"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => void onSaveLiveLink(item, liveLinkDraft[item.id] ?? item.published_url ?? "")}
                                    className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg bg-brand-primary px-3 py-2 text-xs font-bold whitespace-nowrap text-white hover:bg-indigo-600"
                                  >
                                    {t("recurringDetail.saveLiveLink")}
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ) : hasDetails ? (
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                {briefing ? (
                                  <button type="button" onClick={() => openPautaView(item, "briefing")} className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-bold whitespace-nowrap text-slate-700 transition-colors hover:border-indigo-200 hover:bg-white hover:text-brand-primary">
                                    <FileText size={12} /> {t("recurringDetail.viewBriefing")}
                                  </button>
                                ) : null}
                                {item.script ? (
                                  <button type="button" onClick={() => openPautaView(item, "script")} className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-indigo-100 bg-indigo-50 px-2 py-1.5 text-[11px] font-bold whitespace-nowrap text-brand-primary transition-colors hover:border-indigo-200 hover:bg-white">
                                    <ScrollText size={12} /> {t("recurringDetail.viewScript")}
                                  </button>
                                ) : null}
                                {videoUrl ? (
                                  <button type="button" onClick={() => setWatchingVideoUrl(videoUrl)} className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-rose-100 bg-rose-50 px-2 py-1.5 text-[11px] font-bold whitespace-nowrap text-rose-700 transition-colors hover:border-rose-200 hover:bg-white">
                                    <Play size={12} fill="currentColor" /> {t("recurringDetail.watchVideo")}
                                  </button>
                                ) : null}
                                {item.references ? (
                                  <button type="button" onClick={() => openPautaView(item, "references")} className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold whitespace-nowrap text-indigo-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50">
                                    <ExternalLink size={12} /> {t("recurringDetail.viewReferences")}
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => setRevisionHistoryItem(item)}
                                  className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold whitespace-nowrap text-slate-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-brand-primary"
                                >
                                  <History size={12} /> {t("recurringDetail.revisionHistory")}
                                </button>
                                {canManage && needsScriptApproval(item) ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setReviseModal({ item, note: "", stage: "script" })}
                                      className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] font-bold whitespace-nowrap text-rose-700 transition-colors hover:bg-rose-100"
                                    >
                                      <MessageSquare size={12} /> {t("recurringDetail.reviseScript")}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void onApproveScript(item)}
                                      className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] font-bold whitespace-nowrap text-emerald-800 transition-colors hover:bg-emerald-100"
                                    >
                                      <ThumbsUp size={12} /> {t("recurringDetail.approveScript")}
                                    </button>
                                  </>
                                ) : null}
                                {canManage && needsVideoApproval(item) ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setReviseModal({ item, note: "", stage: "video" })}
                                      className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] font-bold whitespace-nowrap text-rose-700 transition-colors hover:bg-rose-100"
                                    >
                                      <MessageSquare size={12} /> {t("recurringDetail.reviseVideo")}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void onApproveVideo(item)}
                                      className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-600 px-2 py-1.5 text-[11px] font-bold whitespace-nowrap text-white transition-colors hover:bg-emerald-700"
                                    >
                                      <ThumbsUp size={12} /> {t("recurringDetail.approveVideo")}
                                    </button>
                                  </>
                                ) : null}
                              </div>
                              {videoVersions.length > 1 ? (
                                <div className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                                  <p className="m-0 text-[10px] font-extrabold tracking-wider text-slate-500 uppercase">{t("recurringDetail.videoVersionsTitle")}</p>
                                  <div className="flex flex-col gap-1">
                                    {videoVersions.map((version) => (
                                      <button
                                        key={`${item.id}-v${version.version}`}
                                        type="button"
                                        onClick={() => setWatchingVideoUrl(version.url)}
                                        className={cn(
                                          "flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-bold transition-colors",
                                          version.current
                                            ? "border-rose-200 bg-rose-50 text-rose-800 hover:bg-white"
                                            : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:text-brand-primary",
                                        )}
                                      >
                                        <span className="inline-flex min-w-0 items-center gap-1.5">
                                          <Play size={12} fill="currentColor" className="shrink-0" />
                                          {t("recurringDetail.watchVideoVersion", { n: version.version })}
                                          {version.current ? (
                                            <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-rose-700 uppercase">
                                              {t("recurringDetail.videoVersionCurrent")}
                                            </span>
                                          ) : null}
                                        </span>
                                        {version.submittedAt ? (
                                          <span className="shrink-0 text-[10px] font-semibold text-slate-400">
                                            {new Date(version.submittedAt).toLocaleDateString(locale)}
                                          </span>
                                        ) : null}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                              {scriptRevisionRequested ? (
                                <div className="rounded-xl border border-rose-200 bg-rose-50/90 px-3 py-2">
                                  <p className="m-0 text-[10px] font-extrabold tracking-wider text-rose-700 uppercase">{t("recurringDetail.scriptRevisionRequestedTitle")}</p>
                                  {item.script_feedback ? (
                                    <p className="mt-1 mb-0 text-[11px] leading-relaxed font-medium whitespace-pre-wrap text-rose-900">{item.script_feedback}</p>
                                  ) : (
                                    <p className="mt-1 mb-0 text-[11px] font-medium text-rose-800">{t("recurringDetail.scriptRevisionRequestedHint")}</p>
                                  )}
                                </div>
                              ) : null}
                              {isScriptNewVersion(item) ? (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                                  <p className="m-0 text-[10px] font-extrabold tracking-wider text-amber-800 uppercase">{t("recurringDetail.scriptNewVersionTitle")}</p>
                                  <p className="mt-1 mb-0 text-[11px] font-medium text-amber-900">{t("recurringDetail.scriptNewVersionHint")}</p>
                                </div>
                              ) : null}
                              {videoRevisionRequested ? (
                                <div className="rounded-xl border border-rose-200 bg-rose-50/90 px-3 py-2">
                                  <p className="m-0 text-[10px] font-extrabold tracking-wider text-rose-700 uppercase">{t("recurringDetail.videoRevisionRequestedTitle")}</p>
                                  {item.video_feedback || item.feedback_note ? (
                                    <p className="mt-1 mb-0 text-[11px] leading-relaxed font-medium whitespace-pre-wrap text-rose-900">{item.video_feedback || item.feedback_note}</p>
                                  ) : (
                                    <p className="mt-1 mb-0 text-[11px] font-medium text-rose-800">{t("recurringDetail.videoRevisionRequestedHint")}</p>
                                  )}
                                </div>
                              ) : null}
                              {isVideoNewVersion(item) ? (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                                  <p className="m-0 text-[10px] font-extrabold tracking-wider text-amber-800 uppercase">{t("recurringDetail.videoNewVersionTitle")}</p>
                                  <p className="mt-1 mb-0 text-[11px] font-medium text-amber-900">{t("recurringDetail.videoNewVersionHint")}</p>
                                </div>
                              ) : null}
                              {canManage && pendingApproval && (item.script?.trim() || videoUrl) ? (
                                <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                                  <p className="mb-2 text-[10px] font-extrabold tracking-wider text-indigo-800 uppercase">{t("recurringDetail.submittedMaterialTitle")}</p>
                                  <div className={cn("grid grid-cols-1 items-start gap-3", item.script?.trim() && videoUrl ? "md:grid-cols-2" : "")}>
                                    {item.script?.trim() ? (
                                      <div className="flex min-w-0 flex-col gap-1.5">
                                        <span className="flex items-center gap-1 text-[10px] font-black tracking-wider text-slate-600 uppercase">
                                          <ScrollText size={12} className="text-brand-primary" /> {t("recurringDetail.submittedScriptLabel")}
                                        </span>
                                        <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-100 bg-white p-3 text-[11px] leading-relaxed font-medium whitespace-pre-wrap text-slate-700">
                                          {item.script}
                                        </div>
                                      </div>
                                    ) : null}
                                    {videoUrl ? (
                                      <div className="flex min-w-0 flex-col gap-1.5">
                                        <span className="flex items-center gap-1 text-[10px] font-black tracking-wider text-slate-600 uppercase">
                                          <Video size={12} className="text-brand-primary" /> {t("recurringDetail.submittedVideoLabel")}
                                        </span>
                                        <CampaignSubmittedVideo videoUrl={videoUrl} compact />
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ) : awaitingBriefing ? (
                            <div className="flex flex-col gap-2 rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                              <p className="m-0 text-[11px] font-medium text-amber-800">
                                {t(isCreator ? "recurringDetail.awaitingBriefingHintCreator" : "recurringDetail.awaitingBriefingHint")}
                              </p>
                              {canManage ? (
                                <button
                                  type="button"
                                  onClick={() => openPautaModal(selectedRow.creator_id, item)}
                                  className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-amber-600 px-2.5 py-1.5 text-[11px] font-bold whitespace-nowrap text-white hover:bg-amber-700"
                                >
                                  <FileText size={12} /> {t("recurringDetail.includeBrief")}
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                          <div className="flex items-center pt-1 text-[11px] text-slate-500">
                            <span className="flex items-center gap-1 whitespace-nowrap"><Clock size={12} className="shrink-0 text-slate-400" /> {deadline}</span>
                          </div>
                          {isCreator && !awaitingBriefing ? (
                            <CreatorPautaSubmissionPanel item={item} onSubmitted={() => void load()} />
                          ) : null}
                          {!isCreator && !live && isAwaitingPublishedLink(item) && (isBrandPosting(item.posting_profile) || isAdmin) ? (
                            <div className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
                              <span className="text-[10px] font-bold tracking-wider text-emerald-800 uppercase">{t("campaignDetail.publishedLinkLabel")}</span>
                              <p className="m-0 text-[11px] font-medium text-emerald-800">
                                {t(isBrandPosting(item.posting_profile) ? "postingProfile.publishedHintBrand" : "postingProfile.publishedHintCreator")}
                              </p>
                              <div className="flex flex-col gap-2 sm:flex-row">
                                <input
                                  type="url"
                                  value={liveLinkDraft[item.id] ?? item.published_url ?? ""}
                                  onChange={(e) => setLiveLinkDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                  placeholder={t("campaignDetail.publishedLinkPh")}
                                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-brand-primary"
                                />
                                <button
                                  type="button"
                                  onClick={() => void onSavePublishedLink(item, liveLinkDraft[item.id] ?? item.published_url ?? "")}
                                  className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold whitespace-nowrap text-white hover:bg-emerald-700"
                                >
                                  {t("recurringDetail.savePublishedLink")}
                                </button>
                              </div>
                            </div>
                          ) : !isCreator && !live && isAwaitingPublishedLink(item) ? (
                            <p className="m-0 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] font-semibold text-amber-900">
                              {t("postingProfile.awaitingCreator")}
                            </p>
                          ) : !isCreator && !live && item.published_url ? (
                            <a href={safeHttpUrl(item.published_url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 truncate text-xs font-bold text-emerald-800 hover:underline">
                              <ExternalLink size={12} className="shrink-0" /> {item.published_url}
                            </a>
                          ) : null}
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
      ) : null}

      {view === "calendar" ? (
        <div className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900"><CalendarCheck size={18} className="text-brand-primary" /> {t("recurringDetail.calendarTitle", { title: contract.title })}</h3>
            <p className="text-xs text-slate-500">{t("recurringDetail.calendarHint", { month: selectedMonth })}</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200/90">
            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/70 py-3 text-center text-xs font-extrabold tracking-wider text-slate-500 uppercase">
                  {[t("recurring.weekMon"), t("recurring.weekTue"), t("recurring.weekWed"), t("recurring.weekThu"), t("recurring.weekFri"), t("recurring.weekSat"), t("recurring.weekSun")].map((day) => (
                    <div key={day}>{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 auto-rows-[9.5rem] divide-x divide-y divide-slate-100">
                  {getCalendarDays(selectedMonth).map((cell) => {
                    const dayItems = items.filter((item) => toDateKey(item.planned_date) === cell.dateStr);
                    const isToday = cell.dateStr === localDateStr();
                    return (
                      <div key={cell.dateStr} className={cn("flex h-full min-h-0 flex-col overflow-hidden p-2", cell.isCurrentMonth ? "bg-white" : "bg-slate-50/40 text-slate-300")}>
                        <div className="mb-1.5 flex shrink-0 items-center justify-between">
                          <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-extrabold", isToday ? "bg-brand-primary text-white" : cell.isCurrentMonth ? "text-slate-700" : "text-slate-300")}>{cell.dayNumber}</span>
                          {dayItems.length ? (
                            <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-[9px] font-black text-brand-primary">{dayItems.length}</span>
                          ) : null}
                        </div>
                        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pr-0.5">
                          {dayItems.map((item) => (
                            <div
                              key={item.id}
                              className={cn(
                                "flex flex-col gap-0.5 rounded-lg border bg-white p-1.5 text-[10px]",
                                isMaterialNewVersion(item) ? "border-amber-300" : itemNeedsApproval(item) ? "border-violet-200" : "border-slate-200",
                              )}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="truncate font-bold text-slate-800">{namedPautaTitle(item.title) || t("recurringDetail.untitledPauta")}</span>
                                <span className="shrink-0 text-[8px] font-extrabold tracking-wider text-indigo-700 uppercase">{t(`recurring.shortFormats.${item.content_type}`, { defaultValue: item.content_type })}</span>
                              </div>
                              <span className="truncate text-[9px] text-slate-500">{item.creator?.artistic_name || allocated.find((row) => row.creator_id === item.creator_id)?.creator?.artistic_name}</span>
                            </div>
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

      {!isCreator && view === "metrics" ? (
        <RecurringMetricsPanel
          contract={contract}
          items={items}
          month={selectedMonth}
          onMonthChange={setSelectedMonth}
          locale={locale}
          formatNumber={formatNumber}
          onContract={setContract}
        />
      ) : null}

      {creatorModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:p-4 app-modal-overlay">
          <form noValidate onSubmit={onSaveCreator} className="app-modal-panel max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="flex items-center gap-2 text-base font-black text-slate-900"><Users size={18} className="text-brand-primary" /> {editingCreator ? t("recurringDetail.modalEdit") : t("recurringDetail.modalAdd")}</h3>
              <button type="button" onClick={() => setCreatorModal(false)} className="cursor-pointer rounded-full p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="flex flex-col gap-4 text-xs font-medium">
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700">{t("recurringDetail.selectCreator")} *</label>
                <Select2Field
                  theme="light"
                  placeholder={t("recurringDetail.selectCreator")}
                  value={creatorForm.creator_id}
                  options={catalog
                    .map((c) => ({
                      value: String(c.id),
                      label: `${c.artistic_name || c.full_name}${formatLocation(locale, c) ? ` (${formatLocation(locale, c)})` : ""} - ${Number(c.metrics?.followers || 0).toLocaleString(locale)} ${t("recurringDetail.followers")}`,
                    }))
                    .sort((a, b) => a.label.localeCompare(b.label, locale, { sensitivity: "base" }))}
                  onChange={(value) => setCreatorForm({ ...creatorForm, creator_id: value })}
                  disabled={Boolean(editingCreator)}
                  triggerClassName={FIELD_SELECT}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-700">{t("recurringDetail.contractStart")} *</label>
                  <input type="date" required value={creatorForm.start_date} onChange={(e) => setCreatorForm({ ...creatorForm, start_date: e.target.value })} className={FIELD_INPUT} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-700">{t("recurringDetail.contractEnd")}</label>
                  <input type="date" value={creatorForm.end_date} onChange={(e) => setCreatorForm({ ...creatorForm, end_date: e.target.value })} className={FIELD_INPUT} />
                </div>
              </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-700">{t("recurringDetail.cache")} *</label>
                  <MoneyInput
                    required
                    currency={moneyCurrency(contract)}
                    value={creatorForm.monthly_cache}
                    onChange={(value) => setCreatorForm({ ...creatorForm, monthly_cache: value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-4 text-xs font-bold text-slate-800 outline-none focus:border-brand-primary"
                  />
                {creatorBudgetPreview ? (
                  <div className="mt-1.5 space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px]">
                    <div className="flex items-center justify-between text-slate-500">
                      <span>{t("recurringDetail.budgetTotal")}</span>
                      <span className="font-bold text-slate-800">{formatCurrency(creatorBudgetPreview.total)}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500">
                      <span>{t("recurringDetail.budgetOthers")}</span>
                      <span className="font-bold text-slate-700">{formatCurrency(creatorBudgetPreview.others)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
                      <span className="font-bold text-slate-700">{t("recurringDetail.budgetRemaining")}</span>
                      <span className={cn("font-black", creatorBudgetPreview.remaining >= 0 ? "text-emerald-600" : "text-rose-600")}>{formatCurrency(creatorBudgetPreview.remaining)}</span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <span className="text-[11px] font-black tracking-wider text-slate-800 uppercase">{t("recurringDetail.quotaTitle")}</span>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {QUOTA_FIELDS.map(([key, labelKey]) => (
                    <label key={key} className="font-bold text-slate-700">
                      <span className="mb-1 block text-[11px] text-slate-600">{t(`recurringDetail.${labelKey}`)}</span>
                      <input type="number" min="0" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-center text-xs font-bold" value={creatorForm[key]} onChange={(e) => setCreatorForm({ ...creatorForm, [key]: e.target.value })} />
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700">{t("recurringDetail.notesTerms")}</label>
                <textarea rows={2} className="min-h-20 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-brand-primary" placeholder={t("recurringDetail.notesTermsPh")} value={creatorForm.notes} onChange={(e) => setCreatorForm({ ...creatorForm, notes: e.target.value })} />
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setCreatorModal(false)} className="cursor-pointer rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100">{tc("cancel")}</button>
              <button className="cursor-pointer rounded-xl bg-brand-primary px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-600">{editingCreator ? t("recurringDetail.saveCreator") : t("recurringDetail.addToProject")}</button>
            </div>
          </form>
        </div>
      ) : null}

      {viewingPauta ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:p-4 app-modal-overlay">
          <div className="app-modal-panel flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-6">
              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-black uppercase", (TYPE_STYLE[viewingPauta.content_type] || TYPE_STYLE.other).bg, (TYPE_STYLE[viewingPauta.content_type] || TYPE_STYLE.other).text, (TYPE_STYLE[viewingPauta.content_type] || TYPE_STYLE.other).border)}>
                    {t(`recurring.shortFormats.${viewingPauta.content_type}`, { defaultValue: viewingPauta.content_type })}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[9px] font-extrabold text-slate-700 uppercase">{t(`recurring.itemStatus.${viewingPauta.status}`, { defaultValue: viewingPauta.status })}</span>
                </div>
                <h3 className="text-lg font-black text-slate-900">{namedPautaTitle(viewingPauta.title) || t("recurringDetail.untitledPauta")}</h3>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {viewingPauta.planned_date
                    ? t("recurringDetail.pautaDeadline", { date: new Date(`${viewingPauta.planned_date}T00:00:00`).toLocaleDateString(locale) })
                    : t("recurringDetail.pautaNoDate")}
                </p>
              </div>
              <button type="button" onClick={closePautaView} className="cursor-pointer rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-6 text-sm">
              {itemHasPautaBriefing(viewingPauta) ? (
                <div id="pauta-view-briefing">
                  <PautaBriefingView
                    item={viewingPauta}
                    title={t("recurringDetail.pautaBriefingLabel")}
                    highlight={viewingPautaFocus === "briefing"}
                  />
                </div>
              ) : null}
              {viewingPauta.script ? (
                <div id="pauta-view-script" className={cn(viewingPautaFocus === "script" && "rounded-2xl ring-2 ring-indigo-200 ring-offset-2")}>
                  <span className="mb-1.5 block text-[10px] font-bold tracking-wider text-brand-primary uppercase">
                    {viewingPauta.script_status ? t("recurringDetail.submittedScriptLabel") : t("recurringDetail.pautaScriptLabel")}
                  </span>
                  <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed whitespace-pre-line text-slate-700">{viewingPauta.script}</p>
                </div>
              ) : null}
              {pautaVideoUrl(viewingPauta) ? (
                <div id="pauta-view-video" className={cn(viewingPautaFocus === "video" && "rounded-2xl ring-2 ring-indigo-200 ring-offset-2")}>
                  <span className="mb-1.5 block text-[10px] font-bold tracking-wider text-brand-primary uppercase">{t("recurringDetail.submittedVideoLabel")}</span>
                  <CampaignSubmittedVideo videoUrl={pautaVideoUrl(viewingPauta)!} />
                  {viewingVideoVersions.length > 1 ? (
                    <div className="mt-3 flex flex-col gap-1.5">
                      <p className="m-0 text-[10px] font-extrabold tracking-wider text-slate-500 uppercase">{t("recurringDetail.videoVersionsTitle")}</p>
                      {viewingVideoVersions.map((version) => (
                        <button
                          key={`view-v${version.version}`}
                          type="button"
                          onClick={() => setWatchingVideoUrl(version.url)}
                          className={cn(
                            "flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-bold transition-colors",
                            version.current
                              ? "border-rose-200 bg-rose-50 text-rose-800 hover:bg-white"
                              : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:text-brand-primary",
                          )}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <Play size={12} fill="currentColor" />
                            {t("recurringDetail.watchVideoVersion", { n: version.version })}
                            {version.current ? (
                              <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-rose-700 uppercase">
                                {t("recurringDetail.videoVersionCurrent")}
                              </span>
                            ) : null}
                          </span>
                          {version.submittedAt ? (
                            <span className="text-[10px] font-semibold text-slate-400">{new Date(version.submittedAt).toLocaleDateString(locale)}</span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {viewingPauta.references ? (
                <div id="pauta-view-references" className={cn(viewingPautaFocus === "references" && "rounded-2xl ring-2 ring-indigo-200 ring-offset-2")}>
                  <span className="mb-1.5 block text-[10px] font-bold tracking-wider text-indigo-600 uppercase">{t("recurringDetail.pautaReferencesLabel")}</span>
                  {/^https?:\/\//i.test(viewingPauta.references) ? (
                    <a href={safeHttpUrl(viewingPauta.references)} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1.5 truncate text-xs font-bold text-brand-primary hover:underline">
                      <ExternalLink size={12} className="shrink-0" /> {viewingPauta.references}
                    </a>
                  ) : (
                    <p className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs leading-relaxed whitespace-pre-line text-slate-700">{viewingPauta.references}</p>
                  )}
                </div>
              ) : null}
              {viewingPauta.published_url ? (
                <div>
                  <span className="mb-1.5 block text-[10px] font-bold tracking-wider text-emerald-700 uppercase">{t("recurringDetail.publishedUrlLabel")}</span>
                  <a href={safeHttpUrl(viewingPauta.published_url)} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1.5 truncate text-xs font-bold text-brand-primary hover:underline">
                    <ExternalLink size={12} className="shrink-0" /> {viewingPauta.published_url}
                  </a>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 p-4">
              <button
                type="button"
                onClick={() => setRevisionHistoryItem(viewingPauta)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <History size={13} /> {t("recurringDetail.revisionHistory")}
              </button>
              {canManage && needsScriptApproval(viewingPauta) ? (
                <>
                  <button
                    type="button"
                    onClick={() => setReviseModal({ item: viewingPauta, note: "", stage: "script" })}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                  >
                    <MessageSquare size={13} /> {t("recurringDetail.reviseScript")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onApproveScript(viewingPauta)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                  >
                    <ThumbsUp size={13} /> {t("recurringDetail.approveScript")}
                  </button>
                </>
              ) : null}
              {canManage && needsVideoApproval(viewingPauta) ? (
                <>
                  <button
                    type="button"
                    onClick={() => setReviseModal({ item: viewingPauta, note: "", stage: "video" })}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                  >
                    <MessageSquare size={13} /> {t("recurringDetail.reviseVideo")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onApproveVideo(viewingPauta)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    <ThumbsUp size={13} /> {t("recurringDetail.approveVideo")}
                  </button>
                </>
              ) : null}
              {canManage ? (
                <button
                  type="button"
                  onClick={() => {
                    const item = viewingPauta;
                    closePautaView();
                    openPautaModal(item.creator_id, item);
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Edit3 size={13} /> {t("recurringDetail.pautaEdit")}
                </button>
              ) : null}
              <button type="button" onClick={closePautaView} className="cursor-pointer rounded-xl bg-brand-primary px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-600">{tc("close")}</button>
            </div>
          </div>
        </div>
      ) : null}

      {watchingVideoUrl ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 p-4">
          <button type="button" className="absolute inset-0" aria-label={t("campaignDetail.closeVideoPlayer")} onClick={() => setWatchingVideoUrl(null)} />
          <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-2xl bg-black shadow-2xl">
            <VideoPlayer src={watchingVideoUrl} autoPlay className="max-h-[80vh] w-full" />
            <button
              type="button"
              onClick={() => setWatchingVideoUrl(null)}
              className="absolute top-3 right-3 cursor-pointer rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-800"
            >
              {t("campaignDetail.closeVideoPlayer")}
            </button>
          </div>
        </div>
      ) : null}

      {reviseModal.item ? (
        <div className="app-modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="app-modal-panel relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {t(reviseModal.stage === "video" ? "recurringDetail.reviseVideoTitle" : "recurringDetail.reviseScriptTitle")}
                  </h3>
                  <p className="mt-0.5 text-[11px] font-medium text-slate-500">{namedPautaTitle(reviseModal.item.title) || t("recurringDetail.untitledPauta")}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReviseModal({ item: null, note: "", stage: "script" })}
                className="cursor-pointer rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-3 p-5">
              <p className="m-0 text-xs leading-relaxed text-slate-600">
                {t(reviseModal.stage === "video" ? "recurringDetail.reviseVideoText" : "recurringDetail.reviseScriptText")}
              </p>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">{t("recurringDetail.reviseScriptLabel")}</label>
                <textarea
                  rows={4}
                  value={reviseModal.note}
                  onChange={(e) => setReviseModal((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder={t(reviseModal.stage === "video" ? "recurringDetail.reviseVideoPh" : "recurringDetail.reviseScriptPh")}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-800 outline-none focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-4">
              <button
                type="button"
                onClick={() => setReviseModal({ item: null, note: "", stage: "script" })}
                className="cursor-pointer rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                {tc("cancel")}
              </button>
              <button
                type="button"
                disabled={reviseSending}
                onClick={() => void onRequestRevision()}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-xs transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <MessageSquare size={14} /> {t("recurringDetail.reviseScriptSend")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {revisionHistoryItem ? (
        <div className="app-modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="app-modal-panel relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-brand-primary">
                  <History size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-black text-slate-900">{t("recurringDetail.revisionHistoryTitle")}</h3>
                  <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{revisionHistoryItem.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRevisionHistoryItem(null)}
                className="cursor-pointer rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-5">
              {pautaRevisionHistory(revisionHistoryItem).length ? (
                pautaRevisionHistory(revisionHistoryItem).map((entry, index) => (
                  <div key={`${entry.requested_at || "n"}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <span className={cn(
                        "rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase",
                        entry.stage === "script" ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-rose-200 bg-rose-50 text-rose-700",
                      )}>
                        {entry.stage === "script" ? t("recurringDetail.revisionHistoryScript") : t("recurringDetail.revisionHistoryVideo")}
                      </span>
                      {entry.requested_at ? (
                        <span className="text-[10px] font-semibold text-slate-400">
                          {new Date(entry.requested_at).toLocaleString(locale)}
                        </span>
                      ) : null}
                    </div>
                    <p className="m-0 text-xs leading-relaxed font-medium whitespace-pre-wrap text-slate-800">{entry.note}</p>
                  </div>
                ))
              ) : (
                <p className="m-0 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs font-medium text-slate-500">
                  {t("recurringDetail.revisionHistoryEmpty")}
                </p>
              )}
            </div>
            <div className="flex justify-end border-t border-slate-100 p-4">
              <button
                type="button"
                onClick={() => setRevisionHistoryItem(null)}
                className="cursor-pointer rounded-xl bg-brand-primary px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-600"
              >
                {tc("close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pautaModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:p-4 app-modal-overlay">
          <form noValidate onSubmit={onSavePauta} className="app-modal-panel max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="flex items-center gap-2 text-base font-black text-slate-900">
                <FileText size={18} className="text-brand-primary" />
                {editingPauta ? t("recurringDetail.pautaEdit") : t("recurringDetail.pautaModal")}
              </h3>
              <button type="button" onClick={() => setPautaModal(false)} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-4 text-xs font-medium">
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700">{t("recurringDetail.pautaCreator")} *</label>
                <Select2Field
                  theme="light"
                  searchable={false}
                  placeholder={t("recurringDetail.selectCreator")}
                  value={pautaCreatorId ? String(pautaCreatorId) : ""}
                  options={[...allocated]
                    .map((row) => {
                      const info = profile(row);
                      return { value: String(row.creator_id), label: info.artistic_name || info.full_name || t("recurringDetail.creator") };
                    })
                    .sort((a, b) => a.label.localeCompare(b.label, locale, { sensitivity: "base" }))}
                  onChange={(value) => setPautaCreatorId(value ? Number(value) : null)}
                  triggerClassName={FIELD_SELECT}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700">{t("recurringDetail.pautaTitle")} *</label>
                <input
                  type="text"
                  value={pautaForm.title}
                  onChange={(e) => setPautaForm({ ...pautaForm, title: e.target.value })}
                  placeholder={t("recurringDetail.pautaTitlePh")}
                  className={FIELD_INPUT}
                />
                <p className="m-0 text-[10px] font-medium text-slate-400">{t("recurringDetail.pautaTitleHint")}</p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-700">{t("recurringDetail.pautaType")} *</label>
                  <Select2Field
                    theme="light"
                    searchable={false}
                    placeholder={t("recurringDetail.pautaType")}
                    value={pautaForm.content_type}
                    options={CONTENT_TYPES.map((type) => ({ value: type, label: t(`recurring.formats.${type}`) }))}
                    onChange={(value) => setPautaForm({ ...pautaForm, content_type: value })}
                    triggerClassName={FIELD_SELECT}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-700">{t("recurringDetail.pautaDate")} *</label>
                  <input
                    type="date"
                    value={pautaForm.planned_date}
                    onChange={(e) => setPautaForm({ ...pautaForm, planned_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs outline-none focus:border-brand-primary"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700">{t("recurringDetail.pautaStatus")}</label>
                <Select2Field
                  theme="light"
                  searchable={false}
                  placeholder={t("recurringDetail.pautaStatus")}
                  value={pautaForm.status}
                  options={PAUTA_STATUSES.map((status) => ({ value: status, label: t(`recurringDetail.pautaStatuses.${status}`) }))}
                  onChange={(value) => setPautaForm({ ...pautaForm, status: value })}
                  triggerClassName={FIELD_SELECT}
                />
              </div>

              {!isLivePauta(pautaForm.content_type) ? (
                <div className="flex flex-col gap-2">
                  <label className="font-bold text-slate-700">{t("recurringDetail.pautaApprovalLabel")}</label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {(
                      [
                        {
                          id: "script_and_video" as const,
                          title: t("recurringDetail.pautaFlowScript"),
                          hint: t("recurringDetail.pautaFlowScriptHint"),
                          badge: t("recurringDetail.pautaFlowScriptBadge"),
                        },
                        {
                          id: "video_only" as const,
                          title: t("recurringDetail.pautaFlowVideo"),
                          hint: t("recurringDetail.pautaFlowVideoHint"),
                          badge: t("recurringDetail.pautaFlowVideoBadge"),
                        },
                      ] as const
                    ).map((option) => {
                      const selected = pautaForm.approval_flow === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setPautaForm({ ...pautaForm, approval_flow: option.id })}
                          className={cn(
                            "flex cursor-pointer flex-col gap-1.5 rounded-2xl border p-3 text-left transition-all",
                            selected
                              ? "border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20"
                              : "border-slate-200 bg-white hover:bg-slate-50",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-black text-slate-900">{option.title}</span>
                            <span
                              className={cn(
                                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px]",
                                selected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300",
                              )}
                            >
                              {selected ? "✓" : ""}
                            </span>
                          </div>
                          <p className="m-0 text-[10px] leading-snug text-slate-500">{option.hint}</p>
                          <span className={cn("self-start rounded-md border px-2 py-0.5 text-[9px] font-bold", selected ? "border-indigo-100 bg-white text-indigo-600" : "border-slate-200 text-slate-600")}>
                            {option.badge}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <PostingProfileCards
                value={pautaForm.posting_profile}
                onChange={(value) => setPautaForm({ ...pautaForm, posting_profile: value })}
              />

              <div className="flex flex-col gap-1.5">
                <label className="flex items-center justify-between font-bold text-slate-700">
                  <span>{isLivePauta(pautaForm.content_type) ? t("recurringDetail.pautaBriefingOptional") : `${t("recurringDetail.pautaBriefing")} *`}</span>
                  {!isLivePauta(pautaForm.content_type) ? <span className="text-[10px] font-normal text-slate-400">{t("recurringDetail.pautaBriefingHint")}</span> : null}
                </label>
                <PautaBriefingFieldsForm
                  value={pautaForm.briefing}
                  onChange={(briefing) => setPautaForm({ ...pautaForm, briefing })}
                  optional={isLivePauta(pautaForm.content_type)}
                />
              </div>

              {isLivePauta(pautaForm.content_type) ? (
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-700">{t("recurringDetail.liveLinkLabel")}</label>
                  <input
                    type="url"
                    value={pautaForm.live_link}
                    onChange={(e) => setPautaForm({ ...pautaForm, live_link: e.target.value })}
                    placeholder={t("recurringDetail.liveLinkPh")}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs outline-none focus:border-brand-primary"
                  />
                  <p className="text-[10px] text-slate-400">{t("recurringDetail.liveLinkHint")}</p>
                </div>
              ) : (
                <>
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center justify-between font-bold text-slate-700">
                  <span>{t("recurringDetail.pautaScript")}</span>
                  <span className="text-[10px] font-normal text-slate-400">{t("recurringDetail.pautaScriptHint")}</span>
                </label>
                <textarea
                  rows={3}
                  value={pautaForm.script}
                  onChange={(e) => setPautaForm({ ...pautaForm, script: e.target.value })}
                  placeholder={t("recurringDetail.pautaScriptPh")}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 font-mono text-[11px] outline-none focus:border-brand-primary"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700">{t("recurringDetail.pautaReferences")}</label>
                <input
                  type="url"
                  value={pautaForm.references}
                  onChange={(e) => setPautaForm({ ...pautaForm, references: e.target.value })}
                  placeholder={t("recurringDetail.pautaReferencesPh")}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs outline-none focus:border-brand-primary"
                />
              </div>
                </>
              )}
            </div>

            <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
              {editingPauta ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (await onDeletePauta(editingPauta)) setPautaModal(false);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-100"
                >
                  <Trash2 size={14} /> {t("recurringDetail.pautaDeleteBtn")}
                </button>
              ) : <div />}
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPautaModal(false)} className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100">{tc("cancel")}</button>
                <button className="rounded-xl bg-brand-primary px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-600">
                  {editingPauta ? t("recurringDetail.pautaSave") : t("recurringDetail.pautaCreate")}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function MetricTile({ icon: Icon, iconClass, label, badge, badgeClass, value, unit, extra }: { icon: LucideIcon; iconClass: string; label: string; badge?: string; badgeClass?: string; value: string; unit: string; extra?: { label: string; value: string } }) {
  return (
    <div className="flex flex-col justify-between gap-2.5 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 shadow-2xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-lg", iconClass)}><Icon size={13} /></div>
          <span className="truncate text-[10px] font-extrabold tracking-wider text-slate-500 uppercase">{label}</span>
        </div>
        {badge ? <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold", badgeClass || "border-slate-200 bg-white text-slate-500")}>{badge}</span> : null}
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

function MiniStat({ label, value, hint, icon: Icon, valueClass, labelClass, boxClass, iconClass }: { label: string; value: string; hint: string; icon: LucideIcon; valueClass?: string; labelClass?: string; boxClass?: string; iconClass?: string }) {
  return (
    <div className={cn("flex flex-col justify-between gap-1 rounded-xl border p-3 shadow-2xs", boxClass || "border-slate-200/70 bg-white")}>
      <div className="flex items-center justify-between gap-1">
        <span className={cn("truncate text-[9px] font-extrabold tracking-wider uppercase", labelClass || "text-slate-400")}>{label}</span>
        <Icon size={12} className={iconClass || "text-brand-primary"} />
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
