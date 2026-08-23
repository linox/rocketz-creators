"use client";

import { useTranslation } from "react-i18next";
import { agencyFeeFromBudget, parseAgencyFeePercent } from "@/lib/agency-fee";

export function AgencyFeePercentField({
  value,
  onChange,
  totalBudget,
  formatCurrency,
  disabled,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  totalBudget?: number | null;
  formatCurrency: (amount: number) => string;
  disabled?: boolean;
  id?: string;
}) {
  const { t } = useTranslation("app");
  const percent = parseAgencyFeePercent(value);
  const budget = Number(totalBudget) || 0;
  const amount = percent == null ? null : agencyFeeFromBudget(budget, percent);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">
        {t("campaigns.agencyFeePercent")}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          min="0"
          max="100"
          step="0.01"
          disabled={disabled}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 pr-8 text-xs font-semibold outline-none focus:border-brand-primary disabled:bg-slate-100"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
      </div>
      <p className="m-0 text-[10px] leading-relaxed text-slate-500">{t("campaigns.agencyFeePercentHint")}</p>
      {amount != null && budget > 0 ? (
        <p className="m-0 text-[11px] font-bold text-purple-700">{t("campaigns.agencyFeeAmount", { amount: formatCurrency(amount) })}</p>
      ) : null}
    </div>
  );
}
