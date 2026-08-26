"use client";

import { mediaStreamUrl } from "@/lib/media-playback";
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
  const url = mediaStreamUrl(src);
  if (!url) return null;

  return (
    <video
      src={url}
      className={cn("bg-black", className)}
      controls={controls}
      autoPlay={autoPlay}
      muted={muted}
      loop={loop}
      playsInline
      preload={preload ?? (autoPlay ? "auto" : "metadata")}
    />
  );
}
