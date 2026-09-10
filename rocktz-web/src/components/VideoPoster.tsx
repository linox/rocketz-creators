"use client";

import { useEffect, useState } from "react";
import { fetchPlaybackSource } from "@/lib/media-playback";
import { cn } from "@/lib/cn";

type Props = {
  src: string;
  className?: string;
};

export function VideoPoster({ src, className }: Props) {
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [frameReady, setFrameReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPosterUrl(null);
    setPlaybackUrl(null);
    setFrameReady(false);
    void fetchPlaybackSource(src).then((data) => {
      if (cancelled) return;
      setPosterUrl(data.poster);
      setPlaybackUrl(data.src || data.original);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

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
        <img src={posterUrl} alt="" className="h-full w-full object-cover" />
      ) : playbackUrl ? (
        <video
          src={playbackUrl.includes("#") ? playbackUrl : `${playbackUrl}#t=0.4`}
          muted
          playsInline
          preload="auto"
          className={cn("h-full w-full object-cover transition-opacity duration-200", frameReady ? "opacity-100" : "opacity-0")}
          onLoadedData={(event) => revealFrame(event.currentTarget)}
          onSeeked={() => setFrameReady(true)}
        />
      ) : null}
    </div>
  );
}
