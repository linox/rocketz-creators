"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Archive,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Film,
  Image as ImageIcon,
  Inbox,
  LayoutList,
  Link2,
  Maximize2,
  MessageSquare,
  Play,
  Search,
  Send,
  Table2,
  X,
} from "lucide-react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { UserAvatar } from "@/components/UserAvatar";
import { alertApiError, alertConfirm, alertSuccess, alertWarning } from "@/lib/alerts";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  buildDeliveryInboxFromApi,
  countByFolder,
  dateGroupKey,
  formatInboxTime,
  formatInboxPeriod,
  isUnread,
  needsAction,
  matchesFolder,
  persistDeliveryArchived,
  persistDeliveryViewed,
  type DeliveryContentType,
  type DeliveryInboxItem,
  type DeliveryStatus,
  type DeliveryVersion,
  type InboxFolder,
  type InboxQuickFilter,
  type InboxSourceFilter,
  type InboxViewMode,
} from "@/lib/delivery-inbox";
import { intlLocale, normalizeLocale } from "@/i18n/locales";

function contentIcon(type: DeliveryContentType) {
  if (type === "script" || type === "caption") return FileText;
  if (type === "image" || type === "carousel") return ImageIcon;
  if (type === "link") return Link2;
  if (type === "file") return Archive;
  return Film;
}

function statusTone(status: DeliveryStatus) {
  switch (status) {
    case "pending_approval":
    case "new_version":
    case "unread":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "revision_requested":
      return "border-purple-200 bg-purple-50 text-purple-800";
    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "overdue":
      return "border-rose-200 bg-rose-50 text-rose-800";
    case "archived":
      return "border-slate-200 bg-slate-100 text-slate-600";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function DeliveriesInboxInner() {
  const { t, i18n } = useTranslation("app");
  const locale = intlLocale(normalizeLocale(i18n.language));

  const [items, setItems] = useState<DeliveryInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [folder, setFolder] = useState<InboxFolder>("all");
  const [sourceFilter, setSourceFilter] = useState<InboxSourceFilter>("all");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState<InboxQuickFilter>("all");
  const [viewMode, setViewMode] = useState<InboxViewMode>("inbox");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionText, setRevisionText] = useState("");
  const [commentText, setCommentText] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [companiesExpanded, setCompaniesExpanded] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  async function loadInbox() {
    setLoading(true);
    try {
      const [campaignsRes, recurringRes] = await Promise.all([api.campaigns(), api.recurring()]);
      setItems(buildDeliveryInboxFromApi(campaignsRes.data, recurringRes.data));
    } catch (err) {
      await alertApiError(err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInbox();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "recurring") setSourceFilter("recurring");
  }, []);

  const actorName = "Rocketz";

  async function approveOnApi(item: DeliveryInboxItem) {
    if (item.planningItemId) {
      if (item.approvalStage === "script") {
        await api.updatePlanningItem(item.planningItemId, {
          script_status: "approved",
          script_feedback: "",
          status: "in_production",
          feedback_note: "",
        });
        return;
      }
      if (item.approvalStage === "video") {
        await api.updatePlanningItem(item.planningItemId, {
          video_status: "approved",
          video_feedback: "",
          status: "approved",
          feedback_note: "",
        });
        return;
      }
      await api.updatePlanningItem(item.planningItemId, { status: "approved", feedback_note: "" });
      return;
    }
    if (!item.participationId) return;
    if (item.approvalStage === "script") {
      await api.updateParticipation(item.participationId, { script_status: "approved", script_feedback: "" });
      return;
    }
    await api.updateParticipation(item.participationId, {
      delivery_status: "approved",
      video_status: "approved",
      script_status: "approved",
      revision_details: "",
      script_feedback: "",
      video_feedback: "",
    });
  }

  async function reviseOnApi(item: DeliveryInboxItem, note: string) {
    if (item.planningItemId) {
      if (item.approvalStage === "script") {
        await api.updatePlanningItem(item.planningItemId, {
          script_status: "revision",
          script_feedback: note,
          status: "in_production",
          feedback_note: note,
        });
        return;
      }
      if (item.approvalStage === "video") {
        await api.updatePlanningItem(item.planningItemId, {
          video_status: "revision",
          video_feedback: note,
          status: "in_production",
          feedback_note: note,
        });
        return;
      }
      await api.updatePlanningItem(item.planningItemId, { status: "in_production", feedback_note: note });
      return;
    }
    if (!item.participationId) return;
    if (item.approvalStage === "script") {
      await api.updateParticipation(item.participationId, {
        script_status: "revision",
        script_feedback: note,
        revision_details: note,
      });
      return;
    }
    await api.updateParticipation(item.participationId, {
      delivery_status: "revision",
      video_status: "revision",
      revision_details: note,
      video_feedback: note,
    });
  }

  const companies = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const item of items) {
      if (item.archived) continue;
      const row = map.get(item.companyId) ?? { id: item.companyId, name: item.companyName, count: 0 };
      row.count += 1;
      map.set(item.companyId, row);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [items]);

  const companySources = useMemo(() => {
    if (!companyId) return [];
    const map = new Map<string, { id: string; name: string; type: string; count: number }>();
    for (const item of items) {
      if (item.companyId !== companyId || item.archived) continue;
      const row = map.get(item.sourceId) ?? {
        id: item.sourceId,
        name: item.sourceName,
        type: item.sourceType,
        count: 0,
      };
      row.count += 1;
      map.set(item.sourceId, row);
    }
    return [...map.values()];
  }, [items, companyId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const weekAgo = new Date(startToday);
    weekAgo.setDate(weekAgo.getDate() - 7);

    return items
      .filter((item) => matchesFolder(item, folder))
      .filter((item) => (sourceFilter === "all" ? true : item.sourceType === sourceFilter))
      .filter((item) => (companyId ? item.companyId === companyId : true))
      .filter((item) => (sourceId ? item.sourceId === sourceId : true))
      .filter((item) => {
        if (!term) return true;
        return [
          item.creatorName,
          item.companyName,
          item.sourceName,
          item.title,
          item.formatLabel,
        ].join(" ").toLowerCase().includes(term);
      })
      .filter((item) => {
        const created = new Date(item.createdAt);
        if (quick === "pending") {
          return ["pending_approval", "new_version", "unread", "revision_requested", "overdue"].includes(item.status);
        }
        if (quick === "today") return created >= startToday;
        if (quick === "week") return created >= weekAgo;
        return true;
      })
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [items, folder, sourceFilter, companyId, sourceId, search, quick]);

  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null;
  const activeVersion =
    selected?.versions.find((v) => v.id === versionId)
    ?? selected?.versions.find((v) => v.versionNumber === selected.currentVersion)
    ?? selected?.versions[0]
    ?? null;

  useEffect(() => {
    if (!selectedId) {
      if (filtered[0]) setSelectedId(filtered[0].id);
      return;
    }
    if (!filtered.some((item) => item.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
    }
  }, [filtered, selectedId]);

  useEffect(() => {
    if (!selected) return;
    setVersionId(selected.versions.find((v) => v.versionNumber === selected.currentVersion)?.id ?? selected.versions[0]?.id ?? null);
    setCarouselIndex(0);
    setRevisionOpen(false);
  }, [selected?.id]);

  function patchItem(id: string, updater: (item: DeliveryInboxItem) => DeliveryInboxItem) {
    setItems((prev) => prev.map((item) => (item.id === id ? updater(item) : item)));
  }

  function openDelivery(item: DeliveryInboxItem) {
    setSelectedId(item.id);
    setMobileShowDetail(true);
    if (!item.viewedAt) {
      const now = new Date().toISOString();
      persistDeliveryViewed(item.id, now);
      patchItem(item.id, (row) => ({
        ...row,
        viewedAt: now,
        status: row.status === "unread" ? "pending_approval" : row.status,
        activity: [
          ...row.activity,
          {
            id: `view-${Date.now()}`,
            type: "viewed",
            userName: actorName,
            message: t("deliveries.inbox.activityViewed"),
            createdAt: now,
          },
        ],
      }));
    }
  }

  async function approveSelected() {
    if (!selected || busy) return;
    const isScriptStage = selected.approvalStage === "script";
    const confirmTitle = isScriptStage ? t("deliveries.inbox.approveScriptTitle") : t("deliveries.inbox.approveConfirmTitle");
    const confirmText = isScriptStage ? t("deliveries.inbox.approveScriptText") : t("deliveries.inbox.approveConfirmText");
    if (!(await alertConfirm(confirmTitle, confirmText, t("deliveries.inbox.approve")))) return;
    setBusy(true);
    try {
      await approveOnApi(selected);
      const now = new Date().toISOString();
      patchItem(selected.id, (row) => ({
        ...row,
        status: "approved",
        viewedAt: row.viewedAt ?? now,
        activity: [
          ...row.activity,
          {
            id: `ap-${Date.now()}`,
            type: "approved",
            userName: actorName,
            message: isScriptStage
              ? t("deliveries.inbox.activityApprovedScript")
              : t("deliveries.inbox.activityApproved", { version: row.currentVersion }),
            createdAt: now,
          },
        ],
      }));
      await alertSuccess(
        isScriptStage ? t("deliveries.inbox.scriptApprovedWaiting") : t("deliveries.inbox.approvedOk"),
      );
      const idx = filtered.findIndex((item) => item.id === selected.id);
      const next = filtered[idx + 1] ?? filtered[idx - 1] ?? null;
      if (next) openDelivery(next);
      void loadInbox();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setBusy(false);
    }
  }

  async function sendRevision() {
    if (!selected || !revisionText.trim()) {
      await alertWarning(t("deliveries.inbox.revisionRequiredTitle"), t("deliveries.inbox.revisionRequiredText"));
      return;
    }
    if (busy) return;
    setBusy(true);
    const note = revisionText.trim();
    try {
      await reviseOnApi(selected, note);
      const now = new Date().toISOString();
      patchItem(selected.id, (row) => ({
        ...row,
        status: "revision_requested",
        activity: [
          ...row.activity,
          {
            id: `rev-${Date.now()}`,
            type: "revision",
            userName: actorName,
            message: note,
            createdAt: now,
          },
        ],
      }));
      setRevisionText("");
      setRevisionOpen(false);
      await alertSuccess(t("deliveries.inbox.revisionSent"));
      void loadInbox();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setBusy(false);
    }
  }

  async function addComment() {
    if (!selected || !commentText.trim()) return;
    const now = new Date().toISOString();
    patchItem(selected.id, (row) => ({
      ...row,
      activity: [
        ...row.activity,
        {
          id: `cm-${Date.now()}`,
          type: "comment",
          userName: actorName,
          message: commentText.trim(),
          createdAt: now,
        },
      ],
    }));
    setCommentText("");
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function bulkMarkRead() {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((item) => {
      if (!selectedIds.includes(item.id)) return item;
      persistDeliveryViewed(item.id, item.viewedAt ?? now);
      return {
        ...item,
        viewedAt: item.viewedAt ?? now,
        status: item.status === "unread" ? "pending_approval" : item.status,
      };
    }));
    setSelectedIds([]);
  }

  async function bulkArchive() {
    setItems((prev) => prev.map((item) => {
      if (!selectedIds.includes(item.id)) return item;
      persistDeliveryArchived(item.id, true);
      return { ...item, archived: true, status: "archived" };
    }));
    setSelectedIds([]);
  }

  async function bulkApprove() {
    if (!(await alertConfirm(t("deliveries.inbox.approveConfirmTitle"), t("deliveries.inbox.bulkApproveText"), t("deliveries.inbox.approve")))) return;
    if (busy) return;
    setBusy(true);
    const now = new Date().toISOString();
    const targets = items.filter((item) => selectedIds.includes(item.id));
    try {
      for (const item of targets) {
        await approveOnApi(item);
      }
      setItems((prev) => prev.map((item) => (
        selectedIds.includes(item.id)
          ? {
              ...item,
              status: "approved",
              viewedAt: item.viewedAt ?? now,
              activity: [
                ...item.activity,
                {
                  id: `bap-${item.id}-${Date.now()}`,
                  type: "approved" as const,
                  userName: actorName,
                  message: t("deliveries.inbox.activityApproved", { version: item.currentVersion }),
                  createdAt: now,
                },
              ],
            }
          : item
      )));
      setSelectedIds([]);
      await alertSuccess(t("deliveries.inbox.approvedOk"));
      void loadInbox();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setBusy(false);
    }
  }

  const grouped = useMemo(() => {
    const groups: Record<"today" | "yesterday" | "week" | "older", DeliveryInboxItem[]> = {
      today: [],
      yesterday: [],
      week: [],
      older: [],
    };
    for (const item of filtered) groups[dateGroupKey(item.createdAt)].push(item);
    return groups;
  }, [filtered]);

  const summary = {
    all: countByFolder(items, "all"),
    pending: countByFolder(items, "pending_approval"),
    revision: countByFolder(items, "revision_requested"),
    unread: countByFolder(items, "unread"),
    overdue: countByFolder(items, "overdue"),
  };

  const visibleCompanies = companiesExpanded ? companies : companies.slice(0, 4);
  const extraFiltersActive = sourceFilter !== "all" || companyId !== null || sourceId !== null || quick !== "all";
  const activeExtraCount = [sourceFilter !== "all", companyId !== null, sourceId !== null, quick !== "all"].filter(Boolean).length;

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-t-2 border-b-2 border-brand-primary" />
        <p className="m-0 text-sm font-medium text-slate-500">{t("deliveries.inbox.loading")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-var(--app-header-h)-var(--app-bottom-nav-h)-1.25rem)] min-h-[24rem] flex-col gap-3 overflow-hidden">
      <header className="flex shrink-0 flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-xs font-bold tracking-wider text-brand-primary uppercase">
            <Inbox size={14} className="shrink-0" /> {t("deliveries.inbox.eyebrow")}
          </div>
          <h1 className="m-0 text-xl font-bold tracking-tight text-[#0F172A] sm:text-[28px]">{t("deliveries.inbox.title")}</h1>
          <p className="mt-1 max-w-2xl text-[14px] text-[#64748B]">{t("deliveries.inbox.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => void alertWarning(t("deliveries.inbox.newDeliveryTitle"), t("deliveries.inbox.newDeliveryHint"))}
          className="inline-flex h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-primary px-5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-600 active:scale-95"
        >
          + {t("deliveries.inbox.newDelivery")}
        </button>
      </header>

      <div className="flex shrink-0 flex-col gap-1.5 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative min-w-[10rem] flex-1">
            <Search size={13} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("deliveries.inbox.searchPh")}
              className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 pr-2 pl-8 text-xs outline-none focus:border-brand-primary focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-0.5">
            {([
              ["all", t("deliveries.inbox.quickAll")],
              ["pending", t("deliveries.inbox.quickPending")],
              ["today", t("deliveries.inbox.quickToday")],
              ["week", t("deliveries.inbox.quickWeek")],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setQuick(key)}
                className={cn("rounded-md px-2 py-1 text-[10px] font-bold whitespace-nowrap", quick === key ? "bg-indigo-100 text-indigo-700" : "text-slate-500 hover:bg-slate-100")}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-[10px] font-bold",
              filtersOpen || extraFiltersActive ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-white",
            )}
          >
            <Filter size={12} />
            {t("deliveries.inbox.filters")}
            {extraFiltersActive ? <span className="rounded-full bg-indigo-600 px-1.5 text-[9px] text-white">{activeExtraCount}</span> : null}
            <ChevronDown size={12} className={cn("transition", filtersOpen && "rotate-180")} />
          </button>

          <div className="flex shrink-0 rounded-lg border border-slate-200 bg-slate-100 p-0.5">
            <button type="button" onClick={() => setViewMode("inbox")} className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold", viewMode === "inbox" ? "bg-white text-brand-primary shadow-sm" : "text-slate-500")}>
              <Inbox size={12} /> {t("deliveries.inbox.modeInbox")}
            </button>
            <button type="button" onClick={() => setViewMode("table")} className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold", viewMode === "table" ? "bg-white text-brand-primary shadow-sm" : "text-slate-500")}>
              <Table2 size={12} /> {t("deliveries.inbox.modeTable")}
            </button>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {([
            ["all", summary.all, t("deliveries.inbox.statAll")],
            ["pending_approval", summary.pending, t("deliveries.inbox.statPending")],
            ["revision_requested", summary.revision, t("deliveries.inbox.statRevision")],
            ["unread", summary.unread, t("deliveries.inbox.statUnread")],
            ["overdue", summary.overdue, t("deliveries.inbox.statOverdue")],
            ["approved", countByFolder(items, "approved"), t("deliveries.inbox.folder.approved")],
            ["archived", countByFolder(items, "archived"), t("deliveries.inbox.folder.archived")],
          ] as const).map(([key, count, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFolder(key)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap transition",
                folder === key ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-white",
              )}
            >
              <span className="font-black text-slate-900">{count}</span>
              {label}
            </button>
          ))}
        </div>

        {filtersOpen ? (
          <div className="space-y-1.5 border-t border-slate-100 pt-1.5">
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-[9px] font-extrabold tracking-wider text-slate-400 uppercase">{t("deliveries.inbox.type")}</span>
              {([
                ["all", t("deliveries.inbox.typeAll")],
                ["campaign", t("deliveries.inbox.typeCampaign")],
                ["recurring", t("deliveries.inbox.typeRecurring")],
              ] as const).map(([key, label]) => (
                <Chip
                  key={key}
                  label={label}
                  active={sourceFilter === key}
                  onClick={() => { setSourceFilter(key); setSourceId(null); }}
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-[9px] font-extrabold tracking-wider text-slate-400 uppercase">{t("deliveries.inbox.companies")}</span>
              <Chip
                label={t("deliveries.inbox.allCompanies")}
                active={!companyId}
                onClick={() => { setCompanyId(null); setSourceId(null); }}
              />
              {visibleCompanies.map((company) => (
                <Chip
                  key={company.id}
                  label={company.name}
                  count={company.count}
                  active={companyId === company.id}
                  onClick={() => { setCompanyId(company.id); setSourceId(null); }}
                />
              ))}
              {companies.length > 4 ? (
                <button type="button" onClick={() => setCompaniesExpanded((v) => !v)} className="rounded-lg px-2 py-0.5 text-[10px] font-bold text-indigo-600 hover:underline">
                  {companiesExpanded ? t("deliveries.inbox.showLess") : t("deliveries.inbox.viewAll")}
                </button>
              ) : null}
            </div>

            {companyId ? (
              <div className="flex flex-wrap items-center gap-1">
                <span className="mr-1 text-[9px] font-extrabold tracking-wider text-slate-400 uppercase">{t("deliveries.inbox.campaignsWorks")}</span>
                <Chip
                  label={t("deliveries.inbox.allFromCompany")}
                  active={!sourceId}
                  onClick={() => setSourceId(null)}
                />
                {companySources.map((source) => (
                  <Chip
                    key={source.id}
                    label={source.name}
                    count={source.count}
                    active={sourceId === source.id}
                    onClick={() => setSourceId(source.id)}
                  />
                ))}
              </div>
            ) : null}

            {extraFiltersActive ? (
              <button
                type="button"
                onClick={() => {
                  setSourceFilter("all");
                  setCompanyId(null);
                  setSourceId(null);
                  setQuick("all");
                }}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-indigo-600"
              >
                <X size={11} /> {t("deliveries.inbox.clearFilters")}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {selectedIds.length > 0 ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-800">
          <span>{t("deliveries.inbox.selectedCount", { count: selectedIds.length })}</span>
          <button type="button" onClick={() => void bulkMarkRead()} className="rounded-lg bg-white px-2.5 py-1 hover:bg-indigo-100">{t("deliveries.inbox.markRead")}</button>
          <button type="button" onClick={() => void bulkApprove()} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-white hover:bg-emerald-700">{t("deliveries.inbox.approve")}</button>
          <button type="button" onClick={() => void bulkArchive()} className="rounded-lg bg-white px-2.5 py-1 hover:bg-indigo-100">{t("deliveries.inbox.archive")}</button>
          <button type="button" onClick={() => setSelectedIds([])} className="ml-auto text-indigo-600">{t("deliveries.inbox.clearSelection")}</button>
        </div>
      ) : null}

      {viewMode === "table" ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <TableView
            items={filtered}
            selectedId={selected?.id ?? null}
            selectedIds={selectedIds}
            locale={locale}
            onOpen={openDelivery}
            onToggle={toggleSelect}
            t={t}
          />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] xl:grid-cols-[minmax(340px,420px)_minmax(0,1fr)]">
          <section className={cn("flex min-h-0 flex-col overflow-hidden border-b border-slate-200 lg:border-r lg:border-b-0", mobileShowDetail && selected ? "hidden lg:flex" : "flex")}>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
                  <Inbox size={28} className="text-slate-300" />
                  <p className="m-0 text-sm font-bold text-slate-700">{t("deliveries.inbox.emptyTitle")}</p>
                  <p className="m-0 text-xs text-slate-400">{t("deliveries.inbox.emptyHint")}</p>
                </div>
              ) : (
                (["today", "yesterday", "week", "older"] as const).map((group) => (
                  grouped[group].length ? (
                    <div key={group}>
                      <div className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50/95 px-3 py-1.5 text-[10px] font-extrabold tracking-wider text-slate-500 uppercase backdrop-blur">
                        {t(`deliveries.inbox.group.${group}`)}
                      </div>
                      {grouped[group].map((item) => (
                        <InboxRow
                          key={item.id}
                          item={item}
                          active={selected?.id === item.id}
                          checked={selectedIds.includes(item.id)}
                          locale={locale}
                          onOpen={() => openDelivery(item)}
                          onToggle={() => toggleSelect(item.id)}
                          t={t}
                        />
                      ))}
                    </div>
                  ) : null
                ))
              )}
            </div>
          </section>

          <section className={cn("min-h-0 min-w-0 overflow-hidden", mobileShowDetail && selected ? "flex" : "hidden lg:flex")}>
            {selected && activeVersion ? (
              <ReadingPane
                item={selected}
                version={activeVersion}
                locale={locale}
                revisionOpen={revisionOpen}
                revisionText={revisionText}
                commentText={commentText}
                detailsOpen={detailsOpen}
                carouselIndex={carouselIndex}
                onBack={() => setMobileShowDetail(false)}
                onVersion={(id) => setVersionId(id)}
                onApprove={() => void approveSelected()}
                onToggleRevision={() => setRevisionOpen((v) => !v)}
                onRevisionText={setRevisionText}
                onSendRevision={() => void sendRevision()}
                onCommentText={setCommentText}
                onSendComment={() => void addComment()}
                onToggleDetails={() => setDetailsOpen((v) => !v)}
                onCarouselIndex={setCarouselIndex}
                onNext={() => {
                  const idx = filtered.findIndex((item) => item.id === selected.id);
                  const next = filtered[idx + 1];
                  if (next) openDelivery(next);
                }}
                t={t}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-slate-400">
                <LayoutList size={32} />
                <p className="m-0 text-sm font-bold text-slate-600">{t("deliveries.inbox.selectHint")}</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap transition",
        active ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-white",
      )}
    >
      <span className="truncate">{label}</span>
      {typeof count === "number" ? <span className="shrink-0 text-[10px] font-bold text-slate-400">{count}</span> : null}
    </button>
  );
}

function InboxRow({
  item,
  active,
  checked,
  locale,
  onOpen,
  onToggle,
  t,
}: {
  item: DeliveryInboxItem;
  active: boolean;
  checked: boolean;
  locale: string;
  onOpen: () => void;
  onToggle: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const unread = isUnread(item);
  const actionNeeded = needsAction(item);
  const Icon = contentIcon(item.contentType);
  return (
    <div
      className={cn(
        "relative flex cursor-pointer gap-2 border-b border-slate-100 px-2 py-2.5 transition hover:bg-slate-50",
        active && "bg-indigo-50/70",
        unread && "bg-violet-50/70",
        actionNeeded && !active && "bg-amber-50/50",
        actionNeeded && "border-l-[3px] border-l-amber-500 pl-[5px]",
      )}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
      role="button"
      tabIndex={0}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => { e.stopPropagation(); onToggle(); }}
        onClick={(e) => e.stopPropagation()}
        className="mt-2 h-3.5 w-3.5 shrink-0 accent-indigo-600"
      />
      <div className="relative mt-0.5 shrink-0">
        <UserAvatar src={item.creatorPhoto} name={item.creatorName} size="custom" shape="circle" className="h-8 w-8" textClassName="text-[10px]" />
        {unread ? <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-violet-600 ring-2 ring-white" /> : null}
        {actionNeeded ? <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className={cn("truncate text-[12px] text-slate-800", unread || actionNeeded ? "font-black" : "font-bold")}>{item.creatorName}</span>
          <span className="shrink-0 text-[10px] font-semibold text-slate-400">
            {dateGroupKey(item.createdAt) === "today" || dateGroupKey(item.createdAt) === "yesterday"
              ? `${dateGroupKey(item.createdAt) === "today" ? t("deliveries.inbox.todayShort") : t("deliveries.inbox.yesterdayShort")} ${formatInboxTime(item.createdAt, locale)}`
              : formatInboxTime(item.createdAt, locale)}
          </span>
        </div>
        <p className="m-0 truncate text-[10px] text-slate-500">
          {item.companyName} · {item.sourceName}
          {item.period ? ` · ${formatInboxPeriod(item.period, locale)}` : ""}
        </p>
        <p className={cn("m-0 truncate text-[12px] text-slate-900", unread || actionNeeded ? "font-extrabold" : "font-semibold")}>{item.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {item.period ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-slate-600 uppercase">
              {formatInboxPeriod(item.period, locale)}
            </span>
          ) : null}
          {item.stagePart && item.stageTotal ? (
            <span className="rounded-full border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-extrabold text-indigo-700 uppercase">
              {t("deliveries.inbox.stagePart", {
                part: item.stagePart,
                total: item.stageTotal,
                label: item.approvalStage === "script" ? t("deliveries.inbox.stageScript") : t("deliveries.inbox.stageVideo"),
              })}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500">
            <Icon size={11} /> {t(`deliveries.inbox.content.${item.contentType}`)} · V{item.currentVersion}
          </span>
          <span className={cn("rounded-full border px-1.5 py-0.5 text-[9px] font-extrabold uppercase", statusTone(item.status))}>
            {t(`deliveries.inbox.status.${item.status}`)}
          </span>
          {actionNeeded ? (
            <span className="rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-900 uppercase">
              {t("deliveries.inbox.needsActionBadge")}
            </span>
          ) : null}
        </div>
        {actionNeeded ? (
          <p className="mt-1 mb-0 text-[10px] font-semibold text-amber-800">{t("deliveries.inbox.needsActionHint")}</p>
        ) : null}
      </div>
    </div>
  );
}

function ReadingPane({
  item,
  version,
  locale,
  revisionOpen,
  revisionText,
  commentText,
  detailsOpen,
  carouselIndex,
  onBack,
  onVersion,
  onApprove,
  onToggleRevision,
  onRevisionText,
  onSendRevision,
  onCommentText,
  onSendComment,
  onToggleDetails,
  onCarouselIndex,
  onNext,
  t,
}: {
  item: DeliveryInboxItem;
  version: DeliveryVersion;
  locale: string;
  revisionOpen: boolean;
  revisionText: string;
  commentText: string;
  detailsOpen: boolean;
  carouselIndex: number;
  onBack: () => void;
  onVersion: (id: string) => void;
  onApprove: () => void;
  onToggleRevision: () => void;
  onRevisionText: (value: string) => void;
  onSendRevision: () => void;
  onCommentText: (value: string) => void;
  onSendComment: () => void;
  onToggleDetails: () => void;
  onCarouselIndex: (value: number) => void;
  onNext: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const images = version.imageUrls ?? (version.thumbnailUrl || version.fileUrl ? [version.thumbnailUrl || version.fileUrl!] : []);
  const isVertical = item.contentType === "video" || item.contentType === "story";

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-slate-100 px-4 py-3">
        <div className="flex items-start gap-3">
          <button type="button" onClick={onBack} className="mt-1 rounded-lg border border-slate-200 p-1.5 text-slate-500 lg:hidden">
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-[11px] font-semibold text-slate-400">
              {item.companyName} / {item.sourceName}
            </p>
            <h2 className="m-0 mt-0.5 text-lg font-black text-slate-900">{item.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <UserAvatar src={item.creatorPhoto} name={item.creatorName} size="custom" shape="circle" className="h-7 w-7" textClassName="text-[10px]" />
              <span className="text-xs font-bold text-slate-800">{item.creatorName}</span>
              <span className="text-[11px] text-slate-400">
                {t("deliveries.inbox.sentAt", { date: new Date(item.createdAt).toLocaleString(locale) })}
              </span>
              {item.period ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-extrabold text-slate-600 uppercase">
                  {formatInboxPeriod(item.period, locale)}
                </span>
              ) : null}
              {item.stagePart && item.stageTotal ? (
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold text-indigo-700 uppercase">
                  {t("deliveries.inbox.stagePart", {
                    part: item.stagePart,
                    total: item.stageTotal,
                    label: item.approvalStage === "script" ? t("deliveries.inbox.stageScript") : t("deliveries.inbox.stageVideo"),
                  })}
                </span>
              ) : null}
              <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase", statusTone(item.status))}>
                {t(`deliveries.inbox.status.${item.status}`)}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                {item.sourceType === "campaign" ? t("deliveries.inbox.typeCampaign") : t("deliveries.inbox.typeRecurring")}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {item.status !== "approved" ? (
            <button type="button" onClick={onApprove} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-emerald-700">
              <Check size={14} /> {item.approvalStage === "script" ? t("deliveries.inbox.approveScript") : t("deliveries.inbox.approve")}
            </button>
          ) : null}
          <button type="button" onClick={onToggleRevision} className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-4 py-2.5 text-xs font-extrabold text-purple-700 hover:bg-purple-100">
            <MessageSquare size={14} /> {t("deliveries.inbox.requestRevision")}
          </button>
          <button type="button" onClick={() => document.getElementById("delivery-comment")?.focus()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50">
            <MessageSquare size={14} /> {t("deliveries.inbox.comment")}
          </button>
          {item.status === "approved" ? (
            <button type="button" onClick={onNext} className="ml-auto inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-xs font-extrabold text-indigo-700">
              {t("deliveries.inbox.nextDelivery")} <ChevronRight size={14} />
            </button>
          ) : null}
        </div>

        {revisionOpen ? (
          <div className="mt-3 rounded-xl border border-purple-200 bg-purple-50/50 p-3">
            <h4 className="m-0 text-sm font-black text-purple-900">{t("deliveries.inbox.revisionTitle")}</h4>
            <textarea
              value={revisionText}
              onChange={(e) => onRevisionText(e.target.value)}
              rows={3}
              placeholder={t("deliveries.inbox.revisionPh")}
              className="mt-2 w-full rounded-lg border border-purple-200 bg-white p-3 text-sm outline-none focus:border-purple-400"
            />
            <button type="button" onClick={onSendRevision} className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-purple-700">
              <Send size={13} /> {t("deliveries.inbox.sendRevision")}
            </button>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          {(item.contentType === "video" || item.contentType === "story") && version.fileUrl ? (
            <div className={cn("mx-auto overflow-hidden rounded-lg bg-black", isVertical ? "aspect-[9/16] max-h-[420px] max-w-[240px]" : "aspect-video max-w-xl")}>
              <video src={version.fileUrl} controls className="h-full w-full object-contain" />
            </div>
          ) : null}

          {item.contentType === "image" && (version.fileUrl || version.thumbnailUrl) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={version.fileUrl || version.thumbnailUrl || ""} alt={item.title} className="mx-auto max-h-[420px] rounded-lg object-contain" />
          ) : null}

          {item.contentType === "carousel" && images.length ? (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={images[carouselIndex]} alt="" className="mx-auto max-h-[380px] rounded-lg object-contain" />
              <div className="flex items-center justify-center gap-2">
                <button type="button" disabled={carouselIndex <= 0} onClick={() => onCarouselIndex(carouselIndex - 1)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs disabled:opacity-40">‹</button>
                <span className="text-[11px] font-bold text-slate-500">{carouselIndex + 1}/{images.length}</span>
                <button type="button" disabled={carouselIndex >= images.length - 1} onClick={() => onCarouselIndex(carouselIndex + 1)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs disabled:opacity-40">›</button>
              </div>
            </div>
          ) : null}

          {(item.contentType === "script" || item.contentType === "caption") ? (
            <pre className="m-0 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-700">
              {version.scriptText || version.captionText || "—"}
            </pre>
          ) : null}

          {item.contentType === "link" && version.linkUrl ? (
            <a href={version.linkUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:underline">
              <ExternalLink size={14} /> {version.linkUrl}
            </a>
          ) : null}

          {item.contentType === "file" || item.contentType === "other" ? (
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
              <Archive size={20} className="text-slate-500" />
              <div>
                <p className="m-0 text-sm font-bold text-slate-800">{version.fileName || item.title}</p>
                <p className="m-0 text-xs text-slate-400">{t("deliveries.inbox.fileHint")}</p>
              </div>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            {version.fileName ? <span className="font-semibold">{version.fileName}</span> : null}
            <span>{t("deliveries.inbox.versionLabel", { n: version.versionNumber })}</span>
            {version.durationLabel ? <span>{t("deliveries.inbox.duration", { value: version.durationLabel })}</span> : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {version.fileUrl ? (
              <>
                <a href={version.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50">
                  <Play size={12} /> {t("deliveries.inbox.watch")}
                </a>
                <a href={version.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50">
                  <Maximize2 size={12} /> {t("deliveries.inbox.fullscreen")}
                </a>
                <a href={version.fileUrl} download className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50">
                  <Download size={12} /> {t("deliveries.inbox.download")}
                </a>
              </>
            ) : null}
          </div>
        </div>

        <div>
          <h3 className="m-0 text-xs font-extrabold tracking-wider text-slate-500 uppercase">{t("deliveries.inbox.versions")}</h3>
          <div className="mt-2 flex flex-col gap-1">
            {item.versions.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => onVersion(v.id)}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs",
                  version.id === v.id ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white hover:bg-slate-50",
                )}
              >
                <span className="font-bold text-slate-800">
                  V{v.versionNumber}
                  {v.versionNumber === item.currentVersion ? <span className="ml-2 text-[10px] font-extrabold text-indigo-600 uppercase">{t("deliveries.inbox.current")}</span> : null}
                </span>
                <span className="text-[10px] text-slate-400">{new Date(v.createdAt).toLocaleString(locale)}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="m-0 text-xs font-extrabold tracking-wider text-slate-500 uppercase">{t("deliveries.inbox.activity")}</h3>
          <div className="mt-2 space-y-3 border-l border-slate-200 pl-3">
            {[...item.activity].reverse().map((act) => (
              <div key={act.id}>
                <p className="m-0 text-xs font-bold text-slate-800">{act.userName}</p>
                <p className="m-0 text-[11px] text-slate-500">{act.message}</p>
                <p className="m-0 text-[10px] text-slate-400">{new Date(act.createdAt).toLocaleString(locale)}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              id="delivery-comment"
              value={commentText}
              onChange={(e) => onCommentText(e.target.value)}
              placeholder={t("deliveries.inbox.commentPh")}
              className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-brand-primary"
            />
            <button type="button" onClick={onSendComment} className="rounded-lg bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-800">
              {t("deliveries.inbox.comment")}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200">
          <button type="button" onClick={onToggleDetails} className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-extrabold tracking-wider text-slate-500 uppercase">
            {t("deliveries.inbox.details")}
            <ChevronDown size={14} className={cn(detailsOpen && "rotate-180")} />
          </button>
          {detailsOpen ? (
            <div className="grid grid-cols-1 gap-2 border-t border-slate-100 px-3 py-3 text-xs sm:grid-cols-2">
              <Detail label={t("deliveries.inbox.detailCompany")} value={item.companyName} />
              <Detail label={t("deliveries.inbox.detailSource")} value={item.sourceName} />
              <Detail label={t("deliveries.inbox.detailCreator")} value={item.creatorName} />
              <Detail label={t("deliveries.inbox.detailType")} value={item.sourceType === "campaign" ? t("deliveries.inbox.typeCampaign") : t("deliveries.inbox.typeRecurring")} />
              <Detail label={t("deliveries.inbox.detailFormat")} value={item.formatLabel} />
              <Detail label={t("deliveries.inbox.detailSent")} value={new Date(item.createdAt).toLocaleString(locale)} />
              <Detail label={t("deliveries.inbox.detailDeadline")} value={item.approvalDeadline ? new Date(item.approvalDeadline).toLocaleString(locale) : "—"} />
              <Detail label={t("deliveries.inbox.detailPublish")} value={item.publicationDate ? new Date(item.publicationDate).toLocaleDateString(locale) : "—"} />
              <Detail label={t("deliveries.inbox.detailOwner")} value={item.responsibleUserName} />
              <Detail label={t("deliveries.inbox.detailVersion")} value={String(item.currentVersion)} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-[10px] font-bold tracking-wider text-slate-400 uppercase">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function TableView({
  items,
  selectedId,
  selectedIds,
  locale,
  onOpen,
  onToggle,
  t,
}: {
  items: DeliveryInboxItem[];
  selectedId: string | null;
  selectedIds: string[];
  locale: string;
  onOpen: (item: DeliveryInboxItem) => void;
  onToggle: (id: string) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <div className="h-full overflow-auto overscroll-contain rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-left text-xs">
        <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold tracking-wider text-slate-500 uppercase">
          <tr>
            <th className="px-3 py-2" />
            <th className="px-3 py-2">{t("deliveries.inbox.colDelivery")}</th>
            <th className="px-3 py-2">{t("deliveries.inbox.colCreator")}</th>
            <th className="px-3 py-2">{t("deliveries.inbox.colCompany")}</th>
            <th className="px-3 py-2">{t("deliveries.inbox.colSource")}</th>
            <th className="px-3 py-2">{t("deliveries.inbox.colFormat")}</th>
            <th className="px-3 py-2">{t("deliveries.inbox.colSent")}</th>
            <th className="px-3 py-2">{t("deliveries.inbox.colDeadline")}</th>
            <th className="px-3 py-2">{t("deliveries.inbox.colStatus")}</th>
            <th className="px-3 py-2">{t("deliveries.inbox.colOwner")}</th>
            <th className="px-3 py-2">{t("deliveries.inbox.colActions")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={cn("border-b border-slate-100 hover:bg-slate-50", selectedId === item.id && "bg-indigo-50/50")}>
              <td className="px-3 py-2">
                <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => onToggle(item.id)} className="accent-indigo-600" />
              </td>
              <td className="px-3 py-2 font-bold text-slate-900">
                {item.title}
                {item.period ? <span className="ml-1 font-semibold text-slate-400">{formatInboxPeriod(item.period, locale)}</span> : null}
              </td>
              <td className="px-3 py-2">{item.creatorName}</td>
              <td className="px-3 py-2">{item.companyName}</td>
              <td className="px-3 py-2">{item.sourceName}</td>
              <td className="px-3 py-2">{item.formatLabel}</td>
              <td className="px-3 py-2 whitespace-nowrap">{new Date(item.createdAt).toLocaleString(locale)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{item.approvalDeadline ? new Date(item.approvalDeadline).toLocaleString(locale) : "—"}</td>
              <td className="px-3 py-2">
                <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase", statusTone(item.status))}>
                  {t(`deliveries.inbox.status.${item.status}`)}
                </span>
              </td>
              <td className="px-3 py-2">{item.responsibleUserName}</td>
              <td className="px-3 py-2">
                <button type="button" onClick={() => onOpen(item)} className="font-bold text-indigo-600 hover:underline">{t("deliveries.inbox.open")}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CampaignDeliveriesScreen() {
  return (
    <AuthenticatedShell>
      <DeliveriesInboxInner />
    </AuthenticatedShell>
  );
}
