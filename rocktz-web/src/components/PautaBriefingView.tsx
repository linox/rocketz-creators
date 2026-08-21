"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp } from "lucide-react";
import { parsePautaBriefing, pautaBriefingHasContent, type PautaBriefingFields } from "@/lib/pauta-briefing";

type ItemLike = {
  briefing?: string | null;
  briefing_note?: string | null;
  briefing_fields?: Partial<PautaBriefingFields> | null;
};

type Props = {
  item: ItemLike;
  title?: string;
  highlight?: boolean;
  collapsible?: boolean;
};

const SUMMARY_KEYS = ["product", "key_message"] as const;
const DETAIL_KEYS = ["must_have", "donts", "cta", "hashtags"] as const;

export function PautaBriefingView({ item, title, highlight, collapsible = false }: Props) {
  const { t } = useTranslation("app");
  const { t: tp } = useTranslation("profile");
  const [detailsOpen, setDetailsOpen] = useState(!collapsible);
  const fields = parsePautaBriefing(item);
  if (!pautaBriefingHasContent(fields)) return null;

  const labels: Record<(typeof SUMMARY_KEYS)[number] | (typeof DETAIL_KEYS)[number], string> = {
    product: tp("briefingProduct"),
    key_message: tp("briefingKeyMessage"),
    must_have: tp("briefingMustHave"),
    donts: tp("briefingDonts"),
    cta: tp("briefingCta"),
    hashtags: tp("briefingHashtags"),
  };
  const fallbacks: Record<(typeof DETAIL_KEYS)[number], string> = {
    must_have: tp("noSpecs"),
    donts: tp("noSpecs"),
    cta: tp("noCta"),
    hashtags: tp("noHashtags"),
  };
  const classNameFor = (key: string) => {
    if (key === "must_have") return "rounded-xl border border-emerald-100/60 bg-emerald-50/40 p-3 text-slate-800";
    if (key === "donts") return "rounded-xl border border-rose-100/60 bg-rose-50/40 p-3 text-slate-800";
    if (key === "hashtags") return "font-mono text-indigo-800";
    return "text-slate-800";
  };
  const labelClassFor = (key: string) => {
    if (key === "must_have") return "text-emerald-700";
    if (key === "donts") return "text-rose-600";
    if (key === "cta") return "text-brand-primary";
    if (key === "hashtags") return "text-indigo-600";
    return "text-slate-500";
  };

  const summaryRows = SUMMARY_KEYS
    .map((key) => ({ key, value: fields[key].trim() }))
    .filter((row) => row.value);
  const hasStructuredDetails = DETAIL_KEYS.some((key) => fields[key].trim());
  const showToggle = collapsible && hasStructuredDetails;
  const visibleDetails = DETAIL_KEYS.filter((key) => (collapsible && detailsOpen) || (!collapsible && fields[key].trim()));

  return (
    <div className={highlight ? "rounded-2xl ring-2 ring-indigo-200 ring-offset-2" : undefined}>
      {title ? <span className="mb-1.5 block text-[10px] font-bold tracking-wider text-slate-500 uppercase">{title}</span> : null}
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-medium sm:grid-cols-2">
        {summaryRows.map((row) => (
          <div key={row.key}>
            <span className="mb-1 block text-[9px] font-extrabold tracking-wider text-slate-500 uppercase">{labels[row.key]}</span>
            <p className="m-0 whitespace-pre-wrap leading-relaxed text-slate-800">{row.value}</p>
          </div>
        ))}
        {showToggle ? (
          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={() => setDetailsOpen((open) => !open)}
              className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-indigo-100 bg-white px-3 py-2 text-[11px] font-bold text-brand-primary transition-colors hover:bg-indigo-50"
            >
              {detailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {detailsOpen ? tp("hideBriefingDetails") : tp("showBriefingDetails")}
            </button>
          </div>
        ) : null}
        {visibleDetails.map((key) => (
          <div key={key} className={key === "must_have" || key === "donts" ? "sm:col-span-2" : undefined}>
            <span className={`mb-1 block text-[9px] font-extrabold tracking-wider uppercase ${labelClassFor(key)}`}>{labels[key]}</span>
            <p className={`m-0 whitespace-pre-wrap leading-relaxed ${classNameFor(key)}`}>
              {fields[key].trim() || (collapsible ? fallbacks[key] : "")}
            </p>
          </div>
        ))}
        {summaryRows.length === 0 && visibleDetails.length === 0 ? <p className="m-0 text-slate-500">{t("campaignDetail.notInformed")}</p> : null}
      </div>
    </div>
  );
}
