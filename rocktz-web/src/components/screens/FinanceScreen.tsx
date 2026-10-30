"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Clock, DollarSign, FileSearch } from "lucide-react";
import { AppModal } from "@/components/AppModal";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { Select2Field } from "@/components/Select2Field";
import { UserAvatar } from "@/components/UserAvatar";
import { api, money } from "@/lib/api";
import { alertApiError, alertConfirm, alertSuccess, alertWarning } from "@/lib/alerts";
import { formatBankLines, formatPixKey } from "@/lib/bank-account";
import { maskBankPreview } from "@/lib/mask-sensitive";
import { userHasPermission } from "@/lib/auth";
import { useAuth } from "@/lib/use-auth";
import type { Company, FinancePayment, FinancePaymentList, FinancePaymentStatus } from "@/lib/types";

const fieldClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition-colors focus:border-purple-600";
const areaClass = "min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-800 outline-none transition-colors focus:border-purple-600";

function InvoiceDataNote({ text }: { text: string }) {
  const { t } = useTranslation("app");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      alertSuccess(t("finance.invoiceDataCopied"));
    } catch {
      alertWarning(t("finance.invoiceDataOnPayment"));
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">{t("finance.invoiceDataOnPayment")}</p>
        <button type="button" onClick={() => void copy()} className="text-[10px] font-black tracking-wide text-purple-700 uppercase hover:text-purple-900">
          {t("finance.copyInvoiceData")}
        </button>
      </div>
      <p className="mt-1 text-sm leading-relaxed font-medium whitespace-pre-wrap text-slate-800">{text}</p>
    </div>
  );
}

function invoicePreviewKind(row: FinancePayment): "pdf" | "image" | "file" {
  const mime = (row.invoice_mime || "").toLowerCase();
  const name = (row.invoice_filename || "").toLowerCase();
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/.test(name)) return "image";
  return "file";
}

function InvoicePreview({ row, onClose }: { row: FinancePayment; onClose: () => void }) {
  const { t } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const kind = invoicePreviewKind(row);
  const src = row.invoice_preview_url || "";

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <AppModal onClose={onClose} panelClassName="max-w-5xl" zIndexClassName="z-[120]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-950">{t("finance.invoice")}</p>
          <p className="truncate text-xs text-slate-500">{row.invoice_filename || row.title || "—"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {row.invoice_url ? (
            <a href={row.invoice_url} className="inline-flex h-9 items-center rounded-xl bg-slate-950 px-3 text-xs font-extrabold text-white hover:bg-slate-800">
              {t("finance.downloadInvoice")}
            </a>
          ) : null}
          <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-xl border border-slate-200 px-3 text-xs font-extrabold text-slate-700 hover:bg-slate-50">
            {tc("close")}
          </button>
        </div>
      </div>
      <div className="bg-slate-100">
        {kind === "pdf" && src ? (
          <iframe title={t("finance.invoice")} src={src} className="h-[75vh] w-full bg-white" />
        ) : kind === "image" && src ? (
          <img src={src} alt={row.invoice_filename || t("finance.invoice")} className="mx-auto max-h-[75vh] w-full object-contain" />
        ) : (
          <p className="px-6 py-16 text-center text-sm text-slate-600">{t("finance.previewUnsupported")}</p>
        )}
      </div>
    </AppModal>
  );
}

function personName(person?: { artistic_name?: string | null; full_name?: string | null } | null) {
  return person?.artistic_name || person?.full_name || "—";
}

function formatDay(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
}

function formatMonth(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  const [year, month] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month) return value;
  return new Date(year, month - 1, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });
}

function PayoutTip({ creator }: { creator: FinancePayment["creator"] }) {
  const { t } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const { t: profile } = useTranslation("profile");
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(true);
  const hideTimer = useRef<number | null>(null);
  const rootRef = useRef<HTMLSpanElement>(null);
  const account = creator?.bank_account;
  const pixKey = formatPixKey(account?.pix_type, account?.pix_key || creator?.pix_key);
  const bankLines = formatBankLines(account ? { ...account, pix_key: "" } : null, {
    checking: profile("bankChecking"),
    savings: profile("bankSavings"),
    agency: profile("bankAgency"),
    account: profile("bankAccount"),
  });
  const holder = account?.holder_name?.trim();
  const lines = bankLines.filter((line) => line !== holder);

  const show = () => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    setOpen(true);
  };
  const hide = () => {
    hideTimer.current = window.setTimeout(() => {
      if (rootRef.current?.contains(document.activeElement)) return;
      setOpen(false);
    }, 160);
  };
  const copyPix = async () => {
    if (!pixKey) return;
    try {
      await navigator.clipboard.writeText(pixKey);
      alertSuccess(t("finance.pixCopied"));
    } catch {
      alertWarning(t("finance.payoutEmpty"));
    }
  };

  return (
    <span
      ref={rootRef}
      className="relative mt-2 inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) hide();
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black tracking-wide text-slate-600 uppercase hover:border-purple-300 hover:text-purple-700"
      >
        {t("finance.payoutTip")}
      </button>
      {open ? (
        <span
          role="tooltip"
          className="absolute bottom-full left-0 z-30 w-80 pb-1"
        >
          <span className="flex flex-col gap-1.5 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-left text-xs font-medium text-white shadow-lg">
            {holder || lines.length || pixKey ? (
              <>
                {shown ? (
                  <>
                    {holder ? <span className="font-bold">{holder}</span> : null}
                    {lines.map((line) => (
                      <span key={line} className="text-slate-200">{line}</span>
                    ))}
                    {pixKey ? (
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0 break-words">
                          <span className="font-bold text-slate-400">{profile("pixKey")}: </span>
                          {pixKey}
                        </span>
                        <button type="button" onClick={() => void copyPix()} className="shrink-0 rounded-lg bg-white/10 px-2 py-1 text-[10px] font-black tracking-wide uppercase hover:bg-white/20">
                          {t("finance.copyPix")}
                        </button>
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="whitespace-pre-line text-slate-200">{maskBankPreview(account, creator?.pix_key)}</span>
                )}
                <button type="button" onClick={() => setShown((current) => !current)} className="self-start text-[10px] font-black tracking-wide text-purple-200 uppercase hover:text-white">
                  {shown ? tc("sensitiveHide") : tc("sensitiveShow")}
                </button>
              </>
            ) : (
              <span>{t("finance.payoutEmpty")}</span>
            )}
          </span>
        </span>
      ) : null}
    </span>
  );
}

function todayInput() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

const statusClass: Record<FinancePaymentStatus, string> = {
  awaiting_invoice: "bg-amber-50 text-amber-800",
  submitted: "bg-sky-50 text-sky-800",
  rejected: "bg-rose-50 text-rose-700",
  released: "bg-indigo-50 text-indigo-800",
  paid: "bg-emerald-50 text-emerald-800",
};

function FinanceInner() {
  const user = useAuth();
  const { t, i18n } = useTranslation("app");
  const isAdmin = user.role === "admin";
  const isCreator = user.role === "creator";
  const isManager = !isCreator;
  const canAccessFinance = !isAdmin || userHasPermission(user, "finance.access");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState(isAdmin ? "" : String(user.company?.id || ""));
  const [payments, setPayments] = useState<FinancePayment[]>([]);
  const [meta, setMeta] = useState<FinancePaymentList["meta"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [search, setSearch] = useState("");
  const [invoiceDay, setInvoiceDay] = useState("5");
  const [paymentDay, setPaymentDay] = useState("15");
  const [invoiceDataCampaign, setInvoiceDataCampaign] = useState("");
  const [invoiceDataRecurring, setInvoiceDataRecurring] = useState("");
  const [invoiceDataCoupon, setInvoiceDataCoupon] = useState("");
  const loadedSettingsFor = useRef<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [preview, setPreview] = useState<FinancePayment | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [dates, setDates] = useState<Record<number, { invoice_due_date: string; payment_due_date: string }>>({});
  const locale = i18n.language || "pt-BR";

  const dayOptions = useMemo(
    () => Array.from({ length: 28 }, (_, index) => {
      const day = String(index + 1);
      return { value: day, label: t("finance.dayOption", { day }) };
    }),
    [t],
  );

  useEffect(() => {
    if (!canAccessFinance) return;
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
  }, [canAccessFinance, isAdmin, user.company?.id]);

  useEffect(() => {
    loadedSettingsFor.current = null;
  }, [companyId]);

  useEffect(() => {
    if (!canAccessFinance) {
      setLoading(false);
      return;
    }
    if (isManager && !companyId) {
      setPayments([]);
      setMeta(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (isManager && companyId) params.set("company_id", companyId);
    if (status) params.set("status", status);
    if (source) params.set("source", source);
    const query = params.toString() ? `?${params.toString()}` : "";
    api.financePayments(query)
      .then((res) => {
        if (cancelled) return;
        setPayments(res.data);
        setMeta(res.meta);
        if (res.meta.company && loadedSettingsFor.current !== res.meta.company.id) {
          loadedSettingsFor.current = res.meta.company.id;
          setInvoiceDay(String(res.meta.company.invoice_due_day));
          setPaymentDay(String(res.meta.company.payment_due_day));
          setInvoiceDataCampaign(res.meta.company.invoice_data_campaign || "");
          setInvoiceDataRecurring(res.meta.company.invoice_data_recurring || "");
          setInvoiceDataCoupon(res.meta.company.invoice_data_coupon || "");
        }
        setDates(Object.fromEntries(res.data.map((row) => [row.id, {
          invoice_due_date: row.invoice_due_date,
          payment_due_date: row.payment_due_date || todayInput(),
        }])));
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
  }, [canAccessFinance, companyId, isManager, source, status]);

  const visible = payments.filter((row) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [row.title, isCreator ? null : personName(row.creator), row.company?.name, row.invoice_filename]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  const currency = payments[0]?.currency || "BRL";
  const counts = meta?.counts ?? {};
  const amounts = meta?.amounts ?? {};
  const sum = (...keys: string[]) => keys.reduce((total, key) => total + (amounts[key] ?? 0), 0);

  function replaceRow(row: FinancePayment) {
    setPayments((current) => current.map((item) => (item.id === row.id ? row : item)));
    setDates((current) => ({
      ...current,
      [row.id]: {
        invoice_due_date: row.invoice_due_date,
        payment_due_date: row.payment_due_date || todayInput(),
      },
    }));
  }

  async function reload() {
    const params = new URLSearchParams();
    if (isManager && companyId) params.set("company_id", companyId);
    if (status) params.set("status", status);
    if (source) params.set("source", source);
    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await api.financePayments(query);
    setPayments(res.data);
    setMeta(res.meta);
  }

  async function saveSettings() {
    if (!companyId) return;
    setSavingSettings(true);
    try {
      const saved = await api.updateFinanceSettings({
        company_id: Number(companyId),
        invoice_due_day: Number(invoiceDay),
        payment_due_day: Number(paymentDay),
        invoice_data_campaign: invoiceDataCampaign,
        invoice_data_recurring: invoiceDataRecurring,
        invoice_data_coupon: invoiceDataCoupon,
      });
      setInvoiceDataCampaign(saved.data.invoice_data_campaign || "");
      setInvoiceDataRecurring(saved.data.invoice_data_recurring || "");
      setInvoiceDataCoupon(saved.data.invoice_data_coupon || "");
      await alertSuccess(t("finance.settingsSaved"));
      await reload();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setSavingSettings(false);
    }
  }

  async function saveDates(row: FinancePayment) {
    const draft = dates[row.id];
    if (!draft?.invoice_due_date || !draft.payment_due_date) {
      await alertWarning(t("finance.saveDates"), t("finance.reasonRequired"));
      return;
    }
    setBusyId(row.id);
    try {
      const res = await api.updateFinancePayment(row.id, draft);
      replaceRow(res.data);
      await alertSuccess(t("finance.datesSaved"));
    } catch (err) {
      await alertApiError(err);
    } finally {
      setBusyId(null);
    }
  }

  async function sendInvoice(row: FinancePayment, file: File | undefined) {
    if (!file) {
      await alertWarning(t("finance.sendInvoice"), t("finance.fileRequired"));
      return;
    }
    setBusyId(row.id);
    try {
      const uploaded = await api.uploadMedia(file, file.name);
      const res = await api.submitFinanceInvoice(row.id, uploaded.data.id);
      replaceRow(res.data);
      await alertSuccess(t("finance.sent"));
      await reload();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setBusyId(null);
    }
  }

  async function approve(row: FinancePayment) {
    const due = dates[row.id]?.payment_due_date || row.payment_due_date || todayInput();
    const confirmed = await alertConfirm(
      t("finance.approveTitle"),
      t("finance.approveText", { name: personName(row.creator), date: formatDay(due, locale) }),
      t("finance.approve"),
    );
    if (!confirmed) return;
    setBusyId(row.id);
    try {
      const res = await api.approveFinancePayment(row.id, due);
      replaceRow(res.data);
      await alertSuccess(t("finance.approved"));
      await reload();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setBusyId(null);
    }
  }

  async function reject(row: FinancePayment) {
    const reason = (reasons[row.id] || "").trim();
    if (!reason) {
      await alertWarning(t("finance.reject"), t("finance.reasonRequired"));
      return;
    }
    setBusyId(row.id);
    try {
      const res = await api.rejectFinancePayment(row.id, reason);
      replaceRow(res.data);
      await alertSuccess(t("finance.rejectedOk"));
      await reload();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setBusyId(null);
    }
  }

  async function markPaid(row: FinancePayment) {
    const confirmed = await alertConfirm(
      t("finance.paidTitle"),
      t("finance.paidText", { name: personName(row.creator) }),
      t("finance.markPaid"),
    );
    if (!confirmed) return;
    setBusyId(row.id);
    try {
      const res = await api.payFinancePayment(row.id);
      replaceRow(res.data);
      await alertSuccess(t("finance.paidOk"));
      await reload();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setBusyId(null);
    }
  }

  if (!canAccessFinance) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950">{t("finance.title")}</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">{t("finance.subtitle")}</p>
        </div>
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-sm text-slate-500">{t("finance.forbidden")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-950">{isCreator ? t("finance.myTitle") : t("finance.title")}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">{isCreator ? t("finance.mySubtitle") : t("finance.subtitle")}</p>
      </div>

      {isAdmin ? (
        <Select2Field
          theme="light"
          placeholder={t("finance.companyPh")}
          value={companyId}
          options={companies.map((company) => ({ value: String(company.id), label: company.name }))}
          onChange={setCompanyId}
        />
      ) : null}

      {isManager && !companyId ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">{t("finance.pickCompany")}</p>
      ) : (
        <>
          {isManager && meta?.company ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <h2 className="text-sm font-black text-slate-900">{t("finance.settingsTitle")}</h2>
              <p className="mt-1 text-xs text-slate-500">{t("finance.settingsHint")}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                  {t("finance.invoiceDay")}
                  <Select2Field theme="light" value={invoiceDay} options={dayOptions} onChange={setInvoiceDay} />
                </label>
                <label className="flex flex-col gap-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                  {t("finance.paymentDay")}
                  <Select2Field theme="light" value={paymentDay} options={dayOptions} onChange={setPaymentDay} />
                </label>
              </div>
              <h3 className="mt-5 text-sm font-black text-slate-900">{t("finance.invoiceDataTitle")}</h3>
              <p className="mt-1 text-xs text-slate-500">{t("finance.invoiceDataHint")}</p>
              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">{t("finance.invoiceDataCampaign")}</span>
                  <textarea value={invoiceDataCampaign} onChange={(event) => setInvoiceDataCampaign(event.target.value)} maxLength={5000} placeholder={t("finance.invoiceDataPh")} className={areaClass} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">{t("finance.invoiceDataRecurring")}</span>
                  <textarea value={invoiceDataRecurring} onChange={(event) => setInvoiceDataRecurring(event.target.value)} maxLength={5000} placeholder={t("finance.invoiceDataPh")} className={areaClass} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">{t("finance.invoiceDataCoupon")}</span>
                  <textarea value={invoiceDataCoupon} onChange={(event) => setInvoiceDataCoupon(event.target.value)} maxLength={5000} placeholder={t("finance.invoiceDataPh")} className={areaClass} />
                </label>
              </div>
              <button
                type="button"
                disabled={savingSettings}
                onClick={() => void saveSettings()}
                className="mt-3 inline-flex h-11 items-center justify-center rounded-xl bg-purple-600 px-4 text-sm font-extrabold text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {t("finance.saveSettings")}
              </button>
            </section>
          ) : null}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Summary tone="amber" icon={<Clock size={18} />} label={t("finance.open")} value={money(sum("awaiting_invoice", "rejected"), currency)} hint={String((counts.awaiting_invoice ?? 0) + (counts.rejected ?? 0))} />
            <Summary tone="sky" icon={<FileSearch size={18} />} label={t("finance.toReview")} value={money(sum("submitted"), currency)} hint={String(counts.submitted ?? 0)} />
            <Summary tone="indigo" icon={<DollarSign size={18} />} label={t(isCreator ? "finance.toReceive" : "finance.toPay")} value={money(sum("released"), currency)} hint={String(counts.released ?? 0)} />
            <Summary tone="emerald" icon={<CheckCircle2 size={18} />} label={t(isCreator ? "finance.receivedTotal" : "finance.paidTotal")} value={money(sum("paid"), currency)} hint={String(counts.paid ?? 0)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t(isCreator ? "finance.searchPhMine" : "finance.searchPh")}
              className={fieldClass}
            />
            <Select2Field
              theme="light"
              value={status}
              placeholder={t("finance.allStatuses")}
              allowClear
              options={[
                { value: "awaiting_invoice", label: t("finance.awaiting") },
                { value: "submitted", label: t("finance.submitted") },
                { value: "rejected", label: t("finance.rejected") },
                { value: "released", label: t("finance.released") },
                { value: "paid", label: t("finance.paid") },
              ]}
              onChange={setStatus}
            />
            <Select2Field
              theme="light"
              value={source}
              placeholder={t("finance.allSources")}
              allowClear
              options={[
                { value: "campaign", label: t("finance.sourceCampaign") },
                { value: "coupon", label: t("finance.sourceCoupon") },
                { value: "recurring", label: t("finance.sourceRecurring") },
              ]}
              onChange={setSource}
            />
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">{t("finance.loading")}</p>
          ) : visible.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-sm text-slate-500">
              {payments.length === 0 && !status && !source && !search ? t("finance.emptyAll") : t("finance.empty")}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {visible.map((row) => {
                const draft = dates[row.id] ?? { invoice_due_date: row.invoice_due_date, payment_due_date: row.payment_due_date || todayInput() };
                const canEditDates = isManager && row.status !== "paid";
                return (
                  <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 gap-3">
                        {isManager ? (
                          <UserAvatar src={row.creator?.photo_url} name={personName(row.creator)} size="lg" shape="circle" />
                        ) : null}
                        <div className="min-w-0">
                          {isManager ? (
                            <>
                              <p className="truncate text-base font-black text-slate-950">{row.creator?.artistic_name || "—"}</p>
                              {row.creator?.full_name ? (
                                <p className="truncate text-sm font-semibold text-slate-600">{row.creator.full_name}</p>
                              ) : null}
                            </>
                          ) : null}
                          <div className={`flex flex-wrap items-center gap-2 ${isManager ? "mt-1" : ""}`}>
                            <h2 className={`text-slate-950 ${isManager ? "text-sm font-bold" : "text-base font-black"}`}>{row.title || "—"}</h2>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black tracking-wide text-slate-600 uppercase">
                              {row.source === "coupon" ? t("finance.sourceCoupon") : row.source === "recurring" ? t("finance.sourceRecurring") : t("finance.sourceCampaign")}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black tracking-wide uppercase ${statusClass[row.status]}`}>
                              {t(`finance.${row.status === "awaiting_invoice" ? "awaiting" : row.status}`)}
                            </span>
                            {row.invoice_overdue ? (
                              <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-black tracking-wide text-white uppercase">{t("finance.overdue")}</span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            {[row.company?.name, formatMonth(row.reference_month, locale)].filter(Boolean).join(" · ")}
                          </p>
                          {isManager && row.status !== "paid" ? <PayoutTip creator={row.creator} /> : null}
                        </div>
                      </div>
                      <p className="text-lg font-black text-slate-950">{money(row.amount, row.currency)}</p>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                        {t("finance.invoiceDue")}
                        {canEditDates ? (
                          <input
                            type="date"
                            value={draft.invoice_due_date}
                            onChange={(event) => setDates((current) => ({ ...current, [row.id]: { ...draft, invoice_due_date: event.target.value } }))}
                            className={fieldClass}
                          />
                        ) : (
                          <span className="text-sm font-bold normal-case text-slate-800">{formatDay(row.invoice_due_date, locale)}</span>
                        )}
                      </label>
                      <label className="flex flex-col gap-1 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                        {t(isCreator ? "finance.receiveBy" : "finance.paymentDue")}
                        {canEditDates ? (
                          <input
                            type="date"
                            value={draft.payment_due_date}
                            onChange={(event) => setDates((current) => ({ ...current, [row.id]: { ...draft, payment_due_date: event.target.value } }))}
                            className={fieldClass}
                          />
                        ) : (
                          <span className="text-sm font-bold normal-case text-slate-800">
                            {row.status === "paid" && row.paid_at ? t("finance.paidOn", { date: formatDay(row.paid_at, locale) }) : formatDay(row.payment_due_date, locale)}
                          </span>
                        )}
                      </label>
                    </div>

                    {row.invoice_data ? (
                      <InvoiceDataNote text={row.invoice_data} />
                    ) : isCreator && (row.status === "awaiting_invoice" || row.status === "rejected") ? (
                      <p className="mt-3 text-sm text-slate-500">{t("finance.invoiceDataEmpty")}</p>
                    ) : null}

                    {row.rejection_reason && row.status === "rejected" ? (
                      <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
                        <span className="font-bold">{t("finance.rejection")}: </span>
                        {row.rejection_reason}
                      </p>
                    ) : null}

                    {row.invoice_url ? (
                      <button type="button" onClick={() => setPreview(row)} className="mt-3 inline-flex text-sm font-bold text-purple-700 underline">
                        {t("finance.viewInvoice")}{row.invoice_filename ? ` · ${row.invoice_filename}` : ""}
                      </button>
                    ) : null}

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                      {isCreator && (row.status === "awaiting_invoice" || row.status === "rejected") ? (
                        <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl bg-slate-950 px-4 text-xs font-extrabold text-white hover:bg-slate-800">
                          {busyId === row.id ? t("finance.sending") : row.status === "rejected" ? t("finance.replaceInvoice") : t("finance.sendInvoice")}
                          <input
                            type="file"
                            accept="application/pdf,.pdf,.doc,.docx,image/*"
                            className="hidden"
                            disabled={busyId === row.id}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              event.target.value = "";
                              void sendInvoice(row, file);
                            }}
                          />
                        </label>
                      ) : null}
                      {canEditDates ? (
                        <button type="button" disabled={busyId === row.id} onClick={() => void saveDates(row)} className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                          {t("finance.saveDates")}
                        </button>
                      ) : null}
                      {isManager && row.status === "submitted" ? (
                        <>
                          <input
                            value={reasons[row.id] || ""}
                            onChange={(event) => setReasons((current) => ({ ...current, [row.id]: event.target.value }))}
                            placeholder={t("finance.reasonPh")}
                            className={`${fieldClass} sm:max-w-xs`}
                          />
                          <button type="button" disabled={busyId === row.id} onClick={() => void approve(row)} className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-xs font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50">
                            {t("finance.approve")}
                          </button>
                          <button type="button" disabled={busyId === row.id} onClick={() => void reject(row)} className="inline-flex h-10 items-center justify-center rounded-xl border border-rose-200 px-4 text-xs font-extrabold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                            {t("finance.reject")}
                          </button>
                        </>
                      ) : null}
                      {isManager && row.status === "released" ? (
                        <button type="button" disabled={busyId === row.id} onClick={() => void markPaid(row)} className="inline-flex h-10 items-center justify-center rounded-xl bg-indigo-600 px-4 text-xs font-extrabold text-white hover:bg-indigo-700 disabled:opacity-50">
                          {t("finance.markPaid")}
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
      {preview ? <InvoicePreview row={preview} onClose={() => setPreview(null)} /> : null}
    </div>
  );
}

const summaryTone = {
  amber: { value: "text-amber-600", badge: "bg-amber-50 text-amber-600" },
  sky: { value: "text-sky-600", badge: "bg-sky-50 text-sky-600" },
  indigo: { value: "text-brand-primary", badge: "bg-indigo-50 text-brand-primary" },
  emerald: { value: "text-emerald-600", badge: "bg-emerald-50 text-emerald-600" },
} as const;

function Summary({ label, value, hint, tone, icon }: { label: string; value: string; hint: string; tone: keyof typeof summaryTone; icon: ReactNode }) {
  const colors = summaryTone[tone];
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-4 shadow-sm">
      <div className="min-w-0">
        <p className="text-[10px] font-bold tracking-wider text-[#64748B] uppercase">{label}</p>
        <p className={`mt-1 truncate text-xl font-bold ${colors.value}`}>{value}</p>
        <p className="mt-1 text-[11px] font-medium text-slate-500">{hint}</p>
      </div>
      <div className={`shrink-0 rounded-xl p-3 ${colors.badge}`}>{icon}</div>
    </div>
  );
}

export function FinanceScreen() {
  return (
    <AuthenticatedShell>
      <FinanceInner />
    </AuthenticatedShell>
  );
}
