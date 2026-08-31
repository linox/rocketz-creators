"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Clock, KeyRound, LayoutGrid, LayoutList, Plus, Repeat, Search, Trash2, Users } from "lucide-react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { ChangeCreatorPasswordModal } from "@/components/ChangeCreatorPasswordModal";
import { MoneyInput } from "@/components/MoneyInput";
import { Select2Field } from "@/components/Select2Field";
import { UserAvatar } from "@/components/UserAvatar";
import { api } from "@/lib/api";
import { alertApiError, alertConfirm, alertSuccess, alertWarning } from "@/lib/alerts";
import { cn } from "@/lib/cn";
import { formatIntegerMask, isValidEmail, parseIntegerMask, parseMoneyMask } from "@/lib/masks";
import { DEFAULT_COUNTRY, defaultCurrencyForCountry, formatLocation, formatMoneyGroups, hasRegions, isValidCountry, isValidRegion, moneyCurrency, normalizeCountry, normalizeRegion } from "@/lib/geo";
import { formatTaxDocument, isValidTaxDocument, taxDocumentMaxLength, taxDocumentPlaceholder, taxDocumentsLabel } from "@/lib/taxDocuments";
import { CountrySelect, RegionSelect } from "@/components/GeoSelectFields";
import { usePrivacy } from "@/lib/privacy";
import type { Creator, RecurringContract } from "@/lib/types";
import { CREATOR_CATEGORY_VALUES, creatorCategoryOptions } from "@/lib/creatorCategories";
import { useAuth } from "@/lib/use-auth";
import { userCanModerateCreator, userHasPermission } from "@/lib/auth";
import { intlLocale, normalizeLocale } from "@/i18n/locales";

const LAYOUT_STORAGE_KEY = "rocktz.creatorsCatalogLayout";
type CatalogLayout = "list" | "grid";

const EMPTY_FORM = { full_name: "", artistic_name: "", cpf: "", email: "", category: "UGC Content", photo_url: "", country: DEFAULT_COUNTRY, state: "" };

const FILTER_TRIGGER =
  "h-[42px] rounded-lg border-[#E2E8F0] bg-[#F9FAFB] px-4 text-xs font-bold tracking-wide text-[#64748B] uppercase";

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
      {formatCurrency(creator.pricing?.reel || 0, defaultCurrencyForCountry(creator.country))} <span className="text-[10px] font-medium text-[#64748B]">{t("creators.perReel")}</span>
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
          <div className="flex flex-col">
            <span className="mb-0.5 text-[10px] font-bold tracking-wider text-[#64748B] uppercase">{t("creators.followers")}</span>
            <span className="text-[14px] font-bold text-[#0F172A]">{formatNumber(metricValue(creator.metrics, ["followers", "instagram_followers", "tiktok_followers"]))}</span>
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
}) {
  const { t, i18n } = useTranslation("app");
  const { formatNumber } = usePrivacy();
  const creatorContracts = creatorRecurringContracts(creator, recurringContracts);
  const followers = formatNumber(metricValue(creator.metrics, ["followers", "instagram_followers", "tiktok_followers"]));
  const avgViews = formatNumber(metricValue(creator.metrics, ["avgViews", "avg_views"]));
  const companyNames = creatorContracts.map((c) => c.company?.name ?? c.title).join(", ");
  const location = formatLocation(intlLocale(normalizeLocale(i18n.language)), creator);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-white p-3.5 transition-all hover:border-brand-primary sm:flex-row sm:items-center sm:gap-4",
        creator.status === "review" ? "border-amber-300 bg-amber-50/10 ring-2 ring-amber-400/20" : "border-[#E2E8F0]",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
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
            <h3 className="m-0 truncate text-sm font-bold text-[#0F172A]">@{creator.artistic_name}</h3>
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
          {creator.full_name ? (
            <p className="m-0 truncate text-[11px] font-medium text-slate-500">{creator.full_name}</p>
          ) : null}
          {location ? <p className="m-0 truncate text-[11px] text-slate-400">{location}</p> : null}
          <div className="mt-1 flex flex-wrap gap-1">
            {orderedCreatorTags(creator.categories, highlightedCategory, 3).map((cat) => (
              <span key={cat} className={cn(creatorTagClass(cat, highlightedCategory), "px-1.5 text-[9px]")}>
                {cat}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center sm:gap-5">
        <div className="flex min-w-[72px] flex-col">
          <span className="text-[9px] font-bold tracking-wider text-[#64748B] uppercase">{t("creators.colFollowers")}</span>
          <span className="text-[13px] font-bold text-[#0F172A]">{followers}</span>
        </div>
        <div className="flex min-w-[72px] flex-col">
          <span className="text-[9px] font-bold tracking-wider text-[#64748B] uppercase">{t("creators.colAvgViews")}</span>
          <span className="text-[13px] font-bold text-[#0F172A]">{avgViews}</span>
        </div>
        <div className="col-span-2 flex min-w-[120px] flex-col sm:col-span-1 sm:max-w-[160px]">
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
        <div className="flex min-w-[88px] flex-col">
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
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-xs hover:bg-emerald-700 sm:flex-none"
          >
            <CheckCircle2 size={13} />
            {t("creators.approve")}
          </button>
          <button
            type="button"
            onClick={() => onReject(creator)}
            className="flex items-center justify-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100"
          >
            {t("creators.reject")}
          </button>
        </div>
      ) : null}

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#F1F5F9] pt-3 sm:border-0 sm:pt-0">
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
      </div>
    </motion.article>
  );
}

function CreatorsInner() {
  const user = useAuth();
  const { t } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const { t: tAuth } = useTranslation("auth");
  const isAdmin = user.role === "admin";
  const isCompany = user.role === "company";
  const canRemove = userHasPermission(user, "users.manage");
  const [creators, setCreators] = useState<Creator[]>([]);
  const [recurringContracts, setRecurringContracts] = useState<RecurringContract[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [minFollowers, setMinFollowers] = useState("");
  const [maxFollowers, setMaxFollowers] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const formDocumentsLabel = taxDocumentsLabel(form.country, tc("orConjunction"), tc("taxIdFallback"));
  const [passwordCreator, setPasswordCreator] = useState<Creator | null>(null);
  const [layout, setLayout] = useState<CatalogLayout>("list");
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

  async function load() {
    try {
      const [creatorsRes, recurringRes] = await Promise.all([
        api.creators(),
        api.recurring().catch(() => ({ data: [] as RecurringContract[] })),
      ]);
      setCreators(creatorsRes.data);
      setRecurringContracts(recurringRes.data);
    } catch (err) {
      await alertApiError(err);
    }
  }

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    if (params.get("filters") === "true") setShowAdvancedFilters(true);
    if (params.get("status")) setStatusFilter(params.get("status") ?? "all");
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (stored === "list" || stored === "grid") setLayout(stored);
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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return creators.filter((creator) => {
      const followers = metricValue(creator.metrics, ["followers", "instagram_followers", "tiktok_followers"]);
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
        regionFilter === "all" ||
        normalizeRegion(creator.state) === regionFilter;
      const matchesMinFollowers = !minFollowers || followers >= parseIntegerMask(minFollowers);
      const matchesMaxFollowers = !maxFollowers || followers <= parseIntegerMask(maxFollowers);
      const matchesMinPrice = !minPrice || reel >= parseMoneyMask(minPrice, filterCurrency);
      const matchesMaxPrice = !maxPrice || reel <= parseMoneyMask(maxPrice, filterCurrency);
      return matchesSearch && matchesStatus && matchesCategory && matchesCountry && matchesRegion && matchesMinFollowers && matchesMaxFollowers && matchesMinPrice && matchesMaxPrice;
    });
  }, [creators, search, statusFilter, categoryFilter, countryFilter, regionFilter, minFollowers, maxFollowers, minPrice, maxPrice, filterCurrency]);

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
    if (form.cpf && !isValidTaxDocument(form.country, form.cpf)) {
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
    try {
      await api.createCreator({
        full_name: form.full_name.trim(),
        artistic_name: form.artistic_name.replace(/^@/, "").trim(),
        email: form.email.trim(),
        cpf: form.cpf || null,
        photo_url: form.photo_url.trim() || null,
        category: form.category,
        instagram: form.artistic_name.replace(/^@/, "").trim(),
        country: form.country,
        state: form.state || null,
      });
      setModalOpen(false);
      setForm(EMPTY_FORM);
      await alertSuccess(t("creators.created"));
      load();
    } catch (err) {
      await alertApiError(err);
    }
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
            <>
            <button
              type="button"
              onClick={resetCasting}
              title={t("creators.resetHint")}
              className="flex h-11 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 text-xs font-bold text-rose-700 shadow-xs transition-all hover:bg-rose-100"
            >
              <Trash2 size={15} className="text-rose-600" />
              {t("creators.reset")}
            </button>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex h-11 items-center gap-2 rounded-lg bg-brand-primary px-6 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-600 active:scale-95"
            >
              <Plus size={18} />
              {t("creators.new")}
            </button>
            </>
          ) : null}
        </div>
      </header>

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

      <div className="flex flex-col items-center gap-4 rounded-[16px] border border-[#E2E8F0] bg-white p-6 shadow-sm lg:flex-row">
        <div className="relative w-full flex-1">
          <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("creators.search")}
            className="w-full rounded-lg border border-[#E2E8F0] py-2.5 pr-4 pl-10 text-sm outline-none transition-all focus:border-brand-primary"
          />
        </div>
        <div className="flex w-full flex-wrap gap-2 lg:w-auto">
          <Select2Field
            theme="light"
            searchable={false}
            value={categoryFilter}
            options={categoryOptions}
            onChange={setCategoryFilter}
            className="min-w-[200px] flex-1 lg:w-52 lg:flex-none"
            triggerClassName={FILTER_TRIGGER}
          />
          {isAdmin ? (
            <Select2Field
              theme="light"
              searchable={false}
              value={statusFilter}
              options={statusOptions}
              onChange={setStatusFilter}
              className="min-w-[200px] flex-1 lg:w-56 lg:flex-none"
              triggerClassName={FILTER_TRIGGER}
            />
          ) : isCompany ? (
            <Select2Field
              theme="light"
              searchable={false}
              value={statusFilter}
              options={statusOptions.filter((option) => option.value === "all" || option.value === "active" || option.value === "review")}
              onChange={setStatusFilter}
              className="min-w-[200px] flex-1 lg:w-56 lg:flex-none"
              triggerClassName={FILTER_TRIGGER}
            />
          ) : null}
          <CountrySelect
            theme="light"
            value={countryFilter}
            emptyLabel={t("creators.allCountries").toUpperCase()}
            onChange={(country) => {
              setCountryFilter(country);
              setRegionFilter("all");
            }}
            className="min-w-[200px] flex-1 lg:w-52 lg:flex-none"
            triggerClassName={FILTER_TRIGGER}
          />
          <RegionSelect
            theme="light"
            country={countryFilter}
            value={regionFilter}
            emptyLabel={t("creators.allRegions").toUpperCase()}
            onChange={setRegionFilter}
            className="min-w-[200px] flex-1 lg:w-52 lg:flex-none"
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

      <div className={cn(layout === "grid" ? "grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4" : "flex flex-col gap-2.5")}>
        {filtered.map((creator) =>
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
            />
          ),
        )}
      </div>

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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("creators.fullName")}</label>
                  <input className="w-full rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm outline-none focus:border-brand-primary" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("creators.artisticName")}</label>
                  <input placeholder={t("creators.artisticPh")} className="w-full rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm outline-none focus:border-brand-primary" value={form.artistic_name} onChange={(e) => setForm({ ...form, artistic_name: e.target.value })} />
                </div>
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
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("creators.email")}</label>
                  <input type="email" className="w-full rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm outline-none focus:border-brand-primary" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
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
