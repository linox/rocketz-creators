"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import {
  canPlayNativeMov,
  mediaDownloadUrl,
  mediaOriginalStreamUrl,
  mediaStreamUrl,
  videoMimeFromUrl,
} from "@/lib/media-playback";
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

function keepInline(event: React.SyntheticEvent<HTMLVideoElement>) {
  const video = event.currentTarget as HTMLVideoElement & {
    webkitDisplayingFullscreen?: boolean;
    webkitExitFullscreen?: () => void;
  };
  if (video.webkitDisplayingFullscreen) video.webkitExitFullscreen?.();
  if (document.fullscreenElement === video) void document.exitFullscreen();
}

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewUrl = mediaStreamUrl(src);
  const originalUrl = mediaOriginalStreamUrl(src);
  const downloadUrl = mediaDownloadUrl(src);
  const [playbackUrl, setPlaybackUrl] = useState(previewUrl);
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    setPlaybackUrl(previewUrl);
    setPreparing(false);
  }, [previewUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const blockNativeFullscreen = (event: Event) => {
      event.preventDefault();
      keepInline({ currentTarget: video } as React.SyntheticEvent<HTMLVideoElement>);
    };
    video.addEventListener("webkitbeginfullscreen", blockNativeFullscreen);
    return () => video.removeEventListener("webkitbeginfullscreen", blockNativeFullscreen);
  }, [playbackUrl]);

  function handleError() {
    if (playbackUrl && originalUrl && playbackUrl !== originalUrl && canPlayNativeMov()) {
      setPlaybackUrl(originalUrl);
      setPreparing(false);
      return;
    }
    setPreparing(true);
  }

  if (!previewUrl) return null;

  return (
    <div className={cn("relative bg-black", className)}>
      {!preparing ? (
        <video
          ref={videoRef}
          key={playbackUrl ?? previewUrl}
          src={playbackUrl ?? previewUrl}
          className={cn("h-full w-full bg-black", className)}
          controls={controls}
          autoPlay={autoPlay}
          muted={muted}
          loop={loop}
          playsInline
          disablePictureInPicture
          controlsList="nofullscreen"
          preload={preload ?? (autoPlay ? "auto" : "metadata")}
          onPlay={keepInline}
          onLoadedData={keepInline}
          onError={handleError}
        >
          <source src={playbackUrl ?? previewUrl} type={videoMimeFromUrl(playbackUrl ?? previewUrl)} />
        </video>
      ) : (
        <div className="flex h-full min-h-[12rem] w-full flex-col items-center justify-center gap-3 px-6 py-8 text-center text-white">
          <p className="text-sm font-semibold">{t("campaignDetail.videoPreparing")}</p>
          {controls ? (
            <a
              href={downloadUrl}
              download
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold tracking-wider text-slate-900 uppercase hover:bg-slate-100"
            >
              <Download size={12} /> {t("campaignDetail.videoPreparingDownload")}
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}
