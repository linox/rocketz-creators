"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Coins, Copy, TicketPercent, Trash2 } from "lucide-react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { Select2Field } from "@/components/Select2Field";
import { api } from "@/lib/api";
import { alertApiError, alertConfirm, alertError, alertSuccess } from "@/lib/alerts";
import { formatBenefitPercent } from "@/lib/benefit-coupon";
import { useAuth } from "@/lib/use-auth";
import type { Company, CreatorCoupon, CreatorCouponCampaignOption } from "@/lib/types";

const fieldClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition-colors focus:border-purple-600";

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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

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
        if (!cancelled) setCampaigns(options.data.campaigns);
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
    if (isManager) {
      return campaigns.map((campaign) => ({ value: String(campaign.id), label: campaign.name }));
    }
    const seen = new Map<number, string>();
    coupons.forEach((coupon) => {
      if (coupon.campaign?.name) seen.set(coupon.campaign_id, coupon.campaign.name);
    });
    return [...seen.entries()].map(([id, label]) => ({ value: String(id), label }));
  }, [campaigns, coupons, isManager]);

  const visible = coupons.filter((coupon) => {
    if (campaignFilter && String(coupon.campaign_id) !== campaignFilter) return false;
    const query = search.trim().toLowerCase();
    if (!query) return true;
    const blob = [coupon.code, creatorName(coupon.creator), coupon.campaign?.name, coupon.company?.name]
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
        {isManager ? (
          <Link
            href={companyId ? `/coupon-earnings?company=${companyId}` : "/coupon-earnings"}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-white hover:bg-slate-800"
          >
            <Coins size={16} />
            {t("coupons.earnings")}
          </Link>
        ) : null}
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
            }}
          />
        </div>
      ) : null}

      {isManager && !companyId ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500">{t("coupons.pickCompany")}</p>
      ) : (
        <>
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
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase ${coupon.is_active ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500"}`}>
                      {coupon.is_active ? t("coupons.active") : t("coupons.paused")}
                    </span>
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
