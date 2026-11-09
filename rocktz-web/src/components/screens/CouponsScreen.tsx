"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Check, Coins, Copy, Download, PencilLine, Plus, TicketPercent, Trash2, X } from "lucide-react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { Select2Field } from "@/components/Select2Field";
import { api } from "@/lib/api";
import { alertApiError, alertConfirm, alertError, alertSuccess, alertWarning } from "@/lib/alerts";
import { formatBenefitPercent, parseBenefitPercent } from "@/lib/benefit-coupon";
import { useAuth } from "@/lib/use-auth";
import type { Company, CreatorCoupon, CreatorCouponCampaignOption, CreatorCouponCreator } from "@/lib/types";

const fieldClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition-colors focus:border-purple-600";
const areaClass = "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-purple-600";

function CouponChangePanel({
  coupon,
  isCreator,
  isManager,
  onChanged,
}: {
  coupon: CreatorCoupon;
  isCreator: boolean;
  isManager: boolean;
  onChanged: () => Promise<void>;
}) {
  const { t } = useTranslation("app");
  const request = coupon.change_request;
  const [open, setOpen] = useState(false);
  const [suggestedCode, setSuggestedCode] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendRequest(event: FormEvent) {
    event.preventDefault();
    const code = suggestedCode.trim().replace(/\s+/g, "").replace(/^@+/, "").toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9-]{1,39}$/.test(code)) {
      await alertWarning(t("coupons.suggestionRequired"));
      return;
    }
    setBusy(true);
    try {
      await api.requestCouponChange(coupon.id, { suggested_code: code, note: note.trim() || undefined });
      setOpen(false);
      setSuggestedCode("");
      setNote("");
      await alertSuccess(t("coupons.requestSent"), t("coupons.requestSentText"));
      await onChanged();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setBusy(false);
    }
  }

  async function cancelRequest() {
    setBusy(true);
    try {
      await api.cancelCouponChange(coupon.id);
      await alertSuccess(t("coupons.requestCancelled"));
      await onChanged();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!request) return;
    const confirmed = await alertConfirm(
      t("coupons.approveTitle"),
      t("coupons.approveText", { from: coupon.code, to: request.suggested_code }),
      t("coupons.approveChange"),
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      await api.approveCouponChange(coupon.id);
      await alertSuccess(t("coupons.changeApproved"));
      await onChanged();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!request) return;
    const confirmed = await alertConfirm(
      t("coupons.rejectTitle"),
      t("coupons.rejectText", { code: coupon.code, suggested: request.suggested_code }),
      t("coupons.rejectChange"),
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      await api.rejectCouponChange(coupon.id);
      await alertSuccess(t("coupons.changeRejected"));
      await onChanged();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setBusy(false);
    }
  }

  if (isManager && request?.status === "pending") {
    return (
      <div className="mt-auto rounded-xl border border-amber-200 bg-amber-50 p-3">
        <p className="m-0 text-[10px] font-bold tracking-wider text-amber-800 uppercase">{t("coupons.pendingChange")}</p>
        <p className="mt-1 mb-0 font-mono text-sm font-black tracking-wide text-slate-900">{request.suggested_code}</p>
        {request.note ? <p className="mt-1 mb-0 text-xs text-amber-950">{request.note}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void approve()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-950 px-3 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50">
            <Check size={14} /> {t("coupons.approveChange")}
          </button>
          <button type="button" disabled={busy} onClick={() => void reject()} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50">
            <X size={14} /> {t("coupons.rejectChange")}
          </button>
        </div>
      </div>
    );
  }

  if (!isCreator) return null;

  if (request?.status === "pending") {
    return (
      <div className="mt-auto rounded-xl border border-amber-200 bg-amber-50 p-3">
        <p className="m-0 text-[10px] font-bold tracking-wider text-amber-800 uppercase">{t("coupons.pendingChange")}</p>
        <p className="mt-1 mb-0 text-xs text-amber-950">{t("coupons.pendingHint", { code: request.suggested_code })}</p>
        {request.note ? <p className="mt-1 mb-0 text-xs text-amber-950">{request.note}</p> : null}
        <button type="button" disabled={busy} onClick={() => void cancelRequest()} className="mt-3 inline-flex h-9 items-center rounded-lg border border-amber-300 bg-white px-3 text-xs font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50">
          {t("coupons.cancelRequest")}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-auto pt-4">
      {request?.status === "rejected" ? (
        <p className="mb-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          <span className="font-bold">{t("coupons.rejectedChange")}. </span>
          {t("coupons.rejectedHint", { code: coupon.code })}
        </p>
      ) : null}
      {open ? (
        <form noValidate onSubmit={(event) => void sendRequest(event)} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">{t("coupons.suggestedCode")}</label>
          <input
            value={suggestedCode}
            onChange={(event) => setSuggestedCode(event.target.value.toUpperCase())}
            placeholder={t("coupons.suggestedCodePh")}
            maxLength={40}
            className={fieldClass}
          />
          <label className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">{t("coupons.changeNote")}</label>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t("coupons.changeNotePh")}
            maxLength={500}
            rows={2}
            className={areaClass}
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className="inline-flex h-9 items-center rounded-lg bg-slate-950 px-3 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50">
              {t("coupons.sendRequest")}
            </button>
            <button type="button" disabled={busy} onClick={() => setOpen(false)} className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {t("coupons.closeRequest")}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-violet-200 px-3 text-xs font-bold text-violet-700 hover:bg-violet-50">
          <PencilLine size={14} /> {t("coupons.requestChange")}
        </button>
      )}
    </div>
  );
}

function creatorName(creator?: { artistic_name?: string | null; full_name?: string | null } | null) {
  return creator?.artistic_name || creator?.full_name || "—";
}

function CouponsInner() {
  const user = useAuth();
  const { t } = useTranslation("app");
  const isAdmin = user.role === "admin";
  const isCreator = user.role === "creator";
  const isManager = !isCreator;
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState(isAdmin ? "" : String(user.company?.id || ""));
  const [coupons, setCoupons] = useState<CreatorCoupon[]>([]);
  const [campaigns, setCampaigns] = useState<CreatorCouponCampaignOption[]>([]);
  const [manualCreators, setManualCreators] = useState<CreatorCouponCreator[]>([]);
  const [creating, setCreating] = useState(false);
  const [manualCreatorId, setManualCreatorId] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [manualDiscount, setManualDiscount] = useState("");
  const [manualCommission, setManualCommission] = useState("");
  const [savingManual, setSavingManual] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      setCompanyId(String(user.company?.id || ""));
      return;
    }
    let cancelled = false;
    api.companies()
      .then((res) => {
        if (!cancelled) setCompanies(res.data);
      })
      .catch((err) => {
        if (!cancelled) void alertApiError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, user.company?.id]);

  useEffect(() => {
    if (isManager && !companyId) {
      setCoupons([]);
      setCampaigns([]);
      setManualCreators([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const query = isManager ? `?company_id=${companyId}` : "";
    api.coupons(query)
      .then(async (res) => {
        if (cancelled) return;
        setCoupons(res.data);
        if (!isManager) return;
        const options = await api.couponOptions(Number(companyId));
        if (!cancelled) {
          setCampaigns(options.data.campaigns);
          setManualCreators(options.data.creators);
        }
      })
      .catch((err) => {
        if (!cancelled) void alertApiError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, isManager]);

  const filterCampaigns = useMemo(() => {
    const rows = isManager
      ? campaigns.map((campaign) => ({ value: String(campaign.id), label: campaign.name }))
      : [...new Map(coupons.flatMap((coupon) => (coupon.campaign_id && coupon.campaign?.name ? [[coupon.campaign_id, coupon.campaign.name] as const] : []))).entries()].map(([id, label]) => ({ value: String(id), label }));
    return coupons.some((coupon) => coupon.campaign_id == null) ? [{ value: "manual", label: t("coupons.manual") }, ...rows] : rows;
  }, [campaigns, coupons, isManager, t]);

  const visible = coupons.filter((coupon) => {
    if (campaignFilter === "manual") return coupon.campaign_id == null;
    if (campaignFilter && String(coupon.campaign_id) !== campaignFilter) return false;
    const query = search.trim().toLowerCase();
    if (!query) return true;
    const blob = [coupon.code, coupon.change_request?.suggested_code, creatorName(coupon.creator), coupon.campaign?.name, coupon.company?.name]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return blob.includes(query);
  });

  async function reload() {
    const query = isManager ? `?company_id=${companyId}` : "";
    const list = await api.coupons(query);
    setCoupons(list.data);
    if (isManager && companyId) {
      const options = await api.couponOptions(Number(companyId));
      setCampaigns(options.data.campaigns);
      setManualCreators(options.data.creators);
    }
  }

  async function createManual(event: FormEvent) {
    event.preventDefault();
    const code = manualCode.trim().replace(/\s+/g, "").replace(/^@+/, "").toUpperCase();
    const discount = parseBenefitPercent(manualDiscount);
    const commission = parseBenefitPercent(manualCommission);
    if (!manualCreatorId || !/^[A-Z0-9][A-Z0-9-]{1,39}$/.test(code) || discount == null || commission == null) {
      await alertWarning(t("coupons.manualRequired"));
      return;
    }
    setSavingManual(true);
    try {
      await api.createCoupon({
        manual: true,
        company_id: Number(companyId),
        creator_id: Number(manualCreatorId),
        code,
        discount_percent: discount,
        commission_percent: commission,
      });
      setCreating(false);
      setManualCreatorId("");
      setManualCode("");
      setManualDiscount("");
      setManualCommission("");
      await alertSuccess(t("coupons.created"));
      await reload();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setSavingManual(false);
    }
  }

  async function toggleActive(coupon: CreatorCoupon) {
    setBusyId(coupon.id);
    try {
      await api.updateCoupon(coupon.id, { is_active: !coupon.is_active });
      await reload();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(coupon: CreatorCoupon) {
    const confirmed = await alertConfirm(t("coupons.deleteTitle"), t("coupons.deleteText", { code: coupon.code }), t("coupons.delete"));
    if (!confirmed) return;
    setBusyId(coupon.id);
    try {
      await api.deleteCoupon(coupon.id);
      await alertSuccess(t("coupons.deleted"));
      await reload();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setBusyId(null);
    }
  }

  async function exportCsv() {
    if (isManager && !companyId) return;
    setExporting(true);
    try {
      const query = isManager ? `?company_id=${companyId}` : "";
      const file = await api.downloadCoupons(query);
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      await alertApiError(err);
    } finally {
      setExporting(false);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      await alertSuccess(t("coupons.copied"), code);
    } catch {
      await alertError(t("coupons.copyFailed"));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="m-0 text-xl font-bold text-[#0F172A] sm:text-[28px]">{isCreator ? t("coupons.myTitle") : t("coupons.title")}</h1>
          <p className="mt-1 max-w-2xl text-[14px] text-[#64748B]">{isCreator ? t("coupons.mySubtitle") : t("coupons.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isManager ? (
            <>
              <button
                type="button"
                disabled={!companyId}
                onClick={() => setCreating((open) => !open)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-extrabold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                <Plus size={16} />
                {t("coupons.new")}
              </button>
              <Link
                href={companyId ? `/coupon-earnings?company=${companyId}` : "/coupon-earnings"}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-white hover:bg-slate-800"
              >
                <Coins size={16} />
                {t("coupons.earnings")}
              </Link>
            </>
          ) : null}
          <button
            type="button"
            disabled={exporting || loading || coupons.length === 0 || (isManager && !companyId)}
            onClick={() => void exportCsv()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            <Download size={16} />
            {exporting ? t("coupons.exporting") : t("coupons.export")}
          </button>
        </div>
      </header>

      {isAdmin ? (
        <div className="max-w-sm">
          <Select2Field
            theme="light"
            placeholder={t("coupons.companyPh")}
            value={companyId}
            options={companies.map((company) => ({ value: String(company.id), label: company.name }))}
            onChange={(value) => {
              setCompanyId(value);
              setCampaignFilter("");
              setCreating(false);
            }}
          />
        </div>
      ) : null}

      {isManager && !companyId ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500">{t("coupons.pickCompany")}</p>
      ) : (
        <>
          {isManager && creating ? (
            <form noValidate onSubmit={(event) => void createManual(event)} className="flex flex-col gap-4 rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
              <div>
                <h2 className="m-0 text-base font-extrabold text-slate-900">{t("coupons.manualTitle")}</h2>
                <p className="mt-1 mb-0 text-sm text-slate-500">{t("coupons.manualHint")}</p>
              </div>
              {manualCreators.length === 0 ? (
                <p className="m-0 text-sm text-slate-500">{t("coupons.noManualCreators")}</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <Select2Field
                    theme="light"
                    placeholder={t("coupons.manualCreatorPh")}
                    value={manualCreatorId}
                    options={manualCreators.map((creator) => ({
                      value: String(creator.id),
                      label: creator.artistic_name || creator.full_name || "—",
                    }))}
                    onChange={setManualCreatorId}
                  />
                  <input
                    value={manualCode}
                    onChange={(event) => setManualCode(event.target.value.toUpperCase())}
                    placeholder={t("coupons.codePh")}
                    maxLength={40}
                    className={fieldClass}
                  />
                  <input
                    inputMode="decimal"
                    value={manualDiscount}
                    onChange={(event) => setManualDiscount(event.target.value)}
                    placeholder={t("coupons.discount")}
                    className={fieldClass}
                  />
                  <input
                    inputMode="decimal"
                    value={manualCommission}
                    onChange={(event) => setManualCommission(event.target.value)}
                    placeholder={t("coupons.commission")}
                    className={fieldClass}
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={savingManual || manualCreators.length === 0} className="inline-flex h-11 items-center rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-white hover:bg-slate-800 disabled:opacity-50">
                  {t("coupons.save")}
                </button>
                <button type="button" disabled={savingManual} onClick={() => setCreating(false)} className="inline-flex h-11 items-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  {t("coupons.closeRequest")}
                </button>
              </div>
            </form>
          ) : null}
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("coupons.searchPh")}
              className={fieldClass}
            />
            <Select2Field
              theme="light"
              allowClear
              placeholder={t("coupons.allCampaigns")}
              value={campaignFilter}
              options={filterCampaigns}
              onChange={setCampaignFilter}
            />
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">{t("coupons.loading")}</p>
          ) : visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
              <TicketPercent className="mx-auto text-slate-300" size={28} />
              <p className="mt-3 text-sm font-semibold text-slate-500">
                {coupons.length === 0 ? (isCreator ? t("coupons.myEmpty") : t("coupons.empty")) : t("coupons.filteredEmpty")}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((coupon) => (
                <article key={coupon.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <p className="m-0 font-mono text-lg font-black tracking-wide text-slate-900">{coupon.code}</p>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase ${coupon.is_active ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500"}`}>
                        {coupon.is_active ? t("coupons.active") : t("coupons.paused")}
                      </span>
                      {coupon.campaign_id == null ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold tracking-wider text-slate-600 uppercase">
                          {t("coupons.manual")}
                        </span>
                      ) : null}
                      {coupon.change_request?.status === "pending" ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold tracking-wider text-amber-800 uppercase">
                          {t("coupons.pendingChange")}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 mb-0 text-sm font-semibold text-violet-700">
                    {t("coupons.line", {
                      discount: formatBenefitPercent(coupon.discount_percent),
                      commission: formatBenefitPercent(coupon.commission_percent),
                    })}
                  </p>
                  {!isCreator ? <p className="mt-3 mb-0 text-sm font-semibold text-slate-800">{creatorName(coupon.creator)}</p> : null}
                  <p className="mt-1 mb-0 text-sm text-slate-500">
                    {[coupon.campaign?.name, coupon.company?.name].filter(Boolean).join(" · ")}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => void copyCode(coupon.code)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
                      <Copy size={14} /> {t("coupons.copy")}
                    </button>
                    {isManager ? (
                      <>
                        <button type="button" disabled={busyId === coupon.id} onClick={() => void toggleActive(coupon)} className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                          {coupon.is_active ? t("coupons.pause") : t("coupons.activate")}
                        </button>
                        <button type="button" disabled={busyId === coupon.id} onClick={() => void remove(coupon)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 px-3 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                          <Trash2 size={14} /> {t("coupons.delete")}
                        </button>
                      </>
                    ) : null}
                  </div>
                  <CouponChangePanel coupon={coupon} isCreator={isCreator} isManager={isManager} onChanged={reload} />
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function CouponsScreen() {
  return (
    <AuthenticatedShell>
      <CouponsInner />
    </AuthenticatedShell>
  );
}
