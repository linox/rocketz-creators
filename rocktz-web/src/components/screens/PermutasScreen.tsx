"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Gift, Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { Select2Field } from "@/components/Select2Field";
import { UserAvatar } from "@/components/UserAvatar";
import { intlLocale, normalizeLocale } from "@/i18n/locales";
import { api } from "@/lib/api";
import { alertApiError, alertSuccess, alertWarning } from "@/lib/alerts";
import { useAuth } from "@/lib/use-auth";
import type { BarterShipmentRow, BarterShipmentStatus, Creator } from "@/lib/types";

const fieldClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-amber-500";
const CODE_PATTERN = /^[A-Za-z]{2}\d{9}[A-Za-z]{2}$/;

type Draft = {
  method: string;
  trackingCode: string;
  carrierLabel: string;
  notes: string;
  description: string;
};

type CreateDraft = {
  creatorId: string;
  description: string;
  method: string;
  trackingCode: string;
  carrierLabel: string;
  notes: string;
};

function emptyCreate(): CreateDraft {
  return {
    creatorId: "",
    description: "",
    method: "correios",
    trackingCode: "",
    carrierLabel: "",
    notes: "",
  };
}

function rowKey(row: BarterShipmentRow) {
  return row.standalone ? `s-${row.id}` : `c-${row.campaign_creator_id}`;
}

function draftFrom(row: BarterShipmentRow): Draft {
  return {
    method: row.shipment?.method || "correios",
    trackingCode: row.shipment?.tracking_code || "",
    carrierLabel: row.shipment?.carrier_label || "",
    notes: row.shipment?.notes || "",
    description: row.standalone ? (row.campaign.barter_details || "") : "",
  };
}

function shipmentPayload(draft: { method: string; trackingCode: string; carrierLabel: string; notes: string }) {
  const code = draft.trackingCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return {
    code,
    body: {
      method: draft.method,
      tracking_code: draft.method === "correios" ? code : undefined,
      carrier_label: draft.method === "other" ? draft.carrierLabel : undefined,
      notes: draft.notes,
    },
  };
}

function creatorIdentity(creator: BarterShipmentRow["creator"]) {
  const handle = (creator.artistic_name || "").replace(/^@+/, "").trim();
  const name = (creator.full_name || "").trim();
  const same = Boolean(handle && name && handle.localeCompare(name, undefined, { sensitivity: "base" }) === 0);
  return {
    name: name || (handle ? `@${handle}` : "—"),
    handle: handle && name && !same ? `@${handle}` : "",
  };
}

function personName(row: BarterShipmentRow) {
  const identity = creatorIdentity(row.creator);
  return [identity.name, identity.handle].filter(Boolean).join(" ");
}

function formatWhen(value: string | null | undefined, locale: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(date);
}

function statusTone(status: BarterShipmentStatus | "pending") {
  switch (status) {
    case "delivered":
    case "handed":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "out_for_delivery":
    case "awaiting_pickup":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "in_transit":
    case "posted":
    case "sent":
      return "border-sky-200 bg-sky-50 text-sky-800";
    case "returned":
    case "issue":
    case "not_found":
      return "border-rose-200 bg-rose-50 text-rose-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function statusMark(status: BarterShipmentStatus | "pending") {
  switch (status) {
    case "delivered":
    case "handed":
      return "bg-emerald-500";
    case "returned":
    case "issue":
    case "not_found":
      return "bg-rose-500";
    case "pending":
      return "bg-slate-300";
    default:
      return "bg-amber-400";
  }
}

function statusRail(status: BarterShipmentStatus | "pending") {
  switch (status) {
    case "delivered":
    case "handed":
      return "border-l-emerald-500";
    case "returned":
    case "issue":
    case "not_found":
      return "border-l-rose-500";
    case "pending":
      return "border-l-slate-200";
    default:
      return "border-l-amber-400";
  }
}

function PermutasInner() {
  const user = useAuth();
  const { t, i18n } = useTranslation("app");
  const locale = intlLocale(normalizeLocale(i18n.language));
  const isCreator = user.role === "creator";
  const [rows, setRows] = useState<BarterShipmentRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [collapsedCampaigns, setCollapsedCampaigns] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateDraft>(emptyCreate);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [creatorsLoading, setCreatorsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("all");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    let active = true;
    api.barterShipments()
      .then((res) => {
        if (!active) return;
        setRows(res.data);
        setDrafts(Object.fromEntries(res.data.map((row) => [rowKey(row), draftFrom(row)])));
      })
      .catch((err) => {
        if (active) void alertApiError(err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const methodOptions = useMemo(() => [
    { value: "correios", label: t("barterShipments.methodCorreios") },
    { value: "hand", label: t("barterShipments.methodHand") },
    { value: "other", label: t("barterShipments.methodOther") },
  ], [t]);

  const filterMethods = useMemo(() => [
    { value: "all", label: t("barterShipments.methodAll") },
    { value: "none", label: t("barterShipments.methodNone") },
    ...methodOptions,
  ], [methodOptions, t]);

  const statusOptions = useMemo(() => [
    { value: "all", label: t("barterShipments.statusAll") },
    ...(["pending", "posted", "in_transit", "out_for_delivery", "awaiting_pickup", "delivered", "handed", "sent", "returned", "issue", "not_found"] as const).map((value) => ({
      value,
      label: t(`barterShipments.status.${value}`),
    })),
  ], [t]);

  const visible = useMemo(() => rows.filter((row) => {
    const shipmentMethod = row.shipment?.method || "none";
    const shipmentStatus = row.shipment?.status || "pending";
    if (method !== "all" && shipmentMethod !== method) return false;
    if (status !== "all" && shipmentStatus !== status) return false;
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [
      personName(row),
      row.creator.full_name,
      row.campaign.name,
      row.campaign.company_name,
      row.campaign.barter_details,
      row.shipment?.tracking_code,
      row.shipment?.carrier_label,
    ].join(" ").toLowerCase().includes(term);
  }), [method, rows, search, status]);

  const groups = useMemo(() => {
    const map = new Map<string, BarterShipmentRow[]>();
    for (const row of visible) {
      const key = row.standalone ? "standalone" : String(row.campaign.id ?? row.campaign.name ?? row.campaign_creator_id);
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return [...map.entries()].sort(([left], [right]) => Number(right === "standalone") - Number(left === "standalone"));
  }, [visible]);

  const creatorOptions = useMemo(() => creators.map((creator) => {
    const identity = creatorIdentity({
      id: creator.id,
      artistic_name: creator.artistic_name,
      full_name: creator.full_name ?? null,
      photo_url: creator.photo_url,
      city: creator.city,
      state: creator.state,
    });
    return { value: String(creator.id), label: [identity.name, identity.handle].filter(Boolean).join(" ") };
  }), [creators]);

  function patchDraft(id: string, patch: Partial<Draft>) {
    setDrafts((current) => {
      const base = current[id];
      if (!base) return current;
      return { ...current, [id]: { ...base, ...patch } };
    });
  }

  function applyRow(next: BarterShipmentRow) {
    const key = rowKey(next);
    setRows((current) => {
      const index = current.findIndex((row) => rowKey(row) === key);
      if (index < 0) return [next, ...current];
      return current.map((row) => (rowKey(row) === key ? next : row));
    });
    setDrafts((current) => ({ ...current, [key]: draftFrom(next) }));
  }

  function reportSave(row: BarterShipmentRow) {
    if (row.shipment?.last_error === "unavailable") {
      void alertWarning(t("barterShipments.title"), t("barterShipments.trackingUnavailable"));
      return;
    }
    void alertSuccess(t("barterShipments.saved"));
  }

  async function openCreate() {
    const next = !creating;
    setCreating(next);
    if (!next || creators.length > 0 || creatorsLoading) return;
    setCreatorsLoading(true);
    try {
      const res = await api.creators();
      setCreators(res.data);
    } catch (err) {
      void alertApiError(err);
    } finally {
      setCreatorsLoading(false);
    }
  }

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    if (!createDraft.creatorId) {
      void alertWarning(t("barterShipments.title"), t("barterShipments.creatorRequired"));
      return;
    }
    if (!createDraft.description.trim()) {
      void alertWarning(t("barterShipments.title"), t("barterShipments.descriptionRequired"));
      return;
    }
    const { code, body } = shipmentPayload(createDraft);
    if (createDraft.method === "correios" && !CODE_PATTERN.test(code)) {
      void alertWarning(t("barterShipments.title"), t("barterShipments.codeInvalid"));
      return;
    }
    setSavingId("new");
    try {
      const res = await api.createStandaloneBarterShipment({
        ...body,
        creator_id: Number(createDraft.creatorId),
        description: createDraft.description.trim(),
      });
      applyRow(res.data);
      setExpandedId(rowKey(res.data));
      setCreateDraft(emptyCreate());
      setCreating(false);
      reportSave(res.data);
    } catch (err) {
      void alertApiError(err);
    } finally {
      setSavingId(null);
    }
  }

  async function save(event: FormEvent, row: BarterShipmentRow) {
    event.preventDefault();
    const key = rowKey(row);
    const draft = drafts[key] || draftFrom(row);
    const { code, body } = shipmentPayload(draft);
    if (draft.method === "correios" && !CODE_PATTERN.test(code)) {
      void alertWarning(t("barterShipments.title"), t("barterShipments.codeInvalid"));
      return;
    }
    if (row.standalone && !draft.description.trim()) {
      void alertWarning(t("barterShipments.title"), t("barterShipments.descriptionRequired"));
      return;
    }
    setSavingId(key);
    try {
      const res = row.standalone && row.id
        ? await api.saveStandaloneBarterShipment(row.id, {
          ...body,
          creator_id: row.creator.id || 0,
          description: draft.description.trim(),
        })
        : await api.saveBarterShipment(row.campaign_creator_id || 0, body);
      applyRow(res.data);
      reportSave(res.data);
    } catch (err) {
      void alertApiError(err);
    } finally {
      setSavingId(null);
    }
  }

  async function refresh(row: BarterShipmentRow) {
    const key = rowKey(row);
    setSavingId(key);
    try {
      const res = row.standalone && row.id
        ? await api.refreshStandaloneBarterShipment(row.id)
        : await api.refreshBarterShipment(row.campaign_creator_id || 0);
      applyRow(res.data);
      if (res.data.shipment?.last_error === "unavailable") {
        void alertWarning(t("barterShipments.title"), t("barterShipments.trackingUnavailable"));
      } else {
        void alertSuccess(t("barterShipments.refreshed"));
      }
    } catch (err) {
      void alertApiError(err);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="m-0 flex items-center gap-2 text-xl font-bold text-[#0F172A] sm:text-[28px]">
            <Gift size={22} className="text-amber-600" />
            {t("barterShipments.title")}
          </h1>
          <p className="mt-1 max-w-2xl text-[14px] text-[#64748B]">
            {isCreator ? t("barterShipments.subtitleCreator") : t("barterShipments.subtitle")}
          </p>
        </div>
        {isCreator ? null : (
          <button type="button" onClick={() => void openCreate()} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white hover:bg-slate-800">
            <Plus size={14} />
            {t("barterShipments.newStandalone")}
          </button>
        )}
      </header>

      {creating && !isCreator ? (
        <form noValidate onSubmit={(event) => void submitCreate(event)} className="grid grid-cols-1 gap-3 rounded-2xl border border-amber-200 bg-amber-50/40 p-4 md:grid-cols-2">
          <p className="text-sm text-slate-600 md:col-span-2">{t("barterShipments.standaloneHint")}</p>
          <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600">
            {t("barterShipments.creator")}
            <Select2Field
              theme="light"
              searchable
              value={createDraft.creatorId}
              placeholder={t("barterShipments.creatorPlaceholder")}
              options={creatorOptions}
              onChange={(value) => setCreateDraft((current) => ({ ...current, creatorId: value }))}
              disabled={creatorsLoading}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600">
            {t("barterShipments.description")}
            <input
              value={createDraft.description}
              onChange={(event) => setCreateDraft((current) => ({ ...current, description: event.target.value }))}
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600">
            {t("barterShipments.method")}
            <Select2Field theme="light" value={createDraft.method} options={methodOptions} onChange={(value) => setCreateDraft((current) => ({ ...current, method: value }))} />
          </label>
          {createDraft.method === "correios" ? (
            <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600">
              {t("barterShipments.trackingCode")}
              <input
                value={createDraft.trackingCode}
                onChange={(event) => setCreateDraft((current) => ({ ...current, trackingCode: event.target.value.toUpperCase() }))}
                placeholder={t("barterShipments.trackingPlaceholder")}
                className={`${fieldClass} font-mono uppercase`}
                autoComplete="off"
              />
            </label>
          ) : null}
          {createDraft.method === "other" ? (
            <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600">
              {t("barterShipments.carrier")}
              <input
                value={createDraft.carrierLabel}
                onChange={(event) => setCreateDraft((current) => ({ ...current, carrierLabel: event.target.value }))}
                className={fieldClass}
              />
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600 md:col-span-2">
            {t("barterShipments.notes")}
            <input
              value={createDraft.notes}
              onChange={(event) => setCreateDraft((current) => ({ ...current, notes: event.target.value }))}
              className={fieldClass}
            />
          </label>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <button type="submit" disabled={savingId === "new"} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60">
              {savingId === "new" ? <Loader2 size={14} className="animate-spin" /> : null}
              {createDraft.method === "correios" ? t("barterShipments.startTracking") : t("barterShipments.save")}
            </button>
            <button type="button" onClick={() => setCreating(false)} className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50">
              {t("barterShipments.cancel")}
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.4fr_0.8fr_0.8fr]">
        <label className="relative block">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("barterShipments.search")}
            className={`${fieldClass} pl-9`}
          />
        </label>
        <Select2Field theme="light" value={method} options={filterMethods} onChange={setMethod} />
        <Select2Field theme="light" value={status} options={statusOptions} onChange={setStatus} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400"><Loader2 className="animate-spin" /></div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">{t("barterShipments.empty")}</p>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">{t("barterShipments.emptyFilter")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(([key, campaignRows]) => {
            const campaign = campaignRows[0]?.campaign;
            const standaloneGroup = key === "standalone";
            const collapsed = collapsedCampaigns[key] === true;
            const waiting = campaignRows.filter((row) => !row.shipment?.tracking_code && (row.shipment?.status || "pending") === "pending").length;
            return (
              <section key={key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
                <button
                  type="button"
                  aria-expanded={!collapsed}
                  onClick={() => setCollapsedCampaigns((current) => ({ ...current, [key]: !collapsed }))}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-slate-900">
                      {standaloneGroup ? t("barterShipments.standaloneGroup") : campaign?.name}
                      {!standaloneGroup && user.role === "admin" && campaign?.company_name ? <span className="font-semibold text-slate-500"> · {campaign.company_name}</span> : null}
                    </span>
                    <span className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] font-semibold text-slate-500">
                      <span>{t("barterShipments.creatorsCount", { count: campaignRows.length })}</span>
                      {waiting > 0 ? <span className="text-amber-700">{t("barterShipments.waitingCount", { count: waiting })}</span> : null}
                      {!standaloneGroup && campaign?.barter_details ? <span className="truncate font-medium">{campaign.barter_details}</span> : null}
                    </span>
                  </span>
                </button>
                {collapsed ? null : (
                  <ul className="divide-y divide-slate-100 border-t border-slate-100">
                    {campaignRows.map((row) => {
                      const keyId = rowKey(row);
                      const draft = drafts[keyId] || draftFrom(row);
                      const shipment = row.shipment;
                      const currentStatus = shipment?.status || "pending";
                      const open = expandedId === keyId;
                      const busy = savingId === keyId;
                      const place = [row.standalone ? row.campaign.barter_details : null, row.creator.city, row.creator.state].filter(Boolean).join(" · ");
                      const identity = creatorIdentity(row.creator);
                      const checked = formatWhen(shipment?.last_checked_at, locale);
                      const posted = formatWhen(shipment?.posted_at, locale);
                      const delivered = formatWhen(shipment?.delivered_at, locale);
                      return (
                        <li key={keyId} className={`border-l-4 ${statusRail(currentStatus)}`}>
                          <button
                            type="button"
                            aria-expanded={open}
                            onClick={() => setExpandedId((current) => current === keyId ? null : keyId)}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                          >
                            <UserAvatar src={row.creator.photo_url} name={identity.name} size="sm" />
                            <span className="min-w-0 flex-1">
                              <span className="flex min-w-0 items-baseline gap-1.5" title={personName(row)}>
                                <span className="min-w-0 truncate text-sm font-bold text-slate-900">{identity.name}</span>
                                {identity.handle ? <span className="max-w-[50%] shrink-0 truncate text-xs font-semibold text-slate-500">{identity.handle}</span> : null}
                                {row.standalone && user.role === "admin" && row.campaign.company_name ? <span className="shrink-0 truncate text-xs font-semibold text-slate-500">· {row.campaign.company_name}</span> : null}
                              </span>
                              <span className="block truncate text-[11px] text-slate-400">
                                {[place, shipment?.tracking_code, shipment?.carrier_label].filter(Boolean).join(" · ") || t("barterShipments.status.pending")}
                              </span>
                            </span>
                            <span title={t(`barterShipments.status.${currentStatus}`)} className={`inline-flex max-w-[5.75rem] shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold sm:max-w-none sm:px-2 ${statusTone(currentStatus)}`}>
                              <span className={`h-2 w-2 shrink-0 rounded-full ${statusMark(currentStatus)}`} aria-hidden="true" />
                              <span className="truncate">{t(`barterShipments.status.${currentStatus}`)}</span>
                            </span>
                            <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
                          </button>
                          {open ? (
                            <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-4">
                              <div className="mb-3 flex flex-wrap items-center gap-2 sm:hidden">
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusTone(currentStatus)}`}>
                                  {t(`barterShipments.status.${currentStatus}`)}
                                </span>
                              </div>
                              {shipment?.status_label ? <p className="text-sm text-slate-700">{shipment.status_label}</p> : null}
                              {shipment ? (
                                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                  {shipment.service_label ? <span>{shipment.service_label}</span> : null}
                                  {shipment.days_in_transit != null && shipment.method === "correios" ? <span>{t("barterShipments.days", { count: shipment.days_in_transit })}</span> : null}
                                  {posted ? <span>{t("barterShipments.postedAt", { time: posted })}</span> : null}
                                  {delivered ? <span>{t("barterShipments.deliveredAt", { time: delivered })}</span> : null}
                                  {checked ? <span>{t("barterShipments.lastCheck", { time: checked })}</span> : null}
                                </div>
                              ) : null}
                              {shipment?.last_error === "unavailable" ? <p className="mt-2 text-sm text-amber-800">{t("barterShipments.trackingUnavailable")}</p> : null}
                              {shipment?.status === "not_found" ? <p className="mt-2 text-sm text-rose-700">{t("barterShipments.notFoundHint")}</p> : null}
                              {row.standalone && !row.can_manage && row.campaign.barter_details ? <p className="mt-2 text-sm font-semibold text-slate-800">{row.campaign.barter_details}</p> : null}
                              {shipment && shipment.events.length > 0 ? (
                                <div className="mt-3">
                                  <p className="text-xs font-bold text-amber-800">{t("barterShipments.timeline")}</p>
                                  <ol className="mt-2 space-y-3 border-l border-amber-200 pl-4">
                                    {shipment.events.map((event, index) => (
                                      <li key={`${event.occurred_at}-${index}`} className="relative">
                                        <span className="absolute top-1.5 -left-[21px] h-2.5 w-2.5 rounded-full bg-amber-500" />
                                        {event.occurred_at ? <p className="text-[11px] font-semibold text-slate-400">{formatWhen(event.occurred_at, locale)}</p> : null}
                                        <p className="text-sm font-bold text-slate-800">{event.status}</p>
                                        {event.details ? <p className="text-xs text-slate-500">{event.details}</p> : null}
                                        {event.origin || event.destination ? (
                                          <p className="text-xs text-slate-500">{[event.origin, event.destination].filter(Boolean).join(" → ")}</p>
                                        ) : null}
                                      </li>
                                    ))}
                                  </ol>
                                </div>
                              ) : null}
                              {row.can_manage ? (
                                <form noValidate onSubmit={(event) => void save(event, row)} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                                  {row.standalone ? (
                                    <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600 md:col-span-2">
                                      {t("barterShipments.description")}
                                      <input
                                        value={draft.description}
                                        onChange={(event) => patchDraft(keyId, { description: event.target.value })}
                                        className={fieldClass}
                                      />
                                    </label>
                                  ) : null}
                                  <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600">
                                    {t("barterShipments.method")}
                                    <Select2Field theme="light" value={draft.method} options={methodOptions} onChange={(value) => patchDraft(keyId, { method: value })} />
                                  </label>
                                  {draft.method === "correios" ? (
                                    <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600">
                                      {t("barterShipments.trackingCode")}
                                      <input
                                        value={draft.trackingCode}
                                        onChange={(event) => patchDraft(keyId, { trackingCode: event.target.value.toUpperCase() })}
                                        placeholder={t("barterShipments.trackingPlaceholder")}
                                        className={`${fieldClass} font-mono uppercase`}
                                        autoComplete="off"
                                      />
                                      {!shipment?.tracking_code ? <span className="font-medium text-amber-800">{t("barterShipments.awaitingHint")}</span> : null}
                                    </label>
                                  ) : null}
                                  {draft.method === "other" ? (
                                    <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600">
                                      {t("barterShipments.carrier")}
                                      <input
                                        value={draft.carrierLabel}
                                        onChange={(event) => patchDraft(keyId, { carrierLabel: event.target.value })}
                                        className={fieldClass}
                                      />
                                    </label>
                                  ) : null}
                                  <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600 md:col-span-2">
                                    {t("barterShipments.notes")}
                                    <input
                                      value={draft.notes}
                                      onChange={(event) => patchDraft(keyId, { notes: event.target.value })}
                                      className={fieldClass}
                                    />
                                  </label>
                                  <div className="flex flex-wrap gap-2 md:col-span-2">
                                    <button type="submit" disabled={busy} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60">
                                      {busy ? <Loader2 size={14} className="animate-spin" /> : null}
                                      {draft.method === "correios" && !shipment?.tracking_code ? t("barterShipments.startTracking") : t("barterShipments.save")}
                                    </button>
                                    {shipment?.method === "correios" && shipment.tracking_code ? (
                                      <button type="button" disabled={busy} onClick={() => void refresh(row)} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                                        <RefreshCw size={14} />
                                        {t("barterShipments.refresh")}
                                      </button>
                                    ) : null}
                                  </div>
                                </form>
                              ) : shipment?.notes ? (
                                <p className="mt-3 text-sm text-slate-600">{shipment.notes}</p>
                              ) : null}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PermutasScreen() {
  return (
    <AuthenticatedShell>
      <PermutasInner />
    </AuthenticatedShell>
  );
}
