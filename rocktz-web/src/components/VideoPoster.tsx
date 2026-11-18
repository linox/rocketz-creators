"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { mediaFrameUrl } from "@/lib/media-playback";
import { useVideoCover } from "@/lib/use-video-cover";
import { cn } from "@/lib/cn";

type Props = {
  src: string;
  className?: string;
  /** Kept so grids can opt into the same shared cover. */
  lite?: boolean;
  fit?: "cover" | "contain";
};

const FRAME_LIMIT = 2;
let frameActive = 0;
const frameQueue: Array<() => void> = [];

function acquireFrame(): Promise<() => void> {
  return new Promise((resolve) => {
    const start = () => {
      frameActive += 1;
      let released = false;
      resolve(() => {
        if (released) return;
        released = true;
        frameActive -= 1;
        frameQueue.shift()?.();
      });
    };
    if (frameActive < FRAME_LIMIT) start();
    else frameQueue.push(start);
  });
}

export function VideoPoster({ src, className, fit = "cover" }: Props) {
  const cover = useVideoCover(src);
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const fitClass = fit === "contain" ? "object-contain" : "object-cover";

  useEffect(() => {
    const node = rootRef.current;
    if (!node || cover.url) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisible(true);
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [cover.url]);

  return (
    <div ref={rootRef} className={cn("relative h-full w-full overflow-hidden bg-slate-900", className)}>
      {cover.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover.url} alt="" decoding="async" className={cn("h-full w-full", fitClass)} />
      ) : visible ? (
        <CoverFrame src={src} fitClass={fitClass} />
      ) : null}
    </div>
  );
}

function CoverFrame({ src, fitClass }: { src: string; fitClass: string }) {
  const url = mediaFrameUrl(src);
  const [still, setStill] = useState<string | null>(null);
  const [anonymous, setAnonymous] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const releaseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    void acquireFrame().then((release) => {
      if (cancelled) {
        release();
        return;
      }
      releaseRef.current = release;
      setAllowed(true);
    });
    return () => {
      cancelled = true;
      releaseRef.current?.();
      releaseRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!still) return;
    releaseRef.current?.();
    releaseRef.current = null;
  }, [still]);

  useEffect(() => {
    return () => {
      if (still) URL.revokeObjectURL(still);
    };
  }, [still]);

  if (!url || !allowed) return null;
  if (still) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={still} alt="" decoding="async" className={cn("h-full w-full", fitClass)} />;
  }

  return (
    <video
      key={anonymous ? "cors" : "plain"}
      src={url}
      crossOrigin={anonymous ? "anonymous" : undefined}
      muted
      playsInline
      preload="auto"
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 h-full w-full", fitClass)}
      onLoadedMetadata={(event) => {
        const video = event.currentTarget;
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        const target = duration > 0.3 ? Math.min(0.5, duration * 0.08) : 0;
        if (target > 0 && video.currentTime < 0.05) {
          video.currentTime = target;
          return;
        }
        captureFrame(video, setStill);
      }}
      onSeeked={(event) => {
        captureFrame(event.currentTarget, setStill);
        releaseRef.current?.();
        releaseRef.current = null;
      }}
      onError={() => {
        if (anonymous) {
          setAnonymous(false);
          return;
        }
        releaseRef.current?.();
        releaseRef.current = null;
      }}
    />
  );
}

function captureFrame(video: HTMLVideoElement, setStill: Dispatch<SetStateAction<string | null>>) {
  if (video.videoWidth < 2 || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
  video.pause();
  const longest = Math.max(video.videoWidth, video.videoHeight);
  const scale = Math.min(1, 720 / longest);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) return;
  try {
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (isMostlyDark(context, canvas.width, canvas.height) && video.currentTime < 1 && video.duration > 1) {
      video.currentTime = Math.min(1, video.duration * 0.15);
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      setStill((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(blob);
      });
    }, "image/jpeg", 0.72);
  } catch {
    // A cross-origin frame stays on the video element when the canvas is blocked.
  }
}

function isMostlyDark(context: CanvasRenderingContext2D, width: number, height: number) {
  const points: Array<[number, number]> = [
    [width / 2, height / 2],
    [width / 3, height / 3],
    [(width * 2) / 3, (height * 2) / 3],
  ];
  return points.every(([x, y]) => {
    const pixel = context.getImageData(Math.max(0, Math.floor(x)), Math.max(0, Math.floor(y)), 1, 1).data;
    return pixel[0] < 12 && pixel[1] < 12 && pixel[2] < 12;
  });
}
