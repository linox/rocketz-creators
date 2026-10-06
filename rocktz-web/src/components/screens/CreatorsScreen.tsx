"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, ChevronLeft, ChevronRight, Clapperboard, Clock, Download, ExternalLink, FileText, Instagram, KeyRound, LayoutGrid, LayoutList, Plus, RefreshCw, Repeat, Search, Sparkles, Trash2, Users, UsersRound, Youtube } from "lucide-react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { ChangeCreatorPasswordModal } from "@/components/ChangeCreatorPasswordModal";
import { PasswordField } from "@/components/PasswordField";
import { CreatorContractModal } from "@/components/CreatorContractModal";
import { MoneyInput } from "@/components/MoneyInput";
import { Select2Field } from "@/components/Select2Field";
import { UserAvatar } from "@/components/UserAvatar";
import { api } from "@/lib/api";
import { alertApiError, alertConfirm, alertSuccess, alertWarning } from "@/lib/alerts";
import { cn } from "@/lib/cn";
import { formatIntegerMask, isValidEmail, parseIntegerMask, parseMoneyMask, passwordError } from "@/lib/masks";
import { DEFAULT_COUNTRY, currencyForProfile, formatLocation, formatMoneyGroups, hasRegions, isValidCountry, isValidRegion, moneyCurrency, normalizeCountry, normalizeRegion } from "@/lib/geo";
import { formatTaxDocument, isValidTaxDocument, taxDocumentMaxLength, taxDocumentPlaceholder, taxDocumentsLabel } from "@/lib/taxDocuments";
import { CountrySelect, RegionSelect } from "@/components/GeoSelectFields";
import { usePrivacy } from "@/lib/privacy";
import type { Creator, CreatorGroup, RecurringContract } from "@/lib/types";
import { matchesNetworkRange, networkSize, NETWORK_TIER_BOUNDS } from "@/lib/network-size";
import { CREATOR_CATEGORY_VALUES, creatorCategoryOptions } from "@/lib/creatorCategories";
import { creatorTermAudit, downloadCreatorTermDocument, type CreatorTermDocLabels } from "@/lib/creator-contract-document";
import { useAuth } from "@/lib/use-auth";
import { userCanModerateCreator, userHasPermission } from "@/lib/auth";
import { intlLocale, normalizeLocale } from "@/i18n/locales";
import { safeHttpUrl } from "@/lib/safe-http-url";

const LAYOUT_STORAGE_KEY = "rocktz.creatorsCatalogLayout";
const PAGE_SIZE_STORAGE_KEY = "rocktz.creatorsPageSize";
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const DEFAULT_PAGE_SIZE = 20;
const FOLLOWER_SYNC_GAP_MS = 3500;
const FOLLOWER_STALE_SECONDS = 24 * 60 * 60;
const SYNCABLE_NETWORKS = ["instagram", "tiktok", "youtube"] as const;
type CatalogLayout = "list" | "grid";
type RefreshScope = "stale" | "filtered";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function syncableNetworks(creator: Creator) {
  return SYNCABLE_NETWORKS.filter((network) => String(creator.socials?.[network] ?? "").trim() !== "");
}

function followersAreStale(creator: Creator) {
  const networks = syncableNetworks(creator);
  if (networks.length === 0) return false;
  const metrics = creator.metrics ?? {};
  const now = Date.now() / 1000;
  return networks.some((network) => {
    const syncedAt = Number(metrics[`${network}_synced_at`] || 0);
    return !syncedAt || now - syncedAt >= FOLLOWER_STALE_SECONDS;
  });
}

const EMPTY_FORM = { full_name: "", artistic_name: "", cpf: "", email: "", password: "", category: "UGC Content", photo_url: "", country: DEFAULT_COUNTRY, state: "" };

const FILTER_TRIGGER =
  "h-[42px] rounded-lg border-[#E2E8F0] bg-[#F9FAFB] px-4 text-xs font-bold tracking-wide text-[#64748B] uppercase";

function CreatorLandingOrigins({ creator }: { creator: Creator }) {
  const { t } = useTranslation("app");
  const origins = (creator.landing_origins ?? []).filter((origin) => origin.landing?.display_name || origin.company?.name);
  if (origins.length === 0) return null;

  return (
    <>
      {origins.map((origin) => {
        const label = t("creators.landingOrigin", {
          landing: origin.landing?.display_name || "—",
          company: origin.company?.name || "—",
        });
        return (
          <span key={origin.id} title={label} className="inline-block max-w-[220px] truncate rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-800">
            {label}
          </span>
        );
      })}
    </>
  );
}

function orderedCreatorTags(categories: string[] | undefined, selected: string, limit: number) {
  const list = categories || [];
  if (!selected || selected === "all") return list.slice(0, limit);
  const needle = selected.toLowerCase();
  const match = list.filter((cat) => cat.toLowerCase() === needle);
  const rest = list.filter((cat) => cat.toLowerCase() !== needle);
  return [...match, ...rest].slice(0, limit);
}

function creatorTagClass(cat: string, selected: string) {
  const active = selected !== "all" && cat.toLowerCase() === selected.toLowerCase();
  return active
    ? "rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-indigo-700 uppercase"
    : "rounded-md bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#64748B] uppercase";
}

function metricValue(metrics: Record<string, number> | undefined, keys: string[]) {
  if (!metrics) return 0;
  for (const key of keys) {
    const value = Number(metrics[key] ?? 0);
    if (value) return value;
  }
  return 0;
}

const SOCIAL_NETWORKS = [
  { key: "instagram" as const, labelKey: "creators.networkInstagram", icon: Instagram, iconClass: "text-pink-600", followerKeys: ["instagram_followers"], fallbackKeys: ["followers"], viewKeys: ["instagram_views", "avgViews", "avg_views"], viewFallback: true },
  { key: "tiktok" as const, labelKey: "creators.networkTiktok", icon: Clapperboard, iconClass: "text-slate-800", followerKeys: ["tiktok_followers"], fallbackKeys: [] as string[], viewKeys: ["tiktok_views"], viewFallback: false },
  { key: "youtube" as const, labelKey: "creators.networkYoutube", icon: Youtube, iconClass: "text-red-600", followerKeys: ["youtube_followers", "youtube_subscribers"], fallbackKeys: [] as string[], viewKeys: ["youtube_views"], viewFallback: false },
  { key: "kwai" as const, labelKey: "creators.networkKwai", icon: Sparkles, iconClass: "text-orange-500", followerKeys: ["kwai_followers"], fallbackKeys: [] as string[], viewKeys: ["kwai_views"], viewFallback: false },
];

function socialProfileHref(network: (typeof SOCIAL_NETWORKS)[number]["key"], handle: string) {
  const raw = handle.trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return safeHttpUrl(raw);
  const id = raw.replace(/^@+/, "").split(/[/?#]/)[0]?.trim() ?? "";
  if (!id) return undefined;
  if (network === "instagram") return safeHttpUrl(`https://www.instagram.com/${id}/`);
  if (network === "tiktok") return safeHttpUrl(`https://www.tiktok.com/@${id}`);
  if (network === "youtube") {
    const channel = /^UC[A-Za-z0-9_-]{20,}$/.test(id);
    return safeHttpUrl(channel ? `https://www.youtube.com/channel/${id}` : `https://www.youtube.com/@${id}`);
  }
  return safeHttpUrl(`https://www.kwai.com/@${id}`);
}

function displayHandle(handle: string) {
  const raw = handle.trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) {
    try {
      const path = new URL(raw).pathname.replace(/^\/+|\/+$/g, "");
      const id = (path.split("/").filter(Boolean).pop() ?? "").replace(/^@/, "");
      return id ? `@${id}` : raw;
    } catch {
      return raw;
    }
  }
  const id = raw.replace(/^@+/, "").split(/[/?#]/)[0] ?? "";
  return id ? `@${id}` : raw;
}

function creatorSocialRows(creator: Creator) {
  const socials = creator.socials ?? {};
  return SOCIAL_NETWORKS.flatMap((network) => {
    const handle = String(socials[network.key] ?? "").trim();
    const followers = metricValue(creator.metrics, handle ? [...network.followerKeys, ...network.fallbackKeys] : network.followerKeys);
    const views = metricValue(creator.metrics, handle || !network.viewFallback ? network.viewKeys : network.viewKeys.slice(0, 1));
    if (!handle && followers <= 0 && views <= 0) return [];
    return [{
      ...network,
      followers,
      views,
      href: handle ? socialProfileHref(network.key, handle) : undefined,
      display: handle ? displayHandle(handle) : "",
    }];
  });
}

function CreatorFollowerNetworks({ creator, compact = false }: { creator: Creator; compact?: boolean }) {
  const { t } = useTranslation("app");
  const { formatNumber } = usePrivacy();
  const rows = creatorSocialRows(creator);
  const headline = networkSize(creator.metrics);
  const numberClass = compact ? "text-[13px] font-bold text-[#0F172A]" : "text-[14px] font-bold text-[#0F172A]";

  if (rows.length === 0) {
    return <span className={numberClass}>{formatNumber(headline)}</span>;
  }

  const primary = rows.find((row) => row.followers > 0 && row.followers === headline) ?? rows[0];

  return (
    <div className={cn("flex min-w-0", compact ? "items-center gap-1.5" : "flex-col")}>
      <span className={cn(numberClass, "shrink-0")}>{formatNumber(headline)}</span>
      <div className={cn("flex min-w-0 items-center gap-1", compact ? "" : "mt-1")}>
        <div className="flex shrink-0 items-center gap-1">
          {rows.map((row) => {
            const Icon = row.icon;
            const network = t(row.labelKey);
            const countLabel = row.key === "youtube" ? t("creators.subscribers") : t("creators.followers");
            const showTooltip = row.key !== primary.key;
            const icon = <Icon size={13} className={row.iconClass} />;
            const className = cn(
              "group relative flex h-6 w-6 items-center justify-center rounded-md border",
              row.key === primary.key ? "border-purple-200 bg-purple-50" : "border-slate-200 bg-white hover:border-purple-200",
            );
            const tooltip = showTooltip ? (
              <span role="tooltip" className="pointer-events-none absolute bottom-[calc(100%+6px)] left-0 z-30 flex w-max max-w-[180px] flex-col rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <span className="text-[10px] font-bold text-slate-800">{network}</span>
                <span className="text-[11px] font-bold text-[#0F172A]">{formatNumber(row.followers)} <span className="font-semibold text-slate-500">{countLabel}</span></span>
                {row.views > 0 ? <span className="text-[11px] font-bold text-[#0F172A]">{formatNumber(row.views)} <span className="font-semibold text-slate-500">{t("creators.avgViews")}</span></span> : null}
                {row.display ? <span className="mt-0.5 truncate text-[10px] font-semibold text-brand-primary">{row.display}</span> : null}
              </span>
            ) : null;

            if (!row.href) {
              return (
                <span key={row.key} className={className} title={network}>
                  {icon}
                  {tooltip}
                </span>
              );
            }

            return (
              <a
                key={row.key}
                href={row.href}
                target="_blank"
                rel="noreferrer"
                aria-label={showTooltip ? `${network}: ${formatNumber(row.followers)} ${countLabel}. ${t("creators.openNetwork", { network })}` : t("creators.openNetwork", { network })}
                title={network}
                className={className}
              >
                {icon}
                {tooltip}
              </a>
            );
          })}
        </div>
        {primary.href ? (
          <a href={primary.href} target="_blank" rel="noreferrer" title={t("creators.openNetwork", { network: t(primary.labelKey) })} className="inline-flex min-w-0 items-center gap-1 text-[11px] font-semibold text-brand-primary hover:underline">
            <span className="truncate">{primary.display || t(primary.labelKey)}</span>
            <ExternalLink size={10} className="shrink-0" />
          </a>
        ) : primary.display ? (
          <span className="truncate text-[11px] font-semibold text-slate-500">{primary.display}</span>
        ) : null}
      </div>
    </div>
  );
}

function creatorRecurringContracts(creator: Creator, recurringContracts: RecurringContract[]) {
  return recurringContracts.filter(
    (contract) => contract.status === "active" && contract.creators?.some((row) => row.creator_id === creator.id),
  );
}

function CreatorFeeValue({
  creator,
  contracts,
}: {
  creator: Creator;
  contracts: RecurringContract[];
}) {
  const { t } = useTranslation("app");
  const { formatCurrency } = usePrivacy();
  const monthly = formatMoneyGroups(
    formatCurrency,
    contracts.map((contract) => {
      const row = contract.creators?.find((item) => item.creator_id === creator.id);
      return { amount: Number(row?.monthly_cache ?? row?.monthly_fee ?? 0), currency: moneyCurrency(contract) };
    }),
  );
  if (contracts.length > 0) {
    return (
      <>
        {monthly} <span className="text-[10px] font-medium text-[#64748B]">{t("creators.perMonth")}</span>
      </>
    );
  }
  return (
    <>
      {formatCurrency(creator.pricing?.reel || 0, currencyForProfile(creator.currency, creator.country))} <span className="text-[10px] font-medium text-[#64748B]">{t("creators.perReel")}</span>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation("app");
  const styles: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-800 border-emerald-200",
    review: "bg-amber-100 text-amber-900 border-amber-300 font-bold",
    paused: "bg-[#F1F5F9] text-[#475569] border-slate-200",
    rejected: "bg-[#FEE2E2] text-[#B91C1C] border-rose-200",
  };

  return (
    <span className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase", styles[status] ?? "border-slate-200 bg-slate-100 text-slate-600")}>
      {status === "active" ? <CheckCircle2 size={10} /> : null}
      {status === "review" ? <Clock size={10} /> : null}
      {t(`status.${status}`, { defaultValue: status })}
    </span>
  );
}

function CreatorTermActions({
  creator,
  labels,
  onView,
  onDownload,
}: {
  creator: Creator;
  labels: { view: string; download: string; signed: string; pending: string };
  onView: (creator: Creator) => void;
  onDownload: (creator: Creator) => void;
}) {
  const signed = Boolean(creator.contract_acceptance);

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        title={signed ? `${labels.view} · ${labels.signed}` : `${labels.view} · ${labels.pending}`}
        onClick={() => onView(creator)}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg border bg-slate-50/80 shadow-2xs transition-all",
          signed
            ? "border-emerald-200 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50"
            : "border-amber-200 text-amber-700 hover:border-amber-300 hover:bg-amber-50",
        )}
      >
        <FileText size={14} />
      </button>
      <button
        type="button"
        title={labels.download}
        onClick={() => onDownload(creator)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50/80 text-slate-500 shadow-2xs transition-all hover:border-purple-300 hover:bg-purple-50 hover:text-brand-primary"
      >
        <Download size={14} />
      </button>
    </div>
  );
}

function CreatorCard({
  creator,
  recurringContracts,
  isAdmin,
  canModerate,
  canRemove,
  highlightedCategory,
  onApprove,
  onReject,
  onChangePassword,
  onRemove,
  onViewTerm,
  onDownloadTerm,
  termLabels,
}: {
  creator: Creator;
  recurringContracts: RecurringContract[];
  isAdmin: boolean;
  canModerate: boolean;
  canRemove: boolean;
  highlightedCategory: string;
  onApprove: (creator: Creator) => void;
  onReject: (creator: Creator) => void;
  onChangePassword: (creator: Creator) => void;
  onRemove: (creator: Creator) => void;
  onViewTerm?: (creator: Creator) => void;
  onDownloadTerm?: (creator: Creator) => void;
  termLabels?: { view: string; download: string; signed: string; pending: string };
}) {
  const { t, i18n } = useTranslation("app");
  const { formatNumber } = usePrivacy();
  const creatorContracts = creatorRecurringContracts(creator, recurringContracts);
  const location = formatLocation(intlLocale(normalizeLocale(i18n.language)), creator);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group flex flex-col justify-between rounded-[16px] border bg-white p-5 transition-all hover:border-brand-primary",
        creator.status === "review" ? "border-amber-300 bg-amber-50/10 ring-2 ring-amber-400/20" : "border-[#E2E8F0]",
      )}
    >
      <div>
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3.5">
            <UserAvatar
              src={creator.photo_url}
              name={creator.artistic_name || creator.full_name}
              size="lg"
              shape="rounded-xl"
              className="border border-slate-200"
              textClassName="text-base"
            />
            <div className="min-w-0">
              <h3 className="m-0 truncate font-bold text-[#0F172A]">@{creator.artistic_name}</h3>
              {location ? <p className="m-0 truncate text-[11px] font-medium text-slate-500">{location}</p> : null}
              <CreatorLandingOrigins creator={creator} />
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={creator.status} />
                <span
                  className={cn(
                    "rounded-full border px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase",
                    creator.role === "admin" ? "border-purple-200 bg-purple-100 text-purple-800" : "border-blue-200 bg-blue-100 text-blue-800",
                  )}
                >
                  {creator.role === "admin" ? t("creators.admin") : t("creators.influencer")}
                </span>
              </div>
            </div>
          </div>
          {isAdmin ? (
            <div className="flex shrink-0 items-center gap-1">
              {onViewTerm && onDownloadTerm && termLabels ? (
                <CreatorTermActions creator={creator} labels={termLabels} onView={onViewTerm} onDownload={onDownloadTerm} />
              ) : null}
              <button
                type="button"
                title={t("creators.changePassword")}
                onClick={() => onChangePassword(creator)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50/80 text-slate-500 shadow-2xs transition-all hover:border-purple-300 hover:bg-purple-50 hover:text-brand-primary"
              >
                <KeyRound size={14} />
              </button>
              {canRemove ? (
                <button
                  type="button"
                  title={t("creators.delete")}
                  onClick={() => onRemove(creator)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50/80 text-slate-500 shadow-2xs transition-all hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 size={14} />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {creator.status === "review" && canModerate ? (
          <div className="mb-4 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
              <Clock size={13} className="shrink-0 text-amber-600" />
              <span>{t("creators.awaitingApproval")}</span>
            </div>
            <p className="m-0 text-[11px] leading-snug text-amber-800">
              {isAdmin && creator.invited_by_company?.name
                ? t("creators.awaitingHintInvited", { company: creator.invited_by_company.name })
                : isAdmin
                  ? t("creators.awaitingHint")
                  : t("creators.awaitingHintCompany")}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onApprove(creator)}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
              >
                <CheckCircle2 size={13} />
                {t("creators.approve")}
              </button>
              <button
                type="button"
                onClick={() => onReject(creator)}
                className="flex items-center justify-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
              >
                {t("creators.reject")}
              </button>
            </div>
          </div>
        ) : null}

        <div className="mb-4 grid grid-cols-2 gap-4 border-t border-b border-[#F1F5F9] py-3.5">
          <div className="flex min-w-0 flex-col">
            <span className="mb-0.5 text-[10px] font-bold tracking-wider text-[#64748B] uppercase">{t("creators.followers")}</span>
            <CreatorFollowerNetworks creator={creator} />
          </div>
          <div className="flex flex-col">
            <span className="mb-0.5 text-[10px] font-bold tracking-wider text-[#64748B] uppercase">{t("creators.avgViews")}</span>
            <span className="text-[14px] font-bold text-[#0F172A]">{formatNumber(metricValue(creator.metrics, ["avgViews", "avg_views"]))}</span>
          </div>
        </div>

        {creatorContracts.length > 0 ? (
          <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-purple-100 bg-purple-50/80 p-2.5 text-xs font-bold text-purple-900">
            <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold text-purple-800">
              <Repeat size={13} className="shrink-0 text-purple-600" />
              {creatorContracts.length} {creatorContracts.length === 1 ? t("creators.recurringCompany") : t("creators.recurringCompanies")}
            </span>
            <span className="max-w-[130px] truncate rounded-md border border-purple-200 bg-white/90 px-2 py-0.5 text-[10px] font-extrabold text-purple-900" title={creatorContracts.map((c) => c.company?.name ?? c.title).join(", ")}>
              {creatorContracts.map((c) => c.company?.name ?? c.title).join(", ")}
            </span>
          </div>
        ) : null}

        <div className="mb-4 flex flex-wrap gap-2">
          {orderedCreatorTags(creator.categories, highlightedCategory, 2).map((cat) => (
            <span key={cat} className={creatorTagClass(cat, highlightedCategory)}>
              {cat}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-[#F1F5F9] pt-4">
        <div className="text-[13px] font-bold text-[#0F172A]">
          <CreatorFeeValue creator={creator} contracts={creatorContracts} />
        </div>
        <Link
          href={`/creators/${creator.id}`}
          className="flex items-center gap-1 rounded-lg bg-purple-50 px-3 py-1.5 text-xs font-bold text-brand-primary shadow-xs transition-all hover:bg-brand-primary hover:text-white"
        >
          {t("creators.view")}
        </Link>
      </div>
    </motion.article>
  );
}

function CreatorListRow({
  creator,
  recurringContracts,
  isAdmin,
  canModerate,
  canRemove,
  highlightedCategory,
  onApprove,
  onReject,
  onChangePassword,
  onRemove,
  onViewTerm,
  onDownloadTerm,
  termLabels,
}: {
  creator: Creator;
  recurringContracts: RecurringContract[];
  isAdmin: boolean;
  canModerate: boolean;
  canRemove: boolean;
  highlightedCategory: string;
  onApprove: (creator: Creator) => void;
  onReject: (creator: Creator) => void;
  onChangePassword: (creator: Creator) => void;
  onRemove: (creator: Creator) => void;
  onViewTerm?: (creator: Creator) => void;
  onDownloadTerm?: (creator: Creator) => void;
  termLabels?: { view: string; download: string; signed: string; pending: string };
}) {
  const { t, i18n } = useTranslation("app");
  const { formatNumber } = usePrivacy();
  const creatorContracts = creatorRecurringContracts(creator, recurringContracts);
  const avgViews = formatNumber(metricValue(creator.metrics, ["avgViews", "avg_views"]));
  const companyNames = creatorContracts.map((c) => c.company?.name ?? c.title).join(", ");
  const location = formatLocation(intlLocale(normalizeLocale(i18n.language)), creator);

  const rowActions = (
    <>
      {isAdmin && onViewTerm && onDownloadTerm && termLabels ? (
        <CreatorTermActions creator={creator} labels={termLabels} onView={onViewTerm} onDownload={onDownloadTerm} />
      ) : null}
      {isAdmin ? (
        <button
          type="button"
          title={t("creators.changePassword")}
          onClick={() => onChangePassword(creator)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50/80 text-slate-500 shadow-2xs transition-all hover:border-purple-300 hover:bg-purple-50 hover:text-brand-primary"
        >
          <KeyRound size={14} />
        </button>
      ) : null}
      {canRemove ? (
        <button
          type="button"
          title={t("creators.delete")}
          onClick={() => onRemove(creator)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50/80 text-slate-500 shadow-2xs transition-all hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
        >
          <Trash2 size={14} />
        </button>
      ) : null}
      <Link
        href={`/creators/${creator.id}`}
        className="flex items-center gap-1 rounded-lg bg-purple-50 px-3 py-1.5 text-xs font-bold text-brand-primary shadow-xs transition-all hover:bg-brand-primary hover:text-white"
      >
        {t("creators.viewShort")}
      </Link>
    </>
  );

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col gap-2 rounded-2xl border bg-white px-3 py-2.5 transition-all hover:border-brand-primary",
        creator.status === "review" ? "border-amber-300 bg-amber-50/10 ring-2 ring-amber-400/20" : "border-[#E2E8F0]",
      )}
    >
      <div className="flex items-start gap-3">
        <UserAvatar
          src={creator.photo_url}
          name={creator.artistic_name || creator.full_name}
          size="md"
          shape="rounded-xl"
          className="shrink-0 border border-slate-200"
          textClassName="text-sm"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="m-0 max-w-full truncate text-sm font-bold text-[#0F172A]">@{creator.artistic_name}</h3>
            <StatusBadge status={creator.status} />
            <span
              className={cn(
                "rounded-full border px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase",
                creator.role === "admin" ? "border-purple-200 bg-purple-100 text-purple-800" : "border-blue-200 bg-blue-100 text-blue-800",
              )}
            >
              {creator.role === "admin" ? t("creators.admin") : t("creators.influencer")}
            </span>
          </div>
          {creator.full_name || location ? (
            <p className="m-0 truncate text-[11px] font-medium text-slate-500">
              {creator.full_name}
              {creator.full_name && location ? <span className="text-slate-300"> · </span> : null}
              {location ? <span className="font-normal text-slate-400">{location}</span> : null}
            </p>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <CreatorLandingOrigins creator={creator} />
            {orderedCreatorTags(creator.categories, highlightedCategory, 3).map((cat) => (
              <span key={cat} className={cn(creatorTagClass(cat, highlightedCategory), "px-1.5 text-[9px]")}>
                {cat}
              </span>
            ))}
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-2 lg:flex">{rowActions}</div>
      </div>

      <div className="flex flex-col gap-2 border-t border-[#F1F5F9] pt-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid min-w-0 flex-1 grid-cols-2 items-start gap-x-4 gap-y-2 sm:grid-cols-4">
          <div className="min-w-0">
            <span className="text-[9px] font-bold tracking-wider text-[#64748B] uppercase">{t("creators.colFollowers")}</span>
            <CreatorFollowerNetworks creator={creator} compact />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-bold tracking-wider text-[#64748B] uppercase">{t("creators.colAvgViews")}</span>
            <span className="block text-[13px] font-bold text-[#0F172A]">{avgViews}</span>
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-bold tracking-wider text-[#64748B] uppercase">{t("creators.colRecurring")}</span>
            {creatorContracts.length > 0 ? (
              <span className="flex items-center gap-1 truncate text-[12px] font-bold text-purple-800" title={companyNames}>
                <Repeat size={11} className="shrink-0 text-purple-600" />
                {creatorContracts.length === 1
                  ? (creatorContracts[0].company?.name ?? creatorContracts[0].title)
                  : `${creatorContracts.length} ${t("creators.recurringCompanies")}`}
              </span>
            ) : (
              <span className="text-[12px] font-semibold text-slate-400">—</span>
            )}
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-bold tracking-wider text-[#64748B] uppercase">{t("creators.colFee")}</span>
            <span className="text-[13px] font-bold text-[#0F172A]">
              <CreatorFeeValue creator={creator} contracts={creatorContracts} />
            </span>
          </div>
        </div>
        {creator.status === "review" && canModerate ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onApprove(creator)}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-xs hover:bg-emerald-700 sm:flex-none"
            >
              <CheckCircle2 size={13} />
              {t("creators.approve")}
            </button>
            <button
              type="button"
              onClick={() => onReject(creator)}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100 sm:flex-none"
            >
              {t("creators.reject")}
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-[#F1F5F9] pt-2 lg:hidden">{rowActions}</div>
    </motion.article>
  );
}

function CreatorsInner() {
  const user = useAuth();
  const router = useRouter();
  const { t, i18n } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const { t: tAuth } = useTranslation("auth");
  const { t: tp } = useTranslation("profile");
  const isAdmin = user.role === "admin";
  const isCompany = user.role === "company";
  const canRemove = userHasPermission(user, "users.manage");
  const [creators, setCreators] = useState<Creator[]>([]);
  const [recurringContracts, setRecurringContracts] = useState<RecurringContract[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState<string[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [groups, setGroups] = useState<CreatorGroup[]>([]);
  const [groupFilter, setGroupFilter] = useState("all");
  const [networkFilter, setNetworkFilter] = useState("all");
  const [minFollowers, setMinFollowers] = useState("");
  const [maxFollowers, setMaxFollowers] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const formDocumentsLabel = taxDocumentsLabel(form.country, tc("orConjunction"), tc("taxIdFallback"));
  const [passwordCreator, setPasswordCreator] = useState<Creator | null>(null);
  const [termCreator, setTermCreator] = useState<Creator | null>(null);
  const [layout, setLayout] = useState<CatalogLayout>("list");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const resultsRef = useRef<HTMLDivElement>(null);
  const pageScrollReady = useRef(false);
  const [refreshScope, setRefreshScope] = useState<RefreshScope>("stale");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const refreshCancelRef = useRef(false);
  const filterCurrency = moneyCurrency(user.company);

  const categoryLabels = tAuth("categories", { returnObjects: true }) as Record<string, string>;
  const knownCategoryOptions = useMemo(
    () => creatorCategoryOptions(categoryLabels, creators.flatMap((creator) => creator.categories ?? [])),
    [categoryLabels, creators],
  );
  const categoryOptions = useMemo(
    () => [{ value: "all", label: t("creators.allCategories").toUpperCase() }, ...knownCategoryOptions.map((option) => ({ value: option.value, label: option.label.toUpperCase() }))],
    [knownCategoryOptions, t],
  );

  const statusOptions = useMemo(
    () => [
      { value: "all", label: t("creators.allStatus").toUpperCase() },
      { value: "active", label: t("status.active").toUpperCase() },
      { value: "review", label: t("creators.statusReview").toUpperCase() },
      { value: "paused", label: t("status.paused").toUpperCase() },
      { value: "rejected", label: t("status.rejected").toUpperCase() },
    ],
    [t],
  );

  const termActionLabels = useMemo(
    () => ({
      view: t("creators.viewTerm"),
      download: t("creators.downloadTerm"),
      signed: t("creators.termSigned"),
      pending: t("creators.termPending"),
    }),
    [t],
  );

  function termDownloadLabels(creator: Creator): CreatorTermDocLabels {
    const documents = taxDocumentsLabel(creator.country || DEFAULT_COUNTRY, tc("orConjunction"), tc("taxIdFallback"));
    return {
      signed: t("creators.termSigned"),
      pending: t("creators.termPending"),
      artisticName: t("creators.artisticName"),
      fullName: t("creators.fullName"),
      document: t("creators.cpf", { documents }),
      email: t("creators.email"),
      acceptedAt: tp("acceptanceDate"),
      version: tp("termModal.version", { version: "" }).trim(),
      acceptId: tp("termModal.acceptIdLabel"),
      declarations: tp("termModal.declarationsTitle"),
    };
  }

  function downloadTerm(creator: Creator) {
    downloadCreatorTermDocument(creator, i18n.language, termDownloadLabels(creator));
  }

  async function load() {
    if (user.role === "creator") return;
    try {
      const [creatorsRes, recurringRes, groupsRes] = await Promise.all([
        api.creators(),
        api.recurring().catch(() => ({ data: [] as RecurringContract[] })),
        api.creatorGroups().catch(() => ({ data: [] as CreatorGroup[] })),
      ]);
      setCreators(creatorsRes.data);
      setRecurringContracts(recurringRes.data);
      setGroups(groupsRes.data);
    } catch (err) {
      await alertApiError(err);
    }
  }

  useEffect(() => {
    if (user.role === "creator" && user.creator?.id) {
      router.replace(`/creators/${user.creator.id}?tab=dashboard`);
      return;
    }
    load();
    const params = new URLSearchParams(window.location.search);
    if (params.get("filters") === "true") setShowAdvancedFilters(true);
    if (params.get("status")) setStatusFilter(params.get("status") ?? "all");
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (stored === "list" || stored === "grid") setLayout(stored);
      const storedPageSize = Number(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY));
      if (PAGE_SIZE_OPTIONS.includes(storedPageSize as (typeof PAGE_SIZE_OPTIONS)[number])) setPageSize(storedPageSize);
    } catch {
      /* ignore */
    }
  }, []);

  function changeLayout(next: CatalogLayout) {
    setLayout(next);
    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const pendingCount = creators.filter((c) => c.status === "review").length;
  const activeCount = creators.filter((c) => c.status === "active").length;

  const groupMemberIds = useMemo(() => {
    if (groupFilter === "all") return null;
    const group = groups.find((item) => String(item.id) === groupFilter);
    return new Set((group?.creators ?? []).map((creator) => creator.id));
  }, [groups, groupFilter]);

  const networkOptions = useMemo(() => [
    { value: "all", label: t("creators.allNetworkSizes").toUpperCase() },
    { value: "nano", label: t("creators.networkNano").toUpperCase() },
    { value: "micro", label: t("creators.networkMicro").toUpperCase() },
    { value: "mid", label: t("creators.networkMid").toUpperCase() },
    { value: "macro", label: t("creators.networkMacro").toUpperCase() },
    { value: "mega", label: t("creators.networkMega").toUpperCase() },
  ], [t]);

  const groupOptions = useMemo(() => [
    { value: "all", label: t("creators.allGroups").toUpperCase() },
    ...groups.map((group) => ({
      value: String(group.id),
      label: (isAdmin && group.company?.name ? `${group.name} · ${group.company.name}` : group.name).toUpperCase(),
    })),
  ], [groups, isAdmin, t]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const bounds = networkFilter !== "all" ? NETWORK_TIER_BOUNDS[networkFilter as keyof typeof NETWORK_TIER_BOUNDS] : null;
    return creators.filter((creator) => {
      const followers = networkSize(creator.metrics);
      const reel = Number(creator.pricing?.reel || 0);
      const matchesSearch =
        !term ||
        (creator.artistic_name || "").toLowerCase().includes(term) ||
        (creator.full_name || "").toLowerCase().includes(term) ||
        Object.values(creator.socials || {}).some((handle) => String(handle || "").toLowerCase().includes(term));
      const matchesStatus = statusFilter === "all" || creator.status === statusFilter;
      const matchesCategory =
        categoryFilter === "all" ||
        (creator.categories || []).some((cat) => cat.toLowerCase() === categoryFilter.toLowerCase());
      const matchesCountry = countryFilter === "all" || normalizeCountry(creator.country) === countryFilter;
      const matchesRegion =
        countryFilter === "all" ||
        regionFilter.length === 0 ||
        regionFilter.includes(normalizeRegion(creator.state));
      const matchesMinFollowers = !minFollowers || followers >= parseIntegerMask(minFollowers);
      const matchesMaxFollowers = !maxFollowers || followers <= parseIntegerMask(maxFollowers);
      const matchesNetwork = !bounds || matchesNetworkRange(followers, bounds.min, bounds.max);
      const matchesGroup = !groupMemberIds || groupMemberIds.has(creator.id);
      const matchesMinPrice = !minPrice || reel >= parseMoneyMask(minPrice, filterCurrency);
      const matchesMaxPrice = !maxPrice || reel <= parseMoneyMask(maxPrice, filterCurrency);
      return matchesSearch && matchesStatus && matchesCategory && matchesCountry && matchesRegion && matchesMinFollowers && matchesMaxFollowers && matchesNetwork && matchesGroup && matchesMinPrice && matchesMaxPrice;
    });
  }, [creators, search, statusFilter, categoryFilter, countryFilter, regionFilter, minFollowers, maxFollowers, minPrice, maxPrice, filterCurrency, networkFilter, groupMemberIds]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, categoryFilter, countryFilter, regionFilter, minFollowers, maxFollowers, minPrice, maxPrice, networkFilter, groupFilter, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const rangeFrom = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeTo = Math.min(safePage * pageSize, filtered.length);

  useEffect(() => {
    if (!pageScrollReady.current) {
      pageScrollReady.current = true;
      return;
    }
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [page]);

  function changePageSize(value: string) {
    const next = Number(value);
    const size = PAGE_SIZE_OPTIONS.includes(next as (typeof PAGE_SIZE_OPTIONS)[number]) ? next : DEFAULT_PAGE_SIZE;
    setPageSize(size);
    setPage(1);
    try {
      window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(size));
    } catch {
      /* ignore */
    }
  }

  async function approve(creator: Creator) {
    if (!(await alertConfirm(t("creators.approveTitle"), t("creators.approveText", { name: creator.artistic_name })))) return;
    try {
      await api.approveCreator(creator.id);
      await alertSuccess(t("creators.approved"), t("creators.approvedBody", { name: creator.artistic_name }));
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function reject(creator: Creator) {
    if (!(await alertConfirm(t("creators.rejectTitle"), t("creators.rejectText", { name: creator.artistic_name }), t("creators.reject")))) return;
    try {
      await api.rejectCreator(creator.id);
      await alertSuccess(t("creators.rejectSuccess"), t("creators.rejectSuccessBody", { name: creator.artistic_name }));
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function removeCreator(creator: Creator) {
    if (!(await alertConfirm(t("creators.deleteTitle"), t("creators.deleteText", { name: creator.artistic_name }), t("creators.delete")))) return;
    try {
      await api.deleteCreator(creator.id);
      await alertSuccess(t("creators.deleted"));
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  const refreshScopeOptions = useMemo(
    () => [
      { value: "stale", label: t("creators.refreshScopeStale") },
      { value: "filtered", label: t("creators.refreshScopeFiltered") },
    ],
    [t],
  );

  async function refreshFollowers() {
    const targets = filtered.filter((creator) => {
      if (syncableNetworks(creator).length === 0) return false;
      return refreshScope === "filtered" || followersAreStale(creator);
    });
    if (targets.length === 0) {
      await alertWarning(
        t("creators.refreshNoneTitle"),
        refreshScope === "filtered" ? t("creators.refreshNoneFiltered") : t("creators.refreshNoneStale"),
      );
      return;
    }
    if (!(await alertConfirm(t("creators.refreshConfirmTitle"), t("creators.refreshConfirmText", { count: targets.length }), t("creators.refreshConfirm")))) return;

    refreshCancelRef.current = false;
    setRefreshing(true);
    let updated = 0;
    let failed = 0;
    let skipped = 0;
    let stoppedAt = 0;

    try {
      for (let index = 0; index < targets.length; index += 1) {
        if (refreshCancelRef.current) break;
        const creator = targets[index];
        stoppedAt = index + 1;
        setRefreshProgress({ current: index + 1, total: targets.length, name: creator.artistic_name });
        let skippedOne = false;
        try {
          const result = await api.refreshCreatorFollowers(creator.id, refreshScope === "filtered");
          if (result.status === "skipped") {
            skipped += 1;
            skippedOne = true;
          } else {
            updated += 1;
          }
        } catch {
          failed += 1;
        }
        if (refreshCancelRef.current || index === targets.length - 1) break;
        await wait(skippedOne ? 400 : FOLLOWER_SYNC_GAP_MS);
      }
    } finally {
      setRefreshing(false);
      setRefreshProgress(null);
    }

    if (refreshCancelRef.current) {
      await alertWarning(t("creators.refreshCancelledTitle"), t("creators.refreshCancelled", { current: stoppedAt, total: targets.length, updated }));
    } else {
      await alertSuccess(t("creators.refreshDoneTitle"), t("creators.refreshDone", { updated, failed, skipped }));
    }
    load();
  }

  async function resetCasting() {
    if (!(await alertConfirm(t("creators.resetTitle"), t("creators.resetText"), t("creators.resetConfirm")))) return;
    try {
      await api.resetCasting();
      await alertSuccess(t("creators.resetSuccess"), t("creators.resetSuccessBody"));
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!form.full_name.trim() || !form.artistic_name.trim() || !form.email.trim()) {
      await alertWarning(t("creators.incompleteTitle"), t("creators.incomplete"));
      return;
    }
    if (!isValidEmail(form.email)) {
      await alertWarning(t("creators.invalidEmailTitle"), t("creators.invalidEmail"));
      return;
    }
    if (!isCompany && form.cpf && !isValidTaxDocument(form.country, form.cpf)) {
      await alertWarning(t("creators.invalidCpfTitle", { documents: formDocumentsLabel }), t("creators.invalidCpf", { documents: formDocumentsLabel }));
      return;
    }
    if (!isValidCountry(form.country)) {
      await alertWarning(tc("alerts.countryRequiredTitle"), tc("alerts.countryRequired"));
      return;
    }
    if (hasRegions(form.country) && !isValidRegion(form.country, form.state)) {
      await alertWarning(tc("alerts.regionRequiredTitle"), tc("alerts.regionRequired"));
      return;
    }
    if (isCompany && form.password && passwordError(form.password)) {
      await alertWarning(t("creators.invalidPasswordTitle"), tc("password.too_short"));
      return;
    }
    try {
      const created = await api.createCreator({
        full_name: form.full_name.trim(),
        artistic_name: form.artistic_name.replace(/^@/, "").trim(),
        email: form.email.trim(),
        password: isCompany && form.password ? form.password : undefined,
        cpf: isCompany ? null : form.cpf || null,
        photo_url: form.photo_url.trim() || null,
        category: form.category,
        instagram: form.artistic_name.replace(/^@/, "").trim(),
        country: form.country,
        state: form.state || null,
      });
      if (isAdmin && created.social_sync === "queued" && created.data?.id) {
        try {
          await api.waitForCreatorSocialSync(created.data.id);
        } catch {
          // The creator is already saved. Follower refresh can fail on its own.
        }
      }
      setModalOpen(false);
      setForm(EMPTY_FORM);
      await alertSuccess(isCompany ? t("creators.createdCompany") : t("creators.created"));
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  if (user.role === "creator") {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="m-0 text-xl font-bold text-[#0F172A] sm:text-[28px]">{t("creators.title")}</h1>
          <p className="mt-1 text-[14px] text-[#64748B]">{isCompany ? t("creators.subtitleCompany") : t("creators.subtitle")}</p>
        </div>
        <div className="flex w-full flex-col items-stretch gap-2.5 sm:w-auto sm:flex-row sm:items-center">
          <div className="flex items-center self-start rounded-xl border border-slate-200 bg-slate-50 p-0.5 sm:self-auto">
            <button
              type="button"
              onClick={() => changeLayout("list")}
              title={t("creators.layoutListHint")}
              aria-label={t("creators.layoutListHint")}
              className={cn("inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-bold whitespace-nowrap", layout === "list" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-white")}
            >
              <LayoutList size={13} className="shrink-0" /> <span className="hidden sm:inline">{t("creators.layoutList")}</span>
            </button>
            <button
              type="button"
              onClick={() => changeLayout("grid")}
              title={t("creators.layoutGridHint")}
              aria-label={t("creators.layoutGridHint")}
              className={cn("inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-bold whitespace-nowrap", layout === "grid" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-white")}
            >
              <LayoutGrid size={13} className="shrink-0" /> <span className="hidden sm:inline">{t("creators.layoutGrid")}</span>
            </button>
          </div>
          {isAdmin ? (
            <button
              type="button"
              onClick={resetCasting}
              title={t("creators.resetHint")}
              className="flex h-11 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 text-xs font-bold text-rose-700 shadow-xs transition-all hover:bg-rose-100"
            >
              <Trash2 size={15} className="text-rose-600" />
              {t("creators.reset")}
            </button>
          ) : null}
          {isAdmin || isCompany ? (
            <Link
              href="/creator-groups"
              className="flex h-11 items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 text-sm font-bold text-indigo-700 hover:bg-indigo-100"
            >
              <UsersRound size={16} />
              {t("creators.groupsLink")}
            </Link>
          ) : null}
          {isAdmin || isCompany ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex h-11 items-center gap-2 rounded-lg bg-brand-primary px-6 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-600 active:scale-95"
            >
              <Plus size={18} />
              {t("creators.new")}
            </button>
          ) : null}
        </div>
      </header>

      {isAdmin || isCompany ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="w-full sm:w-56">
              <Select2Field
                theme="light"
                searchable={false}
                value={refreshScope}
                options={refreshScopeOptions}
                disabled={refreshing}
                onChange={(value) => setRefreshScope(value === "filtered" ? "filtered" : "stale")}
                triggerClassName="h-11 rounded-lg px-3 text-xs font-bold"
              />
            </div>
            <button
              type="button"
              onClick={() => void refreshFollowers()}
              disabled={refreshing}
              title={t("creators.refreshFollowersHint")}
              className="flex h-11 items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-white px-4 text-sm font-bold text-indigo-700 shadow-xs transition-all hover:bg-indigo-50 disabled:cursor-wait disabled:opacity-70"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              {t("creators.refreshFollowers")}
            </button>
          </div>
          {refreshProgress ? (
            <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
              <RefreshCw size={16} className="shrink-0 animate-spin text-indigo-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-indigo-950">
                  {t("creators.refreshProgress", { current: refreshProgress.current, total: refreshProgress.total, name: refreshProgress.name })}
                </p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-indigo-100">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all"
                    style={{ width: `${Math.round((refreshProgress.current / refreshProgress.total) * 100)}%` }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => { refreshCancelRef.current = true; }}
                className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold text-indigo-800 hover:bg-indigo-100"
              >
                {tc("cancel")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {isAdmin || isCompany ? (
      <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={cn(
            "shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all",
            statusFilter === "all" ? "bg-slate-900 text-white shadow-xs" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
          )}
        >
          {t("creators.all", { count: creators.length })}
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("review")}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all",
            statusFilter === "review" ? "bg-amber-500 text-white shadow-xs" : "border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100",
          )}
        >
          <Clock size={13} />
          {t("creators.awaitingCount", { count: pendingCount })}
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("active")}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all",
            statusFilter === "active" ? "bg-emerald-600 text-white shadow-xs" : "border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100",
          )}
        >
          <CheckCircle2 size={13} />
          {t("creators.activeCount", { count: activeCount })}
        </button>
        {isAdmin ? (
        <button
          type="button"
          onClick={() => setStatusFilter("paused")}
          className={cn(
            "shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all",
            statusFilter === "paused" ? "bg-slate-700 text-white shadow-xs" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
          )}
        >
          {t("creators.paused")}
        </button>
        ) : null}
      </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-[16px] border border-[#E2E8F0] bg-white p-4 shadow-sm">
        <div className="relative w-full min-w-0">
          <Search className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("creators.search")}
            aria-label={t("creators.search")}
            className="h-[42px] w-full rounded-lg border border-[#E2E8F0] bg-[#F9FAFB] pr-4 pl-10 text-sm outline-none transition-all focus:border-brand-primary focus:bg-white"
          />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Select2Field
            theme="light"
            searchable={false}
            value={categoryFilter}
            options={categoryOptions}
            onChange={setCategoryFilter}
            className="min-w-0"
            triggerClassName={FILTER_TRIGGER}
          />
          {isAdmin ? (
            <Select2Field
              theme="light"
              searchable={false}
              value={statusFilter}
              options={statusOptions}
              onChange={setStatusFilter}
              className="min-w-0"
              triggerClassName={FILTER_TRIGGER}
            />
          ) : isCompany ? (
            <Select2Field
              theme="light"
              searchable={false}
              value={statusFilter}
              options={statusOptions.filter((option) => option.value === "all" || option.value === "active" || option.value === "review")}
              onChange={setStatusFilter}
              className="min-w-0"
              triggerClassName={FILTER_TRIGGER}
            />
          ) : null}
          <Select2Field
            theme="light"
            searchable={false}
            value={networkFilter}
            options={networkOptions}
            onChange={setNetworkFilter}
            className="min-w-0"
            triggerClassName={FILTER_TRIGGER}
          />
          {groups.length > 0 ? (
            <Select2Field
              theme="light"
              value={groupFilter}
              options={groupOptions}
              onChange={setGroupFilter}
              className="min-w-0"
              triggerClassName={FILTER_TRIGGER}
            />
          ) : null}
          <CountrySelect
            theme="light"
            value={countryFilter}
            emptyLabel={t("creators.allCountries").toUpperCase()}
            onChange={(country) => {
              setCountryFilter(country);
              setRegionFilter([]);
            }}
            className="min-w-0"
            triggerClassName={FILTER_TRIGGER}
          />
          <RegionSelect
            multiple
            theme="light"
            country={countryFilter}
            value={regionFilter}
            emptyLabel={t("creators.allRegions").toUpperCase()}
            onChange={setRegionFilter}
            className="min-w-0"
            triggerClassName={FILTER_TRIGGER}
          />
          <Select2Field
            theme="light"
            searchable={false}
            value={String(pageSize)}
            options={PAGE_SIZE_OPTIONS.map((size) => ({ value: String(size), label: t("creators.pageSize", { count: size }) }))}
            onChange={changePageSize}
            className="min-w-0"
            triggerClassName={FILTER_TRIGGER}
          />
        </div>
      </div>

      {showAdvancedFilters ? (
        <div className="-mt-4 overflow-hidden rounded-[16px] border border-[#E2E8F0] bg-slate-50 p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <h3 className="text-xs font-bold tracking-wider text-[#475569] uppercase">{t("creators.advancedFilters")}</h3>
            <button type="button" onClick={() => setShowAdvancedFilters(false)} className="text-xs font-bold tracking-wide text-slate-500 uppercase hover:text-slate-800">
              {t("creators.closeFilters")}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
            {[
              { label: t("creators.minFollowers"), value: minFollowers, set: setMinFollowers, placeholder: t("creators.minFollowersPh") },
              { label: t("creators.maxFollowers"), value: maxFollowers, set: setMaxFollowers, placeholder: t("creators.maxFollowersPh") },
            ].map((field) => (
              <div key={field.label} className="flex flex-col gap-1.5">
                <label className="text-xs font-bold tracking-wide text-slate-600 uppercase">{field.label}</label>
                <input
                  inputMode="numeric"
                  value={field.value}
                  placeholder={field.placeholder}
                  onChange={(e) => field.set(formatIntegerMask(e.target.value))}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-2 text-sm outline-none focus:border-brand-primary"
                />
              </div>
            ))}
            {[
              { label: t("creators.minPrice"), value: minPrice, set: setMinPrice, placeholder: t("creators.minPricePh") },
              { label: t("creators.maxPrice"), value: maxPrice, set: setMaxPrice, placeholder: t("creators.maxPricePh") },
            ].map((field) => (
              <div key={field.label} className="flex flex-col gap-1.5">
                <label className="text-xs font-bold tracking-wide text-slate-600 uppercase">{field.label}</label>
                <MoneyInput
                  currency={filterCurrency}
                  value={field.value}
                  placeholder={field.placeholder}
                  onChange={field.set}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-2 text-sm outline-none focus:border-brand-primary"
                />
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setMinFollowers("");
                setMaxFollowers("");
                setMinPrice("");
                setMaxPrice("");
              }}
              className="rounded-lg border border-slate-200 bg-transparent px-4 py-2 text-xs font-bold text-slate-600 hover:bg-white"
            >
              {t("creators.clearFilters")}
            </button>
          </div>
        </div>
      ) : null}

      <div ref={resultsRef} className={cn(layout === "grid" ? "grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4" : "flex flex-col gap-2.5")}>
        {paged.map((creator) =>
          layout === "grid" ? (
            <CreatorCard
              key={creator.id}
              creator={creator}
              recurringContracts={recurringContracts}
              isAdmin={isAdmin}
              canModerate={userCanModerateCreator(user, creator)}
              canRemove={canRemove}
              highlightedCategory={categoryFilter}
              onApprove={approve}
              onReject={reject}
              onChangePassword={setPasswordCreator}
              onRemove={removeCreator}
              onViewTerm={isAdmin ? setTermCreator : undefined}
              onDownloadTerm={isAdmin ? downloadTerm : undefined}
              termLabels={isAdmin ? termActionLabels : undefined}
            />
          ) : (
            <CreatorListRow
              key={creator.id}
              creator={creator}
              recurringContracts={recurringContracts}
              isAdmin={isAdmin}
              canModerate={userCanModerateCreator(user, creator)}
              canRemove={canRemove}
              highlightedCategory={categoryFilter}
              onApprove={approve}
              onReject={reject}
              onChangePassword={setPasswordCreator}
              onRemove={removeCreator}
              onViewTerm={isAdmin ? setTermCreator : undefined}
              onDownloadTerm={isAdmin ? downloadTerm : undefined}
              termLabels={isAdmin ? termActionLabels : undefined}
            />
          ),
        )}
      </div>

      {filtered.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-[16px] border border-[#E2E8F0] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] font-semibold text-slate-500">
            {t("creators.showingRange", { from: rangeFrom, to: rangeTo, total: filtered.length })}
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage(Math.max(1, safePage - 1))}
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 px-3 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={14} />
              {t("creators.previousPage")}
            </button>
            <span className="min-w-[7rem] text-center text-[11px] font-bold text-slate-600">
              {t("creators.pageOf", { page: safePage, pages: pageCount })}
            </span>
            <button
              type="button"
              disabled={safePage >= pageCount}
              onClick={() => setPage(Math.min(pageCount, safePage + 1))}
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 px-3 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("creators.nextPage")}
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Users size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-800">{t("creators.empty")}</h3>
          <p className="max-w-xs text-slate-500">{isCompany ? t("creators.emptyHintCompany") : t("creators.emptyHint")}</p>
        </div>
      ) : null}

      {modalOpen ? (
        <div className="app-modal-overlay fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-3 sm:p-4">
          <button type="button" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setModalOpen(false)} aria-label={tc("close")} />
          <div className="app-modal-panel relative z-10 my-auto flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-white p-5 sm:p-6">
              <h2 className="text-xl font-bold text-[#0F172A]">{t("creators.modalTitle")}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1 font-bold text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>
            <form noValidate className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6" onSubmit={onCreate}>
              {isCompany && user.company?.name ? (
                <p className="m-0 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
                  {t("creators.modalHintCompany", { company: user.company.name })}
                </p>
              ) : null}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("creators.fullName")}</label>
                  <input className="w-full rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm outline-none focus:border-brand-primary" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("creators.artisticName")}</label>
                  <input placeholder={t("creators.artisticPh")} className="w-full rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm outline-none focus:border-brand-primary" value={form.artistic_name} onChange={(e) => setForm({ ...form, artistic_name: e.target.value })} />
                </div>
                {isCompany ? null : (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("creators.cpf", { documents: formDocumentsLabel })}</label>
                  <input
                    placeholder={taxDocumentPlaceholder(form.country, formDocumentsLabel)}
                    maxLength={taxDocumentMaxLength(form.country)}
                    className="w-full rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm outline-none focus:border-brand-primary"
                    value={form.cpf}
                    onChange={(e) => setForm({ ...form, cpf: formatTaxDocument(form.country, e.target.value) })}
                  />
                </div>
                )}
                <div className={cn("flex flex-col gap-1.5", isCompany && "md:col-span-2")}>
                  <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("creators.email")}</label>
                  <input type="email" className="w-full rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm outline-none focus:border-brand-primary" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                {isCompany ? (
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("creators.password")}</label>
                    <PasswordField
                      autoComplete="new-password"
                      value={form.password}
                      placeholder={t("creators.passwordPh")}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      inputClassName="w-full rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm outline-none focus:border-brand-primary"
                    />
                    <p className="m-0 text-[11px] leading-snug text-[#64748B]">{t("creators.passwordHint")}</p>
                  </div>
                ) : null}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("creators.country")}</label>
                  <CountrySelect theme="light" value={form.country} onChange={(country) => setForm({ ...form, country, state: "", cpf: formatTaxDocument(country, form.cpf) })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("creators.region")}</label>
                  <RegionSelect theme="light" country={form.country} value={form.state} onChange={(state) => setForm({ ...form, state })} />
                </div>
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("creators.mainCategory")}</label>
                  <Select2Field
                    theme="light"
                    value={form.category}
                    options={CREATOR_CATEGORY_VALUES.map((cat) => ({ value: cat, label: categoryLabels[cat] ?? cat }))}
                    onChange={(value) => setForm({ ...form, category: value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("creators.photoUrl")}</label>
                  <input placeholder={t("creators.photoUrlPh")} className="w-full rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm outline-none focus:border-brand-primary" value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-3 border-t border-[#E2E8F0] pt-4">
                <button type="button" onClick={() => setModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-[#64748B] transition-all hover:text-[#0F172A]">
                  {tc("cancel")}
                </button>
                <button type="submit" className="rounded-lg bg-brand-primary px-8 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-600 active:scale-95">
                  {t("creators.saveRegister")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {passwordCreator ? <ChangeCreatorPasswordModal creator={passwordCreator} onClose={() => setPasswordCreator(null)} /> : null}
      {termCreator ? (
        <CreatorContractModal
          key={termCreator.id}
          isOpen
          readOnly
          creator={termCreator}
          onClose={() => setTermCreator(null)}
          creatorName={termCreator.full_name ?? undefined}
          creatorEmail={termCreator.email ?? undefined}
          creatorDocument={termCreator.document || termCreator.cpf || ""}
          creatorCountry={termCreator.country}
          existingAudit={creatorTermAudit(termCreator, i18n.language)}
        />
      ) : null}
    </div>
  );
}

export function CreatorsScreen() {
  return (
    <AuthenticatedShell>
      <CreatorsInner />
    </AuthenticatedShell>
  );
}
