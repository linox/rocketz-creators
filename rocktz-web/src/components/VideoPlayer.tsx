"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import {
  canPlayNativeMov,
  fetchPlaybackSource,
  mediaDownloadUrl,
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

const MIN_BUFFER_SECONDS = 3;

function keepInline(event: React.SyntheticEvent<HTMLVideoElement>) {
  const video = event.currentTarget as HTMLVideoElement & {
    webkitDisplayingFullscreen?: boolean;
    webkitExitFullscreen?: () => void;
  };
  if (video.webkitDisplayingFullscreen) video.webkitExitFullscreen?.();
  if (document.fullscreenElement === video) void document.exitFullscreen();
}

function bufferedAhead(video: HTMLVideoElement): number {
  const time = video.currentTime;
  for (let index = 0; index < video.buffered.length; index += 1) {
    if (video.buffered.start(index) <= time + 0.15 && video.buffered.end(index) >= time) {
      return video.buffered.end(index) - time;
    }
  }
  return 0;
}

function hasUsableBuffer(video: HTMLVideoElement): boolean {
  if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) return true;
  const duration = Number.isFinite(video.duration) ? video.duration : Infinity;
  const needed = Math.min(MIN_BUFFER_SECONDS, Math.max(0.6, duration - video.currentTime));
  return bufferedAhead(video) >= needed;
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
  const downloadUrl = mediaDownloadUrl(src);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(true);
  const [buffering, setBuffering] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function resolveSource() {
      const data = await fetchPlaybackSource(src);
      if (cancelled) return;
      const playable = data.src || (canPlayNativeMov() ? data.original : null);
      if (playable) {
        setPlaybackUrl(playable);
        setPreparing(false);
        return;
      }
      setPlaybackUrl(null);
      setPreparing(true);
      if (autoPlay || controls) {
        timer = window.setTimeout(() => {
          void resolveSource();
        }, 2500);
      }
    }

    setPreparing(true);
    setPlaybackUrl(null);
    void resolveSource();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [src, autoPlay, controls]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackUrl) return;

    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");

    const pump = () => {
      if (hasUsableBuffer(video)) {
        setBuffering(false);
        if (autoPlay && video.paused) void video.play().catch(() => undefined);
        return;
      }
      setBuffering(true);
      if (!video.paused && video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
        video.pause();
      }
    };

    const onWaiting = () => {
      setBuffering(true);
    };

    const blockNativeFullscreen = (event: Event) => {
      event.preventDefault();
      keepInline({ currentTarget: video } as React.SyntheticEvent<HTMLVideoElement>);
    };

    video.addEventListener("progress", pump);
    video.addEventListener("canplay", pump);
    video.addEventListener("canplaythrough", pump);
    video.addEventListener("playing", pump);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("webkitbeginfullscreen", blockNativeFullscreen);
    pump();

    return () => {
      video.removeEventListener("progress", pump);
      video.removeEventListener("canplay", pump);
      video.removeEventListener("canplaythrough", pump);
      video.removeEventListener("playing", pump);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("webkitbeginfullscreen", blockNativeFullscreen);
    };
  }, [playbackUrl, autoPlay]);

  if (preparing || !playbackUrl) {
    return (
      <div className={cn("relative flex min-h-[12rem] items-center justify-center bg-black", className)}>
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-8 text-center text-white">
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
      </div>
    );
  }

  return (
    <div className={cn("relative bg-black", className)}>
      <video
        ref={videoRef}
        src={playbackUrl}
        className={cn("h-full w-full bg-black", className)}
        controls={controls}
        muted={muted}
        loop={loop}
        playsInline
        disablePictureInPicture
        controlsList="nofullscreen"
        preload={preload ?? "auto"}
        onPlay={keepInline}
        onLoadedData={keepInline}
      />
      {buffering ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45">
          <p className="rounded-full bg-black/70 px-3 py-1.5 text-[11px] font-bold tracking-wider text-white uppercase">
            {t("campaignDetail.videoBuffering")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
