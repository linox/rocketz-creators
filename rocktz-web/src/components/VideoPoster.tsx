"use client";

import { useTranslation } from "react-i18next";
import { useVideoCover } from "@/lib/use-video-cover";
import { cn } from "@/lib/cn";

type Props = {
  src: string;
  className?: string;
  /** Kept so grids can opt into the same shared cover. */
  lite?: boolean;
};

export function VideoPoster({ src, className }: Props) {
  const { t } = useTranslation("app");
  const cover = useVideoCover(src);

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-slate-900", className)}>
      {cover.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover.url} alt="" decoding="async" className="h-full w-full object-cover" />
      ) : null}
      {cover.pending && !cover.url ? (
        <span className="absolute inset-x-2 bottom-2 text-center text-[10px] font-bold text-white/80">
          {t("campaignDetail.videoPreparing")}
        </span>
      ) : null}
    </div>
  );
}
