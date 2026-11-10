"use client";

import { FormEvent, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";

const TYPES = ["reels", "stories", "live_instagram", "tiktok", "live_tiktok", "ugc", "posts", "youtube", "live_youtube"] as const;

type Counts = Record<(typeof TYPES)[number], string>;

type Props = {
  campaignDefaults?: Record<string, string | number | null> | null;
  value?: Record<string, number> | null;
  onSave: (value: Record<string, number> | null) => Promise<void>;
};

function countsFrom(source?: Record<string, string | number | null> | null): Counts {
  return {
    reels: String(source?.reels ?? 0),
    stories: String(source?.stories ?? 0),
    tiktok: String(source?.tiktok ?? 0),
    ugc: String(source?.ugc ?? 0),
    posts: String(source?.posts ?? 0),
    youtube: String(source?.youtube ?? 0),
    live_instagram: String(source?.live_instagram ?? 0),
    live_tiktok: String(source?.live_tiktok ?? 0),
    live_youtube: String(source?.live_youtube ?? 0),
  };
}

function asNumbers(counts: Counts): Record<string, number> {
  return {
    reels: Number(counts.reels) || 0,
    stories: Number(counts.stories) || 0,
    tiktok: Number(counts.tiktok) || 0,
    ugc: Number(counts.ugc) || 0,
    posts: Number(counts.posts) || 0,
    youtube: Number(counts.youtube) || 0,
    live_instagram: Number(counts.live_instagram) || 0,
    live_tiktok: Number(counts.live_tiktok) || 0,
    live_youtube: Number(counts.live_youtube) || 0,
  };
}

export function CampaignCreatorDeliverables({ campaignDefaults, value, onSave }: Props) {
  const { t } = useTranslation("app");
  const defaults = countsFrom(campaignDefaults);
  const [counts, setCounts] = useState<Counts>(countsFrom(value ?? campaignDefaults));
  const [saving, setSaving] = useState(false);
  const personalized = value != null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next = asNumbers(counts);
    const matchesDefault = TYPES.every((type) => next[type] === (Number(defaults[type]) || 0));
    setSaving(true);
    try {
      await onSave(matchesDefault ? null : next);
    } finally {
      setSaving(false);
    }
  }

  async function resetDefault() {
    setCounts(defaults);
    setSaving(true);
    try {
      await onSave(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-white p-4 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <SlidersHorizontal size={16} className="mt-0.5 shrink-0 text-brand-primary" />
          <div>
            <p className="m-0 text-xs font-black text-slate-900">{t("campaignDetail.creatorDeliverablesTitle")}</p>
            <p className="m-0 mt-0.5 text-[11px] leading-relaxed text-slate-500">{t("campaignDetail.creatorDeliverablesHint")}</p>
          </div>
        </div>
        <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-brand-primary uppercase">
          {personalized ? t("campaignDetail.creatorDeliverablesCustom") : t("campaignDetail.creatorDeliverablesStandard")}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TYPES.map((type) => (
          <label key={type} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="block text-[9px] font-extrabold tracking-wider text-slate-500 uppercase">{t(`campaignDetail.${type}`)}</span>
            <input
              type="number"
              min={0}
              max={50}
              inputMode="numeric"
              value={counts[type]}
              onChange={(event) => setCounts((current) => ({ ...current, [type]: event.target.value }))}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm font-black text-slate-900 outline-none focus:border-brand-primary"
            />
            <span className="mt-1 block text-[10px] font-semibold text-slate-400">
              {t("campaignDetail.creatorDeliverablesDefault", { count: Number(defaults[type]) || 0 })}
            </span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {personalized ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => void resetDefault()}
            className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {t("campaignDetail.creatorDeliverablesUseDefault")}
          </button>
        ) : null}
        <button
          type="submit"
          disabled={saving}
          className="cursor-pointer rounded-xl bg-brand-primary px-4 py-2 text-xs font-extrabold text-white hover:bg-indigo-600 disabled:opacity-50"
        >
          {saving ? t("campaignDetail.creatorDeliverablesSaving") : t("campaignDetail.creatorDeliverablesSave")}
        </button>
      </div>
    </form>
  );
}
