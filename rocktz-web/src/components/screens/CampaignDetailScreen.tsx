"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { safeHttpUrl } from "@/lib/safe-http-url";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  BarChart3,
  Calendar,
  CalendarCheck,
  CalendarClock,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Clock,
  Columns2,
  Copy,
  DollarSign,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
  Gift,
  Handshake,
  History,
  Image as ImageIcon,
  Instagram,
  Layers,
  LayoutGrid,
  Lock,
  MapPin,
  Megaphone,
  MessageCircle,
  Package,
  Play,
  Plus,
  ScrollText,
  Search,
  Sparkles,
  ThumbsUp,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
  Video,
  X,
} from "lucide-react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { AgencyFeePercentField } from "@/components/AgencyFeePercentField";
import { ApproveAgencyCampaignModal } from "@/components/ApproveAgencyCampaignModal";
import { CampaignLocationFields } from "@/components/CampaignLocationFields";
import { PostingProfileCards } from "@/components/PostingProfileCards";
import { Select2Field } from "@/components/Select2Field";
import { UserAvatar } from "@/components/UserAvatar";
import { CampaignSubmittedVideo } from "@/components/CampaignSubmittedVideo";
import { VideoPlayer } from "@/components/VideoPlayer";
import { CampaignMetricsPanel } from "@/components/CampaignMetricsPanel";
import { api } from "@/lib/api";
import { agencyFeeFromBudget, currentAgencyFeePercent, parseAgencyFeePercent } from "@/lib/agency-fee";
import { isPendingAgency } from "@/lib/agency-approval";
import { alertApiError, alertConfirm, alertSuccess, alertWarning } from "@/lib/alerts";
import { cn } from "@/lib/cn";
import { usePrivacy } from "@/lib/privacy";
import { campaignLocationLabel, currencySymbol, DEFAULT_COUNTRY, hasRegions, moneyCurrency } from "@/lib/geo";
import { campaignCreatorDeliveryState, isApprovedDelivery, type ContentDeliveryState } from "@/lib/content-delivery-status";
import { isBrandPosting, normalizePostingProfile, type PostingProfile } from "@/lib/posting-profile";
import type { Campaign, CampaignCreator, Company, Creator, RevisionHistoryEntry } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { intlLocale, normalizeLocale } from "@/i18n/locales";

const STATUSES = ["briefing", "selection", "approval", "production", "published", "finished"] as const;
type Tab = "entregas" | "candidaturas" | "briefing" | "financeiro" | "metricas";
type CreatorFilter = "all" | "attention" | "owing" | "delivered" | "no_demand";
type AppFilter = "all" | "pending" | "approved" | "rejected";
type CreatorLayout = "split" | "grid";
const LAYOUT_STORAGE_KEY = "rocktz.creatorLayout";

const STATUS_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  pending_agency: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
  briefing: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  selection: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  approval: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  production: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  published: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  finished: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-300" },
};

const STATUS_LABEL: Record<(typeof STATUSES)[number], string> = {
  briefing: "deliveries.statusBriefing",
  selection: "deliveries.statusSelection",
  approval: "deliveries.statusApproval",
  production: "deliveries.statusProduction",
  published: "deliveries.statusPublished",
  finished: "deliveries.statusFinished",
};

function isApproved(row: CampaignCreator) {
  return !row.application_status || row.application_status === "approved";
}

function hasNoDemand(row: CampaignCreator) {
  const type = (row.delivery_type ?? "").trim().toLowerCase();
  return !type || type.includes("sem demanda") || type.includes("no demand");
}

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
  if (posts) parts.push(`${posts}x Post${posts > 1 ? "s" : ""}`);
  if (youtube) parts.push(`${youtube}x YouTube`);
  return parts.join(" + ");
}

function formatRange(start: string | null | undefined, end: string | null | undefined, locale: string, t: (key: string, opts?: Record<string, string>) => string) {
  if (!start && !end) return t("campaigns.noDate");
  const fmt = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString(locale);
  if (start && end) return t("campaigns.dateRange", { start: fmt(start), end: fmt(end) });
  return fmt(start || end || "");
}

function deliveryLabel(state: ContentDeliveryState, t: (key: string) => string, mode: "list" | "detail" = "list") {
  if (state === "published") return t("campaignDetail.published");
  if (state === "approved") return t("campaignDetail.approved");
  if (state === "scriptRevision") return t("campaignDetail.scriptRevisionStatus");
  if (state === "videoRevision") return t("campaignDetail.videoRevisionStatus");
  if (state === "revision") return t("campaignDetail.adjustments");
  if (state === "scriptReview") return t("campaignDetail.scriptReviewStatus");
  if (state === "videoReview") return t("campaignDetail.videoReviewStatus");
  if (state === "scriptApproved") return t("campaignDetail.scriptApprovedStatus");
  if (state === "sent") return mode === "detail" ? t("campaignDetail.received") : t("campaignDetail.inReview");
  return t("campaignDetail.waiting");
}

function deliveryClass(state: ContentDeliveryState) {
  if (state === "published") return "text-emerald-700";
  if (state === "approved" || state === "scriptApproved") return "text-indigo-700";
  if (state === "scriptRevision" || state === "videoRevision" || state === "revision") return "text-rose-700";
  if (state === "scriptReview" || state === "videoReview" || state === "sent") return "text-amber-700";
  return "text-slate-500";
}

function hasSubmittedMaterial(row: CampaignCreator) {
  const content = row.content;
  if (content?.script?.trim()) return true;
  if (content?.video_url?.trim()) return true;
  if (content?.image_url?.trim()) return true;
  const status = row.delivery_status;
  if (status === "sent" || status === "revision" || status === "approved" || status === "published") return true;
  const scriptStatus = row.script_status;
  if (scriptStatus === "submitted" || scriptStatus === "revision" || scriptStatus === "approved") return true;
  const videoStatus = row.video_status;
  if (videoStatus === "submitted" || videoStatus === "revision" || videoStatus === "approved") return true;
  return false;
}

type CampaignHistoryEntry = {
  kind: "revision" | "submitted";
  stage: string;
  note?: string;
  at?: string;
  version?: number;
};

function campaignChangeHistory(row: CampaignCreator): CampaignHistoryEntry[] {
  const entries: CampaignHistoryEntry[] = [];
  const stored = (row.content?.revision_history ?? []).filter((entry: RevisionHistoryEntry) => entry.note?.trim());
  for (const entry of stored) {
    entries.push({
      kind: "revision",
      stage: entry.stage,
      note: entry.note.trim(),
      at: entry.requested_at,
    });
  }
  if (stored.length === 0) {
    if (row.script_feedback?.trim()) {
      entries.push({ kind: "revision", stage: "script", note: row.script_feedback.trim() });
    }
    if (row.video_feedback?.trim()) {
      entries.push({ kind: "revision", stage: "video", note: row.video_feedback.trim() });
    }
    const details = row.revision_details?.trim();
    if (details && !entries.some((entry) => entry.note === details)) {
      const stage = row.script_status === "revision" && !row.content?.video_url?.trim() ? "script" : "video";
      entries.push({ kind: "revision", stage, note: details });
    }
  }
  for (const version of row.content?.submission_versions ?? []) {
    entries.push({
      kind: "submitted",
      stage: version.stage,
      at: version.submitted_at,
      version: version.version,
    });
  }
  return entries.sort((a, b) => {
    const ta = a.at ? +new Date(a.at) : 0;
    const tb = b.at ? +new Date(b.at) : 0;
    return tb - ta;
  });
}

function campaignScriptVersions(row: CampaignCreator) {
  const current = row.content?.script?.trim() || "";
  const byVersion = new Map<number, { version: number; script: string; submittedAt?: string }>();
  for (const entry of row.content?.submission_versions ?? []) {
    if (entry.stage !== "script") continue;
    const script = (entry.script || "").trim();
    if (!script) continue;
    byVersion.set(entry.version, { version: entry.version, script, submittedAt: entry.submitted_at });
  }
  const currentVersion = row.content?.script_version
    || (byVersion.size ? Math.max(...byVersion.keys()) : current ? 1 : 0);
  if (current && ![...byVersion.values()].some((entry) => entry.script === current)) {
    byVersion.set(currentVersion || 1, {
      version: currentVersion || 1,
      script: current,
      submittedAt: row.script_submitted_at ?? undefined,
    });
  }
  return [...byVersion.values()].sort((a, b) => b.version - a.version);
}

function campaignVideoVersions(row: CampaignCreator) {
  const currentUrl = row.content?.video_url?.trim() || "";
  const byVersion = new Map<number, { version: number; url: string; submittedAt?: string; fileSize?: number | null }>();
  for (const entry of row.content?.submission_versions ?? []) {
    if (entry.stage !== "video") continue;
    const url = (entry.video_url || entry.media_url || entry.submission_url || "").trim();
    if (!url) continue;
    byVersion.set(entry.version, {
      version: entry.version,
      url,
      submittedAt: entry.submitted_at,
      fileSize: entry.video_file_size,
    });
  }
  const currentVersion = row.content?.video_version
    || (byVersion.size ? Math.max(...byVersion.keys()) : currentUrl ? 1 : 0);
  if (currentUrl && ![...byVersion.values()].some((entry) => entry.url === currentUrl)) {
    byVersion.set(currentVersion || 1, {
      version: currentVersion || 1,
      url: currentUrl,
      submittedAt: row.video_submitted_at ?? undefined,
      fileSize: row.content?.video_file_size,
    });
  }
  return [...byVersion.values()].sort((a, b) => b.version - a.version);
}

function needsAgencyAttention(row: CampaignCreator) {
  if (hasNoDemand(row)) return false;
  if (!row.content?.video_url?.trim()) return false;
  const status = row.delivery_status;
  if (status === "approved" || status === "published") return false;
  if (status === "sent") return true;
  if (row.video_status === "submitted") return true;
  return false;
}

function metricValue(metrics: Record<string, number> | undefined, keys: string[]) {
  if (!metrics) return 0;
  for (const key of keys) {
    const value = Number(metrics[key] ?? 0);
    if (value) return value;
  }
  return 0;
}

function suggestedFee(row: CampaignCreator, campaign: Campaign) {
  if (campaign.is_barter) return 0;
  return Number(campaign.creator_cache) || Number(row.amount) || 0;
}

function effectiveCreatorFee(row: CampaignCreator | null | undefined, campaign: Campaign) {
  if (campaign.is_barter || campaign.is_direct_contract) return 0;
  if (!row) return Number(campaign.creator_cache) || 0;
  return Number(row.amount) || Number(campaign.creator_cache) || 0;
}

function whatsappLink(phone: string | null | undefined, message: string) {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

function CoverPicker({ value, onChange, label }: { value: string; onChange: (url: string) => void; label: string }) {
  const { t } = useTranslation("app");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onFile(file: File) {
    if (!file.type.startsWith("image/")) {
      await alertWarning(t("campaignDetail.invalidImage"));
      return;
    }
    setUploading(true);
    try {
      const uploaded = await api.uploadMedia(file, file.name);
      onChange(uploaded.data.url);
    } catch (err) {
      await alertApiError(err);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">{label}</label>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="h-32 w-full rounded-xl object-cover" />
      ) : null}
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onFile(file);
            event.target.value = "";
          }}
        />
        <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {uploading ? t("campaignDetail.uploading") : t("campaignDetail.uploadCover")}
        </button>
        {value ? (
          <button type="button" onClick={() => onChange("")} className="text-xs font-bold text-rose-600">
            {t("companies.removeLogo")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DetailInner() {
  const user = useAuth();
  const router = useRouter();
  const { t, i18n } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const { formatCurrency, formatNumber } = usePrivacy();
  const locale = intlLocale(normalizeLocale(i18n.language));
  const id = usePathname().split("/").filter(Boolean).pop() ?? "";
  const isAdmin = user.role === "admin";
  const isCreator = user.role === "creator";
  const ownCreatorId = user.creator?.id ?? null;
  const canManage = user.role === "admin" || user.role === "company";
  const canChangeStatus = user.role === "admin" || Boolean(user.can_publish_without_approval);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tab, setTab] = useState<Tab>("entregas");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<number[]>([]);
  const [creatorSearch, setCreatorSearch] = useState("");
  const [creatorFilter, setCreatorFilter] = useState<CreatorFilter>("all");
  const [creatorLayout, setCreatorLayout] = useState<CreatorLayout>("split");
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [appFilter, setAppFilter] = useState<AppFilter>("all");
  const [appSearch, setAppSearch] = useState("");
  const [customAmounts, setCustomAmounts] = useState<Record<number, number>>({});
  const [rejectModal, setRejectModal] = useState<{ row: CampaignCreator | null; reason: string }>({ row: null, reason: "" });
  const [feedback, setFeedback] = useState<Record<number, string>>({});
  const [publishedLinkDraft, setPublishedLinkDraft] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [scriptPreviewOpen, setScriptPreviewOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [watchingVideoUrl, setWatchingVideoUrl] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [savingFee, setSavingFee] = useState(false);
  const [agencyFeeDraft, setAgencyFeeDraft] = useState("");
  const [payModal, setPayModal] = useState<{ row: CampaignCreator; mode: "pay" | "schedule" } | null>(null);
  const [payDate, setPayDate] = useState("");
  const [imageOpen, setImageOpen] = useState(false);
  const [editing, setEditing] = useState<CampaignCreator | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [editForm, setEditForm] = useState({
    name: "",
    company_id: "",
    status: "briefing",
    objective: "",
    approval_flow: "script_and_video" as "script_and_video" | "video_only" | "script_only",
    posting_profile: "creator" as PostingProfile,
    total_budget: "",
    creator_cache: "",
    agency_fee_percent: "",
    start_date: "",
    end_date: "",
    is_secret: false,
    is_direct_contract: false,
    is_barter: false,
    limit_by_city: false,
    state: "",
    city: "",
    barter_details: "",
    product: "",
    key_message: "",
    must_have: "",
    donts: "",
    cta: "",
    coupon: "",
    hashtags: "",
    reels: "0",
    stories: "0",
    tiktok: "0",
    ugc: "0",
    posts: "0",
    youtube: "0",
    deadline_days: "5",
    summary: "",
    guidelines: "",
  });
  const [creatorEdit, setCreatorEdit] = useState({ amount: "", delivery_type: "", video_url: "", published_link: "" });

  async function load() {
    if (!id || id === "_") return;
    try {
      const res = await api.campaign(id);
      setCampaign(res.data);
      setImageUrl(res.data.image_url || "");
    } catch (err) {
      await alertApiError(err);
      setCampaign(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    if (isAdmin) {
      api.creators("?status=active").then((res) => setCreators(res.data)).catch(() => undefined);
      api.companies("?status=active").then((res) => setCompanies(res.data)).catch(() => undefined);
    }
    const param = new URLSearchParams(window.location.search).get("tab");
    if (param === "selection" || param === "candidaturas") setTab("candidaturas");
    if (param === "briefing") setTab("briefing");
    if (param === "financeiro") setTab("financeiro");
    if (param === "metricas") setTab("metricas");
  }, [id, isAdmin]);

  useEffect(() => {
    if (!campaign) return;
    setAgencyFeeDraft(String(currentAgencyFeePercent(campaign)));
  }, [campaign?.id, campaign?.agency_fee_percent]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (stored === "split" || stored === "grid") setCreatorLayout(stored);
    } catch {
      /* ignore */
    }
  }, []);

  function changeCreatorLayout(next: CreatorLayout) {
    setCreatorLayout(next);
    setDetailModalOpen(false);
    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const applications = campaign?.applications ?? [];
  const approvedCreators = useMemo(() => applications.filter(isApproved), [applications]);
  const displayCreators = useMemo(() => {
    if (!isCreator || !ownCreatorId) return approvedCreators;
    return approvedCreators.filter((row) => row.creator_id === ownCreatorId);
  }, [approvedCreators, isCreator, ownCreatorId]);
  const myParticipation = useMemo(
    () => (ownCreatorId ? approvedCreators.find((row) => row.creator_id === ownCreatorId) ?? null : null),
    [approvedCreators, ownCreatorId],
  );
  const pendingApps = applications.filter((row) => row.application_status === "pending");
  const pendingAppCount = Math.max(pendingApps.length, campaign?.pending_applications ?? 0);
  const approvedApps = applications.filter((row) => row.application_status === "approved");
  const rejectedApps = applications.filter((row) => row.application_status === "rejected");
  const financeSummary = useMemo(() => {
    if (!campaign) return { total: 0, ready: 0, scheduled: 0, paid: 0, readyRows: [] as CampaignCreator[] };
    let total = 0;
    let ready = 0;
    let scheduled = 0;
    let paid = 0;
    const readyRows: CampaignCreator[] = [];
    for (const row of approvedCreators) {
      const amount = effectiveCreatorFee(row, campaign);
      total += amount;
      if (row.payment_status === "paid") {
        paid += amount;
        continue;
      }
      if (row.payment_status === "scheduled") {
        scheduled += amount;
        continue;
      }
      if (isApprovedDelivery(campaignCreatorDeliveryState(row, campaign.approval_flow))) {
        ready += amount;
        readyRows.push(row);
      }
    }
    return { total, ready, scheduled, paid, readyRows };
  }, [approvedCreators, campaign]);

  useEffect(() => {
    if (displayCreators.length > 0 && (selectedId == null || !displayCreators.some((row) => row.id === selectedId))) {
      setSelectedId(displayCreators[0].id);
    } else if (displayCreators.length === 0) {
      setSelectedId(null);
    }
  }, [displayCreators, selectedId]);

  useEffect(() => {
    if (isCreator && (tab === "candidaturas" || tab === "financeiro" || tab === "metricas")) setTab("entregas");
  }, [isCreator, tab]);

  const selected = displayCreators.find((row) => row.id === selectedId) ?? null;
  const selectedCreator = selected?.creator;
  const selectedDeliveryState = selected && campaign ? campaignCreatorDeliveryState(selected, campaign.approval_flow) : null;

  useEffect(() => {
    setPublishedLinkDraft(selected?.content?.published_link || "");
    setScriptPreviewOpen(false);
    setHistoryOpen(false);
    setWatchingVideoUrl(null);
  }, [selected?.id, selected?.content?.published_link]);

  const statusCounts = useMemo(() => {
    let attention = 0;
    let owing = 0;
    let delivered = 0;
    let noDemand = 0;
    displayCreators.forEach((row) => {
      if (needsAgencyAttention(row)) attention += 1;
      if (hasNoDemand(row)) noDemand += 1;
      else if (row.delivery_status === "approved" || row.delivery_status === "published") delivered += 1;
      else owing += 1;
    });
    return { all: displayCreators.length, attention, owing, delivered, no_demand: noDemand };
  }, [displayCreators]);

  const filteredCreators = useMemo(() => {
    const term = creatorSearch.trim().toLowerCase();
    return displayCreators.filter((row) => {
      const name = `${row.creator?.artistic_name ?? ""} ${row.creator?.full_name ?? ""} ${Object.values(row.creator?.socials ?? {}).join(" ")} ${row.delivery_type ?? ""}`.toLowerCase();
      if (term && !name.includes(term)) return false;
      const none = hasNoDemand(row);
      if (creatorFilter === "attention") return needsAgencyAttention(row);
      if (creatorFilter === "no_demand") return none;
      if (creatorFilter === "delivered") return !none && (row.delivery_status === "approved" || row.delivery_status === "published");
      if (creatorFilter === "owing") return !none && row.delivery_status !== "approved" && row.delivery_status !== "published";
      return true;
    });
  }, [displayCreators, creatorSearch, creatorFilter]);

  const filteredApps = useMemo(() => {
    const term = appSearch.trim().toLowerCase();
    return applications.filter((row) => {
      if (appFilter !== "all" && row.application_status !== appFilter) return false;
      if (!term) return true;
      const niches = (row.creator?.categories ?? []).join(" ");
      const blob = `${row.creator?.artistic_name ?? ""} ${row.creator?.full_name ?? ""} ${Object.values(row.creator?.socials ?? {}).join(" ")} ${row.creator?.city ?? ""} ${row.creator?.state ?? ""} ${niches}`.toLowerCase();
      return blob.includes(term);
    });
  }, [applications, appFilter, appSearch]);

  const totalBudget = Number(campaign?.total_budget) || 0;
  const castingCost = campaign
    ? approvedCreators.reduce((acc, row) => acc + effectiveCreatorFee(row, campaign), 0)
    : 0;
  const feePercent = campaign ? currentAgencyFeePercent(campaign) : 0;
  const agencyMargin = agencyFeeFromBudget(totalBudget, feePercent);
  const endDate = campaign?.end_date ? new Date(`${campaign.end_date}T00:00:00`) : null;
  const daysRemaining = endDate ? Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
  const specialMode = Boolean(campaign?.is_barter || campaign?.is_direct_contract);
  const statusCfg = STATUS_STYLE[campaign?.status ?? "briefing"] || STATUS_STYLE.briefing;

  function setActiveTab(next: Tab) {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState({}, "", url);
  }

  async function patch(row: CampaignCreator, body: Record<string, unknown>) {
    setUpdatingId(row.id);
    try {
      await api.updateParticipation(row.id, body);
      await load();
      return true;
    } catch (err) {
      await alertApiError(err);
      return false;
    } finally {
      setUpdatingId(null);
    }
  }

  async function approveApplication(row: CampaignCreator, amount: number) {
    if (!campaign) return;
    const deliveryType = row.delivery_type || formatDeliverablesSummary(campaign.deliverables) || "ugc";
    await patch(row, {
      application_status: "approved",
      amount,
      delivery_status: row.delivery_status || "pending",
      delivery_type: deliveryType,
      rejection_reason: "",
    });
  }

  async function rejectApplication(row: CampaignCreator, reason: string) {
    const ok = await patch(row, { application_status: "rejected", rejection_reason: reason.trim() || null });
    if (ok) setRejectModal({ row: null, reason: "" });
  }

  async function revertToPending(row: CampaignCreator) {
    await patch(row, { application_status: "pending", rejection_reason: "" });
  }

  async function changeStatus(status: string) {
    if (!campaign) return;
    try {
      await api.updateCampaign(campaign.id, { status });
      await load();
      await alertSuccess(t("campaignDetail.statusUpdated"));
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function saveAgencyFee() {
    if (!campaign) return;
    const feePercent = parseAgencyFeePercent(agencyFeeDraft);
    if (feePercent == null) {
      await alertWarning(tc("alerts.incompleteTitle"), t("campaigns.agencyFeeInvalid"));
      return;
    }
    setSavingFee(true);
    try {
      await api.updateCampaign(campaign.id, { agency_fee_percent: feePercent });
      await load();
      await alertSuccess(t("campaigns.agencyFeeSaved"));
    } catch (err) {
      await alertApiError(err);
    } finally {
      setSavingFee(false);
    }
  }

  function formatPayDate(value?: string | null) {
    if (!value) return "";
    return new Date(`${value}T00:00:00`).toLocaleDateString(locale);
  }

  function paymentBadge(status?: string | null) {
    if (status === "paid") return { className: "border-emerald-200 bg-emerald-50 text-emerald-700", label: t("campaignDetail.paid") };
    if (status === "scheduled") return { className: "border-indigo-200 bg-indigo-50 text-indigo-700", label: t("campaignDetail.scheduled") };
    return { className: "border-rose-200 bg-rose-50 text-rose-700", label: t("campaignDetail.pending") };
  }

  async function markPaid(row: CampaignCreator) {
    if (!campaign) return;
    if (campaign.is_barter || campaign.is_direct_contract) return;
    const amount = moneyOrMode(effectiveCreatorFee(row, campaign));
    const pix = row.creator?.pix_key?.trim();
    const ok = await alertConfirm(
      t("campaignDetail.payConfirmTitle"),
      t("campaignDetail.payConfirmText", {
        name: row.creator?.artistic_name ?? "",
        amount,
        pix: pix || t("campaignDetail.noPix"),
      }),
      t("campaignDetail.payNow"),
    );
    if (!ok) return;
    const done = await patch(row, {
      payment_status: "paid",
      payment_date: new Date().toISOString().slice(0, 10),
    });
    if (done) {
      setPayModal(null);
      await alertSuccess(t("campaignDetail.paymentMarked"));
    }
  }

  async function schedulePayment(row: CampaignCreator, date: string) {
    if (!date) {
      await alertWarning(tc("alerts.incompleteTitle"), t("campaignDetail.scheduleDateRequired"));
      return;
    }
    const done = await patch(row, { payment_status: "scheduled", payment_date: date });
    if (done) {
      setPayModal(null);
      await alertSuccess(t("campaignDetail.paymentScheduled"));
    }
  }

  async function payAllReady() {
    if (!campaign || financeSummary.readyRows.length === 0) return;
    const ok = await alertConfirm(
      t("campaignDetail.payAllTitle"),
      t("campaignDetail.payAllText", {
        count: financeSummary.readyRows.length,
        amount: moneyOrMode(financeSummary.ready),
      }),
      t("campaignDetail.payNow"),
    );
    if (!ok) return;
    const today = new Date().toISOString().slice(0, 10);
    for (const row of financeSummary.readyRows) {
      const done = await patch(row, { payment_status: "paid", payment_date: today });
      if (!done) return;
    }
    await alertSuccess(t("campaignDetail.paymentMarked"));
  }

  async function removeCampaign() {
    if (!campaign) return;
    if (!(await alertConfirm(t("campaignDetail.deleteTitle"), t("campaignDetail.deleteText")))) return;
    try {
      await api.deleteCampaign(campaign.id);
      await alertSuccess(t("campaignDetail.deleted"));
      router.push("/campaign-deliveries");
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function removeCreator(row: CampaignCreator) {
    if (!(await alertConfirm(t("campaignDetail.removeCreatorTitle"), t("campaignDetail.removeCreatorText")))) return;
    try {
      await api.deleteParticipation(row.id);
      await alertSuccess(t("campaignDetail.removed"));
      await load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  function openEdit() {
    if (!campaign) return;
    setImageUrl(campaign.image_url || "");
    const flow = campaign.approval_flow;
    setEditForm({
      name: campaign.name,
      company_id: String(campaign.company_id),
      status: campaign.status,
      objective: campaign.objective || "",
      approval_flow:
        flow === "video_only" || flow === "script_only" || flow === "script_and_video"
          ? flow
          : "script_and_video",
      posting_profile: normalizePostingProfile(campaign.posting_profile),
      total_budget: campaign.total_budget != null ? String(campaign.total_budget) : "",
      creator_cache: campaign.creator_cache != null ? String(campaign.creator_cache) : "",
      agency_fee_percent: String(currentAgencyFeePercent(campaign)),
      start_date: campaign.start_date || "",
      end_date: campaign.end_date || "",
      is_secret: campaign.is_secret,
      is_direct_contract: campaign.is_direct_contract,
      is_barter: campaign.is_barter,
      limit_by_city: Boolean(campaign.limit_by_city),
      state: campaign.state || "",
      city: campaign.city || "",
      barter_details: campaign.barter_details || "",
      product: String(campaign.briefing?.product ?? ""),
      key_message: String(campaign.briefing?.key_message ?? ""),
      must_have: String(campaign.briefing?.must_have ?? ""),
      donts: String(campaign.briefing?.donts ?? ""),
      cta: String(campaign.briefing?.cta ?? ""),
      coupon: String(campaign.briefing?.coupon ?? ""),
      hashtags: String(campaign.briefing?.hashtags ?? ""),
      reels: String(campaign.deliverables?.reels ?? 0),
      stories: String(campaign.deliverables?.stories ?? 0),
      tiktok: String(campaign.deliverables?.tiktok ?? 0),
      ugc: String(campaign.deliverables?.ugc ?? 0),
      posts: String(campaign.deliverables?.posts ?? 0),
      youtube: String(campaign.deliverables?.youtube ?? 0),
      deadline_days: String(campaign.deliverables?.deadline_days ?? 5),
      summary: String(campaign.deliverables?.summary ?? ""),
      guidelines: String(campaign.deliverables?.guidelines ?? ""),
    });
    setEditOpen(true);
  }

  async function saveCampaign(event: FormEvent) {
    event.preventDefault();
    if (!campaign) return;
    const feePercent = parseAgencyFeePercent(editForm.agency_fee_percent);
    if (isAdmin && !editForm.is_barter && feePercent == null) {
      await alertWarning(tc("alerts.incompleteTitle"), t("campaigns.agencyFeeInvalid"));
      return;
    }
    if (editForm.limit_by_city) {
      const country = companies.find((company) => String(company.id) === editForm.company_id)?.country || campaign.company?.country || DEFAULT_COUNTRY;
      if (hasRegions(country) && !editForm.state) {
        await alertWarning(tc("alerts.regionRequiredTitle"), tc("alerts.regionRequired"));
        return;
      }
      if (!editForm.city.trim()) {
        await alertWarning(tc("alerts.cityRequiredTitle"), t("campaigns.cityRequired"));
        return;
      }
    }
    try {
      await api.updateCampaign(campaign.id, {
        name: editForm.name,
        company_id: isAdmin ? Number(editForm.company_id) : undefined,
        status: canChangeStatus ? editForm.status : undefined,
        objective: editForm.objective,
        approval_flow: editForm.approval_flow,
        posting_profile: editForm.posting_profile,
        total_budget: editForm.is_barter ? 0 : editForm.total_budget ? Number(editForm.total_budget) : null,
        creator_cache: editForm.is_barter ? 0 : editForm.creator_cache ? Number(editForm.creator_cache) : null,
        agency_fee_percent: isAdmin ? feePercent ?? undefined : undefined,
        start_date: editForm.start_date || null,
        end_date: editForm.end_date || null,
        image_url: imageUrl || null,
        is_secret: editForm.is_secret,
        is_direct_contract: editForm.is_direct_contract,
        is_barter: editForm.is_barter,
        limit_by_city: editForm.limit_by_city,
        state: editForm.limit_by_city ? editForm.state || null : null,
        city: editForm.limit_by_city ? editForm.city.trim() : null,
        barter_details: editForm.is_barter ? editForm.barter_details : null,
        briefing: {
          product: editForm.product,
          key_message: editForm.key_message,
          must_have: editForm.must_have,
          donts: editForm.donts,
          cta: editForm.cta,
          coupon: editForm.coupon,
          hashtags: editForm.hashtags,
        },
        deliverables: {
          reels: Number(editForm.reels) || 0,
          stories: Number(editForm.stories) || 0,
          tiktok: Number(editForm.tiktok) || 0,
          ugc: Number(editForm.ugc) || 0,
          posts: Number(editForm.posts) || 0,
          youtube: Number(editForm.youtube) || 0,
          deadline_days: Number(editForm.deadline_days) || 5,
          summary: editForm.summary,
          guidelines: editForm.guidelines,
        },
      });
      setEditOpen(false);
      await load();
      await alertSuccess(t("campaignDetail.campaignSaved"));
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function saveImage() {
    if (!campaign) return;
    try {
      await api.updateCampaign(campaign.id, { image_url: imageUrl || null });
      setImageOpen(false);
      await load();
      await alertSuccess(t("campaignDetail.imageSaved"));
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function assign(creator: Creator) {
    if (!campaign) return;
    try {
      await api.assignCreator(campaign.id, {
        creator_id: creator.id,
        delivery_type: formatDeliverablesSummary(campaign.deliverables) || "Reel",
        amount: effectiveCreatorFee(null, campaign),
      });
      setAddOpen(false);
      await load();
      await alertSuccess(t("campaignDetail.added"));
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function saveCreatorEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    try {
      await api.updateParticipation(editing.id, {
        amount: creatorEdit.amount ? Number(creatorEdit.amount) : 0,
        delivery_type: creatorEdit.delivery_type,
        video_url: creatorEdit.video_url || null,
        published_link: creatorEdit.published_link || null,
      });
      setEditing(null);
      await load();
      await alertSuccess(t("campaignDetail.detailsSaved"));
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function requestRevision(row: CampaignCreator) {
    const note = (feedback[row.id] ?? "").trim();
    if (!note) {
      await alertWarning(tc("alerts.incompleteTitle"), t("campaignDetail.revisionRequired"));
      return;
    }
    const needsScriptRevision = row.script_status === "submitted"
      || (Boolean(row.content?.script) && row.script_status !== "approved" && !row.content?.video_url);
    await patch(row, needsScriptRevision
      ? { delivery_status: "revision", revision_details: note, script_status: "revision", script_feedback: note }
      : { delivery_status: "revision", revision_details: note, video_status: "revision", video_feedback: note });
  }

  async function markPublished(row: CampaignCreator) {
    const link = publishedLinkDraft.trim();
    if (!link) {
      await alertWarning(tc("alerts.incompleteTitle"), t("campaignDetail.publishedLinkRequired"));
      return;
    }
    await patch(row, { delivery_status: "published", published_link: link });
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="mx-auto my-12 max-w-lg rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
        <Megaphone size={40} className="mx-auto mb-3 text-slate-300" />
        <h2 className="text-xl font-bold text-slate-800">{t("campaignDetail.notFoundTitle")}</h2>
        <p className="mt-1 mb-6 text-xs text-slate-500">{t("campaignDetail.notFoundHint")}</p>
        <Link href="/campaign-deliveries" className="rounded-xl bg-brand-primary px-5 py-2.5 text-xs font-bold text-white shadow-md">
          {t("campaignDetail.backProjects")}
        </Link>
      </div>
    );
  }

  const companyName = campaign.company?.name || t("campaigns.client");
  const moneyOrMode = (value: number) => (campaign.is_barter ? t("deliveries.barter") : campaign.is_direct_contract ? t("deliveries.direct") : formatCurrency(value, moneyCurrency(campaign)));
  const myFeeDisplay = (() => {
    if (campaign.is_barter) return t("deliveries.barter");
    if (campaign.is_direct_contract) return t("deliveries.direct");
    const amount = effectiveCreatorFee(myParticipation, campaign);
    return amount > 0 ? formatCurrency(amount, moneyCurrency(campaign)) : t("available.toDefine");
  })();
  const detailTabs = (
    isCreator
      ? [
          ["entregas", Video, t("campaignDetail.tabMyDeliveries"), "", ""] as const,
          ["briefing", FileText, t("campaignDetail.tabBriefing"), "", ""] as const,
        ]
      : [
          ["entregas", Video, t("campaignDetail.tabDeliveries"), String(approvedCreators.length), "bg-indigo-600 text-white"] as const,
          ["candidaturas", Users, t("campaignDetail.tabCasting"), pendingAppCount > 0 ? (pendingAppCount > 1 ? t("campaignDetail.pendingBadgeMany", { count: pendingAppCount }) : t("campaignDetail.pendingBadge", { count: pendingAppCount })) : String(applications.length), pendingAppCount > 0 ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-600"] as const,
          ["briefing", FileText, t("campaignDetail.tabBriefing"), "", ""] as const,
          ["metricas", BarChart3, t("campaignDetail.tabMetrics"), "", ""] as const,
          ["financeiro", DollarSign, t("campaignDetail.tabFinance"), "", ""] as const,
        ]
  );

  return (
    <div className="flex flex-col gap-6 pb-24">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-start gap-3.5">
            <Link href="/campaign-deliveries" title={t("campaignDetail.backTitle")} className="mt-0.5 shrink-0 rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-xs transition-all hover:bg-slate-50">
              <ArrowLeft size={18} />
            </Link>
            <div className="flex items-center gap-3">
              <UserAvatar src={campaign.company?.logo_url} name={companyName} size="custom" shape="rounded-2xl" className="h-12 w-12 border border-indigo-100 shadow-xs" textClassName="text-sm font-black" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-extrabold tracking-wider text-brand-primary uppercase">{companyName}</span>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-slate-400">
                    <Calendar size={12} /> {formatRange(campaign.start_date, campaign.end_date, locale, t)}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl font-black tracking-tight text-slate-900 lg:text-2xl">{campaign.name}</h1>
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
                  {campaign.limit_by_city ? (
                    <span className="flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[9px] font-bold text-sky-700">
                      <MapPin size={9} /> {campaignLocationLabel(locale, campaign) || t("campaigns.cityLimited")}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
            {canChangeStatus && !isPendingAgency(campaign.status) ? (
              <Select2Field
                theme="light"
                searchable={false}
                className="w-44"
                value={campaign.status}
                options={STATUSES.map((status) => ({ value: status, label: t(STATUS_LABEL[status]) }))}
                onChange={(value) => void changeStatus(value)}
                triggerClassName={cn("h-auto min-h-0 py-2 text-xs font-extrabold shadow-xs", statusCfg.bg, statusCfg.text, statusCfg.border)}
              />
            ) : (
              <span className={cn("rounded-xl border px-3 py-2 text-xs font-extrabold", statusCfg.bg, statusCfg.text, statusCfg.border)}>
                {isPendingAgency(campaign.status) ? t("status.pending_agency") : t(STATUS_LABEL[campaign.status as (typeof STATUSES)[number]] ?? "deliveries.statusBriefing")}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-[11px] font-extrabold text-indigo-700">
              <FileText size={13} />
              {campaign.approval_flow === "video_only"
                ? t("campaigns.flowVideo")
                : campaign.approval_flow === "script_only"
                  ? t("campaigns.flowScript")
                  : t("campaigns.flowScriptVideo")}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-extrabold text-slate-700">
              {isBrandPosting(campaign.posting_profile) ? t("postingProfile.badgeBrand") : t("postingProfile.badgeCreator")}
            </span>
            {canManage ? (
              <button type="button" onClick={openEdit} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-extrabold text-slate-700 shadow-xs hover:bg-slate-50">
                <Edit3 size={14} /> {t("campaignDetail.edit")}
              </button>
            ) : null}
            {isAdmin && isPendingAgency(campaign.status) ? (
              <button type="button" onClick={() => setApproveOpen(true)} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-xs hover:bg-emerald-700">
                <CheckCircle2 size={14} /> {t("campaignDetail.approveAgency")}
              </button>
            ) : null}
            {isAdmin ? (
              <button type="button" onClick={() => void removeCampaign()} title={t("campaignDetail.deleteTitle")} className="rounded-xl border border-transparent p-2 text-slate-400 transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600">
                <Trash2 size={16} />
              </button>
            ) : null}
          </div>
        </div>

        {isPendingAgency(campaign.status) ? (
          <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-amber-900">
              <Clock size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="m-0 text-xs font-black tracking-wider uppercase">{t("campaignDetail.awaitingAgency")}</p>
                <p className="m-0 mt-1 text-[11px] font-medium leading-snug">{t("campaignDetail.awaitingAgencyHint")}</p>
              </div>
            </div>
          </div>
        ) : null}

        {campaign.objective ? (
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 text-xs leading-relaxed font-medium text-slate-600">
            <strong className="mr-1.5 font-bold text-slate-800">{t("campaignDetail.objective")}</strong>
            {campaign.objective}
          </div>
        ) : null}

        <div className="group relative aspect-[21/9] max-h-56 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm sm:aspect-[24/9] md:aspect-[3/1]">
          {campaign.image_url ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={campaign.image_url} alt={campaign.name} referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-slate-950/80 via-transparent to-transparent p-4">
                <span className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-slate-900/80 px-2.5 py-1 text-[10px] font-black tracking-wider text-white uppercase backdrop-blur-md">
                  <ImageIcon size={11} className="text-brand-primary" /> {t("campaignDetail.coverFormat")}
                </span>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => {
                      setImageUrl(campaign.image_url || "");
                      setImageOpen(true);
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-white/90 px-3.5 py-1.5 text-xs font-black text-slate-900 shadow-lg backdrop-blur-md hover:bg-white"
                  >
                    <Edit3 size={13} className="text-brand-primary" /> {t("campaignDetail.changeCover")}
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-between bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white/80 backdrop-blur-md">
                  <ImageIcon size={24} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{t("campaignDetail.noCoverTitle")}</h3>
                  <p className="text-xs text-slate-400">{t("campaignDetail.noCoverHint")}</p>
                </div>
              </div>
              {canManage ? (
                <button type="button" onClick={() => setImageOpen(true)} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-black text-slate-900 shadow-lg hover:bg-slate-100">
                  <ImageIcon size={14} className="text-brand-primary" /> {t("campaignDetail.addCover")}
                </button>
              ) : null}
            </div>
          )}
        </div>

        <div className={cn("grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2", isCreator ? "lg:grid-cols-2" : "lg:grid-cols-4")}>
          {isCreator ? (
            <>
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-brand-primary">
                      <DollarSign size={15} />
                    </div>
                    <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">{t("campaignDetail.kpiMyFee")}</span>
                  </div>
                  {myParticipation && !campaign.is_barter && Number(myParticipation.amount) > 0 ? (
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                      myParticipation.payment_status === "paid" ? "bg-emerald-50 text-emerald-700" : myParticipation.payment_status === "scheduled" ? "bg-indigo-50 text-indigo-700" : "bg-rose-50 text-rose-700",
                    )}>
                      {myParticipation.payment_status === "paid" ? t("campaignDetail.paid") : myParticipation.payment_status === "scheduled" ? t("campaignDetail.scheduled") : t("campaignDetail.pending")}
                    </span>
                  ) : null}
                </div>
                <span className="pt-3 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">{myFeeDisplay}</span>
              </div>
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                      <CalendarCheck size={15} />
                    </div>
                    <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">{t("campaignDetail.kpiSchedule")}</span>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", daysRemaining > 5 ? "bg-emerald-50 text-emerald-700" : daysRemaining >= 0 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700")}>
                    {daysRemaining >= 0 ? t("campaignDetail.daysLeft", { count: daysRemaining }) : t("campaignDetail.ended")}
                  </span>
                </div>
                <span className="pt-3 text-xs font-black text-slate-800 sm:text-sm">{t("campaignDetail.endsOn", { date: endDate ? endDate.toLocaleDateString(locale) : "—" })}</span>
              </div>
            </>
          ) : (
            <>
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <DollarSign size={15} />
                </div>
                <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">{t("campaignDetail.kpiInvestment")}</span>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{t("campaignDetail.kpiInvestmentBadge")}</span>
            </div>
            <span className="pt-3 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">{campaign.is_barter ? t("deliveries.barter") : campaign.is_direct_contract ? t("campaigns.directContract") : formatCurrency(totalBudget, moneyCurrency(campaign))}</span>
          </div>
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-brand-primary">
                  <Users size={15} />
                </div>
                <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">{t("campaignDetail.kpiCasting")}</span>
              </div>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-brand-primary">
                {approvedCreators.length === 1 ? t("campaignDetail.kpiCastingOne", { count: approvedCreators.length }) : t("campaignDetail.kpiCastingMany", { count: approvedCreators.length })}
              </span>
            </div>
            <span className="pt-3 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">{moneyOrMode(castingCost)}</span>
          </div>
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                  <TrendingUp size={15} />
                </div>
                <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">{t("campaignDetail.kpiMargin")}</span>
              </div>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", agencyMargin >= 0 ? "bg-purple-50 text-purple-700" : "bg-rose-50 text-rose-700")}>
                {specialMode ? t("campaignDetail.kpiPartnership") : t("campaignDetail.kpiFee", { percent: feePercent })}
              </span>
            </div>
            <span className="pt-3 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">{moneyOrMode(agencyMargin)}</span>
          </div>
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <CalendarCheck size={15} />
                </div>
                <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">{t("campaignDetail.kpiSchedule")}</span>
              </div>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", daysRemaining > 5 ? "bg-emerald-50 text-emerald-700" : daysRemaining >= 0 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700")}>
                {daysRemaining >= 0 ? t("campaignDetail.daysLeft", { count: daysRemaining }) : t("campaignDetail.ended")}
              </span>
            </div>
            <span className="pt-3 text-xs font-black text-slate-800 sm:text-sm">{t("campaignDetail.endsOn", { date: endDate ? endDate.toLocaleDateString(locale) : "—" })}</span>
          </div>
            </>
          )}
        </div>

        {!isCreator && pendingAppCount > 0 && tab !== "candidaturas" ? (
          <div className="mt-1 flex flex-col justify-between gap-3 rounded-2xl border border-amber-200/80 bg-[#FFF9E6] p-4 shadow-xs sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-xs">
                <Users size={20} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900">
                    {pendingAppCount === 1
                      ? t("campaignDetail.pendingBannerOne", { count: pendingAppCount })
                      : t("campaignDetail.pendingBannerMany", { count: pendingAppCount })}
                  </h4>
                  <span className="rounded-full bg-brand-primary px-2 py-0.5 text-[10px] font-black tracking-wide text-white uppercase">
                    {t("campaignDetail.actionNeeded")}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{t("campaignDetail.pendingHint")}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("candidaturas")}
              className="flex shrink-0 items-center gap-1.5 self-end rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-slate-800 sm:self-center"
            >
              <UserCheck size={14} className="text-amber-400" /> {t("campaignDetail.reviewApps")}
            </button>
          </div>
        ) : null}

        <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 pt-3">
          {detailTabs.map(([key, Icon, label, badge, badgeClass]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={cn(
                "-mb-[2px] flex cursor-pointer items-center gap-2 border-b-2 px-5 pb-3 text-xs font-extrabold whitespace-nowrap transition-all",
                tab === key ? "rounded-t-xl border-brand-primary bg-indigo-50/70 text-brand-primary" : "rounded-t-xl border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800",
              )}
            >
              <Icon size={16} />
              {label}
              {badge ? <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-black", badgeClass)}>{badge}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {tab === "entregas" ? (
        <div className={cn("grid grid-cols-1 items-start gap-6", !isCreator && creatorLayout === "split" && "lg:grid-cols-12")}>
          {!isCreator ? (
          <div className={cn("flex flex-col gap-4", creatorLayout === "split" ? "lg:col-span-4" : "col-span-full")}>
            <div className="flex flex-col gap-3.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="flex items-center gap-1.5 text-xs font-black tracking-wider text-slate-800 uppercase">
                    <Users size={14} className="text-brand-primary" /> {t("campaignDetail.allocated")}
                  </h3>
                  <span className="text-[10px] font-semibold text-slate-400">{t("campaignDetail.inCasting", { count: approvedCreators.length })}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5">
                    <button type="button" onClick={() => changeCreatorLayout("split")} title={t("campaignDetail.layoutSplitHint")} aria-label={t("campaignDetail.layoutSplitHint")} className={cn("inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-bold whitespace-nowrap", creatorLayout === "split" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-white")}>
                      <Columns2 size={13} className="shrink-0" /> <span className="hidden sm:inline">{t("campaignDetail.layoutSplit")}</span>
                    </button>
                    <button type="button" onClick={() => changeCreatorLayout("grid")} title={t("campaignDetail.layoutGridHint")} aria-label={t("campaignDetail.layoutGridHint")} className={cn("inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-bold whitespace-nowrap", creatorLayout === "grid" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-white")}>
                      <LayoutGrid size={13} className="shrink-0" /> <span className="hidden sm:inline">{t("campaignDetail.layoutGrid")}</span>
                    </button>
                  </div>
                  {isAdmin ? (
                    <button type="button" onClick={() => setAddOpen(true)} className="flex items-center gap-1 rounded-xl bg-brand-primary px-3 py-1.5 text-[11px] font-extrabold text-white shadow-xs hover:bg-indigo-600">
                      <Plus size={13} /> {t("campaignDetail.addCreator")}
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="relative">
                <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" size={14} />
                <input value={creatorSearch} onChange={(event) => setCreatorSearch(event.target.value)} placeholder={t("campaignDetail.searchCreator")} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-3 pl-8 text-xs font-medium outline-none focus:border-brand-primary focus:bg-white" />
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {(
                  [
                    ["all", t("campaignDetail.filterAll"), statusCounts.all, "bg-slate-900 text-white border-slate-900", "bg-white text-slate-600 border-slate-200", false],
                    ["attention", t("campaignDetail.filterAttention"), statusCounts.attention, "bg-amber-500 text-white border-amber-500", "bg-white text-amber-800 border-amber-200", true],
                    ["owing", t("campaignDetail.filterOwing"), statusCounts.owing, "bg-rose-600 text-white border-rose-600", "bg-white text-rose-700 border-rose-200", true],
                    ["delivered", t("campaignDetail.filterDelivered"), statusCounts.delivered, "bg-emerald-600 text-white border-emerald-600", "bg-white text-emerald-700 border-emerald-200", true],
                    ["no_demand", t("campaignDetail.filterNoDemand"), statusCounts.no_demand, "bg-slate-700 text-white border-slate-700", "bg-white text-slate-500 border-slate-200", false],
                  ] as const
                ).map(([key, label, count, active, idle, dot]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCreatorFilter(key)}
                    className={cn("flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold whitespace-nowrap", creatorFilter === key ? active : idle)}
                  >
                    {dot ? (
                      <span
                        className={cn(
                          "inline-block h-1.5 w-1.5 rounded-full",
                          key === "attention" ? "bg-amber-500" : key === "owing" ? "bg-rose-500" : "bg-emerald-500",
                        )}
                      />
                    ) : null}
                    <span>{label}</span>
                    <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-black", creatorFilter === key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600")}>{count}</span>
                  </button>
                ))}
              </div>
              <div className={cn(creatorLayout === "grid" ? "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" : "flex max-h-[580px] flex-col gap-2.5 overflow-y-auto", "pt-1")}>
                {filteredCreators.length === 0 ? (
                  <div className="col-span-full rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                    <Users size={24} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-xs font-bold text-slate-600">{t("campaignDetail.noCreatorFound")}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">{t("campaignDetail.noCreatorHint")}</p>
                  </div>
                ) : (
                  filteredCreators.map((row) => {
                    const expanded = expandedIds.includes(row.id);
                    const followers = metricValue(row.creator?.metrics, ["followers", "instagram_followers", "tiktok_followers"]);
                    const name = row.creator?.artistic_name || row.creator?.full_name || t("campaignDetail.delivery");
                    const handle = row.creator?.artistic_name ? `@${row.creator.artistic_name.replace(/^@/, "")}` : null;
                    const needsAttention = needsAgencyAttention(row);
                    const showAttentionTag = creatorFilter === "all" && needsAttention;
                    const deliveryState = campaignCreatorDeliveryState(row, campaign.approval_flow);

                    if (creatorLayout === "grid") {
                      return (
                        <div
                          key={row.id}
                          className={cn(
                            "group relative flex flex-col items-center rounded-xl border bg-white p-2.5 text-center shadow-sm transition-all hover:border-indigo-200 hover:shadow-md",
                            needsAttention
                              ? "border-amber-300 bg-amber-50/40 ring-1 ring-amber-200/70"
                              : deliveryState === "waiting" || deliveryState === "scriptRevision" || deliveryState === "videoRevision" || deliveryState === "revision"
                                ? "border-rose-200/80"
                                : deliveryState === "published" || deliveryState === "approved"
                                  ? "border-emerald-200/80"
                                  : "border-slate-200",
                          )}
                        >
                          {showAttentionTag ? (
                            <span className="absolute -top-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[8px] font-extrabold tracking-wide text-amber-900 uppercase shadow-xs">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                              {t("campaignDetail.attentionBadge")}
                            </span>
                          ) : null}
                          <UserAvatar src={row.creator?.photo_url} name={name} size="custom" shape="circle" className="mb-2 h-12 w-12 shrink-0 border border-slate-200" textClassName="text-xs font-bold" />
                          <h4 className="w-full truncate px-0.5 text-[11px] font-bold text-slate-900" title={name}>{name}</h4>
                          {handle ? <p className="mt-0.5 w-full truncate px-0.5 text-[9px] text-slate-400">{handle}</p> : null}
                          {followers > 0 ? (
                            <p className="mt-0.5 text-[9px] font-semibold text-slate-500">{t("campaignDetail.followersCount", { count: formatNumber(followers) })}</p>
                          ) : null}
                          <span className="mt-1 max-w-full truncate rounded-md border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[8px] font-extrabold text-brand-primary">{row.delivery_type || t("campaignDetail.delivery")}</span>
                          <span className={cn("mt-1.5 rounded-full border px-2 py-0.5 text-[9px] font-extrabold", deliveryClass(deliveryState), "border-slate-200 bg-slate-50")}>
                            {deliveryLabel(deliveryState, t)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedId(row.id);
                              setDetailModalOpen(true);
                            }}
                            className="mt-2 inline-flex w-full cursor-pointer items-center justify-center gap-1 rounded-lg bg-brand-primary px-2 py-1.5 text-[10px] font-bold text-white hover:bg-indigo-600"
                          >
                            <FileText size={11} className="shrink-0" /> {t("campaignDetail.viewDemands")}
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={row.id}
                        onClick={() => {
                          setSelectedId(row.id);
                          const mobile = typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches;
                          if (mobile) setDetailModalOpen(true);
                        }}
                        className={cn(
                          "relative flex cursor-pointer flex-col gap-2.5 rounded-xl border p-3 transition-all",
                          selectedId === row.id
                            ? "border-brand-primary/60 bg-indigo-50/50 ring-1 ring-brand-primary/20 shadow-xs"
                            : showAttentionTag
                              ? "border-amber-300 bg-amber-50/40 ring-1 ring-amber-200/60 hover:bg-amber-50/70"
                              : "border-slate-200 bg-white hover:bg-slate-50",
                        )}
                      >
                        {showAttentionTag ? (
                          <span className="absolute -top-2 right-2 z-10 flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[8px] font-extrabold tracking-wide text-amber-900 uppercase shadow-xs">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                            {t("campaignDetail.attentionBadge")}
                          </span>
                        ) : null}
                        <div className="flex items-center justify-between">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <UserAvatar src={row.creator?.photo_url} name={row.creator?.artistic_name || row.creator?.full_name} size="custom" shape="rounded-xl" className="h-9 w-9 border border-slate-200" textClassName="text-xs" />
                            <div className="min-w-0">
                              <span className="block truncate text-xs font-black text-slate-800">@{row.creator?.artistic_name || "criador"}</span>
                              {row.creator?.full_name ? <span className="block truncate text-[10px] font-semibold text-slate-400">{row.creator.full_name}</span> : null}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[9px] font-extrabold text-brand-primary">{row.delivery_type || t("campaignDetail.delivery")}</span>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setExpandedIds((prev) => (prev.includes(row.id) ? prev.filter((item) => item !== row.id) : [...prev, row.id]));
                              }}
                              className="rounded-md p-1 text-slate-400 hover:text-slate-700"
                            >
                              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-2 text-[10px]">
                          <div className="flex flex-col justify-between rounded-lg border border-slate-200/60 bg-white/80 p-1.5">
                            <span className="text-[8px] font-extrabold tracking-wider text-slate-400 uppercase">{t("campaignDetail.agreedFee")}</span>
                            <span className="mt-0.5 truncate font-black text-slate-800">{moneyOrMode(effectiveCreatorFee(row, campaign))}</span>
                          </div>
                          <div className="flex flex-col justify-between rounded-lg border border-slate-200/60 bg-white/80 p-1.5">
                            <span className="text-[8px] font-extrabold tracking-wider text-slate-400 uppercase">{t("campaignDetail.deliveryStatus")}</span>
                            <span className={cn("mt-0.5 truncate font-black", deliveryClass(deliveryState))}>{deliveryLabel(deliveryState, t)}</span>
                          </div>
                        </div>
                        {expanded ? (
                          <div className="space-y-2 border-t border-slate-100 pt-2 text-[10px]">
                            <div className="flex items-center justify-between text-slate-500">
                              <span>{t("campaignDetail.contract")}:</span>
                              <span className={cn("font-bold uppercase", row.signature_status === "signed" ? "text-emerald-600" : "text-amber-600")}>{row.signature_status === "signed" ? t("campaignDetail.signed") : t("campaignDetail.pending")}</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-500">
                              <span>{t("campaignDetail.payment")}:</span>
                              <span className={cn("font-bold uppercase", row.payment_status === "paid" ? "text-emerald-600" : row.payment_status === "scheduled" ? "text-indigo-600" : "text-rose-600")}>{row.payment_status === "paid" ? t("campaignDetail.paid") : row.payment_status === "scheduled" ? t("campaignDetail.scheduled") : t("campaignDetail.pending")}</span>
                            </div>
                            {isAdmin ? (
                              <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-1.5">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setCreatorEdit({ amount: String(row.amount ?? ""), delivery_type: row.delivery_type || "", video_url: row.content?.video_url || "", published_link: row.content?.published_link || "" });
                                    setEditing(row);
                                  }}
                                  className="text-[10px] font-extrabold text-brand-primary hover:underline"
                                >
                                  {t("campaignDetail.editDelivery")}
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void removeCreator(row);
                                  }}
                                  className="text-[10px] font-bold text-rose-600 hover:underline"
                                >
                                  {t("campaignDetail.removeCreator")}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          ) : null}

          <div className={cn(
            isCreator && "flex flex-col gap-5",
            !isCreator && creatorLayout === "split" && !detailModalOpen && "hidden lg:flex lg:col-span-8 lg:flex-col lg:gap-5",
            !isCreator && detailModalOpen && "app-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm sm:p-4",
            !isCreator && creatorLayout === "grid" && !detailModalOpen && "hidden",
          )}>
            {selected && selectedCreator ? (
              <div className={cn(
                "flex flex-col gap-5",
                !isCreator && detailModalOpen && "app-modal-panel relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl",
              )}>
                {!isCreator && detailModalOpen ? (
                  <button type="button" onClick={() => setDetailModalOpen(false)} className="sticky top-0 z-10 inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-100">
                    <ArrowLeft size={14} /> {tc("back")}
                  </button>
                ) : null}
                <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3.5">
                    <UserAvatar src={selectedCreator.photo_url} name={selectedCreator.artistic_name || selectedCreator.full_name} size="custom" shape="rounded-2xl" className="h-12 w-12 border border-indigo-100 shadow-xs" textClassName="text-base" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-black text-slate-900">@{selectedCreator.artistic_name}</h2>
                        <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold text-brand-primary">{selected.delivery_type}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-400">
                        {[selectedCreator.full_name, selectedCreator.city || t("campaignDetail.brazil")].filter(Boolean).join(" • ")}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/creators/${selected.creator_id}`} target="_blank" className="flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200">
                      {t("campaignDetail.portfolio")} <ExternalLink size={12} />
                    </Link>
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCreatorEdit({ amount: String(selected.amount ?? ""), delivery_type: selected.delivery_type || "", video_url: selected.content?.video_url || "", published_link: selected.content?.published_link || "" });
                          setEditing(selected);
                        }}
                        className="flex items-center gap-1 rounded-xl bg-brand-primary px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-600"
                      >
                        <Edit3 size={12} /> {t("campaignDetail.editDetails")}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                    <span className="text-[9px] font-extrabold tracking-wider text-slate-400 uppercase">{t("campaignDetail.agreedFee")}</span>
                    <span className="mt-1 truncate text-sm font-black text-slate-900">{moneyOrMode(effectiveCreatorFee(selected, campaign))}</span>
                  </div>
                  <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                    <span className="text-[9px] font-extrabold tracking-wider text-slate-400 uppercase">{t("campaignDetail.deliveryFormat")}</span>
                    <span className="mt-1 truncate text-sm font-black text-slate-800">{selected.delivery_type}</span>
                  </div>
                  <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                    <span className="text-[9px] font-extrabold tracking-wider text-slate-400 uppercase">{t("campaignDetail.contract")}</span>
                    <span className={cn("mt-1 truncate text-xs font-black uppercase", selected.signature_status === "signed" ? "text-emerald-600" : "text-amber-600")}>{selected.signature_status === "signed" ? t("campaignDetail.signed") : t("campaignDetail.pending")}</span>
                  </div>
                  <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                    <span className="text-[9px] font-extrabold tracking-wider text-slate-400 uppercase">{t("campaignDetail.contentStatus")}</span>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                      {selectedDeliveryState ? (
                        <span className={cn("truncate text-xs font-black uppercase", deliveryClass(selectedDeliveryState))}>{deliveryLabel(selectedDeliveryState, t, "detail")}</span>
                      ) : null}
                      {selectedDeliveryState === "approved" ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[8px] font-extrabold tracking-wide text-emerald-800 uppercase">
                          {t("campaignDetail.contentApprovedTag")}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {hasSubmittedMaterial(selected) ? (
                  <div className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                    {(selected.content?.script?.trim() || selected.content?.video_url?.trim() || selected.content?.image_url?.trim() || selected.content?.published_link?.trim()) ? (
                      <div className="flex flex-col gap-3">
                        <span className="text-[10px] font-black tracking-wider text-slate-700 uppercase">{t("campaignDetail.submittedMaterialTitle")}</span>
                        <div className="flex flex-wrap items-center gap-2">
                          {selected.content?.script?.trim() ? (
                            <button
                              type="button"
                              onClick={() => setScriptPreviewOpen(true)}
                              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-[11px] font-bold whitespace-nowrap text-brand-primary transition-colors hover:border-indigo-200 hover:bg-white"
                            >
                              <ScrollText size={13} />
                              {selected.script_status === "submitted" || (selected.content?.script && selected.script_status !== "approved" && !selected.content?.video_url)
                                ? t("campaignDetail.viewScriptForApproval")
                                : t("campaignDetail.viewScript")}
                              {selected.content?.script_version ? (
                                <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[9px] font-extrabold text-indigo-700">
                                  {t("campaignDetail.scriptVersion", { n: selected.content.script_version })}
                                </span>
                              ) : null}
                            </button>
                          ) : null}
                          {selected.content?.video_url?.trim() ? (
                            <CampaignSubmittedVideo
                              compact
                              className="w-auto"
                              videoUrl={selected.content.video_url}
                              fileSize={selected.content.video_file_size}
                            />
                          ) : selected.script_status === "approved" ? (
                            <span className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">
                              <Video size={13} /> {t("campaignDetail.waitingVideo")}
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => setHistoryOpen(true)}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold whitespace-nowrap text-slate-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-brand-primary"
                          >
                            <History size={13} /> {t("campaignDetail.revisionHistory")}
                          </button>
                        </div>
                        {campaignVideoVersions(selected).length > 1 ? (
                          <div className="flex flex-col gap-1.5">
                            <p className="m-0 text-[10px] font-extrabold tracking-wider text-slate-500 uppercase">{t("campaignDetail.videoVersionsTitle")}</p>
                            {campaignVideoVersions(selected).map((version) => (
                              <button
                                key={`campaign-v${version.version}`}
                                type="button"
                                onClick={() => setWatchingVideoUrl(version.url)}
                                className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:border-indigo-200 hover:bg-white"
                              >
                                <Play size={11} fill="currentColor" />
                                {t("campaignDetail.scriptVersion", { n: version.version })}
                                {version.submittedAt ? (
                                  <span className="font-semibold text-slate-400">{new Date(version.submittedAt).toLocaleString(locale)}</span>
                                ) : null}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {selected.content?.image_url ? (
                          <a href={safeHttpUrl(selected.content.image_url)} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-xs font-bold text-slate-800">
                            <span className="truncate">{selected.content.image_url}</span>
                            <ExternalLink size={12} />
                          </a>
                        ) : null}
                        {selected.content?.published_link ? (
                          <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                            <div className="flex items-center gap-2 truncate">
                              <Sparkles size={16} className="shrink-0 text-emerald-600" />
                              <span className="truncate text-xs font-bold text-emerald-900">{t("campaignDetail.publishedPost")}</span>
                            </div>
                            <a href={safeHttpUrl(selected.content.published_link)} target="_blank" rel="noreferrer" className="text-xs font-bold text-emerald-700 hover:underline">
                              {t("campaignDetail.viewPost")} ↗
                            </a>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setHistoryOpen(true)}
                        className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold whitespace-nowrap text-slate-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-brand-primary"
                      >
                        <History size={13} /> {t("campaignDetail.revisionHistory")}
                      </button>
                    )}
                    {selected.notes ? (
                      <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3 text-xs text-amber-900">
                        <strong className="mb-0.5 block">{t("campaignDetail.creatorNotes")}</strong>
                        {selected.notes}
                      </div>
                    ) : null}

                    {canManage ? (
                      <div className="mt-2 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
                        {selected.delivery_status === "approved" ? (
                          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
                            <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                            {t(isBrandPosting(campaign.posting_profile) ? "campaignDetail.approvedBannerBrand" : "campaignDetail.approvedBanner", { name: selectedCreator.artistic_name })}
                          </div>
                        ) : null}
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-[10px] font-black tracking-wider text-slate-700 uppercase">
                            <Edit3 size={13} className="text-brand-primary" /> {t("campaignDetail.decisionTitle")}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400">{t("campaignDetail.decisionHint")}</span>
                        </div>
                        {selected.delivery_status === "approved" ? (
                          isBrandPosting(campaign.posting_profile) || isAdmin ? (
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-bold tracking-wider text-slate-500 uppercase">{t("campaignDetail.publishedLinkLabel")}</label>
                            <input
                              type="url"
                              placeholder={t("campaignDetail.publishedLinkPh")}
                              value={publishedLinkDraft}
                              onChange={(event) => setPublishedLinkDraft(event.target.value)}
                              className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-xs font-medium outline-none focus:border-emerald-500"
                            />
                            <p className="text-[10px] font-medium text-slate-500">
                              {t(isBrandPosting(campaign.posting_profile) ? "postingProfile.publishedHintBrand" : "postingProfile.publishedHintCreator")}
                            </p>
                          </div>
                          ) : (
                          <p className="m-0 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] font-semibold text-amber-900">
                            {t("postingProfile.awaitingCreator")}
                          </p>
                          )
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[9px] font-bold tracking-wider text-slate-500 uppercase">{t("campaignDetail.feedbackLabel")}</label>
                            <textarea
                              rows={3}
                              placeholder={t("campaignDetail.feedbackPh")}
                              value={feedback[selected.id] ?? selected.revision_details ?? ""}
                              onChange={(event) => setFeedback((prev) => ({ ...prev, [selected.id]: event.target.value }))}
                              className="w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium outline-none focus:border-brand-primary"
                            />
                          </div>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                          {selected.delivery_status !== "approved" && selected.delivery_status !== "published" ? (
                            <button
                              type="button"
                              disabled={updatingId !== null || !(feedback[selected.id] || "").trim()}
                              onClick={async () => {
                                if (await patch(selected, { revision_details: feedback[selected.id] })) {
                                  await alertSuccess(t("campaignDetail.feedbackSaved"));
                                }
                              }}
                              className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              {t("campaignDetail.saveFeedback")}
                            </button>
                          ) : (
                            <span />
                          )}
                          <div className="flex flex-wrap items-center gap-2">
                            {selected.delivery_status !== "approved" && selected.delivery_status !== "published" ? (
                              <>
                                <button type="button" disabled={updatingId !== null} onClick={() => void requestRevision(selected)} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[11px] font-black tracking-wider whitespace-nowrap text-rose-800 uppercase hover:bg-rose-100 disabled:opacity-50">
                                  {t("campaignDetail.requestRevision")}
                                </button>
                                {selected.script_status === "submitted" || (selected.content?.script && selected.script_status !== "approved" && !selected.content?.video_url) ? (
                                  <button type="button" disabled={updatingId !== null} onClick={() => patch(selected, { script_status: "approved", script_feedback: "" })} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-[11px] font-black tracking-wider whitespace-nowrap text-white uppercase shadow-xs hover:bg-emerald-700 disabled:opacity-50">
                                    <ThumbsUp size={12} fill="currentColor" /> {t("campaignDetail.approveScript")}
                                  </button>
                                ) : (
                                  <button type="button" disabled={updatingId !== null} onClick={() => patch(selected, { delivery_status: "approved", script_status: "approved", video_status: "approved", revision_details: "" })} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-[11px] font-black tracking-wider whitespace-nowrap text-white uppercase shadow-xs hover:bg-emerald-700 disabled:opacity-50">
                                    <ThumbsUp size={12} fill="currentColor" /> {t("campaignDetail.approveMaterial")}
                                  </button>
                                )}
                              </>
                            ) : null}
                            {selected.delivery_status === "approved" && (isBrandPosting(campaign.posting_profile) || isAdmin) ? (
                              <button type="button" disabled={updatingId !== null || !publishedLinkDraft.trim()} onClick={() => void markPublished(selected)} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-[11px] font-black tracking-wider whitespace-nowrap text-white uppercase shadow-xs hover:bg-indigo-700 disabled:opacity-50">
                                <Sparkles size={12} /> {t("campaignDetail.markPublished")}
                              </button>
                            ) : null}
                            {selected.delivery_status === "published" ? (
                              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[11px] font-black tracking-wider text-emerald-800 uppercase">
                                <CheckCircle2 size={12} /> {t("campaignDetail.publishedDone")}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {selected.delivery_status === "revision" ? (
                          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">
                            <AlertCircle size={16} className="shrink-0 text-rose-600" />
                            {t("campaignDetail.revisionBanner")}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-xs text-slate-400 shadow-xs">
                    <Video size={28} className="text-slate-300" />
                    <span>{t("campaignDetail.waitingVideo")}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-16 text-center text-slate-400 shadow-xs">
                <Users size={36} className="text-slate-300" />
                <h3 className="text-base font-bold text-slate-800">{t("campaignDetail.selectCreator")}</h3>
                <p className="max-w-sm text-xs text-slate-500">{t("campaignDetail.selectCreatorHint")}</p>
                {approvedCreators.length === 0 && isAdmin ? (
                  <button type="button" onClick={() => setAddOpen(true)} className="mt-2 flex items-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2 text-xs font-bold text-white hover:bg-indigo-600">
                    <Plus size={14} /> {t("campaignDetail.addFirst")}
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {!isCreator && tab === "candidaturas" ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="flex items-center gap-2 text-base font-black tracking-tight text-slate-900">
                  <Users size={18} className="text-brand-primary" /> {t("campaignDetail.appsTitle")}
                </h3>
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-black text-brand-primary">
                  {applications.length === 1 ? t("campaignDetail.appsCount", { count: applications.length }) : t("campaignDetail.appsCountMany", { count: applications.length })}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{t("campaignDetail.appsHint")}</p>
            </div>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <div className="relative">
                <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
                <input value={appSearch} onChange={(event) => setAppSearch(event.target.value)} placeholder={t("campaignDetail.searchApps")} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-3.5 pl-9 text-xs font-medium focus:border-brand-primary focus:bg-white focus:outline-none sm:w-60" />
                {appSearch ? (
                  <button type="button" onClick={() => setAppSearch("")} className="absolute top-1/2 right-2.5 -translate-y-1/2 p-0.5 text-slate-400">
                    <X size={12} />
                  </button>
                ) : null}
              </div>
              {isAdmin ? (
                <button type="button" onClick={() => setAddOpen(true)} className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800">
                  <Plus size={14} /> {t("campaignDetail.addManual")}
                </button>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <button type="button" onClick={() => setAppFilter("all")} className={cn("cursor-pointer rounded-2xl border p-4 text-left shadow-xs", appFilter === "all" ? "border-brand-primary bg-indigo-50/80 ring-2 ring-brand-primary/20" : "border-slate-200 bg-white hover:border-slate-300")}>
              <div className="text-[10px] font-black tracking-wider text-slate-400 uppercase">{t("campaignDetail.appsTotal")}</div>
              <div className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">{applications.length}</div>
            </button>
            <button type="button" onClick={() => setAppFilter("pending")} className={cn("cursor-pointer rounded-2xl border p-4 text-left shadow-xs", appFilter === "pending" ? "border-amber-400 bg-amber-50/80 ring-2 ring-amber-400/20" : "border-slate-200 bg-white hover:border-slate-300")}>
              <div className="flex items-center justify-between text-[10px] font-black tracking-wider text-amber-600 uppercase">
                <span>{t("campaignDetail.appsPending")}</span>
                {pendingApps.length > 0 ? <span className="h-2 w-2 animate-ping rounded-full bg-amber-500" /> : null}
              </div>
              <div className="mt-1 text-xl font-black text-amber-700 sm:text-2xl">{pendingApps.length}</div>
            </button>
            <button type="button" onClick={() => setAppFilter("approved")} className={cn("cursor-pointer rounded-2xl border p-4 text-left shadow-xs", appFilter === "approved" ? "border-emerald-400 bg-emerald-50/80 ring-2 ring-emerald-400/20" : "border-slate-200 bg-white hover:border-slate-300")}>
              <div className="text-[10px] font-black tracking-wider text-emerald-600 uppercase">{t("campaignDetail.appsApproved")}</div>
              <div className="mt-1 text-xl font-black text-emerald-700 sm:text-2xl">{approvedApps.length}</div>
            </button>
            <button type="button" onClick={() => setAppFilter("rejected")} className={cn("cursor-pointer rounded-2xl border p-4 text-left shadow-xs", appFilter === "rejected" ? "border-rose-400 bg-rose-50/80 ring-2 ring-rose-400/20" : "border-slate-200 bg-white hover:border-slate-300")}>
              <div className="text-[10px] font-black tracking-wider text-rose-600 uppercase">{t("campaignDetail.appsRejected")}</div>
              <div className="mt-1 text-xl font-black text-rose-700 sm:text-2xl">{rejectedApps.length}</div>
            </button>
          </div>
          {filteredApps.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
                <Users size={28} />
              </div>
              <h4 className="text-base font-bold text-slate-800">
                {appFilter === "pending" ? t("campaignDetail.emptyPending")
                  : appFilter === "approved" ? t("campaignDetail.emptyApproved")
                    : appFilter === "rejected" ? t("campaignDetail.emptyRejected")
                      : t("campaignDetail.emptyAll")}
              </h4>
              <p className="max-w-md text-xs text-slate-500">
                {appSearch ? t("campaignDetail.emptySearch", { query: appSearch }) : t("campaignDetail.emptyHint")}
              </p>
              {appSearch ? (
                <button type="button" onClick={() => setAppSearch("")} className="cursor-pointer rounded-xl bg-slate-100 px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200">
                  {t("campaignDetail.clearSearch")}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredApps.map((row) => {
                const isPending = row.application_status === "pending";
                const isAppApproved = row.application_status === "approved";
                const isRejected = row.application_status === "rejected";
                const isUpdating = updatingId === row.id;
                const amountValue = customAmounts[row.id] !== undefined ? customAmounts[row.id] : suggestedFee(row, campaign);
                const location = [row.creator?.city, row.creator?.state].filter(Boolean).join(", ");
                const followers = metricValue(row.creator?.metrics, ["followers", "instagram_followers", "tiktok_followers"]);
                const engagement = metricValue(row.creator?.metrics, ["engagementRate", "engagement_rate"]);
                const waUrl = whatsappLink(row.creator?.whatsapp, t("campaignDetail.whatsappText", { handle: row.creator?.artistic_name || "", campaign: campaign.name }));
                const niches = row.creator?.categories ?? [];

                return (
                  <div
                    key={row.id}
                    className={cn(
                      "flex flex-col justify-between gap-5 rounded-2xl border bg-white p-5 shadow-xs transition-all lg:flex-row lg:items-center",
                      isPending ? "border-amber-200/90 ring-1 ring-amber-100 hover:border-amber-400" : isAppApproved ? "border-emerald-200/90 bg-emerald-50/20 hover:border-emerald-400" : "border-slate-200 opacity-80",
                    )}
                  >
                    <div className="flex min-w-0 items-start gap-4 sm:items-center">
                      <Link href={`/creators/${row.creator_id}`} className="group shrink-0">
                        <UserAvatar
                          src={row.creator?.photo_url}
                          name={row.creator?.artistic_name || row.creator?.full_name}
                          size="custom"
                          shape="rounded-2xl"
                          className="h-14 w-14 border-2 border-white shadow-sm transition-transform group-hover:scale-105"
                          textClassName="text-base font-black"
                        />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/creators/${row.creator_id}`} className="flex items-center gap-1 text-sm font-black text-slate-900 transition hover:text-brand-primary">
                            @{row.creator?.artistic_name || t("campaignDetail.creatorFallback")}
                            <ArrowUpRight size={13} className="text-slate-400" />
                          </Link>
                          <span className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black tracking-wider uppercase",
                            isPending ? "border border-amber-300 bg-amber-100 text-amber-800" : isAppApproved ? "border border-emerald-300 bg-emerald-100 text-emerald-800" : "border border-rose-300 bg-rose-100 text-rose-800",
                          )}>
                            {isPending ? <Clock size={11} /> : isAppApproved ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                            {isPending ? t("campaignDetail.pendingApproval") : isAppApproved ? t("campaignDetail.approvedCasting") : t("campaignDetail.rejectedApp")}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
                          {row.creator?.full_name ? <span>{row.creator.full_name}</span> : null}
                          {row.creator?.full_name && location ? <span className="text-slate-300">•</span> : null}
                          {location ? <span>{location}</span> : null}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {niches.slice(0, 3).map((niche) => (
                            <span key={niche} className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                              {t(`available.niches.${niche}`, { defaultValue: niche })}
                            </span>
                          ))}
                          {followers ? (
                            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">{t("campaignDetail.followersCount", { count: formatNumber(followers) })}</span>
                          ) : null}
                          {engagement ? (
                            <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">{t("campaignDetail.engagementRate", { rate: engagement })}</span>
                          ) : null}
                        </div>
                        {row.notes ? (
                          <div className="mt-2 max-w-xl rounded-xl border border-slate-200/80 bg-slate-50 p-2.5 text-xs text-slate-700">
                            <strong className="mb-0.5 block text-[10px] font-bold tracking-wider text-slate-500 uppercase">{t("campaignDetail.creatorMessage")}</strong>
                            &ldquo;{row.notes}&rdquo;
                          </div>
                        ) : null}
                        {isRejected && row.rejection_reason ? (
                          <div className="mt-2 max-w-xl rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
                            <strong className="mb-0.5 block text-[10px] font-bold tracking-wider text-rose-600 uppercase">{t("campaignDetail.rejectionReason")}</strong>
                            &ldquo;{row.rejection_reason}&rdquo;
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-stretch gap-4 border-t border-slate-100 pt-3 sm:flex-row sm:items-center lg:flex-col lg:items-end lg:border-t-0 lg:pt-0 xl:flex-row xl:items-center">
                      <div className="flex min-w-[140px] flex-col gap-1">
                        <label className="text-[10px] font-black tracking-wider text-slate-500 uppercase">{t("campaignDetail.agreedFee")}</label>
                        <div className="relative">
                          <span className="absolute top-1/2 left-2.5 -translate-y-1/2 text-xs font-bold text-slate-400">{currencySymbol(moneyCurrency(campaign), locale)}</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={amountValue}
                            disabled={!canManage || isAppApproved || campaign.is_barter}
                            onChange={(event) => setCustomAmounts((prev) => ({ ...prev, [row.id]: Number(event.target.value) }))}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pr-2.5 pl-8 text-xs font-black text-slate-900 focus:border-brand-primary focus:bg-white focus:ring-2 focus:ring-brand-primary/20 focus:outline-none disabled:bg-slate-100 disabled:opacity-75"
                          />
                        </div>
                        <span className="text-[9px] font-medium text-slate-400">{campaign.is_barter ? t("campaignDetail.barterFeeHint") : t("campaignDetail.feeAdjustable", { default: formatCurrency(Number(campaign.creator_cache) || 0, moneyCurrency(campaign)) })}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {isAdmin && waUrl ? (
                          <a href={waUrl} target="_blank" rel="noreferrer" title={t("campaignDetail.whatsappTitle")} className="flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100">
                            <MessageCircle size={15} />
                          </a>
                        ) : null}
                        <Link href={`/creators/${row.creator_id}`} title={t("campaignDetail.viewProfile")} className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50">
                          <Eye size={13} />
                          <span className="hidden sm:inline">{t("campaignDetail.profile")}</span>
                        </Link>
                        {canManage && isPending ? (
                          <>
                            <button type="button" disabled={isUpdating} onClick={() => setRejectModal({ row, reason: "" })} className="flex cursor-pointer items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50">
                              <X size={13} /> {t("campaignDetail.reject")}
                            </button>
                            <button type="button" disabled={isUpdating} onClick={() => void approveApplication(row, amountValue)} className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white shadow-xs transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50">
                              {isUpdating ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Check size={14} />}
                              {t("campaignDetail.approveCasting")}
                            </button>
                          </>
                        ) : null}
                        {canManage && isAppApproved ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedId(row.id);
                                setActiveTab("entregas");
                              }}
                              className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-brand-primary px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-indigo-600"
                            >
                              <Video size={13} /> {t("campaignDetail.seeDeliveries")}
                            </button>
                            <button type="button" disabled={isUpdating} title={t("campaignDetail.revertPending")} onClick={() => void revertToPending(row)} className="cursor-pointer rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50">
                              <Edit3 size={14} />
                            </button>
                          </>
                        ) : null}
                        {canManage && isRejected ? (
                          <button type="button" disabled={isUpdating} onClick={() => void approveApplication(row, amountValue)} className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-brand-primary transition hover:bg-indigo-100 disabled:opacity-50">
                            <CheckCircle2 size={13} /> {t("campaignDetail.reevaluate")}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {tab === "briefing" ? (
        <div className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">{t("campaignDetail.briefingTitle")}</h2>
              <p className="text-xs text-slate-500">{t("campaignDetail.briefingHint")}</p>
            </div>
            {canManage ? (
              <button type="button" onClick={openEdit} className="flex items-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2 text-xs font-extrabold text-white shadow-xs hover:bg-indigo-600">
                <Edit3 size={14} /> {t("campaignDetail.editBriefing")}
              </button>
            ) : null}
          </div>
          <div className="flex flex-col gap-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-indigo-600 p-2 text-white shadow-xs">
                  <Package size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">{t("campaignDetail.perCreator")}</h3>
                  <p className="text-xs text-slate-500">{t("campaignDetail.perCreatorHint")}</p>
                </div>
              </div>
              {countValue(campaign.deliverables?.deadline_days) ? (
                <div className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 py-1 text-xs font-bold text-indigo-900 shadow-xs">
                  {t("campaignDetail.deadline", { count: countValue(campaign.deliverables?.deadline_days) })}
                </div>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
              {(
                [
                  [t("campaignDetail.reels"), campaign.deliverables?.reels, Clapperboard, "text-indigo-600", "bg-indigo-50"],
                  [t("campaignDetail.stories"), campaign.deliverables?.stories, Instagram, "text-amber-600", "bg-amber-50"],
                  [t("campaignDetail.tiktok"), campaign.deliverables?.tiktok, Clapperboard, "text-rose-600", "bg-rose-50"],
                  [t("campaignDetail.ugc"), campaign.deliverables?.ugc, Camera, "text-teal-600", "bg-teal-50"],
                  [t("campaignDetail.posts"), campaign.deliverables?.posts, Layers, "text-emerald-600", "bg-emerald-50"],
                  [t("campaignDetail.youtube"), campaign.deliverables?.youtube, Video, "text-red-600", "bg-red-50"],
                ] as const
              ).map(([label, value, Icon, color, badge]) => (
                <div key={label} className="flex items-center justify-between rounded-xl border border-indigo-100 bg-white p-3 shadow-xs">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className={color} />
                    <span className="text-xs font-bold text-slate-700">{label}</span>
                  </div>
                  <span className={cn("rounded-md px-2 py-0.5 text-sm font-black text-slate-900", badge)}>{countValue(value)}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-indigo-100 bg-white p-3.5">
              <div className="text-xs text-slate-800">
                <span className="font-bold text-slate-500">{t("campaignDetail.summary")} </span>
                <span className="font-black text-brand-primary">{formatDeliverablesSummary(campaign.deliverables) || t("campaignDetail.summaryFallback")}</span>
              </div>
              {campaign.deliverables?.guidelines ? (
                <div className="border-t border-slate-100 pt-2 text-xs text-slate-600">
                  <span className="mb-0.5 block font-bold text-slate-500">{t("campaignDetail.guidelines")}</span>
                  <p className="whitespace-pre-wrap">{String(campaign.deliverables.guidelines)}</p>
                </div>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {(
              [
                [t("campaignDetail.product"), campaign.briefing?.product, "bg-slate-50 border-slate-200"],
                [t("campaignDetail.message"), campaign.briefing?.key_message, "bg-slate-50 border-slate-200"],
                [t("campaignDetail.mustHave"), campaign.briefing?.must_have, "bg-emerald-50/50 border-emerald-200"],
                [t("campaignDetail.donts"), campaign.briefing?.donts, "bg-rose-50/50 border-rose-200"],
                [t("campaignDetail.cta"), campaign.briefing?.cta, "bg-indigo-50/50 border-indigo-200"],
              ] as const
            ).map(([label, value, box]) => (
              <div key={label} className={cn("space-y-1.5 rounded-xl border p-4", box)}>
                <span className="block text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">{label}</span>
                <p className="text-xs font-medium whitespace-pre-wrap text-slate-800">{String(value || t("campaignDetail.notInformed"))}</p>
              </div>
            ))}
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <span className="block text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">{t("campaignDetail.coupon")}</span>
                <span className="text-xs font-bold text-slate-800">{String(campaign.briefing?.coupon || t("campaignDetail.noneItem"))}</span>
              </div>
              <div>
                <span className="block text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">{t("campaignDetail.hashtags")}</span>
                <span className="text-xs font-bold text-brand-primary">{String(campaign.briefing?.hashtags || t("campaignDetail.noneItem"))}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {!isCreator && tab === "metricas" ? (
        <CampaignMetricsPanel
          campaign={campaign}
          rows={approvedCreators}
          locale={locale}
          formatNumber={formatNumber}
          onCampaign={setCampaign}
        />
      ) : null}

      {!isCreator && tab === "financeiro" ? (
        <div className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-lg font-black text-slate-900">{t("campaignDetail.financeTitle")}</h2>
            <p className="text-xs text-slate-500">{t("campaignDetail.financeHint")}</p>
          </div>
          {isAdmin && !campaign.is_barter ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-purple-100 bg-purple-50/50 p-4 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <AgencyFeePercentField
                  value={agencyFeeDraft}
                  onChange={setAgencyFeeDraft}
                  totalBudget={totalBudget}
                  formatCurrency={(amount) => formatCurrency(amount, moneyCurrency(campaign))}
                  disabled={savingFee}
                />
              </div>
              <button
                type="button"
                disabled={savingFee}
                onClick={() => void saveAgencyFee()}
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-purple-600 px-4 text-xs font-extrabold text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {savingFee ? tc("saving") : t("campaignDetail.saveAgencyFee")}
              </button>
            </div>
          ) : null}
          {!campaign.is_barter ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black tracking-wider text-slate-400 uppercase">{t("campaignDetail.paySummaryTotal")}</p>
                <p className="mt-1 text-lg font-black text-slate-900">{moneyOrMode(financeSummary.total)}</p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
                <p className="text-[10px] font-black tracking-wider text-emerald-700 uppercase">{t("campaignDetail.paySummaryReady")}</p>
                <p className="mt-1 text-lg font-black text-emerald-800">{moneyOrMode(financeSummary.ready)}</p>
              </div>
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3">
                <p className="text-[10px] font-black tracking-wider text-indigo-700 uppercase">{t("campaignDetail.paySummaryScheduled")}</p>
                <p className="mt-1 text-lg font-black text-indigo-800">{moneyOrMode(financeSummary.scheduled)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[10px] font-black tracking-wider text-slate-400 uppercase">{t("campaignDetail.paySummaryPaid")}</p>
                <p className="mt-1 text-lg font-black text-slate-900">{moneyOrMode(financeSummary.paid)}</p>
              </div>
            </div>
          ) : null}
          {canManage && financeSummary.readyRows.length > 0 && !campaign.is_barter ? (
            <div className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-semibold text-emerald-800">{t("campaignDetail.payReadyHint", { count: financeSummary.readyRows.length, amount: moneyOrMode(financeSummary.ready) })}</p>
              <button type="button" onClick={() => void payAllReady()} className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-extrabold text-white hover:bg-emerald-700">
                <Banknote size={14} /> {t("campaignDetail.payAllReady")}
              </button>
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black tracking-wider text-slate-500 uppercase">
                  <th className="px-4 py-3">{t("campaignDetail.colCreator")}</th>
                  <th className="px-4 py-3">{t("campaignDetail.colFormat")}</th>
                  <th className="px-4 py-3">{t("campaignDetail.colContent")}</th>
                  <th className="px-4 py-3">{t("campaignDetail.colFee")}</th>
                  <th className="px-4 py-3">{t("campaignDetail.colContract")}</th>
                  <th className="px-4 py-3">{t("campaignDetail.colPayment")}</th>
                  <th className="px-4 py-3 text-right">{t("campaignDetail.colActions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {approvedCreators.map((row) => {
                  const deliveryState = campaignCreatorDeliveryState(row, campaign.approval_flow);
                  const contentOk = isApprovedDelivery(deliveryState);
                  const amount = effectiveCreatorFee(row, campaign);
                  const pay = paymentBadge(row.payment_status);
                  const unpaid = row.payment_status !== "paid";
                  const canPay = canManage && contentOk && unpaid && !campaign.is_barter && !campaign.is_direct_contract;
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <UserAvatar src={row.creator?.photo_url} name={row.creator?.artistic_name || row.creator?.full_name} size="custom" shape="rounded-lg" className="h-7 w-7 border border-slate-200" textClassName="text-[10px]" />
                          <div className="min-w-0">
                            <p>@{row.creator?.artistic_name}</p>
                            {row.creator?.pix_key ? (
                              <p className="truncate text-[10px] font-semibold text-slate-500">{t("campaignDetail.pixKey")}: {row.creator.pix_key}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-600">{row.delivery_type}</td>
                      <td className="px-4 py-3.5">
                        <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-black uppercase", contentOk ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700")}>
                          {deliveryLabel(deliveryState, t)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-black text-slate-900">{moneyOrMode(amount)}</p>
                        {row.payment_status === "scheduled" && row.payment_date ? (
                          <p className="text-[10px] font-semibold text-indigo-600">{t("campaignDetail.scheduledFor", { date: formatPayDate(row.payment_date) })}</p>
                        ) : null}
                        {row.payment_status === "paid" && row.payment_date ? (
                          <p className="text-[10px] font-semibold text-emerald-600">{t("campaignDetail.paidOn", { date: formatPayDate(row.payment_date) })}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-black uppercase", row.signature_status === "signed" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700")}>
                          {row.signature_status === "signed" ? t("campaignDetail.signed") : t("campaignDetail.pending")}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-black uppercase", pay.className)}>{pay.label}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col items-end gap-1.5">
                          {canPay ? (
                            <div className="flex flex-wrap justify-end gap-1.5">
                              <button
                                type="button"
                                disabled={updatingId === row.id}
                                onClick={() => void markPaid(row)}
                                className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-[10px] font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                <Banknote size={12} /> {t("campaignDetail.payNow")}
                              </button>
                              <button
                                type="button"
                                disabled={updatingId === row.id}
                                onClick={() => {
                                  setPayDate(row.payment_date || new Date().toISOString().slice(0, 10));
                                  setPayModal({ row, mode: "schedule" });
                                }}
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 text-[10px] font-extrabold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                              >
                                <CalendarClock size={12} /> {t("campaignDetail.schedulePayment")}
                              </button>
                            </div>
                          ) : null}
                          {!contentOk && unpaid && !campaign.is_barter ? (
                            <p className="max-w-[180px] text-right text-[10px] font-medium text-amber-700">{t("campaignDetail.waitingContentHint")}</p>
                          ) : null}
                          {canManage ? (
                            <button
                              type="button"
                              onClick={() => {
                                setCreatorEdit({ amount: String(row.amount ?? ""), delivery_type: row.delivery_type || "", video_url: row.content?.video_url || "", published_link: row.content?.published_link || "" });
                                setEditing(row);
                              }}
                              className="font-bold text-brand-primary hover:underline"
                            >
                              {t("campaignDetail.editDelivery")}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {approveOpen ? (
        <ApproveAgencyCampaignModal
          campaign={campaign}
          onClose={() => setApproveOpen(false)}
          onApproved={() => {
            setApproveOpen(false);
            void load();
          }}
        />
      ) : null}

      <AnimatePresence>
        {addOpen ? (
          <div className="app-modal-overlay fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-3 sm:p-4">
            <motion.button type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setAddOpen(false)} aria-label={tc("close")} />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="app-modal-panel relative z-10 my-auto flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex shrink-0 items-center justify-between border-b border-[#E2E8F0] p-5 sm:p-6">
                <div>
                  <h2 className="text-xl font-bold text-[#0F172A]">{t("campaignDetail.addCreatorTitle")}</h2>
                  <p className="text-xs text-slate-500">{t("campaignDetail.addCreatorHint")}</p>
                </div>
                <button type="button" onClick={() => setAddOpen(false)} className="p-1 font-bold text-slate-400">✕</button>
              </div>
              <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5 sm:p-6">
                {creators.map((creator) => {
                  const already = approvedCreators.some((row) => row.creator_id === creator.id);
                  return (
                    <div key={creator.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                      <div className="flex items-center gap-3">
                        <UserAvatar src={creator.photo_url} name={creator.artistic_name || creator.full_name} size="custom" shape="rounded-xl" className="h-10 w-10 border border-slate-200" textClassName="text-xs" />
                        <div>
                          <p className="text-sm font-black text-slate-900">@{creator.artistic_name}</p>
                          {creator.full_name ? <p className="text-xs text-slate-500">{creator.full_name}</p> : null}
                        </div>
                      </div>
                      {already ? (
                        <span className="text-[11px] font-bold text-slate-400">{t("campaignDetail.alreadyIn")}</span>
                      ) : (
                        <button type="button" onClick={() => void assign(creator)} className="rounded-xl bg-brand-primary px-3 py-1.5 text-xs font-bold text-white">
                          {t("campaignDetail.add")}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {imageOpen ? (
          <div className="app-modal-overlay fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-3 sm:p-4">
            <motion.button type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setImageOpen(false)} aria-label={tc("close")} />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="app-modal-panel relative z-10 my-auto flex w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] p-5 sm:p-6">
                <div>
                  <h2 className="text-xl font-bold text-[#0F172A]">{t("campaignDetail.changeCover")}</h2>
                  <p className="text-xs text-slate-500">{t("campaignDetail.changeCoverHint")}</p>
                </div>
                <button type="button" onClick={() => setImageOpen(false)} className="p-1 font-bold text-slate-400">✕</button>
              </div>
              <div className="flex flex-col gap-4 p-5 sm:p-6">
                <CoverPicker value={imageUrl} onChange={setImageUrl} label={t("campaignDetail.coverLabel")} />
                <div className="flex justify-end gap-3 border-t border-slate-100 pt-3">
                  <button type="button" onClick={() => setImageOpen(false)} className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">{tc("cancel")}</button>
                  <button type="button" onClick={() => void saveImage()} className="flex items-center gap-1.5 rounded-xl bg-brand-primary px-5 py-2 text-xs font-extrabold text-white shadow-md hover:bg-indigo-600">
                    <CheckCircle2 size={14} /> {t("campaignDetail.saveImage")}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {editOpen ? (
          <div className="app-modal-overlay fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-3 sm:p-4">
            <motion.button type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setEditOpen(false)} aria-label={tc("close")} />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="app-modal-panel relative z-10 my-auto flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex shrink-0 items-center justify-between border-b border-[#E2E8F0] p-5 sm:p-6">
                <h2 className="text-xl font-bold text-[#0F172A]">{t("campaignDetail.editCampaignTitle")}</h2>
                <button type="button" onClick={() => setEditOpen(false)} className="p-1 font-bold text-slate-400">✕</button>
              </div>
              <form noValidate onSubmit={saveCampaign} className="flex flex-1 flex-col gap-4 overflow-y-auto p-5 sm:p-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">{t("campaigns.name")}</label>
                  <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold" value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} />
                </div>
                <CoverPicker value={imageUrl} onChange={setImageUrl} label={t("campaignDetail.coverLabel")} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {isAdmin ? (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">{t("campaigns.company")}</label>
                      <Select2Field theme="light" searchable={false} value={editForm.company_id} options={companies.map((company) => ({ value: String(company.id), label: company.name }))} onChange={(value) => setEditForm({ ...editForm, company_id: value, state: "" })} />
                    </div>
                  ) : null}
                  {canChangeStatus ? (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">{t("campaigns.colStatus")}</label>
                      <Select2Field
                        theme="light"
                        searchable={false}
                        value={editForm.status}
                        options={(isPendingAgency(editForm.status) ? ["pending_agency", ...STATUSES] : [...STATUSES]).map((status) => ({
                          value: status,
                          label: status === "pending_agency" ? t("status.pending_agency") : t(STATUS_LABEL[status as (typeof STATUSES)[number]]),
                        }))}
                        onChange={(value) => setEditForm({ ...editForm, status: value })}
                      />
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">{t("campaigns.budget")}</label>
                    <input type="number" step="0.01" disabled={editForm.is_barter} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold disabled:bg-slate-100" value={editForm.total_budget} onChange={(event) => setEditForm({ ...editForm, total_budget: event.target.value })} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">{t("campaigns.creatorCache")}</label>
                    <input type="number" step="0.01" min="0" disabled={editForm.is_barter} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold disabled:bg-slate-100" value={editForm.creator_cache} onChange={(event) => setEditForm({ ...editForm, creator_cache: event.target.value })} />
                  </div>
                  {isAdmin ? (
                    <AgencyFeePercentField
                      value={editForm.agency_fee_percent}
                      onChange={(value) => setEditForm({ ...editForm, agency_fee_percent: value })}
                      totalBudget={editForm.is_barter ? 0 : editForm.total_budget ? Number(editForm.total_budget) : 0}
                      formatCurrency={(amount) => formatCurrency(amount, moneyCurrency(campaign))}
                      disabled={editForm.is_barter}
                    />
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">{t("campaigns.startDate")}</label>
                    <input type="date" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" value={editForm.start_date} onChange={(event) => setEditForm({ ...editForm, start_date: event.target.value })} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">{t("campaigns.endDate")}</label>
                    <input type="date" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" value={editForm.end_date} onChange={(event) => setEditForm({ ...editForm, end_date: event.target.value })} />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">{t("campaigns.approvalLabel")}</label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {(
                      [
                        {
                          id: "script_and_video" as const,
                          icon: FileText,
                          title: t("campaigns.flowScriptVideo"),
                          hint: t("campaigns.flowScriptVideoHint"),
                          badge: t("campaigns.flowScriptVideoBadge"),
                          recommended: true,
                        },
                        {
                          id: "video_only" as const,
                          icon: Video,
                          title: t("campaigns.flowVideo"),
                          hint: t("campaigns.flowVideoHint"),
                          badge: t("campaigns.flowVideoBadge"),
                          recommended: false,
                        },
                        {
                          id: "script_only" as const,
                          icon: FileText,
                          title: t("campaigns.flowScript"),
                          hint: t("campaigns.flowScriptHint"),
                          badge: t("campaigns.flowScriptBadge"),
                          recommended: false,
                        },
                      ] as const
                    ).map((option) => {
                      const Icon = option.icon;
                      const selected = editForm.approval_flow === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setEditForm({ ...editForm, approval_flow: option.id })}
                          className={cn(
                            "flex cursor-pointer flex-col justify-between gap-2 rounded-2xl border p-3 text-left transition-all",
                            selected
                              ? "border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-2 ring-indigo-500/20"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                          )}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="flex items-center gap-1.5 text-[11px] font-black">
                              <Icon size={13} className={selected ? "text-indigo-600" : "text-slate-400"} />
                              {option.title}
                            </span>
                            <span
                              className={cn(
                                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px]",
                                selected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300",
                              )}
                            >
                              {selected ? "✓" : ""}
                            </span>
                          </div>
                          <p className="text-[10px] leading-snug text-slate-500">{option.hint}</p>
                          <span
                            className={cn(
                              "self-start rounded-md border px-2 py-0.5 text-[9px] font-bold",
                              option.recommended
                                ? "border-indigo-100 bg-white/80 text-indigo-600"
                                : "border-slate-200 bg-white/80 text-slate-600",
                            )}
                          >
                            {option.badge}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <PostingProfileCards
                  value={editForm.posting_profile}
                  onChange={(value) => setEditForm({ ...editForm, posting_profile: value })}
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">{t("campaigns.objective")}</label>
                  <textarea
                    rows={2}
                    placeholder={t("deliveries.objectivePh")}
                    className="w-full resize-none rounded-xl border border-slate-200 p-2.5 text-xs font-medium"
                    value={editForm.objective}
                    onChange={(event) => setEditForm({ ...editForm, objective: event.target.value })}
                  />
                </div>
                <div className="flex flex-wrap gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={editForm.is_secret} onChange={(event) => setEditForm({ ...editForm, is_secret: event.target.checked })} /> {t("deliveries.secretNda")}</label>
                  <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={editForm.is_direct_contract} onChange={(event) => setEditForm({ ...editForm, is_direct_contract: event.target.checked })} /> {t("deliveries.directCompany")}</label>
                  <label className="flex items-center gap-2 text-xs font-bold text-amber-700"><input type="checkbox" checked={editForm.is_barter} onChange={(event) => setEditForm({ ...editForm, is_barter: event.target.checked })} /> {t("deliveries.barterProducts")}</label>
                </div>
                <CampaignLocationFields
                  country={companies.find((company) => String(company.id) === editForm.company_id)?.country || campaign.company?.country}
                  enabled={editForm.limit_by_city}
                  onEnabledChange={(value) => setEditForm({ ...editForm, limit_by_city: value, state: value ? editForm.state : "", city: value ? editForm.city : "" })}
                  state={editForm.state}
                  onStateChange={(value) => setEditForm({ ...editForm, state: value })}
                  city={editForm.city}
                  onCityChange={(value) => setEditForm({ ...editForm, city: value })}
                />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {(["reels", "stories", "tiktok", "ugc", "posts", "youtube"] as const).map((key) => (
                    <div key={key} className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">{t(`campaignDetail.${key}`)}</label>
                      <input type="number" min="0" className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold" value={editForm[key]} onChange={(event) => setEditForm({ ...editForm, [key]: event.target.value })} />
                    </div>
                  ))}
                </div>
                {(
                  [
                    ["product", t("campaignDetail.product")],
                    ["key_message", t("campaignDetail.message")],
                    ["must_have", t("campaignDetail.mustHave")],
                    ["donts", t("campaignDetail.donts")],
                    ["cta", t("campaignDetail.cta")],
                    ["hashtags", t("campaignDetail.hashtags")],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">{label}</label>
                    <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs" value={editForm[key]} onChange={(event) => setEditForm({ ...editForm, [key]: event.target.value })} />
                  </div>
                ))}
                <div className="flex justify-end gap-3 border-t border-slate-100 pt-3">
                  <button type="button" onClick={() => setEditOpen(false)} className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">{tc("cancel")}</button>
                  <button className="rounded-xl bg-brand-primary px-5 py-2 text-xs font-extrabold text-white shadow-md hover:bg-indigo-600">{t("campaignDetail.saveChanges")}</button>
                </div>
              </form>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {editing ? (
          <div className="app-modal-overlay fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-3 sm:p-4">
            <motion.button type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setEditing(null)} aria-label={tc("close")} />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="app-modal-panel relative z-10 my-auto flex w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] p-5">
                <h2 className="text-xl font-bold text-[#0F172A]">{t("campaignDetail.editCreatorTitle")}</h2>
                <button type="button" onClick={() => setEditing(null)} className="p-1 font-bold text-slate-400">✕</button>
              </div>
              <form noValidate onSubmit={saveCreatorEdit} className="flex flex-col gap-3 p-5">
                <input className="rounded-xl border border-slate-200 px-3 py-2 text-xs" placeholder={t("campaignDetail.agreedFee")} value={creatorEdit.amount} onChange={(event) => setCreatorEdit({ ...creatorEdit, amount: event.target.value })} />
                <input className="rounded-xl border border-slate-200 px-3 py-2 text-xs" placeholder={t("campaignDetail.deliveryFormat")} value={creatorEdit.delivery_type} onChange={(event) => setCreatorEdit({ ...creatorEdit, delivery_type: event.target.value })} />
                <input className="rounded-xl border border-slate-200 px-3 py-2 text-xs" placeholder={t("campaignDetail.mediaTitle")} value={creatorEdit.video_url} onChange={(event) => setCreatorEdit({ ...creatorEdit, video_url: event.target.value })} />
                <input className="rounded-xl border border-slate-200 px-3 py-2 text-xs" placeholder={t("campaignDetail.publishedPost")} value={creatorEdit.published_link} onChange={(event) => setCreatorEdit({ ...creatorEdit, published_link: event.target.value })} />
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setEditing(null)} className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600">{tc("cancel")}</button>
                  <button className="rounded-xl bg-brand-primary px-5 py-2 text-xs font-extrabold text-white">{t("campaignDetail.saveChanges")}</button>
                </div>
              </form>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {rejectModal.row ? (
          <div className="app-modal-overlay fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto p-3 sm:p-4">
            <motion.button type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setRejectModal({ row: null, reason: "" })} aria-label={tc("close")} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="app-modal-panel relative z-10 my-auto flex w-full max-w-md flex-col gap-4 overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                    <AlertCircle size={18} />
                  </div>
                  <h3 className="text-base font-black text-slate-900">{t("campaignDetail.rejectModalTitle")}</h3>
                </div>
                <button type="button" onClick={() => setRejectModal({ row: null, reason: "" })} className="cursor-pointer p-1 text-slate-400 hover:text-slate-700">✕</button>
              </div>
              <p className="text-xs text-slate-600">{t("campaignDetail.rejectModalText", { name: campaign.name })}</p>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">{t("campaignDetail.rejectReasonLabel")}</label>
                <textarea
                  rows={3}
                  value={rejectModal.reason}
                  onChange={(event) => setRejectModal((prev) => ({ ...prev, reason: event.target.value }))}
                  placeholder={t("campaignDetail.rejectReasonPh")}
                  className="w-full resize-none rounded-xl border border-slate-200 p-3 text-xs font-medium focus:border-rose-400 focus:ring-2 focus:ring-rose-200 focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-2">
                <button type="button" onClick={() => setRejectModal({ row: null, reason: "" })} className="cursor-pointer rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">{tc("cancel")}</button>
                <button
                  type="button"
                  disabled={updatingId === rejectModal.row.id}
                  onClick={() => void rejectApplication(rejectModal.row as CampaignCreator, rejectModal.reason)}
                  className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-extrabold text-white shadow-xs transition hover:bg-rose-700 active:scale-95 disabled:opacity-50"
                >
                  <X size={14} /> {t("campaignDetail.confirmReject")}
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {payModal ? (
          <div className="app-modal-overlay fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto p-3 sm:p-4">
            <motion.button type="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setPayModal(null)} aria-label={tc("close")} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="app-modal-panel relative z-10 my-auto flex w-full max-w-md flex-col gap-4 overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <CalendarClock size={18} />
                  </div>
                  <h3 className="text-base font-black text-slate-900">{t("campaignDetail.scheduleModalTitle")}</h3>
                </div>
                <button type="button" onClick={() => setPayModal(null)} className="cursor-pointer p-1 text-slate-400 hover:text-slate-700">✕</button>
              </div>
              <p className="text-xs text-slate-600">
                {t("campaignDetail.scheduleModalHint", {
                  name: payModal.row.creator?.artistic_name ?? "",
                  amount: moneyOrMode(effectiveCreatorFee(payModal.row, campaign)),
                })}
              </p>
              {payModal.row.creator?.pix_key ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                  {t("campaignDetail.pixKey")}: {payModal.row.creator.pix_key}
                </p>
              ) : (
                <p className="text-xs font-semibold text-amber-700">{t("campaignDetail.noPix")}</p>
              )}
              <form
                noValidate
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void schedulePayment(payModal.row, payDate);
                }}
              >
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase" htmlFor="campaign-pay-date">{t("campaignDetail.scheduleDateLabel")}</label>
                  <input
                    id="campaign-pay-date"
                    type="date"
                    value={payDate}
                    onChange={(event) => setPayDate(event.target.value)}
                    className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-2">
                  <button type="button" onClick={() => setPayModal(null)} className="cursor-pointer rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">{tc("cancel")}</button>
                  <button type="submit" disabled={updatingId === payModal.row.id} className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-extrabold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50">
                    <CalendarClock size={14} /> {t("campaignDetail.confirmSchedule")}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      {scriptPreviewOpen && selected?.content?.script?.trim() ? (
        <div className="app-modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:p-4">
          <div className="app-modal-panel flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
              <div className="min-w-0">
                <h3 className="text-base font-black text-slate-900">{t("campaignDetail.scriptPreviewTitle")}</h3>
                {selectedCreator ? (
                  <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">@{selectedCreator.artistic_name}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(selected.content?.script || "");
                    await alertSuccess(t("campaignDetail.copied"));
                  }}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-bold text-brand-primary hover:bg-indigo-50"
                >
                  <Copy size={12} /> {t("campaignDetail.copy")}
                </button>
                <button type="button" onClick={() => setScriptPreviewOpen(false)} className="cursor-pointer rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {campaignScriptVersions(selected).map((version, index) => (
                <div key={`script-v${version.version}`} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[9px] font-extrabold text-indigo-700 uppercase">
                      {t("campaignDetail.scriptVersion", { n: version.version })}
                    </span>
                    {index === 0 ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-extrabold text-emerald-800 uppercase">
                        {t("campaignDetail.currentVersion")}
                      </span>
                    ) : null}
                    {version.submittedAt ? (
                      <span className="text-[10px] font-semibold text-slate-400">{new Date(version.submittedAt).toLocaleString(locale)}</span>
                    ) : null}
                  </div>
                  <p className="m-0 rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-slate-700">{version.script}</p>
                </div>
              ))}
            </div>
            {canManage && selected.delivery_status !== "approved" && selected.delivery_status !== "published" && (selected.script_status === "submitted" || (selected.content?.script && selected.script_status !== "approved" && !selected.content?.video_url)) ? (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 p-4">
                <button type="button" onClick={() => setScriptPreviewOpen(false)} className="cursor-pointer rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100">{tc("close")}</button>
                <button
                  type="button"
                  disabled={updatingId !== null}
                  onClick={() => {
                    setScriptPreviewOpen(false);
                    void patch(selected, { script_status: "approved", script_feedback: "" });
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-[11px] font-black tracking-wider whitespace-nowrap text-white uppercase shadow-xs hover:bg-emerald-700 disabled:opacity-50"
                >
                  <ThumbsUp size={12} fill="currentColor" /> {t("campaignDetail.approveScript")}
                </button>
              </div>
            ) : (
              <div className="flex justify-end border-t border-slate-100 p-4">
                <button type="button" onClick={() => setScriptPreviewOpen(false)} className="cursor-pointer rounded-xl bg-brand-primary px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-600">{tc("close")}</button>
              </div>
            )}
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

      {historyOpen && selected ? (
        <div className="app-modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="app-modal-panel relative z-10 flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-brand-primary">
                  <History size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-black text-slate-900">{t("campaignDetail.revisionHistoryTitle")}</h3>
                  {selectedCreator ? (
                    <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">@{selectedCreator.artistic_name}</p>
                  ) : null}
                </div>
              </div>
              <button type="button" onClick={() => setHistoryOpen(false)} className="cursor-pointer rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-5">
              {campaignChangeHistory(selected).length ? (
                campaignChangeHistory(selected).map((entry, index) => (
                  <div key={`${entry.kind}-${entry.at || "n"}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <span className={cn(
                        "rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase",
                        entry.stage === "script" ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-rose-200 bg-rose-50 text-rose-700",
                      )}>
                        {entry.stage === "script" ? t("campaignDetail.revisionHistoryScript") : t("campaignDetail.revisionHistoryVideo")}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-extrabold text-slate-600 uppercase">
                        {entry.kind === "submitted" ? t("campaignDetail.historySubmitted") : t("campaignDetail.historyRevision")}
                      </span>
                      {entry.version ? (
                        <span className="text-[10px] font-extrabold text-slate-500">{t("campaignDetail.scriptVersion", { n: entry.version })}</span>
                      ) : null}
                      {entry.at ? (
                        <span className="text-[10px] font-semibold text-slate-400">{new Date(entry.at).toLocaleString(locale)}</span>
                      ) : null}
                    </div>
                    {entry.note ? (
                      <p className="m-0 text-xs leading-relaxed font-medium whitespace-pre-wrap text-slate-800">{entry.note}</p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="m-0 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs font-medium text-slate-500">
                  {t("campaignDetail.revisionHistoryEmpty")}
                </p>
              )}
            </div>
            <div className="flex justify-end border-t border-slate-100 p-4">
              <button type="button" onClick={() => setHistoryOpen(false)} className="cursor-pointer rounded-xl bg-brand-primary px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-600">{tc("close")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CampaignDetailScreen() {
  return (
    <AuthenticatedShell>
      <DetailInner />
    </AuthenticatedShell>
  );
}
