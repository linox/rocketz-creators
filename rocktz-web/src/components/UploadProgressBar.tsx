"use client";

import { useTranslation } from "react-i18next";

export function UploadProgressBar({ progress }: { progress: number }) {
  const { t } = useTranslation("profile");
  const percent = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center justify-between text-[11px] font-bold tracking-wider uppercase">
        <span className="flex items-center gap-1.5 text-[#64748B]">
          <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border border-indigo-500 border-t-transparent" />
          {percent >= 100 ? t("finishingUpload") : t("uploading")}
        </span>
        <span className="tabular-nums text-brand-primary">{percent}%</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-[#F1F5F9]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={t("uploading")}
      >
        <div className="h-full bg-brand-primary transition-[width] duration-200 ease-out" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
