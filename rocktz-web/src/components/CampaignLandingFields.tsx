"use client";

import { useEffect, useState } from "react";
import { LayoutTemplate } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Select2Field } from "@/components/Select2Field";
import { api } from "@/lib/api";

export function CampaignLandingFields({
  enabled,
  onEnabledChange,
  companyId,
  landingPageId,
  onLandingPageIdChange,
}: {
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  companyId?: number | null;
  landingPageId: string;
  onLandingPageIdChange: (value: string) => void;
}) {
  const { t } = useTranslation("app");
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    if (!enabled || !companyId) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    api.companyLandings(companyId)
      .then((res) => {
        if (cancelled) return;
        setOptions([
          { value: "", label: t("campaigns.landingPageAny") },
          ...res.data.map((page) => ({ value: String(page.id), label: page.display_name })),
        ]);
      })
      .catch(() => {
        if (!cancelled) setOptions([{ value: "", label: t("campaigns.landingPageAny") }]);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, enabled, t]);

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
      {enabled && companyId ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.landingPage")}</label>
          <Select2Field
            theme="light"
            placeholder={t("campaigns.landingPagePh")}
            value={landingPageId}
            options={options}
            onChange={onLandingPageIdChange}
          />
        </div>
      ) : null}
    </div>
  );
}
