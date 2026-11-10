"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchPlaybackSource, playbackCandidate } from "@/lib/media-playback";
import { cn } from "@/lib/cn";

type Props = {
  src: string;
  className?: string;
  /** Thumbnail only: metadata preload and a slower retry, for grids. */
  lite?: boolean;
};

export function VideoPoster({ src, className, lite = false }: Props) {
  const { t } = useTranslation("app");
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [frameReady, setFrameReady] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);

  useEffect(() => {
    setRejected([]);
    setPosterUrl(null);
    setPlaybackUrl(null);
    setFrameReady(false);
    setPreparing(false);
  }, [src]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    let attempts = 0;

    async function resolve() {
      const data = await fetchPlaybackSource(src);
      if (cancelled) return;
      const nextPlay = playbackCandidate(data, rejected);
      setPosterUrl(data.poster);
      setPlaybackUrl(nextPlay);
      const waiting = !data.poster && !nextPlay;
      setPreparing(Boolean(data.preparing) && waiting);
      if (waiting && (!lite || attempts < 3)) {
        attempts += 1;
        timer = window.setTimeout(() => {
          void resolve();
        }, lite ? 4000 : 2500);
      }
    }

    void resolve();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [src, rejected, lite]);

  useEffect(() => {
    if (posterUrl || !playbackUrl || frameReady) return;
    const timer = window.setTimeout(() => setFrameReady(true), 1200);
    return () => window.clearTimeout(timer);
  }, [posterUrl, playbackUrl, frameReady]);

  function revealFrame(video: HTMLVideoElement) {
    const mark = Number.isFinite(video.duration) && video.duration > 0
      ? Math.min(1, Math.max(0.2, video.duration * 0.08))
      : 0.4;
    if (video.currentTime < mark - 0.05) {
      video.currentTime = mark;
      return;
    }
    setFrameReady(true);
  }

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-slate-900", className)}>
      {posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={posterUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : playbackUrl ? (
        <video
          src={playbackUrl.includes("#") ? playbackUrl : `${playbackUrl}#t=0.4`}
          muted
          playsInline
          preload={lite ? "metadata" : "auto"}
          className={cn("h-full w-full object-cover transition-opacity duration-200", frameReady ? "opacity-100" : "opacity-0")}
          onLoadedData={(event) => revealFrame(event.currentTarget)}
          onSeeked={() => setFrameReady(true)}
          onError={() => {
            if (!playbackUrl) return;
            setPlaybackUrl(null);
            setFrameReady(false);
            setPreparing(true);
            setRejected((current) => (current.includes(playbackUrl) ? current : [...current, playbackUrl]));
          }}
        />
      ) : null}
      {preparing && !posterUrl && !frameReady ? (
        <span className="absolute inset-x-2 bottom-2 text-center text-[10px] font-bold text-white/80">
          {t("campaignDetail.videoPreparing")}
        </span>
      ) : null}
    </div>
  );
}
