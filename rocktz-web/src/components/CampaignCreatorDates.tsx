"use client";

import { FormEvent, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

type Props = {
  generalDate: string | null;
  deliveryDate: string | null;
  postDate: string | null;
  canEdit: boolean;
  locale: string;
  onSave?: (dates: { delivery_date: string | null; post_date: string | null }) => Promise<void>;
};

function formatDate(value: string | null, locale: string) {
  if (!value) return "—";
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(locale);
}

export function CampaignCreatorDates({
  generalDate,
  deliveryDate,
  postDate,
  canEdit,
  locale,
  onSave,
}: Props) {
  const { t } = useTranslation("app");
  const [delivery, setDelivery] = useState(deliveryDate?.slice(0, 10) || "");
  const [post, setPost] = useState(postDate?.slice(0, 10) || "");
  const [saving, setSaving] = useState(false);
  const personalized = Boolean(deliveryDate);
  const effective = deliveryDate || generalDate;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave?.({
        delivery_date: delivery || null,
        post_date: post || null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
      <div className="flex items-start gap-2">
        <CalendarCheck size={16} className="mt-0.5 shrink-0 text-brand-primary" />
        <div>
          <p className="m-0 text-xs font-black text-slate-900">{t("campaignDetail.creatorDeliveryTitle")}</p>
          <p className="m-0 mt-0.5 text-[11px] leading-relaxed text-slate-500">{t("campaignDetail.creatorDeliveryHint")}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-white bg-white px-3 py-2">
          <span className="block text-[9px] font-extrabold tracking-wider text-slate-400 uppercase">{t("campaigns.generalDeliveryDate")}</span>
          <span className="mt-0.5 block text-sm font-black text-slate-800">{formatDate(generalDate, locale)}</span>
        </div>
        <div className="rounded-xl border border-white bg-white px-3 py-2">
          <span className="block text-[9px] font-extrabold tracking-wider text-slate-400 uppercase">
            {personalized ? t("campaignDetail.personalizedBadge") : t("campaignDetail.generalBadge")}
          </span>
          <span className="mt-0.5 block text-sm font-black text-slate-800">{formatDate(effective, locale)}</span>
        </div>
      </div>
      {canEdit ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">
              {t("campaignDetail.personalizedDeliveryDate")}
              <input
                type="date"
                value={delivery}
                onChange={(event) => setDelivery(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold normal-case tracking-normal text-slate-800"
              />
            </label>
            <label className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">
              {t("campaignDetail.postDate")}
              <input
                type="date"
                value={post}
                onChange={(event) => setPost(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold normal-case tracking-normal text-slate-800"
              />
            </label>
          </div>
          <p className="m-0 text-[10px] leading-relaxed text-slate-500">{t("campaignDetail.personalizedDeliveryHint")}</p>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="cursor-pointer rounded-xl bg-brand-primary px-4 py-2 text-xs font-extrabold text-white hover:bg-indigo-600 disabled:opacity-50"
            >
              {saving ? t("campaignDetail.savingDates") : t("campaignDetail.saveDates")}
            </button>
          </div>
        </>
      ) : null}
    </form>
  );
}
