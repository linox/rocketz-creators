"use client";

import { useVideoCover } from "@/lib/use-video-cover";
import { cn } from "@/lib/cn";

type Props = {
  src: string;
  className?: string;
  /** Kept so grids can opt into the same shared cover. */
  lite?: boolean;
  fit?: "cover" | "contain";
};

export function VideoPoster({ src, className, fit = "cover" }: Props) {
  const cover = useVideoCover(src);
  const fitClass = fit === "contain" ? "object-contain" : "object-cover";

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-slate-900", className)}>
      {cover.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover.url} alt="" decoding="async" className={cn("h-full w-full", fitClass)} />
      ) : null}
    </div>
  );
}
