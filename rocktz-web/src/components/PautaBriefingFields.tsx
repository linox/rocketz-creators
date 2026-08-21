"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { PautaBriefingFields } from "@/lib/pauta-briefing";

type Props = {
  value: PautaBriefingFields;
  onChange: (value: PautaBriefingFields) => void;
  optional?: boolean;
};

export function PautaBriefingFieldsForm({ value, onChange, optional }: Props) {
  const { t } = useTranslation("app");

  function patch(key: keyof PautaBriefingFields, next: string) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">
          {t("campaigns.briefingProduct")}
          {optional ? null : " *"}
        </label>
        <input
          value={value.product}
          onChange={(event) => patch("product", event.target.value)}
          placeholder={t("campaigns.briefingProductPh")}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-brand-primary"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">{t("campaigns.briefingMessage")}</label>
        <textarea
          rows={2}
          value={value.key_message}
          onChange={(event) => patch("key_message", event.target.value)}
          placeholder={t("campaigns.briefingMessagePh")}
          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-brand-primary"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold tracking-wider text-emerald-700 uppercase">{t("campaigns.briefingMust")}</label>
          <textarea
            rows={3}
            value={value.must_have}
            onChange={(event) => patch("must_have", event.target.value)}
            placeholder={t("campaigns.briefingMustPh")}
            className="w-full resize-none rounded-xl border border-emerald-200 bg-emerald-50/20 px-3 py-2 text-xs outline-none focus:border-emerald-500"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold tracking-wider text-rose-700 uppercase">{t("campaigns.briefingDonts")}</label>
          <textarea
            rows={3}
            value={value.donts}
            onChange={(event) => patch("donts", event.target.value)}
            placeholder={t("campaigns.briefingDontsPh")}
            className="w-full resize-none rounded-xl border border-rose-200 bg-rose-50/20 px-3 py-2 text-xs outline-none focus:border-rose-500"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold tracking-wider text-brand-primary uppercase">{t("campaigns.briefingCta")}</label>
        <input
          value={value.cta}
          onChange={(event) => patch("cta", event.target.value)}
          placeholder={t("campaigns.briefingCtaPh")}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-brand-primary"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold tracking-wider text-indigo-700 uppercase">{t("campaigns.briefingHashtags")}</label>
        <input
          value={value.hashtags}
          onChange={(event) => patch("hashtags", event.target.value)}
          placeholder={t("campaigns.briefingHashtagsPh")}
          className={cn("w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs outline-none focus:border-brand-primary")}
        />
      </div>
    </div>
  );
}
