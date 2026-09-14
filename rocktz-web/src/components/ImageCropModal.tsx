"use client";

import { useCallback, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import Cropper, { type Area } from "react-easy-crop";
import { Check, X } from "lucide-react";
import { motion } from "motion/react";
import { getCroppedImageBlob } from "@/lib/crop-image";

type ImageCropModalProps = {
  imageSrc: string;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
  aspect?: number;
  outputWidth?: number;
  outputHeight?: number;
  title?: string;
  formatLabel?: string;
  hint?: string;
  confirmLabel?: string;
  /** Aspect of a nested “mobile” frame inside a wide crop; dims the desktop-only sides. */
  safeZoneAspect?: number;
};

function safeZoneSidePercent(cropAspect: number, safeAspect: number) {
  if (!(cropAspect > 0) || !(safeAspect > 0) || safeAspect >= cropAspect) return 0;
  return ((cropAspect - safeAspect) / cropAspect / 2) * 100;
}

export function ImageCropModal({
  imageSrc,
  onCancel,
  onConfirm,
  aspect = 1,
  outputWidth = 512,
  outputHeight = 512,
  title,
  formatLabel,
  hint,
  confirmLabel,
  safeZoneAspect,
}: ImageCropModalProps) {
  const { t } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setPixels(croppedAreaPixels);
  }, []);
  const isWide = aspect >= 1.6;
  const safeInset = safeZoneAspect ? safeZoneSidePercent(aspect, safeZoneAspect) : 0;

  async function handleConfirm() {
    if (!pixels) return;
    setBusy(true);
    try {
      const blob = await getCroppedImageBlob(imageSrc, pixels, { width: outputWidth, height: outputHeight });
      onConfirm(blob);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-modal-overlay fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" aria-hidden />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`app-modal-panel relative z-10 flex w-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl ${isWide ? "max-w-3xl" : "max-w-lg"}`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-[10px] font-black tracking-widest text-brand-primary uppercase">{formatLabel || t("editProfile.cropFormat")}</p>
            <h3 className="text-base font-black text-slate-900">{title || t("editProfile.cropTitle")}</h3>
          </div>
          <button type="button" onClick={onCancel} className="cursor-pointer rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>

        <div className={`relative bg-slate-900 ${isWide ? "h-[200px] sm:h-[260px]" : "h-[360px]"}`}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape="rect"
            showGrid
            classes={safeInset > 0 ? { cropAreaClassName: "banner-hero-crop-area" } : undefined}
            style={
              safeInset > 0
                ? { cropAreaStyle: { ["--banner-safe-inset" as string]: `${safeInset}%` } as CSSProperties }
                : undefined
            }
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="space-y-4 p-5">
          {hint ? <p className="text-[11px] leading-relaxed font-medium text-slate-500">{hint}</p> : null}
          <label className="flex items-center gap-3 text-xs font-bold text-slate-600">
            <span className="w-14 uppercase tracking-wider">{t("editProfile.zoom")}</span>
            <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="h-1.5 flex-1 accent-brand-primary" />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCancel} className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
              {tc("cancel")}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy || !pixels}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-brand-primary px-5 py-2.5 text-xs font-extrabold text-white shadow-md shadow-indigo-100 hover:bg-indigo-600 disabled:opacity-50"
            >
              <Check size={15} />
              {busy ? t("editProfile.cropping") : confirmLabel || t("editProfile.usePhoto")}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
