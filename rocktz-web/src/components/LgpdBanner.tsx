"use client";

import { ShieldCheck, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePrivacy } from "@/lib/privacy";

export function LgpdBanner() {
  const { lgpdAccepted, acceptLgpd, openLgpd } = usePrivacy();
  const { t } = useTranslation("app");
  if (lgpdAccepted) return null;

  return (
    <div className="fixed right-4 bottom-4 left-4 z-40 max-w-md rounded-2xl border border-slate-700/80 bg-slate-900/95 p-4 text-white shadow-2xl backdrop-blur-md sm:left-auto">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/20 text-indigo-400">
          <ShieldCheck size={18} />
        </div>
        <div className="flex-1 space-y-1 pr-2 text-xs">
          <h4 className="text-xs font-extrabold uppercase tracking-wider">{t("lgpd.bannerTitle")}</h4>
          <p className="text-[11px] leading-relaxed text-slate-300">
            {t("lgpd.bannerBody")}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button type="button" onClick={acceptLgpd} className="rounded-lg bg-brand-primary px-3 py-1.5 text-[11px] font-extrabold text-white">
              {t("lgpd.agree")}
            </button>
            <button type="button" onClick={openLgpd} className="px-2.5 py-1.5 text-[11px] font-bold text-slate-300 underline">
              {t("lgpd.manage")}
            </button>
          </div>
        </div>
        <button type="button" onClick={acceptLgpd} className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white" title={t("lgpd.closeNotice")}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
