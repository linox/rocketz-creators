"use client";

import { FormEvent, useState } from "react";
import { ScrollText } from "lucide-react";
import { useTranslation } from "react-i18next";

type Props = {
  value: string | null;
  canEdit: boolean;
  companyName?: string | null;
  onSave?: (text: string | null) => Promise<void>;
};

export function CampaignAdditionalBriefing({ value, canEdit, companyName, onSave }: Props) {
  const { t } = useTranslation("app");
  const [draft, setDraft] = useState(value || "");
  const [saving, setSaving] = useState(false);
  const text = (value || "").trim();
  const company = companyName?.trim() || "";

  if (!canEdit && !text) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave?.(draft.trim() || null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-2">
        <ScrollText size={16} className="mt-0.5 shrink-0 text-amber-700" />
        <div>
          <p className="m-0 text-xs font-black text-slate-900">{t(canEdit ? "campaignDetail.additionalBriefingTitle" : "campaignDetail.additionalBriefingCreatorTitle")}</p>
          <p className="m-0 mt-0.5 text-[11px] leading-relaxed text-slate-500">
            {t(
              canEdit
                ? "campaignDetail.additionalBriefingHint"
                : company
                  ? "campaignDetail.additionalBriefingCreatorHint"
                  : "campaignDetail.additionalBriefingCreatorHintFallback",
              { company },
            )}
          </p>
        </div>
      </div>
      {canEdit ? (
        <>
          <textarea
            rows={5}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("campaignDetail.additionalBriefingPh")}
            className="w-full resize-y rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs leading-relaxed font-medium text-slate-800 outline-none focus:border-amber-500"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="cursor-pointer rounded-xl bg-amber-700 px-4 py-2 text-xs font-extrabold text-white hover:bg-amber-800 disabled:opacity-50"
            >
              {saving ? t("campaignDetail.additionalBriefingSaving") : t("campaignDetail.additionalBriefingSave")}
            </button>
          </div>
        </>
      ) : (
        <p className="m-0 whitespace-pre-wrap rounded-xl border border-amber-100 bg-white px-3 py-2.5 text-xs leading-relaxed font-medium text-slate-800">{text}</p>
      )}
    </form>
  );
}
