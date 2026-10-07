"use client";

import { Cake } from "lucide-react";
import { useTranslation } from "react-i18next";

export function CampaignAgeFields({
  enabled,
  onEnabledChange,
  minAge,
  onMinAgeChange,
  maxAge,
  onMaxAgeChange,
}: {
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  minAge: string;
  onMinAgeChange: (value: string) => void;
  maxAge: string;
  onMaxAgeChange: (value: string) => void;
}) {
  const { t } = useTranslation("app");

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-violet-100 bg-violet-50/40 p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onEnabledChange(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600"
        />
        <span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <Cake size={12} className="text-violet-600" /> {t("campaigns.limitAgeTitle")}
          </span>
          <span className="mt-1 block text-[10px] leading-relaxed text-[#64748B]">{t("campaigns.limitAgeHint")}</span>
        </span>
      </label>
      {enabled ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.minAge")}</label>
            <input
              inputMode="numeric"
              value={minAge}
              onChange={(event) => onMinAgeChange(event.target.value.replace(/\D/g, "").slice(0, 3))}
              placeholder={t("campaigns.agePh")}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs outline-none focus:border-brand-primary"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.maxAge")}</label>
            <input
              inputMode="numeric"
              value={maxAge}
              onChange={(event) => onMaxAgeChange(event.target.value.replace(/\D/g, "").slice(0, 3))}
              placeholder={t("campaigns.agePh")}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs outline-none focus:border-brand-primary"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
