"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { VideoPlayer } from "@/components/VideoPlayer";
import { cn } from "@/lib/cn";

type Props = {
  src: string;
  onClose: () => void;
  className?: string;
  closeLabel?: string;
};

export function VideoLightbox({ src, onClose, className, closeLabel }: Props) {
  const { t } = useTranslation("app");
  const [mounted, setMounted] = useState(false);
  const label = closeLabel ?? t("campaignDetail.closeVideoPlayer");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/80 p-4">
      <button type="button" className="absolute inset-0 cursor-pointer" aria-label={label} onClick={onClose} />
      <div className={cn("relative z-10 w-full max-w-4xl overflow-hidden rounded-2xl bg-black shadow-2xl", className)}>
        <VideoPlayer src={src} autoPlay className="max-h-[80vh] w-full object-contain" />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 cursor-pointer rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-800"
        >
          {label}
        </button>
      </div>
    </div>,
    document.body,
  );
}
