"use client";

import { TicketPercent } from "lucide-react";
import { useTranslation } from "react-i18next";
import { benefitCouponPattern } from "@/lib/benefit-coupon";

export function BenefitCouponFields({
  enabled,
  onEnabledChange,
  code,
  onCodeChange,
  discount,
  onDiscountChange,
  commission,
  onCommissionChange,
}: {
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  code: string;
  onCodeChange: (value: string) => void;
  discount: string;
  onDiscountChange: (value: string) => void;
  commission: string;
  onCommissionChange: (value: string) => void;
}) {
  const { t } = useTranslation("app");

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-violet-100 bg-violet-50/50 p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onEnabledChange(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600"
        />
        <span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <TicketPercent size={12} className="text-violet-600" /> {t("campaigns.benefitCouponTitle")}
          </span>
          <span className="mt-1 block text-[10px] leading-relaxed text-[#64748B]">{t("campaigns.benefitCouponHint")}</span>
        </span>
      </label>
      {enabled ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5 sm:col-span-1">
              <label className="text-[10px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.benefitCouponCode")}</label>
              <input
                value={code}
                onChange={(event) => onCodeChange(event.target.value.toUpperCase())}
                placeholder={t("campaigns.benefitCouponCodePh")}
                maxLength={20}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-bold tracking-wide uppercase outline-none focus:border-violet-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.benefitDiscount")}</label>
              <input
                inputMode="decimal"
                value={discount}
                onChange={(event) => onDiscountChange(event.target.value)}
                placeholder={t("campaigns.benefitDiscountPh")}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-violet-500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.benefitCommission")}</label>
              <input
                inputMode="decimal"
                value={commission}
                onChange={(event) => onCommissionChange(event.target.value)}
                placeholder={t("campaigns.benefitCommissionPh")}
                className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-violet-500"
              />
            </div>
          </div>
          <p className="m-0 text-[11px] font-semibold text-violet-700">{t("campaigns.benefitCouponPreview", { code: benefitCouponPattern(t, code) })}</p>
        </>
      ) : null}
    </div>
  );
}
