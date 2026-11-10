"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import {
  fetchPlaybackSource,
  mediaDownloadUrl,
  mediaPosterUrl,
  playbackCandidate,
} from "@/lib/media-playback";
import { useLoadedImage } from "@/lib/use-loaded-image";
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
  const loadedRef = useRef(false);
  const urlRef = useRef<string | null>(null);
  const attemptsRef = useRef<Record<string, number>>({});
  const retryTimers = useRef<number[]>([]);
  const downloadUrl = mediaDownloadUrl(src);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [poster, setPoster] = useState<string | null>(() => mediaPosterUrl(src));
  const visiblePoster = useLoadedImage(poster).url;
  const [preparing, setPreparing] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);

  useEffect(() => {
    setRejected([]);
    setPoster(mediaPosterUrl(src));
    loadedRef.current = false;
    urlRef.current = null;
    attemptsRef.current = {};
  }, [src]);

  useEffect(() => {
    return () => {
      retryTimers.current.forEach((id) => window.clearTimeout(id));
      retryTimers.current = [];
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function resolveSource() {
      const data = await fetchPlaybackSource(src);
      if (cancelled) return;
      if (loadedRef.current && urlRef.current && !rejected.includes(urlRef.current)) {
        return;
      }
      const playable = playbackCandidate(data, rejected);
      setPoster((current) => data.poster || current || mediaPosterUrl(src));
      if (playable) {
        if (urlRef.current !== playable) loadedRef.current = false;
        urlRef.current = playable;
        setPlaybackUrl(playable);
        setPreparing(false);
        if (!data.src && data.preparing) {
          timer = window.setTimeout(() => {
            void resolveSource();
          }, 4000);
        }
        return;
      }
      urlRef.current = null;
      loadedRef.current = false;
      setPlaybackUrl(null);
      setPreparing(true);
      if (autoPlay || controls) {
        timer = window.setTimeout(() => {
          void resolveSource();
        }, 2500);
      }
    }

    void resolveSource();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [src, autoPlay, controls, rejected]);

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
      <div className={cn("relative flex min-h-[12rem] items-center justify-center overflow-hidden bg-black", className)}>
        {visiblePoster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={visiblePoster} alt="" className="absolute inset-0 h-full w-full object-contain" />
        ) : null}
        <div className="relative z-10 flex flex-col items-center justify-center gap-3 px-6 py-8 text-center text-white">
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
        poster={visiblePoster ?? undefined}
        preload={preload ?? "auto"}
        onPlay={keepInline}
        onLoadedData={(event) => {
          loadedRef.current = true;
          keepInline(event);
        }}
        onError={() => {
          if (!playbackUrl) return;
          const failed = playbackUrl;
          loadedRef.current = false;
          urlRef.current = null;
          setPlaybackUrl(null);
          setPreparing(true);
          const attempts = (attemptsRef.current[failed] ?? 0) + 1;
          attemptsRef.current[failed] = attempts;
          setRejected((current) => (current.includes(failed) ? current : [...current, failed]));
          if (attempts < 6) {
            const timer = window.setTimeout(() => {
              setRejected((current) => current.filter((url) => url !== failed));
            }, 2000);
            retryTimers.current.push(timer);
          }
        }}
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
