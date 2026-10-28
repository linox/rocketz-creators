"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Coins } from "lucide-react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { MoneyInput } from "@/components/MoneyInput";
import { Select2Field } from "@/components/Select2Field";
import { intlLocale, normalizeLocale } from "@/i18n/locales";
import { api, money } from "@/lib/api";
import { alertApiError, alertSuccess, alertWarning } from "@/lib/alerts";
import { moneyToMask, parseMoneyMask } from "@/lib/masks";
import { useAuth } from "@/lib/use-auth";
import type { Company, CouponEarningRow, CouponEarningSheet, FinancePaymentStatus } from "@/lib/types";

const fieldClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition-colors focus:border-purple-600";

function monthValue(offset: number) {
  const today = new Date();
  const target = new Date(today.getFullYear(), today.getMonth() - offset, 1);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
}

function monthChoices(locale: string) {
  return Array.from({ length: 12 }, (_, index) => {
    const today = new Date();
    const target = new Date(today.getFullYear(), today.getMonth() - index, 1);
    const value = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
    const raw = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(target);
    return { value, label: raw.charAt(0).toUpperCase() + raw.slice(1) };
  });
}

function personName(row: CouponEarningRow) {
  return row.artistic_name || row.full_name || "—";
}

function statusLabel(status: FinancePaymentStatus | null, t: (key: string) => string) {
  if (!status) return t("couponEarnings.open");
  if (status === "awaiting_invoice") return t("finance.awaiting");
  return t(`finance.${status}`);
}

function draftsFrom(rows: CouponEarningRow[], currency: string) {
  return Object.fromEntries(rows.map((row) => [row.creator_id, moneyToMask(row.amount, currency)]));
}

function CouponEarningsInner() {
  const user = useAuth();
  const searchParams = useSearchParams();
  const { t, i18n } = useTranslation("app");
  const locale = intlLocale(normalizeLocale(i18n.language));
  const isAdmin = user.role === "admin";
  const isCreator = user.role === "creator";
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState(isAdmin ? (searchParams.get("company") || "") : String(user.company?.id || ""));
  const [month, setMonth] = useState(monthValue(1));
  const [sheet, setSheet] = useState<CouponEarningSheet | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [shared, setShared] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const months = useMemo(() => monthChoices(locale), [locale]);
  const currency = sheet?.currency || "BRL";
  const rows = sheet?.rows || [];

  useEffect(() => {
    if (isCreator) return;
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
  }, [isAdmin, isCreator, user.company?.id]);

  useEffect(() => {
    if (isCreator || !companyId) {
      setSheet(null);
      setDrafts({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const query = `?month=${month}${isAdmin ? `&company_id=${companyId}` : ""}`;
    api.couponEarnings(query)
      .then((res) => {
        if (cancelled) return;
        setSheet(res.data);
        setDrafts(draftsFrom(res.data.rows, res.data.currency));
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
  }, [companyId, isAdmin, isCreator, month]);

  const visible = rows.filter((row) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [personName(row), row.full_name, ...row.codes].join(" ").toLowerCase().includes(term);
  });

  const total = rows.reduce((sum, row) => sum + parseMoneyMask(drafts[row.creator_id] || "", currency), 0);

  function applyToEmpty() {
    if (parseMoneyMask(shared, currency) <= 0) {
      void alertWarning(t("couponEarnings.apply"), t("couponEarnings.applyEmpty"));
      return;
    }
    setDrafts((current) => {
      const next = { ...current };
      for (const row of rows) {
        if (row.locked || (next[row.creator_id] || "").trim()) continue;
        next[row.creator_id] = shared;
      }
      return next;
    });
  }

  async function save() {
    if (!companyId) return;
    setSaving(true);
    try {
      const res = await api.saveCouponEarnings({
        ...(isAdmin ? { company_id: Number(companyId) } : {}),
        month,
        entries: rows.map((row) => {
          const draft = drafts[row.creator_id] || "";
          return {
            creator_id: row.creator_id,
            amount: draft.trim() ? parseMoneyMask(draft, currency) : null,
          };
        }),
      });
      setSheet(res.data);
      setDrafts(draftsFrom(res.data.rows, res.data.currency));
      setShared("");
      await alertSuccess(res.message || t("couponEarnings.saved"));
    } catch (error) {
      await alertApiError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="m-0 text-xl font-bold text-[#0F172A] sm:text-[28px]">{t("couponEarnings.title")}</h1>
          <p className="mt-1 max-w-2xl text-[14px] text-[#64748B]">
            {isCreator ? t("couponEarnings.creatorSubtitle") : t("couponEarnings.subtitle")}
          </p>
        </div>
        {isCreator ? (
          <Link href="/finance" className="inline-flex h-11 items-center justify-center rounded-xl bg-purple-600 px-4 text-sm font-extrabold text-white hover:bg-purple-700">
            {t("couponEarnings.openFinance")}
          </Link>
        ) : (
          <Link href="/coupons" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 hover:bg-slate-50">
            <Coins size={16} />
            {t("coupons.title")}
          </Link>
        )}
      </header>

      {isCreator ? null : (
        <>
      <div className="grid gap-3 md:grid-cols-2">
        {isAdmin ? (
          <Select2Field
            theme="light"
            placeholder={t("couponEarnings.companyPh")}
            value={companyId}
            options={companies.map((company) => ({ value: String(company.id), label: company.name }))}
            onChange={setCompanyId}
          />
        ) : null}
        <label className="flex flex-col gap-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
          {t("couponEarnings.month")}
          <Select2Field theme="light" value={month} options={months} onChange={setMonth} />
        </label>
      </div>

      {isAdmin && !companyId ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500">{t("couponEarnings.pickCompany")}</p>
      ) : loading ? (
        <p className="text-sm text-slate-500">{t("couponEarnings.loading")}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500">{t("couponEarnings.empty")}</p>
      ) : (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px_auto] lg:items-end">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("couponEarnings.searchPh")}
              className={fieldClass}
            />
            <label className="flex flex-col gap-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
              {t("couponEarnings.applyLabel")}
              <MoneyInput value={shared} onChange={setShared} currency={currency} className={fieldClass} />
            </label>
            <button
              type="button"
              onClick={applyToEmpty}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
            >
              {t("couponEarnings.apply")}
            </button>
          </div>

          {visible.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500">{t("couponEarnings.filteredEmpty")}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {visible.map((row) => (
                <article key={row.creator_id} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_200px] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-base font-black text-slate-950">{personName(row)}</p>
                    {row.full_name && row.artistic_name ? (
                      <p className="truncate text-sm font-semibold text-slate-600">{row.full_name}</p>
                    ) : null}
                    <p className="mt-1 truncate text-sm text-slate-500">{row.codes.join(" · ")}</p>
                  </div>
                  <div>
                    <p className={`text-xs font-bold tracking-wide uppercase ${row.locked ? "text-amber-700" : "text-slate-500"}`}>
                      {statusLabel(row.payment_status, t)}
                    </p>
                    {row.locked ? <p className="mt-1 text-xs text-slate-500">{t("couponEarnings.lockedHint")}</p> : null}
                  </div>
                  <label className="flex flex-col gap-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                    {t("couponEarnings.amount")}
                    <MoneyInput
                      value={drafts[row.creator_id] || ""}
                      onChange={(value) => setDrafts((current) => ({ ...current, [row.creator_id]: value }))}
                      currency={currency}
                      className={fieldClass}
                      disabled={row.locked}
                    />
                  </label>
                </article>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold text-slate-600">
              {t("couponEarnings.total")}: <span className="text-base font-black text-slate-950">{money(total, currency)}</span>
            </p>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-purple-600 px-5 text-sm font-extrabold text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? t("couponEarnings.saving") : t("couponEarnings.save")}
            </button>
          </div>
        </form>
      )}
        </>
      )}
    </div>
  );
}

export function CouponEarningsScreen() {
  return (
    <AuthenticatedShell>
      <CouponEarningsInner />
    </AuthenticatedShell>
  );
}
