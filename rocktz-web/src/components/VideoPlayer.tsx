"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { mediaDownloadUrl, mediaStreamUrl, videoMimeFromUrl } from "@/lib/media-playback";
import { cn } from "@/lib/cn";

type Props = {
  src: string;
  className?: string;
  autoPlay?: boolean;
  controls?: boolean;
  muted?: boolean;
  loop?: boolean;
  preload?: "none" | "metadata" | "auto";
};

export function VideoPlayer({
  src,
  className,
  autoPlay = false,
  controls = true,
  muted,
  loop,
  preload,
}: Props) {
  const { t } = useTranslation("app");
  const [failed, setFailed] = useState(false);
  const url = mediaStreamUrl(src);
  if (!url) return null;

  if (failed) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-3 bg-slate-950 p-8 text-center", className)}>
        <p className="text-sm font-semibold text-white">{t("campaignDetail.videoPlaybackError")}</p>
        <a
          href={mediaDownloadUrl(src)}
          className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-900"
        >
          {t("campaignDetail.downloadSubmittedVideo")}
        </a>
      </div>
    );
  }

  return (
    <video
      className={cn("bg-black", className)}
      controls={controls}
      autoPlay={autoPlay}
      muted={muted}
      loop={loop}
      playsInline
      preload={preload ?? (autoPlay ? "auto" : "metadata")}
      onError={() => setFailed(true)}
    >
      <source src={url} type={videoMimeFromUrl(url)} />
    </video>
  );
}
