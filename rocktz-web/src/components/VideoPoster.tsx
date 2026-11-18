"use client";

import { useEffect, useRef, useState } from "react";
import { useVideoCover } from "@/lib/use-video-cover";
import { mediaStreamUrl } from "@/lib/media-playback";
import { cn } from "@/lib/cn";

type Props = {
  src: string;
  className?: string;
  /** Kept so grids can opt into the same shared cover. */
  lite?: boolean;
  fit?: "cover" | "contain";
  /** Paint a paused frame while the stored JPEG is still being created. */
  frame?: boolean;
};

export function VideoPoster({ src, className, fit = "cover", frame = false }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [frameBroken, setFrameBroken] = useState(false);
  const cover = useVideoCover(src, visible);
  const fitClass = fit === "contain" ? "object-contain" : "object-cover";
  const stream = frame && visible && !cover.url && cover.failed && !frameBroken ? mediaStreamUrl(src) : null;

  useEffect(() => {
    setFrameBroken(false);
  }, [src]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(Boolean(entry?.isIntersecting));
    }, { rootMargin: "240px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className={cn("relative h-full w-full overflow-hidden bg-slate-900", className)}>
      {cover.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover.url} alt="" decoding="async" className={cn("h-full w-full", fitClass)} />
      ) : stream ? (
        <video
          src={stream.includes("#") ? stream : `${stream}#t=0.1`}
          muted
          playsInline
          preload="metadata"
          disablePictureInPicture
          aria-hidden
          tabIndex={-1}
          className={cn("pointer-events-none h-full w-full", fitClass)}
          onError={() => setFrameBroken(true)}
          onLoadedData={(event) => {
            event.currentTarget.pause();
          }}
        />
      ) : null}
    </div>
  );
}
