"use client";

import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";

export function parseApprovedLimit(enabled: boolean, raw: string): { ok: true; max_approved_creators: number | null } | { ok: false } {
  if (!enabled) return { ok: true, max_approved_creators: null };
  const value = Number(raw);
  if (!raw.trim() || !Number.isInteger(value) || value < 1 || value > 10000) return { ok: false };
  return { ok: true, max_approved_creators: value };
}

export function CampaignApprovedLimitFields({
  enabled,
  onEnabledChange,
  maxApproved,
  onMaxApprovedChange,
}: {
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  maxApproved: string;
  onMaxApprovedChange: (value: string) => void;
}) {
  const { t } = useTranslation("app");

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onEnabledChange(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-700"
        />
        <span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <Users size={12} className="text-slate-700" /> {t("campaigns.limitApprovedTitle")}
          </span>
          <span className="mt-1 block text-[10px] leading-relaxed text-[#64748B]">{t("campaigns.limitApprovedHint")}</span>
        </span>
      </label>
      {enabled ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold tracking-wider text-[#64748B] uppercase">{t("campaigns.maxApproved")}</label>
          <input
            inputMode="numeric"
            value={maxApproved}
            onChange={(event) => onMaxApprovedChange(event.target.value.replace(/\D/g, "").slice(0, 5))}
            placeholder={t("campaigns.maxApprovedPh")}
            className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs outline-none focus:border-brand-primary sm:w-40"
          />
        </div>
      ) : null}
    </div>
  );
}
