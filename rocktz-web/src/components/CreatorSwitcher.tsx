"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Key, Search, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import type { Creator } from "@/lib/types";
import { cn } from "@/lib/cn";
import { useTranslation } from "react-i18next";

export function CreatorSwitcher({
  handle,
  currentCreatorId,
  variant = "header",
}: {
  handle?: string;
  currentCreatorId?: number;
  variant?: "header" | "banner";
}) {
  const router = useRouter();
  const { t } = useTranslation("app");
  const { t: tp } = useTranslation("profile");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creators, setCreators] = useState<Creator[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.creators().then((res) => setCreators(res.data)).catch(() => undefined);
  }, []);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = creators.filter((creator) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    return `${creator.artistic_name} ${creator.full_name} ${(creator.categories ?? []).join(" ")}`.toLowerCase().includes(term);
  });

  const active = creators.find((creator) => creator.id === currentCreatorId);
  const labelHandle = active?.artistic_name || handle || "";

  function pick(id: number) {
    setOpen(false);
    router.push(`/creators/${id}`);
  }

  if (variant === "banner") {
    return (
      <div className="relative inline-block text-left" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex items-center gap-2 rounded-xl border border-purple-500 bg-purple-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-purple-700 active:scale-95"
        >
          <Key size={14} className="animate-pulse text-purple-200" />
          <span>{labelHandle ? tp("switcherSwapWith", { handle: labelHandle }) : tp("switcherSwap")}</span>
          <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
        </button>
        {open ? (
          <div className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] rounded-2xl border border-slate-200 bg-white p-3 text-slate-800 shadow-2xl sm:right-auto sm:left-0">
            <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="flex items-center gap-1.5 text-xs font-black tracking-wider text-purple-900 uppercase">
                <Sparkles size={14} className="text-purple-600" /> {tp("switcherSelect")}
              </span>
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">{tp("switcherCount", { count: creators.length })}</span>
            </div>
            <div className="relative mb-2">
              <Search size={14} className="absolute top-2.5 left-3 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tp("switcherSearch")}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pr-3 pl-8 text-xs font-medium outline-none focus:border-purple-500"
              />
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filtered.map((creator) => (
                <button
                  key={creator.id}
                  type="button"
                  className={cn("flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50", creator.id === currentCreatorId && "bg-purple-50")}
                  onClick={() => pick(creator.id)}
                >
                  <span>
                    <span className="font-bold">@{creator.artistic_name}</span>
                    {creator.full_name ? <span className="block text-[11px] text-slate-500">{creator.full_name}</span> : null}
                  </span>
                </button>
              ))}
              {!filtered.length ? <p className="px-2 py-4 text-xs text-slate-400">{t("switcherEmpty")}</p> : null}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative min-w-0 max-w-full" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 max-w-full items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-xs font-extrabold tracking-wider text-indigo-700 uppercase"
      >
        <span className="truncate">@{labelHandle || tp("creatorFallback")}</span>
        <ChevronDown size={14} className="shrink-0" />
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search size={14} className="text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("switcherSearch")}
              className="h-8 flex-1 text-sm outline-none"
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {filtered.map((creator) => (
              <button
                key={creator.id}
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => pick(creator.id)}
              >
                <span>
                  <span className="font-bold">@{creator.artistic_name}</span>
                  {creator.full_name ? <span className="block text-[11px] text-slate-500">{creator.full_name}</span> : null}
                </span>
              </button>
            ))}
            {!filtered.length ? <p className="px-3 py-4 text-xs text-slate-400">{t("switcherEmpty")}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
