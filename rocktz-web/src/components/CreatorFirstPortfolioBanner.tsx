"use client";

import Link from "next/link";
import { Video } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

export function CreatorFirstPortfolioBanner({
  href,
  className,
}: {
  href: string;
  className?: string;
}) {
  const { t } = useTranslation("profile");

  return (
    <div
      role="status"
      className={cn(
        "flex min-w-0 flex-col gap-4 overflow-hidden rounded-2xl border-2 border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-indigo-50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3.5 sm:items-center">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
          <Video size={22} className="shrink-0" />
        </div>
        <div className="min-w-0">
          <h4 className="m-0 text-sm font-black tracking-tight text-indigo-950 sm:text-base">
            {t("firstPortfolioTitle")}
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-indigo-800 sm:text-[13px]">
            {t("firstPortfolioBody")}
          </p>
        </div>
      </div>
      <Link
        href={href}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-extrabold tracking-wider whitespace-nowrap text-white uppercase shadow-md transition hover:bg-indigo-700"
      >
        {t("firstPortfolioCta")}
      </Link>
    </div>
  );
}
