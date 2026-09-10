"use client";

import { useEffect, useRef } from "react";
import { mediaStreamUrl, videoMimeFromUrl } from "@/lib/media-playback";
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const url = mediaStreamUrl(src);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const blockNativeFullscreen = (event: Event) => {
      event.preventDefault();
      keepInline({ currentTarget: video } as React.SyntheticEvent<HTMLVideoElement>);
    };
    video.addEventListener("webkitbeginfullscreen", blockNativeFullscreen);
    return () => video.removeEventListener("webkitbeginfullscreen", blockNativeFullscreen);
  }, [url]);

  if (!url) return null;

  return (
    <video
      ref={videoRef}
      src={url}
      className={cn("bg-black", className)}
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
    >
      <source src={url} type={videoMimeFromUrl(url)} />
    </video>
  );
}
