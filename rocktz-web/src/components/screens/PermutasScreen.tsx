"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Gift, Loader2, RefreshCw, Search } from "lucide-react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { Select2Field } from "@/components/Select2Field";
import { UserAvatar } from "@/components/UserAvatar";
import { intlLocale, normalizeLocale } from "@/i18n/locales";
import { api } from "@/lib/api";
import { alertApiError, alertSuccess, alertWarning } from "@/lib/alerts";
import { useAuth } from "@/lib/use-auth";
import type { BarterShipmentRow, BarterShipmentStatus } from "@/lib/types";

const fieldClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-amber-500";
const CODE_PATTERN = /^[A-Za-z]{2}\d{9}[A-Za-z]{2}$/;

type Draft = {
  method: string;
  trackingCode: string;
  carrierLabel: string;
  notes: string;
};

function draftFrom(row: BarterShipmentRow): Draft {
  return {
    method: row.shipment?.method || "correios",
    trackingCode: row.shipment?.tracking_code || "",
    carrierLabel: row.shipment?.carrier_label || "",
    notes: row.shipment?.notes || "",
  };
}

function personName(row: BarterShipmentRow) {
  return row.creator.artistic_name || row.creator.full_name || "—";
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

function PermutasInner() {
  const user = useAuth();
  const { t, i18n } = useTranslation("app");
  const locale = intlLocale(normalizeLocale(i18n.language));
  const isCreator = user.role === "creator";
  const [rows, setRows] = useState<BarterShipmentRow[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [collapsedCampaigns, setCollapsedCampaigns] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("all");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    let active = true;
    api.barterShipments()
      .then((res) => {
        if (!active) return;
        setRows(res.data);
        setDrafts(Object.fromEntries(res.data.map((row) => [row.campaign_creator_id, draftFrom(row)])));
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
      const key = String(row.campaign.id ?? row.campaign.name ?? row.campaign_creator_id);
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return [...map.entries()];
  }, [visible]);

  function patchDraft(id: number, patch: Partial<Draft>) {
    setDrafts((current) => {
      const base = current[id];
      if (!base) return current;
      return { ...current, [id]: { ...base, ...patch } };
    });
  }

  function applyRow(next: BarterShipmentRow) {
    setRows((current) => current.map((row) => (row.campaign_creator_id === next.campaign_creator_id ? next : row)));
    setDrafts((current) => ({ ...current, [next.campaign_creator_id]: draftFrom(next) }));
  }

  async function save(event: FormEvent, row: BarterShipmentRow) {
    event.preventDefault();
    const draft = drafts[row.campaign_creator_id] || draftFrom(row);
    const code = draft.trackingCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (draft.method === "correios" && !CODE_PATTERN.test(code)) {
      void alertWarning(t("barterShipments.title"), t("barterShipments.codeInvalid"));
      return;
    }
    setSavingId(row.campaign_creator_id);
    try {
      const res = await api.saveBarterShipment(row.campaign_creator_id, {
        method: draft.method,
        tracking_code: draft.method === "correios" ? code : undefined,
        carrier_label: draft.method === "other" ? draft.carrierLabel : undefined,
        notes: draft.notes,
      });
      applyRow(res.data);
      if (res.data.shipment?.last_error === "unavailable") {
        void alertWarning(t("barterShipments.title"), t("barterShipments.trackingUnavailable"));
      } else {
        void alertSuccess(t("barterShipments.saved"));
      }
    } catch (err) {
      void alertApiError(err);
    } finally {
      setSavingId(null);
    }
  }

  async function refresh(row: BarterShipmentRow) {
    setSavingId(row.campaign_creator_id);
    try {
      const res = await api.refreshBarterShipment(row.campaign_creator_id);
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
      <header>
        <h1 className="m-0 flex items-center gap-2 text-xl font-bold text-[#0F172A] sm:text-[28px]">
          <Gift size={22} className="text-amber-600" />
          {t("barterShipments.title")}
        </h1>
        <p className="mt-1 max-w-2xl text-[14px] text-[#64748B]">
          {isCreator ? t("barterShipments.subtitleCreator") : t("barterShipments.subtitle")}
        </p>
      </header>

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
                      {campaign?.name}
                      {user.role === "admin" && campaign?.company_name ? <span className="font-semibold text-slate-500"> · {campaign.company_name}</span> : null}
                    </span>
                    <span className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] font-semibold text-slate-500">
                      <span>{t("barterShipments.creatorsCount", { count: campaignRows.length })}</span>
                      {waiting > 0 ? <span className="text-amber-700">{t("barterShipments.waitingCount", { count: waiting })}</span> : null}
                      {campaign?.barter_details ? <span className="truncate font-medium">{campaign.barter_details}</span> : null}
                    </span>
                  </span>
                </button>
                {collapsed ? null : (
                  <ul className="divide-y divide-slate-100 border-t border-slate-100">
                    {campaignRows.map((row) => {
                      const draft = drafts[row.campaign_creator_id] || draftFrom(row);
                      const shipment = row.shipment;
                      const currentStatus = shipment?.status || "pending";
                      const open = expandedId === row.campaign_creator_id;
                      const busy = savingId === row.campaign_creator_id;
                      const place = [row.creator.city, row.creator.state].filter(Boolean).join(" · ");
                      const checked = formatWhen(shipment?.last_checked_at, locale);
                      const posted = formatWhen(shipment?.posted_at, locale);
                      const delivered = formatWhen(shipment?.delivered_at, locale);
                      return (
                        <li key={row.campaign_creator_id}>
                          <button
                            type="button"
                            aria-expanded={open}
                            onClick={() => setExpandedId((current) => current === row.campaign_creator_id ? null : row.campaign_creator_id)}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                          >
                            <UserAvatar src={row.creator.photo_url} name={personName(row)} size="sm" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-bold text-slate-900">{personName(row)}</span>
                              <span className="block truncate text-[11px] text-slate-400">
                                {[place, shipment?.tracking_code, shipment?.carrier_label].filter(Boolean).join(" · ") || t("barterShipments.status.pending")}
                              </span>
                            </span>
                            <span className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold sm:inline-flex ${statusTone(currentStatus)}`}>
                              {t(`barterShipments.status.${currentStatus}`)}
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
                                  <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600">
                                    {t("barterShipments.method")}
                                    <Select2Field theme="light" value={draft.method} options={methodOptions} onChange={(value) => patchDraft(row.campaign_creator_id, { method: value })} />
                                  </label>
                                  {draft.method === "correios" ? (
                                    <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600">
                                      {t("barterShipments.trackingCode")}
                                      <input
                                        value={draft.trackingCode}
                                        onChange={(event) => patchDraft(row.campaign_creator_id, { trackingCode: event.target.value.toUpperCase() })}
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
                                        onChange={(event) => patchDraft(row.campaign_creator_id, { carrierLabel: event.target.value })}
                                        className={fieldClass}
                                      />
                                    </label>
                                  ) : null}
                                  <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600 md:col-span-2">
                                    {t("barterShipments.notes")}
                                    <input
                                      value={draft.notes}
                                      onChange={(event) => patchDraft(row.campaign_creator_id, { notes: event.target.value })}
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
