"use client";

import { FileSignature, Scale } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

export function CreatorContractRequiredBanner({
  onSign,
  className,
  compact = false,
}: {
  onSign: () => void;
  className?: string;
  compact?: boolean;
}) {
  const { t } = useTranslation("profile");

  return (
    <div
      role="alert"
      className={cn(
        "flex min-w-0 flex-col gap-4 overflow-hidden rounded-2xl border-2 border-violet-500/50 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-4 text-white shadow-lg shadow-violet-500/20 sm:flex-row sm:items-center sm:justify-between sm:p-5",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3.5 sm:items-center">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
          <Scale size={compact ? 20 : 22} className="shrink-0 text-violet-100" />
        </div>
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/25 bg-white/15 px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase">
              {t("contractRequiredBadge")}
            </span>
          </div>
          <h4 className="m-0 text-sm font-black tracking-tight text-white sm:text-base">
            {t("contractRequiredTitle")}
          </h4>
          <p className={cn("mt-1 text-xs leading-relaxed text-violet-100", compact ? "line-clamp-2" : "sm:text-[13px]")}>
            {t("contractRequiredBody")}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onSign}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-extrabold tracking-wider whitespace-nowrap text-violet-700 uppercase shadow-md transition hover:bg-violet-50"
      >
        <FileSignature size={16} className="shrink-0" />
        {t("contractRequiredCta")}
      </button>
    </div>
  );
}
