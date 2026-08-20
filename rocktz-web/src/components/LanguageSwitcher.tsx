"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { getToken, laravelFetch } from "@/lib/laravel";
import { setAppLocale } from "@/i18n/config";
import { LOCALES, LOCALE_LABELS, normalizeLocale, type AppLocale } from "@/i18n/locales";

type LanguageSwitcherProps = {
  theme?: "light" | "dark";
  className?: string;
  layout?: "auto" | "segmented" | "menu";
};

type MenuPos = { top: number; left: number; width: number };

export function LanguageSwitcher({ theme = "light", className, layout = "auto" }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation("common");
  const current = normalizeLocale(i18n.language);
  const dark = theme === "dark";
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPos | null>(null);

  async function pick(locale: AppLocale) {
    setOpen(false);
    await setAppLocale(locale);
    if (getToken()) {
      await laravelFetch("/auth/locale", {
        method: "PATCH",
        body: JSON.stringify({ locale }),
      }).catch(() => undefined);
    }
  }

  function placeMenu() {
    const el = triggerRef.current;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const width = Math.max(112, rect.width);
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    setPos({
      top: rect.bottom + 6,
      left,
      width,
    });
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    placeMenu();
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    const onReposition = () => {
      if (layout === "auto" && window.matchMedia("(min-width: 640px)").matches) {
        setOpen(false);
        return;
      }
      placeMenu();
    };
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, layout]);

  const localeButtons = (inMenu: boolean) =>
    LOCALES.map((locale) => {
      const active = current === locale;
      return (
        <button
          key={locale}
          type="button"
          role={inMenu ? "option" : undefined}
          aria-selected={inMenu ? active : undefined}
          onClick={() => pick(locale)}
          className={cn(
            inMenu ? "flex w-full items-center rounded-md px-3 py-2 text-left text-[11px] font-bold tracking-wide" : "rounded-md px-2 py-1",
            active
              ? dark
                ? "bg-white/15 text-white"
                : "bg-purple-600 text-white"
              : dark
                ? "text-slate-300 hover:bg-white/10 hover:text-white"
                : "text-slate-500 hover:bg-slate-50 hover:text-purple-700",
          )}
        >
          {LOCALE_LABELS[locale]}
        </button>
      );
    });

  const segmented = (
    <div
      className={cn(
        "inline-flex rounded-lg border p-0.5 text-[11px] font-bold tracking-wide",
        dark ? "border-white/15 bg-white/5 text-slate-300" : "border-slate-200 bg-white text-slate-500",
        layout === "auto" && "hidden sm:inline-flex",
        layout === "menu" && "hidden",
        className,
      )}
      role="group"
      aria-label={t("language")}
    >
      {localeButtons(false)}
    </div>
  );

  const compact = (
    <div className={cn(layout === "auto" && "sm:hidden", layout === "segmented" && "hidden")}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={t("language")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex h-10 items-center gap-0.5 rounded-lg border px-2 text-[11px] font-bold tracking-wide",
          dark ? "border-white/15 bg-white/5 text-white" : "border-slate-200 bg-white text-slate-700",
        )}
      >
        {LOCALE_LABELS[current]}
        <ChevronDown size={12} className={cn("opacity-70 transition-transform", open && "rotate-180")} />
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={menuRef}
              id={listId}
              role="listbox"
              aria-label={t("language")}
              style={{ top: pos.top, left: pos.left, width: pos.width }}
              className={cn(
                "fixed z-[200] flex flex-col gap-0.5 rounded-xl border p-1 shadow-xl",
                dark ? "border-white/10 bg-[#111827]" : "border-slate-200 bg-white",
              )}
            >
              {localeButtons(true)}
            </div>,
            document.body,
          )
        : null}
    </div>
  );

  return (
    <>
      {compact}
      {segmented}
    </>
  );
}
