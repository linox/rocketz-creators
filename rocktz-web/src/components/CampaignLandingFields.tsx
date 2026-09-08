"use client";

import { LayoutTemplate } from "lucide-react";
import { useTranslation } from "react-i18next";

export function CampaignLandingFields({
  enabled,
  onEnabledChange,
}: {
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
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
            <LayoutTemplate size={12} className="text-violet-600" /> {t("campaigns.limitLandingTitle")}
          </span>
          <span className="mt-1 block text-[10px] leading-relaxed text-[#64748B]">{t("campaigns.limitLandingHint")}</span>
        </span>
      </label>
    </div>
  );
}
