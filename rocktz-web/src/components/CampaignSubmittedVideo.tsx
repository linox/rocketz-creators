"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Play, Video } from "lucide-react";
import { cn } from "@/lib/cn";
import { mediaDownloadUrl } from "@/lib/media-playback";
import { VideoLightbox } from "@/components/VideoLightbox";

type Props = {
  videoUrl: string;
  fileSize?: number | null;
  className?: string;
  compact?: boolean;
};

export function CampaignSubmittedVideo({ videoUrl, className, compact = false }: Props) {
  const { t } = useTranslation("app");
  const [playing, setPlaying] = useState(false);
  const downloadUrl = mediaDownloadUrl(videoUrl);

  return (
    <>
      <div
        className={cn(
          "flex w-full items-center gap-2 rounded-xl border border-red-100 bg-red-50/50 p-3 text-xs font-bold text-slate-800",
          className,
        )}
      >
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 text-left transition-colors hover:text-brand-primary"
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
        <a
          href={downloadUrl}
          download
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-white hover:text-slate-800"
          aria-label={t("campaignDetail.downloadSubmittedVideo")}
        >
          <Download size={14} />
        </a>
      </div>
      {playing ? <VideoLightbox src={videoUrl} onClose={() => setPlaying(false)} /> : null}
    </>
  );
}
