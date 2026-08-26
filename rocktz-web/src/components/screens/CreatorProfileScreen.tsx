"use client";

import { FormEvent, Fragment, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { safeHttpUrl } from "@/lib/safe-http-url";
import { intlLocale, normalizeLocale } from "@/i18n/locales";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clapperboard,
  Clock,
  DollarSign,
  Eye,
  ExternalLink,
  FileText,
  Link2,
  Filter,
  FolderPlus,
  Globe,
  Home,
  Hourglass,
  Info,
  Instagram,
  Key,
  KeyRound,
  Megaphone,
  AlertTriangle,
  Repeat,
  Scale,
  Send,
  Smartphone,
  Sparkles,
  Trash2,
  User,
  UserCheck,
  Video,
  X,
  Youtube,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { itemHasPautaBriefing } from "@/lib/pauta-briefing";
import { AppModal } from "@/components/AppModal";
import { PautaBriefingView } from "@/components/PautaBriefingView";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { ChangeCreatorPasswordModal } from "@/components/ChangeCreatorPasswordModal";
import { CreatorCampaignSubmissionPanel } from "@/components/CreatorCampaignSubmissionPanel";
import { CreatorContractModal } from "@/components/CreatorContractModal";
import { CreatorPautaSubmissionPanel } from "@/components/CreatorPautaSubmissionPanel";
import { CreatorPortfolioPanel } from "@/components/CreatorPortfolioPanel";
import { CreatorSwitcher } from "@/components/CreatorSwitcher";
import { Select2Field } from "@/components/Select2Field";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { UserAvatar } from "@/components/UserAvatar";
import { CONTRACT_METADATA } from "@/data/creatorContractTerms";
import { api } from "@/lib/api";
import { alertApiError, alertConfirm, alertSuccess, alertWarning } from "@/lib/alerts";
import { cn } from "@/lib/cn";
import {
  CONTENT_DELIVERY_STATES,
  campaignCreatorDeliveryState,
  creatorNextDeliveryAction,
  deliveryStatusRank,
  isApprovedDelivery,
  isRevisionDelivery,
  planningItemDeliveryState,
  type ContentDeliveryState,
  type CreatorDeliveryActionKind,
} from "@/lib/content-delivery-status";
import { formatCPF, formatWhatsApp, formatInstagram, formatTikTok, formatYouTube, formatKwai, instagramHandle, formatBRLMask, parseBRLMask, moneyToMask, formatIntegerMask, parseIntegerMask, integerToMask, isValidCPF } from "@/lib/masks";
import { DEFAULT_COUNTRY, formatLocation, hasRegions, isValidRegion } from "@/lib/geo";
import { CountrySelect, RegionSelect } from "@/components/GeoSelectFields";
import { usePrivacy } from "@/lib/privacy";
import { numericIdFromPath } from "@/lib/route-id";
import type { Campaign, Creator, PlanningItem, RecurringContract } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { userCanModerateCreator, userHasPermission } from "@/lib/auth";

type RecurringWorkRow = {
  key: string;
  contract: RecurringContract;
  item: PlanningItem | null;
  fee: number | null;
  deliverables: Record<string, number>;
  deliveryStatus: ContentDeliveryState;
};

const QUOTA_PILLS: { keys: string[]; labelKey: string }[] = [
  { keys: ["reels", "reel"], labelKey: "quotaReel" },
  { keys: ["stories", "story"], labelKey: "quotaStory" },
  { keys: ["posts", "post"], labelKey: "quotaPost" },
  { keys: ["tiktok", "tiktoks"], labelKey: "quotaTiktok" },
  { keys: ["youtube"], labelKey: "quotaYoutube" },
  { keys: ["live", "lives"], labelKey: "quotaLive" },
  { keys: ["live_instagram"], labelKey: "quotaLiveInstagram" },
  { keys: ["live_tiktok"], labelKey: "quotaLiveTiktok" },
  { keys: ["live_youtube"], labelKey: "quotaLiveYoutube" },
  { keys: ["pinterest", "pins"], labelKey: "quotaPinterest" },
  { keys: ["blog", "artigos", "articles"], labelKey: "quotaBlog" },
  { keys: ["podcast", "podcasts"], labelKey: "quotaPodcast" },
  { keys: ["unboxing", "unboxings"], labelKey: "quotaUnboxing" },
  { keys: ["ugc", "ugcs"], labelKey: "quotaUgc" },
  { keys: ["event", "events"], labelKey: "quotaEvent" },
  { keys: ["other", "outro"], labelKey: "quotaOther" },
];

function currentYearMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function itemInMonth(item: PlanningItem, month: string) {
  return item.month === month || Boolean(item.planned_date?.startsWith(month));
}

function quotaEntries(deliverables?: Record<string, number>) {
  return QUOTA_PILLS
    .map((pill) => ({
      labelKey: pill.labelKey,
      count: pill.keys.reduce((sum, key) => sum + Number(deliverables?.[key] || 0), 0),
    }))
    .filter((entry) => entry.count > 0);
}

function quotaTotal(deliverables?: Record<string, number>) {
  return quotaEntries(deliverables).reduce((sum, entry) => sum + entry.count, 0);
}

type CompanyGroup<T> = {
  key: string;
  id: string;
  name: string;
  logoUrl: string | null;
  rows: T[];
};

function buildRecurringWorkRows(contracts: RecurringContract[], creatorId: number): RecurringWorkRow[] {
  const rows: RecurringWorkRow[] = [];

  for (const contract of contracts) {
    const creatorRow = contract.creators?.find((row) => row.creator_id === creatorId);
    const fee = creatorRow?.monthly_cache ?? creatorRow?.monthly_fee ?? null;
    const items = (contract.items ?? [])
      .filter((item) => item.creator_id === creatorId && item.status !== "published")
      .sort((a, b) => deliveryStatusRank(planningItemDeliveryState(a)) - deliveryStatusRank(planningItemDeliveryState(b)));

    if (items.length === 0) {
      rows.push({
        key: `contract-${contract.id}`,
        contract,
        item: null,
        fee,
        deliverables: creatorRow?.monthly_deliverables ?? {},
        deliveryStatus: "waiting",
      });
      continue;
    }

    for (const item of items) {
      rows.push({
        key: `item-${item.id}`,
        contract,
        item,
        fee,
        deliverables: creatorRow?.monthly_deliverables ?? {},
        deliveryStatus: planningItemDeliveryState(item),
      });
    }
  }

  return rows.sort((a, b) => deliveryStatusRank(a.deliveryStatus) - deliveryStatusRank(b.deliveryStatus));
}

function companyFilterId(id?: number | null, name?: string | null) {
  if (id) return String(id);
  return name?.trim() ? `name:${name.trim().toLowerCase()}` : "none";
}

function groupRowsByCompany<T>(
  rows: T[],
  getCompany: (row: T) => { id?: number | null; name: string; logoUrl?: string | null },
): CompanyGroup<T>[] {
  const map = new Map<string, CompanyGroup<T>>();
  for (const row of rows) {
    const company = getCompany(row);
    const id = companyFilterId(company.id, company.name);
    const existing = map.get(id);
    if (existing) {
      existing.rows.push(row);
      continue;
    }
    map.set(id, {
      key: id,
      id,
      name: company.name,
      logoUrl: company.logoUrl ?? null,
      rows: [row],
    });
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

function WorkTableFilters({
  company,
  status,
  companyOptions,
  statusOptions,
  onCompany,
  onStatus,
  tp,
}: {
  company: string;
  status: string;
  companyOptions: { value: string; label: string }[];
  statusOptions: { value: string; label: string }[];
  onCompany: (value: string) => void;
  onStatus: (value: string) => void;
  tp: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold tracking-wider text-slate-500 uppercase">
          <Building2 size={11} /> {tp("filterCompany")}
        </span>
        <Select2Field theme="light" value={company} options={companyOptions} onChange={onCompany} placeholder={tp("filterCompany")} />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold tracking-wider text-slate-500 uppercase">
          <Filter size={11} /> {tp("filterStatus")}
        </span>
        <Select2Field theme="light" value={status} options={statusOptions} onChange={onStatus} placeholder={tp("filterStatus")} />
      </div>
    </div>
  );
}

function CompanyGroupHeader({
  name,
  count,
  logoUrl,
  countLabel,
  tone,
}: {
  name: string;
  count: number;
  logoUrl?: string | null;
  countLabel: string;
  tone: "purple" | "indigo";
}) {
  return (
    <div className={cn(
      "flex items-center gap-2.5 border-y px-4 py-2.5 sm:px-5",
      tone === "purple" ? "border-purple-100 bg-purple-50/80" : "border-indigo-100 bg-indigo-50/80",
    )}>
      <UserAvatar
        src={logoUrl}
        name={name}
        size="custom"
        shape="rounded-lg"
        className={cn(
          "h-7 w-7 border bg-white shadow-sm",
          tone === "purple" ? "border-purple-100" : "border-indigo-100",
        )}
        textClassName="text-[9px]"
      />
      <span className="min-w-0 truncate text-sm font-black text-slate-900">{name}</span>
      <span className={cn(
        "ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-extrabold",
        tone === "purple" ? "border-purple-200 bg-white text-purple-700" : "border-indigo-200 bg-white text-indigo-700",
      )}>
        {countLabel}
      </span>
    </div>
  );
}

function RecurringCompanyHeader({
  name,
  projectTitle,
  logoUrl,
  feeLabel,
  quotaItems,
  pendingCount,
  quotaCount,
  tp,
  ta,
}: {
  name: string;
  projectTitle: string;
  logoUrl?: string | null;
  feeLabel: string;
  quotaItems: { labelKey: string; count: number }[];
  pendingCount: number;
  quotaCount: number;
  tp: (key: string, options?: Record<string, unknown>) => string;
  ta: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <div className="border-b border-purple-100 bg-purple-50/80 px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <UserAvatar
            src={logoUrl}
            name={name}
            size="custom"
            shape="rounded-xl"
            className="h-11 w-11 shrink-0 border border-white shadow-sm"
            textClassName="text-sm"
          />
          <div className="min-w-0">
            <h4 className="m-0 truncate text-base font-black text-slate-900">{name}</h4>
            <p className="mt-0.5 mb-0 truncate text-[11px] font-semibold text-slate-500">{projectTitle}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-0.5 sm:items-end">
          <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">{tp("monthlyCacheLabel")}</span>
          <span className="text-lg font-black text-brand-primary">{feeLabel}</span>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">{tp("monthlyDeliveriesLabel")}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {quotaItems.length ? quotaItems.map((entry) => (
            <span key={entry.labelKey} className="rounded-full border border-purple-200 bg-white px-2.5 py-1 text-[10px] font-extrabold text-purple-700">
              {ta(`recurring.${entry.labelKey}`, { count: entry.count })}
            </span>
          )) : (
            <span className="text-[11px] font-semibold text-slate-400">{tp("noMonthlyQuota")}</span>
          )}
          {quotaCount > 0 || pendingCount > 0 ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-extrabold text-amber-800">
              {tp("monthQuotaProgress", { pending: pendingCount, total: quotaCount || pendingCount })}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DeliveryStatusIcon({ state }: { state: ContentDeliveryState }) {
  if (isRevisionDelivery(state)) return <AlertTriangle size={11} />;
  if (isApprovedDelivery(state) || state === "scriptApproved") return <CheckCircle2 size={11} />;
  if (state === "scriptReview" || state === "videoReview" || state === "sent") return <Clock size={11} />;
  return <Hourglass size={11} />;
}

const STATUS_OPTION_VALUES = ["active", "review", "paused", "rejected"] as const;
const ROLE_OPTION_VALUES = [
  { value: "creator", labelKey: "roleInfluencer" as const },
  { value: "admin", labelKey: "roleAdministrator" as const },
];

type ProfileTab = "dashboard" | "recurring" | "campaigns" | "portfolio" | "about";

function resolveProfileTab(value: string | null, creatorSelf: boolean): ProfileTab {
  if (value === "dashboard" || value === "recurring" || value === "campaigns" || value === "portfolio" || value === "about") {
    return value;
  }
  return creatorSelf ? "dashboard" : "portfolio";
}

function metricValue(metrics: Record<string, number> | undefined, keys: string[]) {
  if (!metrics) return 0;
  for (const key of keys) {
    const value = Number(metrics[key] ?? 0);
    if (value) return value;
  }
  return 0;
}

function formatPercentInput(value: string) {
  const cleaned = value.replace(/[^\d,.]/g, "").replace(".", ",");
  const [intPart, decPart] = cleaned.split(",");
  const ints = (intPart || "").slice(0, 3);
  if (cleaned.includes(",")) return `${ints},${(decPart || "").slice(0, 2)}`;
  return ints;
}

function parsePercentInput(value: string) {
  return Number(value.replace(",", ".")) || 0;
}

function percentToMask(value: number | string | null | undefined) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(n).replace(".", ",");
}

type NetworkKey = "instagram" | "tiktok" | "youtube" | "kwai";

type NetworkForm = {
  handle: string;
  followers: string;
  views: string;
  engagement: string;
};

const EMPTY_NETWORK: NetworkForm = { handle: "", followers: "", views: "", engagement: "" };

const EMPTY_NETWORKS: Record<NetworkKey, NetworkForm> = {
  instagram: { ...EMPTY_NETWORK },
  tiktok: { ...EMPTY_NETWORK },
  youtube: { ...EMPTY_NETWORK },
  kwai: { ...EMPTY_NETWORK },
};

type PriceForm = {
  story: string;
  reel: string;
  post: string;
  combo: string;
  tiktok: string;
  youtube: string;
  kwai: string;
};

const EMPTY_PRICES: PriceForm = {
  story: "",
  reel: "",
  post: "",
  combo: "",
  tiktok: "",
  youtube: "",
  kwai: "",
};

function maskPII(value: string | null | undefined, hidden: boolean | undefined, fallback: string) {
  if (!value) return fallback;
  if (hidden) return "••••••••";
  return value;
}

function statusChip(status: string, labels: { active: string; review: string; paused: string; rejected: string }) {
  if (status === "active") return { label: labels.active, className: "bg-emerald-100 text-emerald-800 border-emerald-200" };
  if (status === "review") return { label: labels.review, className: "bg-amber-100 text-amber-800 border-amber-200" };
  if (status === "paused") return { label: labels.paused, className: "bg-slate-100 text-slate-800 border-slate-200" };
  return { label: labels.rejected, className: "bg-red-100 text-red-800 border-red-200" };
}

function ProfileInner() {
  const user = useAuth();
  const { t: tp } = useTranslation("profile");
  const { t: ta } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const { i18n } = useTranslation();
  const { formatCurrency, formatNumber, hideValues } = usePrivacy();
  const pathname = usePathname();
  const router = useRouter();
  const id = numericIdFromPath(pathname, "creators");

  const [creator, setCreator] = useState<Creator | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"agency" | "creator">("agency");
  const [editing, setEditing] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [adding, setAdding] = useState(false);
  const [recurring, setRecurring] = useState<RecurringContract[]>([]);
  const [myCampaignItems, setMyCampaignItems] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [campaignSubTab, setCampaignSubTab] = useState<"active" | "applications">("active");
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<number | null>(null);
  const [expandedRecurringKey, setExpandedRecurringKey] = useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const searchParams = useSearchParams();
  const isCreatorSelf = user.role === "creator" && user.creator?.id === id;
  const tab = resolveProfileTab(searchParams.get("tab"), isCreatorSelf);
  const locale = intlLocale(normalizeLocale(i18n.language));
  const shouldOpenContract = searchParams.get("contract") === "1";

  const [fullName, setFullName] = useState("");
  const [artisticName, setArtisticName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [state, setState] = useState("");
  const [cpf, setCpf] = useState("");
  const [bio, setBio] = useState("");
  const [networks, setNetworks] = useState<Record<NetworkKey, NetworkForm>>(EMPTY_NETWORKS);
  const [prices, setPrices] = useState<PriceForm>(EMPTY_PRICES);
  const [acceptsExchange, setAcceptsExchange] = useState(false);
  const [acceptsPaidTraffic, setAcceptsPaidTraffic] = useState(false);
  const [acceptsExclusivity, setAcceptsExclusivity] = useState(false);
  const [syncingNetwork, setSyncingNetwork] = useState<NetworkKey | "all" | null>(null);

  const isAdmin = user.role === "admin";
  const agencyView = isAdmin && viewMode === "agency";
  const canModerateCreator = creator ? userCanModerateCreator(user, creator) : false;
  const canRemove = userHasPermission(user, "users.manage");

  async function updateLandingReview(status: string) {
    const companyId = user.company?.id;
    const signupId = creator?.landing_review?.id;
    if (!companyId || !signupId) return;
    try {
      await api.updateLandingSignup(companyId, signupId, status);
      await alertSuccess(ta("companyLanding.signups.updated"));
      await load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  function hydrate(data: Creator) {
    setFullName(data.full_name ?? "");
    setArtisticName(data.artistic_name);
    setWhatsapp(data.whatsapp ?? "");
    setCity(data.city ?? "");
    setCountry(data.country || DEFAULT_COUNTRY);
    setState(data.state ?? "");
    setCpf(data.cpf || data.document || "");
    setBio(data.bio ?? "");
    setNetworks({
      instagram: {
        handle: formatInstagram(data.socials?.instagram || ""),
        followers: integerToMask(metricValue(data.metrics, ["instagram_followers", "followers"])),
        views: integerToMask(metricValue(data.metrics, ["instagram_views", "avgViews", "avg_views"])),
        engagement: percentToMask(data.metrics?.instagram_engagement || data.metrics?.avgEngagement || data.metrics?.engagement_rate),
      },
      tiktok: {
        handle: formatTikTok(data.socials?.tiktok || ""),
        followers: integerToMask(metricValue(data.metrics, ["tiktok_followers"])),
        views: integerToMask(metricValue(data.metrics, ["tiktok_views"])),
        engagement: percentToMask(data.metrics?.tiktok_engagement),
      },
      youtube: {
        handle: formatYouTube(data.socials?.youtube || ""),
        followers: integerToMask(metricValue(data.metrics, ["youtube_followers", "youtube_subscribers"])),
        views: integerToMask(metricValue(data.metrics, ["youtube_views"])),
        engagement: percentToMask(data.metrics?.youtube_engagement),
      },
      kwai: {
        handle: formatKwai(data.socials?.kwai || ""),
        followers: integerToMask(metricValue(data.metrics, ["kwai_followers"])),
        views: integerToMask(metricValue(data.metrics, ["kwai_views"])),
        engagement: percentToMask(data.metrics?.kwai_engagement),
      },
    });
    setPrices({
      story: moneyToMask(data.pricing?.story),
      reel: moneyToMask(data.pricing?.reel),
      post: moneyToMask(data.pricing?.post),
      combo: moneyToMask(data.pricing?.combo),
      tiktok: moneyToMask(data.pricing?.tiktok),
      youtube: moneyToMask(data.pricing?.youtube),
      kwai: moneyToMask(data.pricing?.kwai),
    });
    setAcceptsExchange(data.accepts_exchange);
    setAcceptsPaidTraffic(data.accepts_paid_traffic);
    setAcceptsExclusivity(data.accepts_exclusivity);
  }

  function patchNetwork(key: NetworkKey, patch: Partial<NetworkForm>) {
    setNetworks((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  }

  function patchPrice(key: keyof PriceForm, value: string) {
    setPrices((current) => ({ ...current, [key]: value }));
  }

  function networkHandlePayload(key: Exclude<NetworkKey, "kwai">) {
    if (key === "instagram") return instagramHandle(networks.instagram.handle);
    if (key === "tiktok") return formatTikTok(networks.tiktok.handle).replace(/^@+/, "");
    return formatYouTube(networks.youtube.handle).replace(/^@+/, "");
  }

  async function syncNetwork(key: Exclude<NetworkKey, "kwai">) {
    if (!creator) return;
    const handle = networkHandlePayload(key);
    if (!handle) {
      await alertWarning(tp("fetchNetworkNeedHandleTitle"), tp("fetchNetworkNeedHandle"));
      return;
    }

    setSyncingNetwork(key);
    try {
      const response = await api.syncCreatorSocial(creator.id, { network: key, handle });
      if (!response.data) return;
      setCreator(response.data);
      hydrate(response.data);
      const result = response.sync?.[key];
      if (!result?.ok) {
        await alertWarning(tc("alerts.couldNotFinish"), result?.message || tp("fetchNetworkFail"));
        return;
      }
      await alertSuccess(tp("fetchNetworkSuccessTitle"), result.cached ? tp("fetchNetworkCached") : tp("fetchNetworkSuccess"));
    } catch (err) {
      await alertApiError(err);
    } finally {
      setSyncingNetwork(null);
    }
  }

  async function syncAllNetworks() {
    if (!creator) return;
    const handles = {
      instagram: networkHandlePayload("instagram"),
      tiktok: networkHandlePayload("tiktok"),
      youtube: networkHandlePayload("youtube"),
    };
    if (!handles.instagram && !handles.tiktok && !handles.youtube) {
      await alertWarning(tp("fetchNetworkNeedHandleTitle"), tp("fetchNetworkNeedHandle"));
      return;
    }

    setSyncingNetwork("all");
    try {
      const response = await api.syncCreatorSocial(creator.id, { handles });
      if (!response.data) return;
      setCreator(response.data);
      hydrate(response.data);
      const failed = Object.values(response.sync ?? {}).filter((item) => !item.ok);
      const cached = Object.values(response.sync ?? {}).every((item) => !item.ok || item.cached);
      if (failed.length > 0) {
        await alertWarning(
          tp("fetchNetworkPartialTitle"),
          failed.map((item) => item.message).filter(Boolean).join(" ") || tp("fetchNetworkPartial"),
        );
      } else {
        await alertSuccess(tp("fetchNetworkSuccessTitle"), cached ? tp("fetchNetworkCached") : tp("fetchNetworkSuccess"));
      }
    } catch (err) {
      await alertApiError(err);
    } finally {
      setSyncingNetwork(null);
    }
  }

  async function load() {
    if (!id) {
      setError(tp("notFound"));
      setLoading(false);
      return;
    }
    try {
      const res = await api.creator(id);
      setCreator(res.data);
      hydrate(res.data);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : tp("notFound"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    if (isAdmin) {
      api.campaigns("?include=content").then((res) => setCampaigns(res.data)).catch(() => undefined);
    }
    if (isAdmin || isCreatorSelf) {
      api.recurring("?include=items").then((res) => setRecurring(res.data)).catch(() => undefined);
    }
  }, [isAdmin, isCreatorSelf]);

  useEffect(() => {
    if (!isCreatorSelf || !id) return;
    if (tab !== "campaigns" && tab !== "dashboard") return;
    setLoadingCampaigns(true);
    api.availableCampaigns()
      .then((res) => setMyCampaignItems(res.data))
      .catch(() => undefined)
      .finally(() => setLoadingCampaigns(false));
  }, [isCreatorSelf, tab, id]);

  useEffect(() => {
    if (!shouldOpenContract || !creator || creator.contract_acceptance) return;
    if (!(isAdmin || user.creator?.id === creator.id)) return;
    setContractOpen(true);
  }, [shouldOpenContract, creator, isAdmin, user.creator?.id]);

  async function reloadMyCampaigns() {
    setLoadingCampaigns(true);
    try {
      setMyCampaignItems((await api.availableCampaigns()).data);
    } catch {
      /* ignore */
    } finally {
      setLoadingCampaigns(false);
    }
  }

  async function reloadRecurring() {
    try {
      setRecurring((await api.recurring("?include=items")).data);
    } catch {
      /* ignore */
    }
  }

  function openSubmission(rowId: number) {
    setExpandedSubmissionId(rowId);
    setExpandedRecurringKey(null);
  }

  function openRecurringWork(rowKey: string) {
    setExpandedRecurringKey(rowKey);
    setExpandedSubmissionId(null);
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-brand-primary" />
      </div>
    );
  }

  if (user.role === "creator" && user.creator?.id && id !== user.creator.id) {
    return (
      <div className="mx-auto mt-12 flex max-w-md flex-col items-center gap-4 rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">{tp("restrictedTitle")}</h2>
        <p className="text-sm leading-relaxed text-slate-600">{tp("restrictedBody")}</p>
        <Link href={`/creators/${user.creator.id}?tab=dashboard`} className="w-full rounded-xl bg-brand-primary py-3 text-center text-xs font-bold tracking-wider text-white uppercase">{tp("goToMyProfile")}</Link>
      </div>
    );
  }

  if (error || !creator) {
    return (
      <div className="mx-auto mt-12 flex max-w-lg flex-col items-center rounded-xl border border-[#E2E8F0] bg-white p-12 text-center">
        <div className="mb-4 rounded-full bg-red-50 p-3 text-red-500"><Info size={28} /></div>
        <p className="mb-2 font-bold text-[#0F172A]">{tp("loadError")}</p>
        <p className="mb-6 text-sm text-[#64748B]">{error || tp("notFound")}</p>
        <Link href="/creators" className="flex h-10 items-center gap-2 rounded-lg bg-brand-primary px-6 text-sm font-bold text-white shadow-lg hover:bg-indigo-600">
          <ArrowLeft size={16} /> {tp("backToCasting")}
        </Link>
      </div>
    );
  }

  const profile = creator;
  const chip = statusChip(profile.status, {
    active: tp("statusChipActive"),
    review: tp("statusChipReview"),
    paused: tp("statusChipPaused"),
    rejected: tp("statusChipRejected"),
  });
  const myContracts = recurring.filter((contract) => contract.status === "active" && contract.creators?.some((row) => row.creator_id === profile.id));
  const recurringWorkRows = buildRecurringWorkRows(myContracts, profile.id);
  const canEdit = isAdmin || user.creator?.id === profile.id;
  const canUpload = canEdit && (!isAdmin || viewMode === "creator");
  const showCreatorTabs = canEdit && !agencyView;
  const statusOptions = STATUS_OPTION_VALUES.map((value) => ({
    value,
    label: tp(
      value === "active" ? "statusActive"
        : value === "review" ? "statusReview"
          : value === "paused" ? "statusPaused"
            : "statusRejected",
    ),
  }));
  const roleOptions = ROLE_OPTION_VALUES.map((option) => ({ value: option.value, label: tp(option.labelKey) }));

  function goTab(next: ProfileTab) {
    setEditing(next === "about");
    router.replace(`${pathname}?tab=${next}`, { scroll: false });
  }

  const myParticipations = myCampaignItems
    .map((campaign) => {
      const row = campaign.applications?.find((app) => app.creator_id === profile.id);
      return row ? { campaign, row } : null;
    })
    .filter((item): item is { campaign: Campaign; row: NonNullable<Campaign["applications"]>[number] } => Boolean(item));

  const approvedCampaigns = myParticipations.filter((item) => item.row.application_status === "approved");
  const pendingApplications = myParticipations.filter((item) => item.row.application_status === "pending");
  const rejectedApplications = myParticipations.filter((item) => item.row.application_status === "rejected");

  const totalReceived = approvedCampaigns
    .filter((item) => item.row.payment_status === "paid")
    .reduce((sum, item) => sum + (Number(item.row.amount) || Number(item.campaign.creator_cache) || 0), 0);

  const totalToReceive = approvedCampaigns
    .filter((item) => item.row.payment_status !== "paid" && item.row.delivery_status === "approved")
    .reduce((sum, item) => sum + (Number(item.row.amount) || Number(item.campaign.creator_cache) || 0), 0);

  const monthlyEarnings = myContracts.reduce((sum, contract) => {
    const row = contract.creators?.find((item) => item.creator_id === profile.id);
    return sum + Number(row?.monthly_cache ?? row?.monthly_fee ?? 0);
  }, 0);

  function applicationLabel(status: string | null | undefined) {
    if (status === "approved") return tp("applicationApproved");
    if (status === "rejected") return tp("applicationRejected");
    return tp("applicationPending");
  }

  function deliveryLabel(status: string | null | undefined) {
    if (status === "published") return ta("campaignDetail.published");
    if (status === "approved") return ta("campaignDetail.approved");
    if (status === "scriptApproved") return ta("campaignDetail.scriptApprovedStatus");
    if (status === "scriptRevision") return ta("campaignDetail.scriptRevisionStatus");
    if (status === "videoRevision") return ta("campaignDetail.videoRevisionStatus");
    if (status === "scriptReview") return ta("campaignDetail.scriptReviewStatus");
    if (status === "videoReview") return ta("campaignDetail.videoReviewStatus");
    if (status === "revision") return ta("campaignDetail.adjustments");
    if (status === "sent") return ta("campaignDetail.inReview");
    return tp("deliveryPending");
  }

  function deliveryBadgeClass(status: string | null | undefined) {
    if (status === "scriptRevision" || status === "videoRevision" || status === "revision") {
      return "border-amber-200 bg-amber-100 text-amber-800";
    }
    if (status === "approved" || status === "published" || status === "scriptApproved") {
      return "border-emerald-200 bg-emerald-100 text-emerald-800";
    }
    if (status === "scriptReview" || status === "videoReview" || status === "sent") {
      return "border-indigo-200 bg-indigo-100 text-indigo-800";
    }
    return "border-slate-200 bg-slate-100 text-slate-700";
  }

  function applicationBadgeClass(status: string | null | undefined) {
    if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-700";
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  function fmtDate(value?: string | null) {
    return value ? new Date(`${value}T00:00:00`).toLocaleDateString(locale) : ta("available.toDefine");
  }

  function creatorFeeText(campaign: Campaign, row: { amount: number | null; payment_status?: string | null }) {
    if (campaign.is_barter) return ta("available.barterPay");
    const amount = Number(row.amount) || Number(campaign.creator_cache) || 0;
    if (amount > 0) return formatCurrency(amount, campaign.currency);
    return ta("available.toDefine");
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!fullName.trim() || !artisticName.trim()) {
      await alertWarning(tp("incompleteTitle"), tp("incompleteProfile"));
      return;
    }
    if (cpf && !isValidCPF(cpf)) {
      await alertWarning(tp("invalidCpfTitle"), tp("invalidCpf"));
      return;
    }
    if (hasRegions(country) && !isValidRegion(country, state)) {
      await alertWarning(tc("alerts.regionRequiredTitle"), tc("alerts.regionRequired"));
      return;
    }
    try {
      await api.updateCreator(profile.id, {
        full_name: fullName.trim(),
        artistic_name: artisticName.replace(/^@/, "").trim(),
        whatsapp: whatsapp || null,
        city: city || null,
        country,
        state: state || null,
        cpf: cpf || null,
        document: cpf || null,
        bio,
        socials: {
          ...(profile.socials ?? {}),
          instagram: instagramHandle(networks.instagram.handle),
          tiktok: formatTikTok(networks.tiktok.handle).replace(/^@/, ""),
          youtube: formatYouTube(networks.youtube.handle).replace(/^@/, ""),
          kwai: formatKwai(networks.kwai.handle).replace(/^@/, ""),
        },
        metrics: {
          ...profile.metrics,
          instagram_followers: parseIntegerMask(networks.instagram.followers),
          instagram_views: parseIntegerMask(networks.instagram.views),
          instagram_engagement: parsePercentInput(networks.instagram.engagement),
          tiktok_followers: parseIntegerMask(networks.tiktok.followers),
          tiktok_views: parseIntegerMask(networks.tiktok.views),
          tiktok_engagement: parsePercentInput(networks.tiktok.engagement),
          youtube_followers: parseIntegerMask(networks.youtube.followers),
          youtube_views: parseIntegerMask(networks.youtube.views),
          youtube_engagement: parsePercentInput(networks.youtube.engagement),
          kwai_followers: parseIntegerMask(networks.kwai.followers),
          kwai_views: parseIntegerMask(networks.kwai.views),
          kwai_engagement: parsePercentInput(networks.kwai.engagement),
          followers: parseIntegerMask(networks.instagram.followers),
          avgViews: parseIntegerMask(networks.instagram.views),
          avgEngagement: parsePercentInput(networks.instagram.engagement),
        },
        pricing: {
          ...profile.pricing,
          story: parseBRLMask(prices.story),
          reel: parseBRLMask(prices.reel),
          post: parseBRLMask(prices.post),
          combo: parseBRLMask(prices.combo),
          tiktok: parseBRLMask(prices.tiktok),
          youtube: parseBRLMask(prices.youtube),
          kwai: parseBRLMask(prices.kwai),
        },
        accepts_exchange: acceptsExchange,
        accepts_paid_traffic: acceptsPaidTraffic,
        accepts_exclusivity: acceptsExclusivity,
      });
      await alertSuccess(tp("updated"));
      if (showCreatorTabs) goTab("about");
      else setEditing(false);
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function addToCampaign() {
    if (!campaignId) return;
    setAdding(true);
    try {
      await api.assignCreator(Number(campaignId), { creator_id: profile.id });
      await alertSuccess(tp("addedToCampaign"));
      setCampaignId("");
    } catch (err) {
      await alertApiError(err);
    } finally {
      setAdding(false);
    }
  }

  async function removeCreatorAccount() {
    if (!creator) return;
    if (!(await alertConfirm(ta("creators.deleteTitle"), ta("creators.deleteText", { name: creator.artistic_name }), ta("creators.delete")))) return;
    try {
      await api.deleteCreator(creator.id);
      await alertSuccess(ta("creators.deleted"));
      router.push("/creators");
    } catch (err) {
      await alertApiError(err);
    }
  }

  return (
    <div className="flex flex-col gap-8 pb-24">
      {isAdmin ? (
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-indigo-900/60 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 text-white shadow-lg sm:p-5 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-xl border border-indigo-400/30 bg-indigo-500/20 p-2.5 text-indigo-300">
              <Key size={20} className="animate-pulse text-indigo-200" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="m-0 text-sm font-bold text-white">{tp("adminSwitchTitle")}</h4>
                <span className="rounded-full border border-indigo-400/30 bg-indigo-500/30 px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider text-indigo-200 uppercase">
                  {tp("viewingAs", { handle: creator.artistic_name })}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-300">{tp("adminSwitchHint")}</p>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-2.5 md:w-auto">
            <CreatorSwitcher currentCreatorId={creator.id} handle={creator.artistic_name} variant="banner" />
            <div className="flex rounded-xl border border-slate-700 bg-slate-800/80 p-1">
              <button type="button" onClick={() => setViewMode("agency")} className={cn("rounded-lg px-3 py-1.5 text-xs font-bold uppercase transition-all", viewMode === "agency" ? "bg-purple-600 font-extrabold text-white shadow-md" : "text-slate-300 hover:text-white")}>
                {tp("agencyPanelView")}
              </button>
              <button type="button" onClick={() => { setViewMode("creator"); setEditing(false); }} className={cn("rounded-lg px-3 py-1.5 text-xs font-bold uppercase transition-all", viewMode === "creator" ? "bg-purple-600 font-extrabold text-white shadow-md" : "text-slate-300 hover:text-white")}>
                {tp("creatorViewMode")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {creator.status === "review" ? (
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border-2 border-amber-400/60 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 p-4 shadow-sm sm:flex-row sm:items-center sm:p-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm"><Clock size={22} /></div>
            <div>
              <h4 className="m-0 text-sm font-bold text-amber-950">{agencyView || canModerateCreator ? tp("awaitingAdminTitle") : tp("awaitingCreatorTitle")}</h4>
              <p className="mt-0.5 max-w-xl text-xs text-amber-800">
                {canModerateCreator && !agencyView
                  ? tp("awaitingCompanyBody")
                  : agencyView && creator.invited_by_company?.name
                    ? tp("awaitingAdminInvitedBody", { company: creator.invited_by_company.name })
                    : agencyView
                      ? tp("awaitingAdminBody")
                      : tp("awaitingCreatorBody")}
              </p>
            </div>
          </div>
          {canModerateCreator ? (
            <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
              <button type="button" onClick={async () => { try { await api.approveCreator(creator.id); await alertSuccess(tp("approved")); load(); } catch (err) { await alertApiError(err); } }} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 sm:flex-none">
                <Check size={16} /> {tp("approveCreator")}
              </button>
              <button type="button" onClick={async () => { if (!(await alertConfirm(tp("rejectTitle"), tp("rejectText"), tp("reject")))) return; await api.rejectCreator(creator.id).catch(alertApiError); load(); }} className="rounded-xl border border-rose-200 bg-rose-100 px-3 py-2 text-xs font-bold text-rose-800 hover:bg-rose-200">{tp("reject")}</button>
            </div>
          ) : null}
        </div>
      ) : null}

      {user.role === "company" && creator.landing_review ? (
        <div className="flex flex-col gap-4 rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm"><Globe size={20} /></div>
            <div>
              <h4 className="m-0 text-sm font-bold text-indigo-950">{ta("companyLanding.signups.bannerTitle")}</h4>
              <p className="mt-0.5 max-w-xl text-xs text-indigo-800">{ta("companyLanding.signups.bannerBody")}</p>
              <div className="mt-2">
                <StatusBadge status={creator.landing_review.status} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void updateLandingReview("approved")} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700">{ta("companyLanding.signups.approve")}</button>
            <button type="button" onClick={() => void updateLandingReview("reviewing")} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800">{ta("companyLanding.signups.reviewing")}</button>
            <button type="button" onClick={() => void updateLandingReview("rejected")} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-800">{ta("companyLanding.signups.reject")}</button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center md:gap-4">
        <div className="flex flex-col gap-4">
          {isAdmin || user.role === "company" ? (
            <Link href="/creators" className="flex items-center gap-2 text-[12px] font-bold tracking-wider text-[#64748B] uppercase transition-colors hover:text-brand-primary">
              <ArrowLeft size={14} /> {tp("backToCasting")}
            </Link>
          ) : null}
          <div className="flex items-center gap-4">
            <UserAvatar src={creator.photo_url} name={creator.artistic_name || creator.full_name} size="custom" shape="rounded-2xl" className="h-16 w-16 border border-[#E2E8F0] shadow-sm" textClassName="text-xl" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="m-0 text-[26px] font-bold text-[#0F172A]">@{creator.artistic_name}</h1>
                <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider", chip.className)}>{chip.label}</span>
                <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider", creator.role === "admin" ? "border-purple-200 bg-purple-100 text-purple-800" : "border-blue-200 bg-blue-100 text-blue-800")}>
                  {creator.role === "admin" ? tp("roleChipAdmin") : tp("roleChipInfluencer")}
                </span>
              </div>
              <p className="mt-0.5 text-[14px] font-medium text-[#64748B]">
                {[creator.full_name, formatLocation(locale, creator)].filter(Boolean).join(" • ")}
              </p>
            </div>
          </div>
        </div>

        {agencyView ? (
          <div className="flex flex-col items-stretch gap-4 md:flex-row">
            <div className="flex min-w-[260px] flex-col justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
              <span className="flex items-center gap-1 text-[10px] font-bold tracking-wider text-[#64748B] uppercase">
                <FolderPlus size={11} className="text-brand-primary" /> {tp("addToCampaign")}
              </span>
              <div className="flex gap-2">
                <Select2Field theme="light" searchable={false} value={campaignId} placeholder={tp("selectCampaign")} options={campaigns.map((campaign) => ({ value: String(campaign.id), label: campaign.name }))} onChange={setCampaignId} className="min-w-0 flex-1" triggerClassName="h-9 rounded-lg px-2 text-xs font-bold" />
                <button type="button" disabled={!campaignId || adding} onClick={addToCampaign} className="h-9 shrink-0 rounded-lg bg-brand-primary px-3 text-xs font-bold text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">{tp("add")}</button>
              </div>
            </div>
            <div className="flex min-w-[320px] flex-col justify-center gap-2 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
              <span className="flex items-center gap-1 text-[10px] font-bold tracking-wider text-[#64748B] uppercase">
                <UserCheck size={11} className="text-purple-600" /> {tp("accessControlAdmin")}
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold tracking-wide text-[#64748B] uppercase">{tp("rolePermission")}</label>
                  <Select2Field theme="light" searchable={false} value={creator.role === "admin" ? "admin" : "creator"} options={roleOptions} onChange={() => undefined} triggerClassName="h-9 rounded-lg px-2 py-1.5 text-xs font-semibold" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] font-bold tracking-wide text-[#64748B] uppercase">{tp("castingStatus")}</label>
                  <Select2Field theme="light" searchable={false} value={creator.status} options={statusOptions} onChange={async (status) => { try { await api.updateCreator(creator.id, { status }); load(); } catch (err) { await alertApiError(err); } }} triggerClassName="h-9 rounded-lg px-2 py-1.5 text-xs font-semibold" />
                </div>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPasswordOpen(true)} className="flex items-center justify-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-brand-primary hover:bg-purple-100">
                  <KeyRound size={13} /> {tp("changePassword")}
                </button>
                <button type="button" onClick={() => setEditing((value) => !value)} className={cn("flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold", editing ? "bg-slate-900 text-white shadow-xs" : "border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200")}>
                  <UserCheck size={13} /> {editing ? tp("viewPortfolioShort") : tp("editProfileBtn")}
                </button>
              </div>
              {canRemove ? (
                <button type="button" onClick={() => void removeCreatorAccount()} className="mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100">
                  <Trash2 size={13} /> {ta("creators.delete")}
                </button>
              ) : null}
              <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-lg border border-indigo-100 bg-indigo-50/60 p-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
                  checked={Boolean(creator.can_access_all_countries)}
                  onChange={async (event) => {
                    try {
                      await api.updateCreator(creator.id, { can_access_all_countries: event.target.checked });
                      load();
                    } catch (err) {
                      await alertApiError(err);
                    }
                  }}
                />
                <span>
                  <span className="block text-[11px] font-bold text-slate-800">{tp("accessAllCountries")}</span>
                  <span className="mt-0.5 block text-[10px] leading-relaxed text-slate-500">{tp("accessAllCountriesHint")}</span>
                </span>
              </label>
            </div>
          </div>
        ) : canEdit ? (
          <div className="flex w-full flex-col gap-2 md:w-auto md:items-end">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 md:rounded-lg md:border md:border-brand-primary/10 md:bg-brand-primary/5 md:px-3 md:py-1.5 md:text-[10px] md:font-bold md:tracking-wider md:text-brand-primary md:uppercase">
              <Smartphone size={13} className="shrink-0 text-brand-primary" />
              <span className="truncate">{tp("loggedInAs", { handle: creator.artistic_name })}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 md:flex">
              <button
                type="button"
                onClick={() => setPasswordOpen(true)}
                className="flex min-w-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 md:py-1.5"
              >
                <KeyRound size={13} className="shrink-0 text-slate-400" />
                <span className="truncate">{tp("changePassword")}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (tab === "about") goTab("portfolio");
                  else goTab("about");
                }}
                className="flex min-w-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 md:py-1.5"
              >
                <UserCheck size={13} className="shrink-0 text-slate-400" />
                <span className="truncate">{tab === "about" ? tp("viewPortfolioShort") : tp("editProfileBtn")}</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-3">
        {agencyView ? (
          <div className="flex flex-col gap-6 lg:col-span-1">
            <div className="flex flex-col gap-6 rounded-[16px] border border-[#E2E8F0] bg-white p-6 shadow-sm">
              <h3 className="border-b border-[#F1F5F9] pb-3 text-[14px] font-bold tracking-wider text-[#0F172A] uppercase">{tp("networksSection")}</h3>
              <NetworkMetricsSummary
                metrics={creator.metrics}
                socials={creator.socials}
                pricing={creator.pricing}
                formatNumber={formatNumber}
                formatCurrency={formatCurrency}
              />

              <h3 className="border-b border-[#F1F5F9] pt-3 pb-3 text-[14px] font-bold tracking-wider text-[#0F172A] uppercase">{tp("contactInfo")}</h3>
              <div className="flex flex-col gap-3 text-xs leading-relaxed text-[#475569]">
                <div>
                  <span className="block text-[9px] font-bold tracking-wide text-[#64748B] uppercase">{tp("emailLabel")}</span>
                  <span>{maskPII(creator.email, hideValues, tp("notInformed"))}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold tracking-wide text-[#64748B] uppercase">{tp("whatsappLabel")}</span>
                  <span>{maskPII(creator.whatsapp, hideValues, tp("notInformed"))}</span>
                </div>
                <SocialLinks socials={creator.socials} emptyLabel={tp("notInformed")} />
                {(creator.categories ?? []).length > 0 ? (
                  <div>
                    <span className="block text-[9px] font-bold tracking-wide text-[#64748B] uppercase">{tp("nicheCategories")}</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {creator.categories.map((cat) => (
                        <span key={cat} className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-[#0F172A] uppercase">{cat}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="mt-1.5 border-t border-[#F1F5F9] pt-2.5">
                  <span className="mb-1.5 block text-[9px] font-bold tracking-wide text-[#64748B] uppercase">{tp("affinitiesPrefs")}</span>
                  <div className="flex flex-wrap gap-1">
                    {creator.accepts_exchange ? <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">✓ {tp("prefBarter")}</span> : null}
                    {creator.accepts_paid_traffic ? <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">✓ {tp("prefPaidTraffic")}</span> : null}
                    {creator.accepts_exclusivity ? <span className="rounded-full border border-purple-100 bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">✓ {tp("prefExclusivity")}</span> : null}
                    {(creator.work_affinities ?? []).map((aff) => (
                      <span key={aff} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-700">✓ {aff}</span>
                    ))}
                    {!creator.accepts_exchange && !creator.accepts_paid_traffic && !creator.accepts_exclusivity && !(creator.work_affinities ?? []).length ? (
                      <span className="text-[11px] text-slate-400 italic">{tp("noCommercialPrefs")}</span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2 border-t border-[#F1F5F9] pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[9px] font-bold tracking-wide text-[#64748B] uppercase">
                      <Scale size={12} className="text-purple-600" /> {tp("officialTermTitle")}
                    </span>
                    {creator.contract_acceptance ? (
                      <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700"><CheckCircle2 size={10} /> {tp("signed")}</span>
                    ) : (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700">{tp("deliveryPending")}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 rounded-xl border border-slate-200/80 bg-slate-50 p-3">
                    <div className="flex items-start justify-between text-xs">
                      <span className="font-medium text-slate-500">{tp("digitalContractLabel")}</span>
                      <span className="font-bold text-slate-800">{tp("contractVersion", { version: CONTRACT_METADATA.version })}</span>
                    </div>
                    {creator.contract_acceptance ? (
                      <div className="flex flex-col gap-1 border-t border-slate-200/60 pt-2 text-[11px] text-slate-500">
                        <div className="flex justify-between"><span>{tp("acceptanceDate")}</span><span className="font-semibold text-slate-700">{creator.contract_acceptance.accepted_at ? new Date(creator.contract_acceptance.accepted_at).toLocaleDateString(locale) : "—"}</span></div>
                        <div className="flex justify-between"><span>{tp("signedBy")}</span><span className="font-semibold text-slate-700">{creator.contract_acceptance.full_name}</span></div>
                      </div>
                    ) : null}
                    <button type="button" onClick={() => setContractOpen(true)} className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-purple-700 shadow-xs hover:bg-slate-100">
                      <FileText size={13} /> {creator.contract_acceptance ? tp("viewFullTermAudit") : tp("signOfficialTerm")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className={cn("flex flex-col gap-8", agencyView ? "lg:col-span-2" : "lg:col-span-3")}>
          {showCreatorTabs ? (
            <div className="mb-2 flex max-w-3xl overflow-x-auto rounded-xl border border-slate-200/60 bg-slate-100 p-1">
              <button type="button" onClick={() => goTab("dashboard")} className={cn("flex min-w-[120px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none px-3 py-2 text-[11px] font-bold tracking-wider whitespace-nowrap uppercase", tab === "dashboard" ? "bg-white text-indigo-600 shadow-sm" : "text-[#64748B] hover:text-[#0F172A]")}>
                <Home size={14} /> {tp("tabDashboard")}
              </button>
              <button type="button" onClick={() => goTab("recurring")} className={cn("flex min-w-[110px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none px-3 py-2 text-[11px] font-bold tracking-wider whitespace-nowrap uppercase", tab === "recurring" ? "bg-white text-purple-600 shadow-sm" : "text-[#64748B] hover:text-[#0F172A]")}>
                <Repeat size={14} /> {tp("tabRecurring")}
              </button>
              <button type="button" onClick={() => goTab("campaigns")} className={cn("flex min-w-[110px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none px-3 py-2 text-[11px] font-bold tracking-wider whitespace-nowrap uppercase", tab === "campaigns" ? "bg-white text-indigo-600 shadow-sm" : "text-[#64748B] hover:text-[#0F172A]")}>
                <Megaphone size={14} /> {tp("tabCampaigns")}
              </button>
              <button type="button" onClick={() => goTab("portfolio")} className={cn("flex min-w-[130px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none px-3 py-2 text-[11px] font-bold tracking-wider whitespace-nowrap uppercase", tab === "portfolio" ? "bg-white text-indigo-600 shadow-sm" : "text-[#64748B] hover:text-[#0F172A]")}>
                <Video size={14} /> {tp("tabPortfolio")}
              </button>
              <button type="button" onClick={() => goTab("about")} className={cn("flex min-w-[110px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none px-3 py-2 text-[11px] font-bold tracking-wider whitespace-nowrap uppercase", tab === "about" ? "bg-white text-indigo-600 shadow-sm" : "text-[#64748B] hover:text-[#0F172A]")}>
                <User size={14} /> {tp("tabAbout")}
              </button>
            </div>
          ) : null}
          {(agencyView && editing) || (showCreatorTabs && tab === "about") ? (
            <form noValidate onSubmit={saveProfile} className="flex flex-col gap-5">
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-[#0F172A]"><UserCheck size={20} className="text-brand-primary" /> {tp("professionalDataTitle")}</h3>
                  <p className="mt-1 text-[12px] text-[#64748B]">{tp("professionalDataHint")}</p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label={tp("fullName")}><input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} /></Field>
                  <Field label={tp("artisticName")}>
                    <div className="relative">
                      <span className="absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-bold text-slate-400">@</span>
                      <input className={cn(inputClass, "pl-8 font-semibold")} value={artisticName} onChange={(e) => setArtisticName(e.target.value.replace(/^@+/, ""))} />
                    </div>
                  </Field>
                  <Field label={tp("whatsappContact")}><input className={inputClass} value={whatsapp} onChange={(e) => setWhatsapp(formatWhatsApp(e.target.value))} /></Field>
                  <Field label={tp("country")}>
                    <CountrySelect theme="light" value={country} onChange={(value) => { setCountry(value); setState(""); }} />
                  </Field>
                  <Field label={tp("stateUf")}>
                    <RegionSelect theme="light" country={country} value={state} onChange={setState} />
                  </Field>
                  <Field label={tp("city")}><input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} /></Field>
                  <Field label={tp("cpfCreator")}><input className={inputClass} value={cpf} maxLength={14} onChange={(e) => setCpf(formatCPF(e.target.value))} /></Field>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[#0F172A]">{tp("networksSection")}</h3>
                    <p className="mt-1 text-[12px] text-[#64748B]">{tp("networksSectionHint")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void syncAllNetworks()}
                    disabled={syncingNetwork !== null}
                    className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-brand-primary/20 bg-brand-primary/5 px-3 text-xs font-bold text-brand-primary hover:bg-brand-primary/10 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {syncingNetwork === "all" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    {syncingNetwork === "all" ? tp("fetchingNetworkData") : tp("fetchAllNetworkData")}
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <NetworkCard
                  title={tp("socialInstagram")}
                  icon={Instagram}
                  iconClass="text-pink-500"
                  handle={networks.instagram.handle}
                  onHandle={(value) => patchNetwork("instagram", { handle: formatInstagram(value) })}
                  handleLabel={tp("networkHandle")}
                  handlePlaceholder={tp("socialInstagramPh")}
                  followers={networks.instagram.followers}
                  onFollowers={(value) => patchNetwork("instagram", { followers: formatIntegerMask(value) })}
                  views={networks.instagram.views}
                  onViews={(value) => patchNetwork("instagram", { views: formatIntegerMask(value) })}
                  engagement={networks.instagram.engagement}
                  onEngagement={(value) => patchNetwork("instagram", { engagement: formatPercentInput(value) })}
                  followersLabel={tp("followers")}
                  onFetch={() => void syncNetwork("instagram")}
                  fetching={syncingNetwork === "instagram" || syncingNetwork === "all"}
                  prices={[
                    { label: tp("priceStory"), value: prices.story, onChange: (value) => patchPrice("story", value) },
                    { label: tp("priceReels"), value: prices.reel, onChange: (value) => patchPrice("reel", value) },
                    { label: tp("priceFeedPost"), value: prices.post, onChange: (value) => patchPrice("post", value) },
                  ]}
                />
                <NetworkCard
                  title={tp("socialTiktok")}
                  icon={Clapperboard}
                  iconClass="text-rose-500"
                  handle={networks.tiktok.handle}
                  onHandle={(value) => patchNetwork("tiktok", { handle: formatTikTok(value) })}
                  handleLabel={tp("networkHandle")}
                  handlePlaceholder={tp("socialTiktokPh")}
                  followers={networks.tiktok.followers}
                  onFollowers={(value) => patchNetwork("tiktok", { followers: formatIntegerMask(value) })}
                  views={networks.tiktok.views}
                  onViews={(value) => patchNetwork("tiktok", { views: formatIntegerMask(value) })}
                  engagement={networks.tiktok.engagement}
                  onEngagement={(value) => patchNetwork("tiktok", { engagement: formatPercentInput(value) })}
                  followersLabel={tp("followers")}
                  onFetch={() => void syncNetwork("tiktok")}
                  fetching={syncingNetwork === "tiktok" || syncingNetwork === "all"}
                  prices={[{ label: tp("priceTiktok"), value: prices.tiktok, onChange: (value) => patchPrice("tiktok", value) }]}
                />
                <NetworkCard
                  title={tp("socialYoutube")}
                  icon={Youtube}
                  iconClass="text-red-500"
                  handle={networks.youtube.handle}
                  onHandle={(value) => patchNetwork("youtube", { handle: formatYouTube(value) })}
                  handleLabel={tp("networkHandleYoutube")}
                  handlePlaceholder={tp("socialYoutubePh")}
                  followers={networks.youtube.followers}
                  onFollowers={(value) => patchNetwork("youtube", { followers: formatIntegerMask(value) })}
                  views={networks.youtube.views}
                  onViews={(value) => patchNetwork("youtube", { views: formatIntegerMask(value) })}
                  engagement={networks.youtube.engagement}
                  onEngagement={(value) => patchNetwork("youtube", { engagement: formatPercentInput(value) })}
                  followersLabel={tp("subscribers")}
                  onFetch={() => void syncNetwork("youtube")}
                  fetching={syncingNetwork === "youtube" || syncingNetwork === "all"}
                  prices={[{ label: tp("priceYoutube"), value: prices.youtube, onChange: (value) => patchPrice("youtube", value) }]}
                />
                <NetworkCard
                  title={tp("socialKwai")}
                  icon={Sparkles}
                  iconClass="text-orange-500"
                  handle={networks.kwai.handle}
                  onHandle={(value) => patchNetwork("kwai", { handle: formatKwai(value) })}
                  handleLabel={tp("networkHandle")}
                  handlePlaceholder={tp("socialKwaiPh")}
                  followers={networks.kwai.followers}
                  onFollowers={(value) => patchNetwork("kwai", { followers: formatIntegerMask(value) })}
                  views={networks.kwai.views}
                  onViews={(value) => patchNetwork("kwai", { views: formatIntegerMask(value) })}
                  engagement={networks.kwai.engagement}
                  onEngagement={(value) => patchNetwork("kwai", { engagement: formatPercentInput(value) })}
                  followersLabel={tp("followers")}
                  prices={[{ label: tp("priceKwai"), value: prices.kwai, onChange: (value) => patchPrice("kwai", value) }]}
                />
                </div>
              </div>

              <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <MoneyField label={tp("comboCommercial")} value={prices.combo} onChange={(value) => patchPrice("combo", value)} />
                  <div className="flex flex-col justify-end gap-2">
                    <span className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{tp("affinitiesPrefs")}</span>
                    <div className="flex flex-wrap gap-2">
                      <Toggle checked={acceptsExchange} onChange={setAcceptsExchange} label={tp("prefBarter")} />
                      <Toggle checked={acceptsPaidTraffic} onChange={setAcceptsPaidTraffic} label={tp("prefPaidTraffic")} />
                      <Toggle checked={acceptsExclusivity} onChange={setAcceptsExclusivity} label={tp("prefExclusivity")} />
                    </div>
                  </div>
                </div>
                <Field label={tp("bioLabel")}>
                  <textarea className="min-h-28 w-full rounded-lg border border-[#E2E8F0] p-3 text-sm outline-none focus:border-brand-primary" value={bio} onChange={(e) => setBio(e.target.value)} />
                </Field>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (agencyView) setEditing(false);
                      else goTab("dashboard");
                    }}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600"
                  >
                    {tc("cancel")}
                  </button>
                  <button className="rounded-lg bg-brand-primary px-6 py-2 text-sm font-bold text-white">{tp("saveProfile")}</button>
                </div>
              </div>
            </form>
          ) : showCreatorTabs && tab === "dashboard" ? (
            <div className="flex flex-col gap-8">
              <div className="flex flex-col items-start justify-between gap-6 rounded-[24px] border border-white/5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-8 text-white shadow-xl md:flex-row md:items-center">
                <div className="flex flex-col">
                  <span className="w-fit rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-extrabold tracking-widest text-indigo-300 uppercase">{tp("panelTitle")}</span>
                  <h2 className="mt-3 text-2xl font-bold">{tp("helloCreator", { name: creator.artistic_name || creator.full_name })}</h2>
                  <p className="mt-1 max-w-md text-xs leading-relaxed text-slate-300">{tp("panelHint")}</p>
                </div>
                <div className="flex shrink-0 items-center gap-6 rounded-2xl border border-white/10 bg-white/5 p-4 font-medium backdrop-blur-sm">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold tracking-wider text-indigo-200 uppercase">{tp("monthlyEarnings")}</span>
                    <span className="mt-1 text-xl font-black text-emerald-400">{formatCurrency(monthlyEarnings)}</span>
                  </div>
                  <div className="h-10 w-px bg-white/10" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold tracking-wider text-indigo-200 uppercase">{tp("paidLabel")}</span>
                    <span className="mt-1 text-sm font-bold text-slate-200">{formatCurrency(totalReceived)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 font-medium sm:grid-cols-3">
                <div className="flex items-center justify-between rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
                  <div>
                    <span className="text-[10px] font-bold tracking-wider text-[#64748B] uppercase">{tp("monthlyEarnings")}</span>
                    <h3 className="mt-1 text-xl font-bold text-purple-700">{formatCurrency(monthlyEarnings)}</h3>
                    <p className="mt-1 mb-0 text-[11px] font-medium text-slate-500">{tp("monthlyEarningsHint")}</p>
                  </div>
                  <div className="rounded-xl bg-purple-50 p-3 text-purple-600"><Repeat size={18} /></div>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
                  <div>
                    <span className="text-[10px] font-bold tracking-wider text-[#64748B] uppercase">{tp("receivedPaid")}</span>
                    <h3 className="mt-1 text-xl font-bold text-emerald-600">{formatCurrency(totalReceived)}</h3>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600"><CheckCircle2 size={18} /></div>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
                  <div>
                    <span className="text-[10px] font-bold tracking-wider text-[#64748B] uppercase">{tp("toReceiveApproved")}</span>
                    <h3 className="mt-1 text-xl font-bold text-brand-primary">{formatCurrency(totalToReceive)}</h3>
                  </div>
                  <div className="rounded-xl bg-indigo-50 p-3 text-brand-primary"><DollarSign size={18} /></div>
                </div>
              </div>

              {loadingCampaigns ? (
                <div className="flex items-center justify-center rounded-[16px] border border-[#E2E8F0] bg-white p-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-brand-primary" />
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <h3 className="flex items-center gap-1.5 border-b border-slate-100 pb-2 text-xs font-extrabold tracking-widest text-[#0F172A] uppercase">
                    <Briefcase size={16} className="text-brand-primary" /> {tp("activeCampaignsSection", { count: approvedCampaigns.length })}
                  </h3>
                  {approvedCampaigns.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 rounded-[16px] border border-dashed border-[#E2E8F0] bg-white p-12 text-center">
                      <div className="rounded-full bg-slate-50 p-3 text-slate-400"><Briefcase size={24} /></div>
                      <h4 className="text-sm font-bold text-slate-800">{tp("noActiveCampaigns")}</h4>
                      <p className="max-w-sm text-xs leading-relaxed text-[#64748B]">{tp("noActiveCampaignsHint")}</p>
                      <Link href="/available-campaigns" className="mt-1 inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2 text-xs font-bold text-white hover:bg-indigo-600">
                        <Sparkles size={14} /> {tp("browseAvailable")}
                      </Link>
                    </div>
                  ) : (
                    <ActiveCampaignsTable
                      approvedCampaigns={approvedCampaigns}
                      expandedSubmissionId={expandedSubmissionId}
                      openSubmission={openSubmission}
                      onCloseSubmission={() => setExpandedSubmissionId(null)}
                      reloadMyCampaigns={reloadMyCampaigns}
                      applicationLabel={applicationLabel}
                      deliveryLabel={deliveryLabel}
                      deliveryBadgeClass={deliveryBadgeClass}
                      applicationBadgeClass={applicationBadgeClass}
                      creatorFeeText={creatorFeeText}
                      fmtDate={fmtDate}
                      tp={tp as (key: string, options?: Record<string, unknown>) => string}
                    />
                  )}
                </div>
              )}

              <div className="flex flex-col gap-4 border-t border-slate-100 pt-6">
                <h3 className="flex items-center gap-1.5 border-b border-slate-100 pb-2 text-xs font-extrabold tracking-widest text-[#0F172A] uppercase">
                  <Repeat size={16} className="text-purple-600" /> {tp("activeRecurringSection", { count: myContracts.length })}
                </h3>
                <ActiveRecurringWorksTable
                  rows={recurringWorkRows}
                  expandedKey={expandedRecurringKey}
                  openRow={openRecurringWork}
                  onCloseRow={() => setExpandedRecurringKey(null)}
                  reloadRecurring={reloadRecurring}
                  deliveryLabel={deliveryLabel}
                  deliveryBadgeClass={deliveryBadgeClass}
                  fmtDate={fmtDate}
                  formatCurrency={formatCurrency}
                  tp={tp as (key: string, options?: Record<string, unknown>) => string}
                />
              </div>
            </div>
          ) : showCreatorTabs && tab === "recurring" ? (
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-xl bg-purple-50 p-2.5 text-purple-600"><Repeat size={20} /></div>
                  <div>
                    <h3 className="m-0 text-lg font-bold text-slate-900">{tp("recurringWorksTitle", { count: myContracts.length })}</h3>
                    <p className="m-0 text-xs text-slate-500">{tp("recurringWorksHint")}</p>
                  </div>
                </div>
              </div>
              <ActiveRecurringWorksTable
                rows={recurringWorkRows}
                expandedKey={expandedRecurringKey}
                openRow={openRecurringWork}
                onCloseRow={() => setExpandedRecurringKey(null)}
                reloadRecurring={reloadRecurring}
                deliveryLabel={deliveryLabel}
                deliveryBadgeClass={deliveryBadgeClass}
                fmtDate={fmtDate}
                formatCurrency={formatCurrency}
                tp={tp as (key: string, options?: Record<string, unknown>) => string}
              />
            </div>
          ) : showCreatorTabs && tab === "campaigns" ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-indigo-50 p-2.5 text-brand-primary"><Megaphone size={22} /></div>
                  <div>
                    <h3 className="m-0 text-lg font-bold text-slate-900">{tp("myCampaignsTitle", { count: approvedCampaigns.length })}</h3>
                    <p className="m-0 text-xs text-slate-500">{tp("myCampaignsHint")}</p>
                  </div>
                </div>
                <Link href="/available-campaigns" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 text-xs font-bold tracking-wider text-white uppercase shadow-sm hover:bg-indigo-600">
                  <Sparkles size={14} /> {tp("browseAvailable")}
                </Link>
              </div>

              <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
                <button type="button" onClick={() => setCampaignSubTab("active")} className={cn("inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold", campaignSubTab === "active" ? "bg-slate-900 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
                  <Briefcase size={14} /> {tp("activeCampaigns", { count: approvedCampaigns.length })}
                </button>
                <button type="button" onClick={() => setCampaignSubTab("applications")} className={cn("inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold", campaignSubTab === "applications" ? "bg-slate-900 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
                  <Send size={14} /> {tp("myApplications", { count: pendingApplications.length + rejectedApplications.length })}
                </button>
              </div>

              {loadingCampaigns ? (
                <div className="flex items-center justify-center rounded-[16px] border border-[#E2E8F0] bg-white p-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-brand-primary" />
                </div>
              ) : campaignSubTab === "active" ? (
                approvedCampaigns.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-[16px] border border-dashed border-[#E2E8F0] bg-white p-12 text-center">
                    <div className="rounded-full bg-slate-50 p-3 text-slate-400"><Briefcase size={24} /></div>
                    <h4 className="text-sm font-bold text-slate-800">{tp("noActiveCampaigns")}</h4>
                    <p className="max-w-sm text-xs leading-relaxed text-[#64748B]">{tp("noActiveCampaignsHint")}</p>
                    <Link href="/available-campaigns" className="mt-1 inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2 text-xs font-bold text-white hover:bg-indigo-600">
                      <Sparkles size={14} /> {tp("browseAvailable")}
                    </Link>
                  </div>
                ) : (
                  <ActiveCampaignsTable
                    approvedCampaigns={approvedCampaigns}
                    expandedSubmissionId={expandedSubmissionId}
                    openSubmission={openSubmission}
                    onCloseSubmission={() => setExpandedSubmissionId(null)}
                    reloadMyCampaigns={reloadMyCampaigns}
                    applicationLabel={applicationLabel}
                    deliveryLabel={deliveryLabel}
                    deliveryBadgeClass={deliveryBadgeClass}
                    applicationBadgeClass={applicationBadgeClass}
                    creatorFeeText={creatorFeeText}
                    fmtDate={fmtDate}
                    tp={tp as (key: string, options?: Record<string, unknown>) => string}
                  />
                )
              ) : pendingApplications.length + rejectedApplications.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 rounded-[16px] border border-dashed border-[#E2E8F0] bg-white p-12 text-center">
                  <div className="rounded-full bg-slate-50 p-3 text-slate-400"><Send size={24} /></div>
                  <h4 className="text-sm font-bold text-slate-800">{tp("noApplications")}</h4>
                  <p className="max-w-sm text-xs leading-relaxed text-[#64748B]">{tp("noApplicationsHint")}</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-col divide-y divide-slate-100 lg:hidden">
                    {[...pendingApplications, ...rejectedApplications].map(({ campaign, row }) => (
                      <div key={row.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="m-0 text-sm font-bold break-words text-slate-900">{campaign.name}</p>
                            <p className="mt-0.5 mb-0 text-[11px] text-slate-400">{campaign.company?.name || tp("partnerCompany")}</p>
                          </div>
                          <span className="shrink-0 text-sm font-extrabold text-brand-primary">{creatorFeeText(campaign, row)}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                            <Calendar size={13} className="text-slate-400" />
                            {fmtDate(campaign.end_date)}
                          </span>
                          <span className={cn("inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase", applicationBadgeClass(row.application_status))}>
                            {applicationLabel(row.application_status)}
                          </span>
                        </div>
                        <Link
                          href={`/campaigns/${campaign.id}?tab=briefing`}
                          className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-200 sm:w-auto"
                        >
                          <Eye size={13} className="text-brand-primary" /> {tp("viewBriefing")}
                        </Link>
                      </div>
                    ))}
                  </div>
                  <div className="hidden lg:block">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[10px] font-extrabold tracking-wider text-slate-500 uppercase">
                          <th className="p-3.5 pl-5">{tp("colCampaignCompany")}</th>
                          <th className="p-3.5">{tp("colCache")}</th>
                          <th className="p-3.5">{tp("colDeadline")}</th>
                          <th className="p-3.5">{tp("colApplicationStatus")}</th>
                          <th className="p-3.5 pr-5 text-right">{tp("colActions")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {[...pendingApplications, ...rejectedApplications].map(({ campaign, row }) => (
                          <tr key={row.id} className="transition-colors hover:bg-slate-50/80">
                            <td className="p-3.5 pl-5">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-900">{campaign.name}</span>
                                <span className="text-[10px] text-slate-400">{campaign.company?.name || tp("partnerCompany")}</span>
                              </div>
                            </td>
                            <td className="p-3.5">
                              <span className="text-sm font-extrabold text-brand-primary">{creatorFeeText(campaign, row)}</span>
                            </td>
                            <td className="p-3.5 text-slate-700">
                              <div className="flex items-center gap-1 font-semibold">
                                <Calendar size={13} className="text-slate-400" />
                                <span>{fmtDate(campaign.end_date)}</span>
                              </div>
                            </td>
                            <td className="p-3.5">
                              <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase", applicationBadgeClass(row.application_status))}>
                                {applicationLabel(row.application_status)}
                              </span>
                            </td>
                            <td className="p-3.5 pr-5 text-right">
                              <Link
                                href={`/campaigns/${campaign.id}?tab=briefing`}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-200"
                              >
                                <Eye size={13} className="text-brand-primary" /> {tp("viewBriefing")}
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : showCreatorTabs && tab === "portfolio" ? (
            <CreatorPortfolioPanel creator={creator} canUpload={canUpload} onChanged={load} />
          ) : (
            <>
              {!showCreatorTabs ? <CreatorPortfolioPanel creator={creator} canUpload={canUpload} onChanged={load} /> : null}

              {agencyView ? (
                <CreatorRecurringEmptyOrList myContracts={myContracts} />
              ) : null}
            </>
          )}
        </div>
      </div>

      {passwordOpen ? <ChangeCreatorPasswordModal creator={creator} onClose={() => setPasswordOpen(false)} /> : null}
      {contractOpen ? (
        <CreatorContractModal
          isOpen
          onClose={() => setContractOpen(false)}
          readOnly={Boolean(creator.contract_acceptance) && !canEdit}
          creatorName={creator.full_name ?? undefined}
          creatorEmail={creator.email ?? user.email ?? undefined}
          creatorDocument={creator.document || creator.cpf || ""}
          existingAudit={creator.contract_acceptance ? {
            termId: "rocketz-2026",
            version: CONTRACT_METADATA.version,
            fullName: creator.contract_acceptance.full_name,
            document: creator.document || creator.cpf || "",
            email: creator.email ?? "",
            acceptedAt: creator.contract_acceptance.accepted_at ?? "",
            formattedDate: creator.contract_acceptance.accepted_at ?? "",
            ipUserAgent: "",
            declarations: {},
            allAccepted: true,
            status: "valid",
          } : null}
          onAccept={async (audit) => {
            try {
              await api.acceptContract(creator.id, { full_name: audit.fullName, email: audit.email, document: audit.document });
              await alertSuccess(tp("termAccepted"));
              setContractOpen(false);
              load();
              window.dispatchEvent(new Event("rocketz:auth-refresh"));
              if (shouldOpenContract) {
                router.replace(`/creators/${creator.id}?tab=${tab}`);
              }
            } catch (err) {
              await alertApiError(err);
            }
          }}
        />
      ) : null}
    </div>
  );
}

const inputClass = "h-11 w-full rounded-lg border border-[#E2E8F0] px-4 text-sm outline-none focus:border-brand-primary";

function CreatorRecurringEmptyOrList({ myContracts }: { myContracts: RecurringContract[] }) {
  const { t: tp } = useTranslation("profile");
  const { formatCurrency } = usePrivacy();

  if (myContracts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-[20px] border border-slate-200/80 bg-white p-8 text-center shadow-sm">
        <div className="rounded-full bg-purple-50 p-3.5 text-purple-600"><Repeat size={24} /></div>
        <h4 className="m-0 text-base font-bold text-slate-800">{tp("noRecurringTitle")}</h4>
        <p className="m-0 max-w-md text-xs leading-relaxed text-slate-500">{tp("noRecurringHint")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {myContracts.map((contract) => {
        const row = contract.creators?.[0];
        const fee = row?.monthly_cache ?? row?.monthly_fee ?? contract.monthly_fee;
        return (
          <Link key={contract.id} href={`/recurring/${contract.id}`} className="rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-purple-300">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <UserAvatar src={contract.company?.logo_url} name={contract.company?.name ?? contract.title} size="custom" shape="rounded-xl" className="h-10 w-10 border border-slate-200" textClassName="text-xs" />
                <div className="min-w-0">
                  <p className="m-0 truncate text-sm font-bold text-[#0F172A]">{contract.company?.name ?? contract.title}</p>
                  <p className="m-0 truncate text-xs text-slate-500">{contract.title}</p>
                </div>
              </div>
              {fee != null ? (
                <span className="text-sm font-extrabold text-brand-primary">{formatCurrency(Number(fee) || 0)}</span>
              ) : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function deliveryActionLabel(kind: CreatorDeliveryActionKind, tp: (key: string) => string) {
  if (kind === "send_script") return tp("sendScriptForReview");
  if (kind === "send_video") return tp("sendVideoForReview");
  if (kind === "view_published") return tp("viewPublishedPost");
  return tp("sendPublishedLink");
}

function CreatorWorkActions({
  deliveryStatus,
  flow,
  publishedUrl,
  postingProfile,
  onOpen,
  layout,
  tp,
}: {
  deliveryStatus: ContentDeliveryState;
  flow?: string | null;
  publishedUrl?: string | null;
  postingProfile?: string | null;
  onOpen: () => void;
  layout: "stack" | "inline";
  tp: (key: string) => string;
}) {
  const action = creatorNextDeliveryAction(deliveryStatus, flow, publishedUrl, postingProfile);
  const stack = layout === "stack";
  const briefingClass = stack
    ? "inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-brand-primary/25 bg-white px-3 py-2 text-xs font-bold text-brand-primary shadow-sm transition-all hover:bg-indigo-50 sm:w-auto"
    : "inline-flex items-center gap-1.5 rounded-xl border border-brand-primary/25 bg-white px-3 py-1.5 text-xs font-bold text-brand-primary shadow-sm transition-all hover:bg-indigo-50";
  const actionClass = cn(
    stack
      ? "inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border-none px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all sm:w-auto"
      : "inline-flex cursor-pointer items-center gap-1.5 rounded-xl border-none px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition-all",
    action?.revision
      ? "bg-rose-600 hover:bg-rose-700"
      : action?.kind === "send_link" || action?.kind === "view_published"
        ? "bg-emerald-600 hover:bg-emerald-700"
        : "bg-brand-primary hover:bg-indigo-600",
  );
  const ActionIcon = action?.revision
    ? RefreshCw
    : action?.kind === "send_script"
      ? FileText
      : action?.kind === "send_video"
        ? Video
        : action?.kind === "view_published"
          ? ExternalLink
          : Link2;

  return (
    <div className={cn("flex", stack ? "flex-col gap-2 sm:flex-row sm:flex-wrap" : "flex-wrap items-center justify-end gap-2")}>
      <button type="button" onClick={onOpen} className={briefingClass}>
        <Eye size={13} /> {tp("viewBriefing")}
      </button>
      {action?.kind === "view_published" && publishedUrl ? (
        <a href={safeHttpUrl(publishedUrl)} target="_blank" rel="noreferrer" className={actionClass}>
          <ActionIcon size={13} /> {deliveryActionLabel(action.kind, tp)}
        </a>
      ) : action ? (
        <button type="button" onClick={onOpen} className={actionClass}>
          <ActionIcon size={13} /> {deliveryActionLabel(action.kind, tp)}
        </button>
      ) : null}
    </div>
  );
}

function RecurringBriefingModal({
  work,
  onClose,
  onSubmitted,
  tp,
}: {
  work: RecurringWorkRow;
  onClose: () => void;
  onSubmitted: () => void;
  tp: (key: string, options?: Record<string, unknown>) => string;
}) {
  const { t: tc } = useTranslation("common");
  const item = work.item;
  if (!item) return null;

  const hasBriefing = itemHasPautaBriefing(item);

  return (
    <AppModal onClose={onClose} zIndexClassName="z-[110]" panelClassName="max-w-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <p className="m-0 text-[10px] font-bold tracking-wider text-slate-400 uppercase">{tp("briefingModalTitle")}</p>
          <h3 className="m-0 mt-1 truncate text-sm font-black text-slate-900">{item.title || work.contract.title}</h3>
          <p className="m-0 mt-0.5 truncate text-xs font-semibold text-slate-500">
            {[work.contract.company?.name, work.contract.title].filter(Boolean).join(" · ")}
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={tc("close")}>
          <X size={16} />
        </button>
      </div>
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-5">
        {hasBriefing ? (
          <PautaBriefingView collapsible item={item} title={tp("creativeBriefing", { name: item.title })} />
        ) : (
          <p className="m-0 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-500">{tp("noBriefingYet")}</p>
        )}
        <CreatorPautaSubmissionPanel key={item.id} item={item} onSubmitted={onSubmitted} />
      </div>
    </AppModal>
  );
}

function ActiveRecurringWorksTable({
  rows,
  expandedKey,
  openRow,
  onCloseRow,
  reloadRecurring,
  deliveryLabel,
  deliveryBadgeClass,
  fmtDate,
  formatCurrency,
  tp,
}: {
  rows: RecurringWorkRow[];
  expandedKey: string | null;
  openRow: (key: string) => void;
  onCloseRow: () => void;
  reloadRecurring: () => Promise<void>;
  deliveryLabel: (status: string | null | undefined) => string;
  deliveryBadgeClass: (status: string | null | undefined) => string;
  fmtDate: (value?: string | null) => string;
  formatCurrency: (value: number) => string;
  tp: (key: string, options?: Record<string, unknown>) => string;
}) {
  const { t: ta } = useTranslation("app");
  const { i18n } = useTranslation();
  const locale = intlLocale(normalizeLocale(i18n.language));
  const month = currentYearMonth();
  const monthLabelRaw = new Date(`${month}-01T00:00:00`).toLocaleDateString(locale, { month: "long", year: "numeric" });
  const monthLabel = monthLabelRaw.charAt(0).toUpperCase() + monthLabelRaw.slice(1);
  const [companyFilter, setCompanyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const companyOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const work of rows) {
      const name = work.contract.company?.name || tp("partnerCompany");
      const id = companyFilterId(work.contract.company_id ?? work.contract.company?.id, name);
      if (!seen.has(id)) seen.set(id, name);
    }
    return [
      { value: "all", label: tp("filterAllCompanies") },
      ...[...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: "base" })).map(([value, label]) => ({ value, label })),
    ];
  }, [rows, tp]);

  const statusOptions = useMemo(() => [
    { value: "all", label: tp("filterAllStatuses") },
    ...CONTENT_DELIVERY_STATES.filter((state) => state !== "published").map((state) => ({ value: state, label: deliveryLabel(state) })),
  ], [tp, deliveryLabel]);

  const sections = useMemo(() => {
    const byContract = new Map<number, RecurringWorkRow[]>();
    for (const work of rows) {
      const list = byContract.get(work.contract.id) ?? [];
      list.push(work);
      byContract.set(work.contract.id, list);
    }

    return [...byContract.values()]
      .map((list) => {
        const sample = list[0];
        const companyName = sample.contract.company?.name || tp("partnerCompany");
        const companyId = companyFilterId(sample.contract.company_id ?? sample.contract.company?.id, companyName);
        if (companyFilter !== "all" && companyId !== companyFilter) return null;
        const monthItems = list.filter((work) => work.item && itemInMonth(work.item, month));
        const pendingRows = monthItems.filter((work) => {
          if (work.deliveryStatus === "published") return false;
          if (statusFilter !== "all" && work.deliveryStatus !== statusFilter) return false;
          return true;
        });
        return {
          key: `contract-${sample.contract.id}`,
          contract: sample.contract,
          companyName,
          logoUrl: sample.contract.company?.logo_url ?? null,
          fee: sample.fee,
          deliverables: sample.deliverables,
          pendingRows,
          monthTotal: quotaTotal(sample.deliverables) || monthItems.length,
        };
      })
      .filter((section): section is NonNullable<typeof section> => Boolean(section))
      .sort((a, b) => a.companyName.localeCompare(b.companyName, undefined, { sensitivity: "base" }));
  }, [rows, companyFilter, statusFilter, month, tp]);

  const pendingCount = sections.reduce((sum, section) => sum + section.pendingRows.length, 0);
  const openWork = useMemo(
    () => rows.find((work) => work.key === expandedKey) ?? null,
    [rows, expandedKey],
  );

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-[20px] border border-dashed border-[#E2E8F0] bg-white p-12 text-center">
        <div className="rounded-full bg-purple-50 p-3 text-purple-600"><Repeat size={24} /></div>
        <h4 className="text-sm font-bold text-slate-800">{tp("noRecurringTitle")}</h4>
        <p className="max-w-sm text-xs leading-relaxed text-[#64748B]">{tp("noRecurringHint")}</p>
      </div>
    );
  }

  return (
    <>
    <div className="flex flex-col gap-4">
      <div className="rounded-[20px] border border-purple-200/90 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <Repeat size={16} className="shrink-0 text-purple-600" />
            <span className="truncate text-xs font-bold tracking-wider text-slate-900 uppercase">{tp("recurringWorkTableTitle")}</span>
          </div>
          <span className="w-fit rounded-full border border-purple-200 bg-purple-100 px-3 py-1 text-xs font-extrabold text-purple-700">
            {tp("recurringInProgressBadge", { count: pendingCount })}
          </span>
        </div>
        <WorkTableFilters
          company={companyFilter}
          status={statusFilter}
          companyOptions={companyOptions}
          statusOptions={statusOptions}
          onCompany={setCompanyFilter}
          onStatus={setStatusFilter}
          tp={tp}
        />
      </div>
      {sections.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-[#E2E8F0] bg-white p-10 text-center text-sm font-medium text-slate-500">{tp("noFilterResults")}</div>
      ) : (
        sections.map((section) => (
          <article key={section.key} className="overflow-hidden rounded-[20px] border border-purple-200/90 bg-white shadow-sm">
            <RecurringCompanyHeader
              name={section.companyName}
              projectTitle={section.contract.title}
              logoUrl={section.logoUrl}
              feeLabel={section.fee != null ? formatCurrency(Number(section.fee) || 0) : "—"}
              quotaItems={quotaEntries(section.deliverables)}
              pendingCount={section.pendingRows.length}
              quotaCount={section.monthTotal}
              tp={tp}
              ta={ta}
            />
            <div className="border-t border-purple-100 bg-slate-50 px-4 py-2 sm:px-5">
              <p className="m-0 text-[11px] font-extrabold tracking-wider text-slate-600 uppercase">{tp("pendingThisMonth", { month: monthLabel })}</p>
            </div>
            {section.pendingRows.length === 0 ? (
              <p className="m-0 px-5 py-8 text-center text-sm font-medium text-slate-500">{tp("noPendingThisMonth")}</p>
            ) : (
              <>
      <div className="flex flex-col lg:hidden">
            <div className="divide-y divide-slate-100">
        {section.pendingRows.map((work) => {
          const { contract, item, deliveryStatus, key } = work;
          const isOpen = expandedKey === key;

          return (
            <div key={key} className={cn("p-4", isOpen && "bg-purple-50/40")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="m-0 text-sm font-bold break-words text-slate-900">{item?.title || contract.title}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                  <Calendar size={13} className="text-slate-400" />
                  {item?.planned_date ? fmtDate(item.planned_date) : (item ? "—" : tp("awaitingDemand"))}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-emerald-700 uppercase">
                  <CheckCircle2 size={11} />
                  {tp("contractLinked")}
                </span>
                <span className={cn("inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase", deliveryBadgeClass(item ? deliveryStatus : "waiting"))}>
                  <DeliveryStatusIcon state={item ? deliveryStatus : "waiting"} />
                  {item ? deliveryLabel(deliveryStatus) : tp("awaitingDemand")}
                </span>
              </div>
              <div className="mt-3">
                {item ? (
                  <CreatorWorkActions
                    layout="stack"
                    deliveryStatus={deliveryStatus}
                    flow={item.approval_flow}
                    publishedUrl={item.published_url}
                    postingProfile={item.posting_profile}
                    onOpen={() => openRow(key)}
                    tp={tp}
                  />
                ) : (
                  <Link
                    href={`/recurring/${contract.id}`}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-brand-primary/25 bg-white px-3 py-2 text-xs font-bold text-brand-primary shadow-sm transition-all hover:bg-indigo-50 sm:w-auto"
                  >
                    <Eye size={13} /> {tp("openProject")}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
            </div>
      </div>
      <div className="hidden lg:block">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-purple-100 bg-purple-50/40 text-[10px] font-extrabold tracking-wider text-slate-500 uppercase">
              <th className="p-3.5 pl-5">{tp("colDemandProject")}</th>
              <th className="p-3.5">{tp("colDeadline")}</th>
              <th className="p-3.5">{tp("colDeliveryStatus")}</th>
              <th className="p-3.5 pr-5 text-right">{tp("colActions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {section.pendingRows.map((work) => {
              const { contract, item, deliveryStatus, key } = work;
              const isOpen = expandedKey === key;

              return (
                <tr key={key} className={cn("transition-colors hover:bg-purple-50/30", isOpen && "bg-purple-50/50")}>
                  <td className="p-3.5 pl-5">
                    <span className="text-sm font-bold text-slate-900">
                      {item?.title || contract.title}
                    </span>
                  </td>
                  <td className="p-3.5 text-slate-700">
                    <div className="flex items-center gap-1 font-semibold">
                      <Calendar size={13} className="text-slate-400" />
                      <span>{item?.planned_date ? fmtDate(item.planned_date) : (item ? "—" : tp("awaitingDemand"))}</span>
                    </div>
                  </td>
                  <td className="p-3.5">
                    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase", deliveryBadgeClass(item ? deliveryStatus : "waiting"))}>
                      <DeliveryStatusIcon state={item ? deliveryStatus : "waiting"} />
                      {item ? deliveryLabel(deliveryStatus) : tp("awaitingDemand")}
                    </span>
                  </td>
                  <td className="p-3.5 pr-5 text-right">
                    {item ? (
                      <CreatorWorkActions
                        layout="inline"
                        deliveryStatus={deliveryStatus}
                        flow={item.approval_flow}
                        publishedUrl={item.published_url}
                        postingProfile={item.posting_profile}
                        onOpen={() => openRow(key)}
                        tp={tp}
                      />
                    ) : (
                      <Link
                        href={`/recurring/${contract.id}`}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-brand-primary/25 bg-white px-3 py-1.5 text-xs font-bold text-brand-primary shadow-sm transition-all hover:bg-indigo-50"
                      >
                        <Eye size={13} /> {tp("openProject")}
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
              </>
            )}
          </article>
        ))
      )}
    </div>
    {openWork?.item ? (
      <RecurringBriefingModal
        work={openWork}
        onClose={onCloseRow}
        onSubmitted={() => {
          onCloseRow();
          void reloadRecurring();
        }}
        tp={tp}
      />
    ) : null}
    </>
  );
}

type ApprovedCampaignRow = {
  campaign: Campaign;
  row: NonNullable<Campaign["applications"]>[number];
};

function CampaignBriefingModal({
  campaign,
  row,
  onClose,
  onSubmitted,
  tp,
}: {
  campaign: Campaign;
  row: NonNullable<Campaign["applications"]>[number];
  onClose: () => void;
  onSubmitted: () => void;
  tp: (key: string, options?: Record<string, unknown>) => string;
}) {
  const { t: tc } = useTranslation("common");

  return (
    <AppModal onClose={onClose} zIndexClassName="z-[110]" panelClassName="max-w-3xl">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <p className="m-0 text-[10px] font-bold tracking-wider text-slate-400 uppercase">{tp("briefingModalTitle")}</p>
          <h3 className="m-0 mt-1 truncate text-sm font-black text-slate-900">{campaign.name}</h3>
          <p className="m-0 mt-0.5 truncate text-xs font-semibold text-slate-500">{campaign.company?.name}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={tc("close")}>
          <X size={16} />
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto">
        <CreatorCampaignSubmissionPanel
          key={row.id}
          campaign={campaign}
          row={row}
          onClose={onClose}
          onSubmitted={onSubmitted}
          showBriefingToggle={false}
        />
      </div>
    </AppModal>
  );
}

function ActiveCampaignsTable({
  approvedCampaigns,
  expandedSubmissionId,
  openSubmission,
  onCloseSubmission,
  reloadMyCampaigns,
  applicationLabel,
  deliveryLabel,
  deliveryBadgeClass,
  applicationBadgeClass,
  creatorFeeText,
  fmtDate,
  tp,
}: {
  approvedCampaigns: ApprovedCampaignRow[];
  expandedSubmissionId: number | null;
  openSubmission: (rowId: number) => void;
  onCloseSubmission: () => void;
  reloadMyCampaigns: () => Promise<void>;
  applicationLabel: (status: string | null | undefined) => string;
  deliveryLabel: (status: string | null | undefined) => string;
  deliveryBadgeClass: (status: string | null | undefined) => string;
  applicationBadgeClass: (status: string | null | undefined) => string;
  creatorFeeText: (campaign: Campaign, row: { amount: number | null; payment_status?: string | null }) => string;
  fmtDate: (value?: string | null) => string;
  tp: (key: string, options?: Record<string, unknown>) => string;
}) {
  const [companyFilter, setCompanyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const rows = useMemo(() => approvedCampaigns.map((item) => ({
    ...item,
    deliveryStatus: campaignCreatorDeliveryState(item.row, item.campaign.approval_flow),
    companyId: companyFilterId(item.campaign.company_id ?? item.campaign.company?.id, item.campaign.company?.name),
    companyName: item.campaign.company?.name || tp("partnerCompany"),
    logoUrl: item.campaign.company?.logo_url ?? null,
  })), [approvedCampaigns, tp]);

  const companyOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of rows) {
      if (!seen.has(item.companyId)) seen.set(item.companyId, item.companyName);
    }
    return [
      { value: "all", label: tp("filterAllCompanies") },
      ...[...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: "base" })).map(([value, label]) => ({ value, label })),
    ];
  }, [rows, tp]);

  const statusOptions = useMemo(() => [
    { value: "all", label: tp("filterAllStatuses") },
    ...CONTENT_DELIVERY_STATES.map((state) => ({ value: state, label: deliveryLabel(state) })),
  ], [tp, deliveryLabel]);

  const filteredRows = useMemo(() => rows.filter((item) => {
    if (companyFilter !== "all" && item.companyId !== companyFilter) return false;
    if (statusFilter !== "all" && item.deliveryStatus !== statusFilter) return false;
    return true;
  }), [rows, companyFilter, statusFilter]);

  const groups = useMemo(() => groupRowsByCompany(filteredRows, (item) => ({
    id: item.campaign.company_id ?? item.campaign.company?.id,
    name: item.companyName,
    logoUrl: item.logoUrl,
  })), [filteredRows]);

  const openCampaign = useMemo(
    () => approvedCampaigns.find((item) => item.row.id === expandedSubmissionId) ?? null,
    [approvedCampaigns, expandedSubmissionId],
  );

  return (
    <>
    <div className="overflow-hidden rounded-[20px] border border-indigo-200/90 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-indigo-100 bg-indigo-50/70 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <Briefcase size={16} className="shrink-0 text-brand-primary" />
            <span className="truncate text-xs font-bold tracking-wider text-slate-900 uppercase">{tp("workTableTitle")}</span>
          </div>
          <span className="w-fit rounded-full border border-indigo-200 bg-indigo-100 px-3 py-1 text-xs font-extrabold text-brand-primary">
            {tp("inProgressBadge", { count: filteredRows.length })}
          </span>
        </div>
        <WorkTableFilters
          company={companyFilter}
          status={statusFilter}
          companyOptions={companyOptions}
          statusOptions={statusOptions}
          onCompany={setCompanyFilter}
          onStatus={setStatusFilter}
          tp={tp}
        />
      </div>
      {filteredRows.length === 0 ? (
        <div className="p-10 text-center text-sm font-medium text-slate-500">{tp("noFilterResults")}</div>
      ) : (
        <>
      <div className="flex flex-col lg:hidden">
        {groups.map((group) => (
          <div key={`cm-${group.key}`}>
            <CompanyGroupHeader
              name={group.name}
              count={group.rows.length}
              logoUrl={group.logoUrl}
              countLabel={tp(group.rows.length === 1 ? "companyCampaignCountOne" : "companyCampaignCount", { count: group.rows.length })}
              tone="indigo"
            />
            <div className="divide-y divide-slate-100">
        {group.rows.map(({ campaign, row, deliveryStatus }) => {
          const isOpen = expandedSubmissionId === row.id;
          const actions = (
            <CreatorWorkActions
              layout="stack"
              deliveryStatus={deliveryStatus}
              flow={campaign.approval_flow}
              publishedUrl={row.content?.published_link}
              postingProfile={campaign.posting_profile}
              onOpen={() => openSubmission(row.id)}
              tp={tp}
            />
          );
          return (
            <div key={row.id} className={cn("p-4", isOpen && "bg-indigo-50/40")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="m-0 text-sm font-bold break-words text-slate-900">{campaign.name}</p>
                </div>
                <span className="shrink-0 text-sm font-extrabold text-brand-primary">{creatorFeeText(campaign, row)}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                  <Calendar size={13} className="text-slate-400" />
                  {fmtDate(row.delivery_date || campaign.end_date)}
                </span>
                <span className={cn("inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase", applicationBadgeClass(row.application_status))}>
                  {row.application_status === "approved" ? <CheckCircle2 size={11} /> : null}
                  {applicationLabel(row.application_status)}
                </span>
                <span className={cn("inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase", deliveryBadgeClass(deliveryStatus))}>
                  <DeliveryStatusIcon state={deliveryStatus} />
                  {deliveryLabel(deliveryStatus)}
                </span>
              </div>
              <div className="mt-3">{actions}</div>
            </div>
          );
        })}
            </div>
          </div>
        ))}
      </div>
      <div className="hidden lg:block">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-indigo-100 bg-indigo-50/40 text-[10px] font-extrabold tracking-wider text-slate-500 uppercase">
              <th className="p-3.5 pl-5">{tp("colCampaign")}</th>
              <th className="p-3.5">{tp("colCache")}</th>
              <th className="p-3.5">{tp("colDeadline")}</th>
              <th className="p-3.5">{tp("colApplicationStatus")}</th>
              <th className="p-3.5">{tp("colDeliveryStatus")}</th>
              <th className="p-3.5 pr-5 text-right">{tp("colActions")}</th>
            </tr>
          </thead>
          <tbody className="font-medium">
            {groups.map((group) => (
              <Fragment key={`cd-${group.key}`}>
                <tr>
                  <td colSpan={6} className="p-0">
                    <CompanyGroupHeader
                      name={group.name}
                      count={group.rows.length}
                      logoUrl={group.logoUrl}
                      countLabel={tp(group.rows.length === 1 ? "companyCampaignCountOne" : "companyCampaignCount", { count: group.rows.length })}
                      tone="indigo"
                    />
                  </td>
                </tr>
            {group.rows.map(({ campaign, row, deliveryStatus }) => {
              const isOpen = expandedSubmissionId === row.id;

              return (
                <tr key={row.id} className={cn("transition-colors hover:bg-indigo-50/30", isOpen && "bg-indigo-50/50")}>
                    <td className="p-3.5 pl-5">
                      <span className="text-sm font-bold text-slate-900">{campaign.name}</span>
                    </td>
                    <td className="p-3.5">
                      <span className="text-sm font-extrabold text-brand-primary">{creatorFeeText(campaign, row)}</span>
                    </td>
                    <td className="p-3.5 text-slate-700">
                      <div className="flex items-center gap-1 font-semibold">
                        <Calendar size={13} className="text-slate-400" />
                        <span>{fmtDate(row.delivery_date || campaign.end_date)}</span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase", applicationBadgeClass(row.application_status))}>
                        {row.application_status === "approved" ? <CheckCircle2 size={11} /> : null}
                        {applicationLabel(row.application_status)}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase", deliveryBadgeClass(deliveryStatus))}>
                        <DeliveryStatusIcon state={deliveryStatus} />
                        {deliveryLabel(deliveryStatus)}
                      </span>
                    </td>
                    <td className="p-3.5 pr-5 text-right">
                      <CreatorWorkActions
                        layout="inline"
                        deliveryStatus={deliveryStatus}
                        flow={campaign.approval_flow}
                        publishedUrl={row.content?.published_link}
                        postingProfile={campaign.posting_profile}
                        onOpen={() => openSubmission(row.id)}
                        tp={tp}
                      />
                    </td>
                </tr>
              );
            })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
        </>
      )}
    </div>
    {openCampaign ? (
      <CampaignBriefingModal
        campaign={openCampaign.campaign}
        row={openCampaign.row}
        onClose={onCloseSubmission}
        onSubmitted={() => {
          onCloseSubmission();
          void reloadMyCampaigns();
        }}
        tp={tp}
      />
    ) : null}
    </>
  );
}

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <div className="relative">
        <span className="absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-bold text-slate-400">R$</span>
        <input
          inputMode="decimal"
          className={cn(inputClass, "pl-10 font-semibold tabular-nums")}
          value={value}
          onChange={(event) => onChange(formatBRLMask(event.target.value))}
          placeholder="0,00"
        />
      </div>
    </Field>
  );
}

function NetworkCard({
  title,
  icon: Icon,
  iconClass,
  handle,
  onHandle,
  handleLabel,
  handlePlaceholder,
  followers,
  onFollowers,
  views,
  onViews,
  engagement,
  onEngagement,
  followersLabel,
  prices,
  onFetch,
  fetching,
}: {
  title: string;
  icon: typeof Instagram;
  iconClass: string;
  handle: string;
  onHandle: (value: string) => void;
  handleLabel: string;
  handlePlaceholder: string;
  followers: string;
  onFollowers: (value: string) => void;
  views: string;
  onViews: (value: string) => void;
  engagement: string;
  onEngagement: (value: string) => void;
  followersLabel: string;
  prices: { label: string; value: string; onChange: (value: string) => void }[];
  onFetch?: () => void;
  fetching?: boolean;
}) {
  const { t: tp } = useTranslation("profile");
  return (
    <section className="rounded-[16px] border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50", iconClass)}>
          <Icon size={16} />
        </span>
        <h4 className="text-sm font-bold text-slate-900">{title}</h4>
      </div>
      <div className="flex flex-col gap-4">
        <div className={cn("flex flex-col gap-2", onFetch ? "sm:flex-row sm:items-end" : "")}>
          <Field label={handleLabel} className="min-w-0 flex-1">
            <input className={inputClass} value={handle} onChange={(event) => onHandle(event.target.value)} placeholder={handlePlaceholder} />
          </Field>
          {onFetch ? (
            <button
              type="button"
              onClick={onFetch}
              disabled={fetching || !handle.trim()}
              className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-4 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {fetching ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {fetching ? tp("fetchingNetworkData") : tp("fetchNetworkData")}
            </button>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">{tp("metricsTitle")}</p>
          {onFetch ? <p className="text-[11px] text-slate-500">{tp("metricsLockedHint")}</p> : null}
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3">
            <Field label={followersLabel} labelClassName="min-h-[2.5rem] leading-tight">
              <input readOnly={Boolean(onFetch)} tabIndex={onFetch ? -1 : undefined} inputMode="numeric" className={cn(inputClass, onFetch && "cursor-default bg-slate-50 text-slate-700")} value={followers} onChange={(event) => onFollowers(event.target.value)} />
            </Field>
            <Field label={tp("avgViews")} labelClassName="min-h-[2.5rem] leading-tight">
              <input readOnly={Boolean(onFetch)} tabIndex={onFetch ? -1 : undefined} inputMode="numeric" className={cn(inputClass, onFetch && "cursor-default bg-slate-50 text-slate-700")} value={views} onChange={(event) => onViews(event.target.value)} />
            </Field>
            <Field label={tp("engagementPct")} labelClassName="min-h-[2.5rem] leading-tight">
              <input readOnly={Boolean(onFetch)} tabIndex={onFetch ? -1 : undefined} inputMode="decimal" className={cn(inputClass, onFetch && "cursor-default bg-slate-50 text-slate-700")} value={engagement} onChange={(event) => onEngagement(event.target.value)} />
            </Field>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">{tp("pricingTitle")}</p>
          <div className={cn("grid gap-3", prices.length > 1 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2")}>
            {prices.map((price) => (
              <MoneyField key={price.label} label={price.label} value={price.value} onChange={price.onChange} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function NetworkMetricsSummary({
  metrics,
  socials,
  pricing,
  formatNumber,
  formatCurrency,
}: {
  metrics?: Record<string, number>;
  socials?: Record<string, string> | null;
  pricing?: Record<string, number> | null;
  formatNumber: (value?: number | null) => string;
  formatCurrency: (value: number) => string;
}) {
  const { t: tp } = useTranslation("profile");
  const rows = [
    {
      key: "instagram" as const,
      label: tp("socialInstagram"),
      icon: Instagram,
      className: "text-pink-600",
      followers: metricValue(metrics, ["instagram_followers", "followers"]),
      views: metricValue(metrics, ["instagram_views", "avgViews", "avg_views"]),
      engagement: metrics?.instagram_engagement || metrics?.avgEngagement || metrics?.engagement_rate,
      rates: [
        { label: tp("priceStory"), value: Number(pricing?.story) || 0 },
        { label: tp("priceReels"), value: Number(pricing?.reel) || 0 },
        { label: tp("priceFeedPost"), value: Number(pricing?.post) || 0 },
      ].filter((rate) => rate.value > 0),
    },
    {
      key: "tiktok" as const,
      label: tp("socialTiktok"),
      icon: Clapperboard,
      className: "text-rose-600",
      followers: metricValue(metrics, ["tiktok_followers"]),
      views: metricValue(metrics, ["tiktok_views"]),
      engagement: metrics?.tiktok_engagement,
      rates: [{ label: tp("priceTiktok"), value: Number(pricing?.tiktok) || 0 }].filter((rate) => rate.value > 0),
    },
    {
      key: "youtube" as const,
      label: tp("socialYoutube"),
      icon: Youtube,
      className: "text-red-600",
      followers: metricValue(metrics, ["youtube_followers", "youtube_subscribers"]),
      views: metricValue(metrics, ["youtube_views"]),
      engagement: metrics?.youtube_engagement,
      rates: [{ label: tp("priceYoutube"), value: Number(pricing?.youtube) || 0 }].filter((rate) => rate.value > 0),
    },
    {
      key: "kwai" as const,
      label: tp("socialKwai"),
      icon: Sparkles,
      className: "text-orange-500",
      followers: metricValue(metrics, ["kwai_followers"]),
      views: metricValue(metrics, ["kwai_views"]),
      engagement: metrics?.kwai_engagement,
      rates: [{ label: tp("priceKwai"), value: Number(pricing?.kwai) || 0 }].filter((rate) => rate.value > 0),
    },
  ].filter((row) => row.followers || row.views || row.engagement || row.rates.length || socials?.[row.key]);

  const combo = Number(pricing?.combo) || 0;

  if (!rows.length && !combo) {
    return <p className="text-xs text-slate-400 italic">{tp("noNetworkMetrics")}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => {
        const Icon = row.icon;
        const handle = socials?.[row.key]?.trim() || "";
        const hasMetrics = Boolean(row.followers || row.views || row.engagement);
        return (
          <div key={row.key} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5 text-[12px] font-bold text-slate-800">
                <Icon size={14} className={cn("shrink-0", row.className)} />
                <span>{row.label}</span>
              </div>
              {handle ? <span className="truncate text-[11px] font-semibold text-slate-500">{handle.startsWith("@") ? handle : `@${handle}`}</span> : null}
            </div>
            {hasMetrics ? (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">{row.key === "youtube" ? tp("subscribers") : tp("followers")}</p>
                  <p className="text-[12px] font-extrabold text-slate-800">{formatNumber(row.followers)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">{tp("avgViews")}</p>
                  <p className="text-[12px] font-extrabold text-slate-800">{formatNumber(row.views)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">{tp("engagement")}</p>
                  <p className="text-[12px] font-extrabold text-brand-primary">{row.engagement ? `${row.engagement}%` : "—"}</p>
                </div>
              </div>
            ) : null}
            {row.rates.length ? (
              <div className={cn("flex flex-col gap-1.5", hasMetrics ? "mt-2.5 border-t border-slate-200/80 pt-2.5" : "")}>
                {row.rates.map((rate) => (
                  <div key={rate.label} className="flex items-center justify-between gap-2">
                    <span className="text-[12px] text-slate-500">{rate.label}</span>
                    <span className="text-[13px] font-semibold text-slate-800">{formatCurrency(rate.value)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
      {combo > 0 ? (
        <div className="flex items-center justify-between border-t border-[#F1F5F9] pt-3">
          <span className="text-[13px] font-bold text-brand-primary">{tp("comboCommercial")}</span>
          <span className="text-[18px] font-bold text-brand-primary">{formatCurrency(combo)}</span>
        </div>
      ) : null}
    </div>
  );
}

function socialHref(network: "instagram" | "tiktok" | "youtube" | "kwai", handle: string) {
  const raw = handle.trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  const id = raw.replace(/^@+/, "");
  if (!id) return "";
  if (network === "instagram") return `https://instagram.com/${id}`;
  if (network === "tiktok") return `https://www.tiktok.com/@${id}`;
  if (network === "youtube") return `https://youtube.com/@${id}`;
  return `https://www.kwai.com/@${id}`;
}

function SocialLinks({ socials, emptyLabel }: { socials?: Record<string, string> | null; emptyLabel: string }) {
  const { t: tp } = useTranslation("profile");
  const items = [
    { key: "instagram" as const, label: tp("socialInstagram"), icon: Instagram, className: "text-pink-500" },
    { key: "tiktok" as const, label: tp("socialTiktok"), icon: Clapperboard, className: "text-rose-500" },
    { key: "youtube" as const, label: tp("socialYoutube"), icon: Youtube, className: "text-red-500" },
    { key: "kwai" as const, label: tp("socialKwai"), icon: Sparkles, className: "text-orange-500" },
  ].map((item) => ({ ...item, handle: socials?.[item.key]?.trim() || "" })).filter((item) => item.handle);

  if (!items.length) return null;

  return (
    <div>
      <span className="block text-[9px] font-bold tracking-wide text-[#64748B] uppercase">{tp("socialsTitle")}</span>
      <div className="mt-1.5 flex flex-col gap-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const href = socialHref(item.key, item.handle);
          const text = item.handle.startsWith("@") || /^https?:\/\//i.test(item.handle) ? item.handle : `@${item.handle}`;
          return (
            <a key={item.key} href={safeHttpUrl(href)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-600 hover:text-brand-primary">
              <Icon size={13} className={item.className} />
              <span className="truncate">{text || emptyLabel}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, children, className, labelClassName }: { label: string; children: ReactNode; className?: string; labelClassName?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label className={cn("text-[11px] font-bold tracking-wider text-[#64748B] uppercase", labelClassName)}>{label}</label>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className={cn("rounded-full border px-3 py-1.5 text-xs font-bold", checked ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500")}>
      {checked ? "✓ " : ""}{label}
    </button>
  );
}

export function CreatorProfileScreen() {
  return (
    <AuthenticatedShell>
      <Suspense fallback={
        <div className="flex h-96 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-brand-primary" />
        </div>
      }>
        <ProfileInner />
      </Suspense>
    </AuthenticatedShell>
  );
}
