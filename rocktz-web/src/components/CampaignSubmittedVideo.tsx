"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Play, Video } from "lucide-react";
import { cn } from "@/lib/cn";
import { isPlayableVideoSize, mediaDownloadUrl } from "@/lib/media-playback";

type Props = {
  videoUrl: string;
  fileSize?: number | null;
  className?: string;
  compact?: boolean;
};

export function CampaignSubmittedVideo({ videoUrl, fileSize, className, compact = false }: Props) {
  const { t } = useTranslation("app");
  const [playing, setPlaying] = useState(false);
  const playable = isPlayableVideoSize(fileSize);
  const downloadUrl = mediaDownloadUrl(videoUrl);

  if (playable) {
    return (
      <>
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className={cn(
            "flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50/50 p-3 text-left text-xs font-bold text-slate-800 transition-colors hover:bg-red-50",
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
              <Play size={16} fill="currentColor" className="translate-x-0.5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate">{compact ? t("campaignDetail.watchSubmittedVideo") : t("campaignDetail.submittedVideoTitle")}</span>
              {!compact ? <span className="mt-0.5 block text-[10px] font-semibold tracking-wider text-brand-primary uppercase">{t("campaignDetail.watchSubmittedVideo")}</span> : null}
            </span>
          </span>
          <Video size={14} className="shrink-0 text-slate-400" />
        </button>
        {playing ? (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 p-4">
            <button type="button" className="absolute inset-0" aria-label={t("campaignDetail.closeVideoPlayer")} onClick={() => setPlaying(false)} />
            <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-2xl bg-black shadow-2xl">
              <video src={videoUrl} controls autoPlay className="max-h-[80vh] w-full" />
              <button
                type="button"
                onClick={() => setPlaying(false)}
                className="absolute top-3 right-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-800"
              >
                {t("campaignDetail.closeVideoPlayer")}
              </button>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <a
      href={downloadUrl}
      download
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-800 transition-colors hover:bg-slate-100",
        className,
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-700">
          <Download size={16} />
        </span>
        <span className="min-w-0">
          <span className="block truncate">{compact ? t("campaignDetail.downloadSubmittedVideo") : t("campaignDetail.submittedVideoTitle")}</span>
          {!compact ? <span className="mt-0.5 block text-[10px] font-semibold tracking-wider text-slate-500 uppercase">{t("campaignDetail.submittedVideoLargeHint")}</span> : null}
        </span>
      </span>
      <Download size={14} className="shrink-0 text-slate-400" />
    </a>
  );
}
