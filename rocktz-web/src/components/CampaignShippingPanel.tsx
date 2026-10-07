"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, FileSpreadsheet, Loader2, Printer, Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CountrySelect, RegionSelect } from "@/components/GeoSelectFields";
import { Select2Field } from "@/components/Select2Field";
import { api } from "@/lib/api";
import { alertApiError, alertSuccess, alertWarning } from "@/lib/alerts";
import { hasRegions, normalizeCountry } from "@/lib/geo";
import { ApiError } from "@/lib/laravel";
import {
  EMPTY_SHIPPING,
  formatPostalCode,
  postalCodeReady,
  shippingFormFromAddress,
  shippingIssue,
  shippingPayload,
  type ShippingForm,
} from "@/lib/shipping-address";
import type { Campaign, ShippingSender } from "@/lib/types";

const inputClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-brand-primary";

export function CampaignShippingPanel({
  campaign,
  isAgency,
  onSaved,
}: {
  campaign: Campaign;
  isAgency: boolean;
  onSaved: (campaign: Campaign) => void;
}) {
  const { t } = useTranslation("app");
  const { t: tp } = useTranslation("profile");
  const { t: tc } = useTranslation("common");
  const [senders, setSenders] = useState<ShippingSender[]>([]);
  const [choice, setChoice] = useState("new");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [form, setForm] = useState<ShippingForm>({ ...EMPTY_SHIPPING, country: "BR" });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState<"pdf" | "csv" | null>(null);
  const [lookingUpZip, setLookingUpZip] = useState(false);
  const hydrateKey = useRef("");
  const zipLookupKey = useRef("");
  const zipLookupFlight = useRef("");
  const zipLookupSeq = useRef(0);
  const zipLookupTimer = useRef<number | null>(null);
  const latestZip = useRef("");

  const saved = campaign.shipping_sender;
  const country = normalizeCountry(form.country) || "BR";

  useEffect(() => {
    let active = true;
    api.shippingSenders()
      .then((res) => {
        if (active) setSenders(res.data);
      })
      .catch((err) => {
        if (active) void alertApiError(err);
      });
    return () => {
      active = false;
    };
  }, [campaign.id]);

  useEffect(() => {
    const key = `${campaign.id}:${saved?.id ?? ""}:${saved?.name ?? ""}:${senders.map((row) => row.id).join(",")}`;
    if (hydrateKey.current === key) return;
    hydrateKey.current = key;
    const match = saved?.id ? senders.find((row) => row.id === saved.id) : undefined;
    if (match) {
      applySender(match);
      setChoice(String(match.id));
      return;
    }
    if (saved?.name) {
      setChoice("current");
      setName(saved.name);
      setPhone(saved.phone || "");
      const next = shippingFormFromAddress(saved.address?.country || campaign.company?.country, saved.address);
      latestZip.current = next.zip;
      setForm(next);
      return;
    }
    setChoice("new");
    setName("");
    setPhone("");
    const next = { ...EMPTY_SHIPPING, country: normalizeCountry(campaign.company?.country) || "BR" };
    latestZip.current = "";
    setForm(next);
  }, [campaign.company?.country, campaign.id, saved?.address, saved?.id, saved?.name, saved?.phone, senders]);

  const options = useMemo(() => {
    const rows = senders.map((sender) => ({
      value: String(sender.id),
      label: senderOptionLabel(sender, isAgency, t("campaignDetail.labelsAgencyTag")),
    }));
    const base = [{ value: "new", label: t("campaignDetail.labelsNew") }, ...rows];
    if (saved?.name && !senders.some((row) => row.id === saved.id)) {
      base.splice(1, 0, { value: "current", label: t("campaignDetail.labelsCurrent", { name: saved.name }) });
    }
    return base;
  }, [isAgency, saved?.id, saved?.name, senders, t]);

  function applySender(sender: ShippingSender) {
    setName(sender.name);
    setPhone(sender.phone || "");
    const next = shippingFormFromAddress(sender.address?.country, sender.address);
    latestZip.current = next.zip;
    zipLookupKey.current = "";
    setForm(next);
  }

  function pickSender(value: string) {
    setChoice(value);
    if (value === "new") {
      setName("");
      setPhone("");
      const next = { ...EMPTY_SHIPPING, country: normalizeCountry(campaign.company?.country) || "BR" };
      latestZip.current = "";
      zipLookupKey.current = "";
      setForm(next);
      return;
    }
    if (value === "current" && saved?.name) {
      setName(saved.name);
      setPhone(saved.phone || "");
      const next = shippingFormFromAddress(saved.address?.country || campaign.company?.country, saved.address);
      latestZip.current = next.zip;
      setForm(next);
      return;
    }
    const sender = senders.find((row) => String(row.id) === value);
    if (sender) applySender(sender);
  }

  function scheduleZipLookup(nextCountry: string, zip: string) {
    if (zipLookupTimer.current) window.clearTimeout(zipLookupTimer.current);
    if (!postalCodeReady(nextCountry, zip, "auto")) return;
    zipLookupTimer.current = window.setTimeout(() => {
      void runZipLookup(nextCountry, zip);
    }, nextCountry === "BR" ? 450 : 700);
  }

  async function runZipLookup(nextCountry: string, zip: string) {
    if (!postalCodeReady(nextCountry, zip)) return;
    const key = `${nextCountry}|${zip.trim()}`;
    if (zipLookupKey.current === key || zipLookupFlight.current === key) return;
    zipLookupFlight.current = key;
    const seq = ++zipLookupSeq.current;
    setLookingUpZip(true);
    try {
      const found = (await api.lookupPostalCode(nextCountry, zip.trim())).data;
      if (seq !== zipLookupSeq.current) return;
      zipLookupKey.current = key;
      const placeCountry = found.country || nextCountry;
      setForm((current) => {
        const countryChanged = placeCountry !== current.country;
        const next = {
          ...current,
          country: placeCountry,
          zip: formatPostalCode(placeCountry, found.zip || current.zip),
          street: found.street || (countryChanged ? "" : current.street),
          neighborhood: found.neighborhood || (countryChanged ? "" : current.neighborhood),
          city: found.city || (countryChanged ? "" : current.city),
          state: found.state || (countryChanged ? "" : current.state),
        };
        latestZip.current = next.zip;
        return next;
      });
    } catch (err) {
      if (seq !== zipLookupSeq.current) return;
      if (err instanceof ApiError && err.status === 404) {
        await alertWarning(tp("shippingZipNotFoundTitle"), tp("shippingZipNotFound"));
        return;
      }
      await alertApiError(err);
    } finally {
      if (seq === zipLookupSeq.current) {
        zipLookupFlight.current = "";
        setLookingUpZip(false);
      }
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      await alertWarning(tc("alerts.incompleteTitle"), t("campaignDetail.labelsNeedName"));
      return;
    }
    const issue = shippingIssue(country, form);
    if (issue === "zip") {
      await alertWarning(tc("alerts.incompleteTitle"), tp("shippingZipInvalid"));
      return;
    }
    const address = shippingPayload(country, form);
    if (issue === "incomplete" || !address) {
      await alertWarning(tc("alerts.incompleteTitle"), tp("shippingIncomplete"));
      return;
    }
    const known = senders.some((row) => String(row.id) === choice);
    setSaving(true);
    try {
      const res = await api.saveCampaignSender(campaign.id, {
        shipping_sender_id: known ? Number(choice) : null,
        name: name.trim(),
        phone: phone.trim() || null,
        address,
      });
      const list = await api.shippingSenders();
      setSenders(list.data);
      onSaved(res.data);
      await alertSuccess(t("campaignDetail.labelsSavedOk"));
    } catch (err) {
      await alertApiError(err);
    } finally {
      setSaving(false);
    }
  }

  async function download(format: "pdf" | "csv") {
    if (!saved?.name) {
      await alertWarning(tc("alerts.incompleteTitle"), t("campaignDetail.labelsNeedSender"));
      return;
    }
    setDownloading(format);
    try {
      const file = await api.downloadShippingLabels(campaign.id, format);
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      await alertApiError(err);
    } finally {
      setDownloading(null);
    }
  }

  const summary = saved?.name
    ? [saved.name, saved.address?.city, saved.address?.state].filter(Boolean).join(" · ")
    : null;

  return (
    <form noValidate onSubmit={save} className={`rounded-2xl border border-amber-200 bg-amber-50/40 shadow-xs ${open ? "p-4 sm:p-5" : "px-4 py-3"}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? t("campaignDetail.labelsCollapse") : t("campaignDetail.labelsExpand")}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-sm font-black text-slate-900">
            <Tag size={16} className="shrink-0 text-amber-600" /> {t("campaignDetail.labelsTitle")}
          </span>
          {!open && summary ? <span className="mt-0.5 block truncate text-xs font-medium text-slate-500">{summary}</span> : null}
        </span>
        <ChevronDown size={18} className={`shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <>
      <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="max-w-2xl text-xs leading-relaxed text-slate-600">{t("campaignDetail.labelsHint")}</p>
          <p className="mt-1 text-[11px] font-medium text-slate-500">
            {isAgency ? t("campaignDetail.labelsScopeAgency") : t("campaignDetail.labelsScopeCompany")}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={downloading !== null}
            onClick={() => void download("pdf")}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-primary px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-600 disabled:opacity-60"
          >
            {downloading === "pdf" ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
            {t("campaignDetail.labelsDownloadPdf")}
          </button>
          <button
            type="button"
            disabled={downloading !== null}
            onClick={() => void download("csv")}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-60"
          >
            {downloading === "csv" ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
            {t("campaignDetail.labelsDownloadCsv")}
          </button>
        </div>
      </div>
      <p className="mt-3 text-[11px] font-medium text-amber-800">{t("campaignDetail.labelsApprovedHint")}</p>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600 md:col-span-2">
          {t("campaignDetail.labelsSaved")}
          <Select2Field theme="light" searchable value={choice} options={options} onChange={pickSender} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600">
          {t("campaignDetail.labelsSenderName")}
          <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600">
          {t("campaignDetail.labelsSenderPhone")}
          <input className={inputClass} value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600">
          {tp("shippingCountry")}
          <CountrySelect
            theme="light"
            value={country}
            onChange={(value) => {
              const zip = formatPostalCode(value, form.zip);
              zipLookupKey.current = "";
              latestZip.current = zip;
              setForm((current) => ({ ...current, country: value, state: "", street: "", neighborhood: "", city: "", zip }));
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600">
          {tp("shippingZip")}
          <input
            className={inputClass}
            value={form.zip}
            inputMode={country === "BR" ? "numeric" : "text"}
            autoComplete="postal-code"
            onChange={(event) => {
              const zip = formatPostalCode(country, event.target.value);
              latestZip.current = zip;
              zipLookupKey.current = "";
              setForm({ ...form, zip });
              scheduleZipLookup(country, zip);
            }}
            onBlur={() => {
              if (zipLookupTimer.current) window.clearTimeout(zipLookupTimer.current);
              void runZipLookup(country, latestZip.current);
            }}
          />
          {lookingUpZip ? <span className="text-[10px] font-medium text-slate-500">{tp("shippingLookingUp")}</span> : null}
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600">
          {tp("shippingStreet")}
          <input className={inputClass} value={form.street} autoComplete="address-line1" onChange={(event) => setForm({ ...form, street: event.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600">
          {tp("shippingNumber")}
          <input className={inputClass} value={form.number} onChange={(event) => setForm({ ...form, number: event.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600">
          {tp("shippingComplement")}
          <input className={inputClass} value={form.complement} placeholder={tp("shippingComplementPh")} onChange={(event) => setForm({ ...form, complement: event.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600">
          {tp("shippingNeighborhood")}
          <input className={inputClass} value={form.neighborhood} onChange={(event) => setForm({ ...form, neighborhood: event.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600">
          {tp("shippingCity")}
          <input className={inputClass} value={form.city} autoComplete="address-level2" onChange={(event) => setForm({ ...form, city: event.target.value })} />
        </label>
        {hasRegions(country) ? (
          <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-600">
            {tp("shippingState")}
            <RegionSelect theme="light" country={country} value={form.state} onChange={(value) => setForm({ ...form, state: value })} />
          </label>
        ) : null}
      </div>
      <div className="mt-4">
        <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60">
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          {t("campaignDetail.labelsSave")}
        </button>
      </div>
        </>
      ) : null}
    </form>
  );
}

function senderOptionLabel(sender: ShippingSender, isAgency: boolean, agencyTag: string): string {
  const place = [sender.address?.city, sender.address?.state].filter(Boolean).join(" - ");
  const owner = sender.company_id == null ? agencyTag : (isAgency ? sender.company_name : null);
  return [sender.name, place, owner].filter(Boolean).join(" · ");
}
