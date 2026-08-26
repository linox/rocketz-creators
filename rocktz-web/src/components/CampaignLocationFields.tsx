"use client";

import { MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RegionSelect } from "@/components/GeoSelectFields";
import { DEFAULT_COUNTRY, hasRegions } from "@/lib/geo";

export function CampaignLocationFields({
  country,
  enabled,
  onEnabledChange,
  state,
  onStateChange,
  city,
  onCityChange,
}: {
  country?: string | null;
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  state: string;
  onStateChange: (value: string) => void;
  city: string;
  onCityChange: (value: string) => void;
}) {
  const { t } = useTranslation("app");
  const countryCode = country || DEFAULT_COUNTRY;
  const showRegion = hasRegions(countryCode);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-sky-100 bg-sky-50/40 p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onEnabledChange(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600"
        />
        <span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <MapPin size={12} className="text-sky-600" /> {t("campaigns.limitCityTitle")}
          </span>
          <span className="mt-1 block text-[10px] leading-relaxed text-[#64748B]">{t("campaigns.limitCityHint")}</span>
        </span>
      </label>
      {enabled ? (
        <div className={`grid gap-3 ${showRegion ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
          {showRegion ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.region")}</label>
              <RegionSelect theme="light" country={countryCode} value={state} onChange={onStateChange} placeholder={t("campaigns.regionPh")} />
            </div>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.city")}</label>
            <input
              value={city}
              onChange={(event) => onCityChange(event.target.value)}
              placeholder={t("campaigns.cityPh")}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs outline-none focus:border-brand-primary"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
