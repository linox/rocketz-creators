"use client";

import { Building2, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { PostingProfile } from "@/lib/posting-profile";

export function PostingProfileCards({
  value,
  onChange,
}: {
  value: PostingProfile;
  onChange: (value: PostingProfile) => void;
}) {
  const { t } = useTranslation("app");
  const options = [
    {
      id: "creator" as const,
      title: t("postingProfile.creator"),
      hint: t("postingProfile.creatorHint"),
      Icon: User,
    },
    {
      id: "brand" as const,
      title: t("postingProfile.brand"),
      hint: t("postingProfile.brandHint"),
      Icon: Building2,
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div>
        <label className="block text-[11px] font-bold tracking-wider text-[#64748B] uppercase">{t("postingProfile.label")}</label>
        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{t("postingProfile.hint")}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const selected = value === option.id;
          const Icon = option.Icon;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={cn(
                "flex cursor-pointer flex-col justify-between gap-2 rounded-2xl border p-3.5 text-left transition-all",
                selected
                  ? "border-indigo-600 bg-indigo-50/70 text-indigo-950 ring-2 ring-indigo-500/20"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-black">
                  <Icon size={14} className={selected ? "text-indigo-600" : "text-slate-400"} />
                  {option.title}
                </span>
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px]",
                    selected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300",
                  )}
                >
                  {selected ? "✓" : ""}
                </span>
              </div>
              <p className="m-0 text-[10px] leading-snug text-slate-500">{option.hint}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
