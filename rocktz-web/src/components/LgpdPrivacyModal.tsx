"use client";

import { Eye, EyeOff, ShieldCheck, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePrivacy } from "@/lib/privacy";

export function LgpdPrivacyModal() {
  const { lgpdOpen, closeLgpd, hideValues, toggleHideValues, acceptLgpd } = usePrivacy();
  const { t } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  if (!lgpdOpen) return null;

  return (
    <div className="app-modal-overlay fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={closeLgpd}>
      <div className="app-modal-panel w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">{t("lgpd.law")}</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{t("lgpd.center")}</h2>
          </div>
          <button type="button" onClick={closeLgpd} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 px-6 py-5 text-sm text-slate-600">
          <p>{t("lgpd.body")}</p>
          <button
            type="button"
            onClick={toggleHideValues}
            className="flex w-full items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-left"
          >
            <span className="flex items-center gap-2 font-bold text-slate-900">
              {hideValues ? <EyeOff size={16} /> : <Eye size={16} />}
              {t("lgpd.hideMoney")}
            </span>
            <span className="text-xs font-black uppercase text-indigo-600">{hideValues ? t("lgpd.on") : t("lgpd.off")}</span>
          </button>
          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
            <ShieldCheck size={14} className="mb-1 inline" /> {t("lgpd.stored")}
          </div>
        </div>
        <div className="flex gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={closeLgpd} className="flex-1 rounded-xl border py-3 text-sm font-bold">
            {tc("close")}
          </button>
          <button type="button" onClick={acceptLgpd} className="flex-1 rounded-xl bg-brand-primary py-3 text-sm font-bold text-white">
            {t("lgpd.agree")}
          </button>
        </div>
      </div>
    </div>
  );
}
