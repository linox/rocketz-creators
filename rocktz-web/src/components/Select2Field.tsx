"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

export type Select2Option = {
  value: string;
  label: string;
};

type Select2SharedProps = {
  options: Select2Option[];
  placeholder?: string;
  theme?: "light" | "dark";
  searchable?: boolean;
  disabled?: boolean;
  name?: string;
  className?: string;
  triggerClassName?: string;
};

type Select2SingleProps = Select2SharedProps & {
  multiple?: false;
  value: string;
  onChange: (value: string) => void;
  allowClear?: boolean;
};

type Select2MultiProps = Select2SharedProps & {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
  /** Clears the selection. Shown as selected while nothing else is chosen. */
  exclusiveValue?: string;
};

export type Select2FieldProps = Select2SingleProps | Select2MultiProps;

type MenuPos = { top: number; left: number; width: number; maxHeight: number };

export function Select2Field(props: Select2FieldProps) {
  const {
    options,
    placeholder,
    theme = "light",
    searchable,
    disabled = false,
    name,
    className,
    triggerClassName,
  } = props;
  const multiple = props.multiple === true;
  const exclusiveValue = props.multiple ? props.exclusiveValue : undefined;
  const selectedValues = props.multiple ? props.value.filter((item) => item !== props.exclusiveValue) : [];
  const singleValue = props.multiple ? "" : props.value;
  const { t } = useTranslation("common");
  const resolvedPlaceholder = placeholder ?? t("select2.placeholder");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<MenuPos | null>(null);

  const enableSearch = searchable ?? options.length > 8;
  const selected = options.find((option) => option.value === singleValue);
  const selectedLabels = selectedValues.map((item) => options.find((option) => option.value === item)?.label ?? item);
  const triggerLabel = multiple
    ? selectedLabels.length === 0
      ? (options.find((option) => option.value === exclusiveValue)?.label ?? resolvedPlaceholder)
      : selectedLabels.join(", ")
    : (selected?.label ?? resolvedPlaceholder);
  const dark = theme === "dark";

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!enableSearch || !term) {
      return options;
    }
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(term) || (option.value ?? "").toLowerCase().includes(term),
    );
  }, [enableSearch, options, query]);

  function placeMenu() {
    const el = triggerRef.current;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const maxHeight = Math.min(280, Math.max(spaceBelow, spaceAbove, 160));
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const width = multiple ? Math.max(rect.width, 260) : rect.width;
    setPos({
      top: openUp ? Math.max(8, rect.top - maxHeight - 6) : rect.bottom + 6,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      width,
      maxHeight,
    });
  }

  function close() {
    setOpen(false);
    setQuery("");
  }

  function pick(next: string) {
    if (!props.multiple) {
      props.onChange(next);
      close();
      return;
    }
    if (props.exclusiveValue && next === props.exclusiveValue) {
      props.onChange([]);
      close();
      return;
    }
    const current = Array.isArray(props.value) ? props.value.filter((item) => item !== props.exclusiveValue) : [];
    props.onChange(current.includes(next) ? current.filter((item) => item !== next) : [...current, next]);
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    placeMenu();
    const onReposition = () => placeMenu();
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 20);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menu =
    open && pos
      ? createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-multiselectable={multiple || undefined}
            style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
            className={cn(
              "fixed z-[400] flex flex-col overflow-hidden rounded-xl border shadow-xl",
              dark ? "border-white/10 bg-[#111827] text-slate-100" : "border-slate-200 bg-white text-slate-900",
            )}
          >
            {enableSearch ? (
              <div className={cn("border-b p-2", dark ? "border-white/10" : "border-slate-100")}>
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("select2.search")}
                  className={cn(
                    "h-9 w-full rounded-lg border px-3 text-sm outline-none",
                    dark ? "border-white/15 bg-[#1e293b] text-white" : "border-slate-200 bg-white text-slate-900",
                  )}
                />
              </div>
            ) : null}
            <ul className="overflow-y-auto py-1" style={{ maxHeight: enableSearch ? pos.maxHeight - 52 : pos.maxHeight }}>
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-slate-400">{t("select2.empty")}</li>
              ) : (
                filtered.map((option, index) => {
                  const active = multiple
                    ? option.value === exclusiveValue
                      ? selectedValues.length === 0
                      : selectedValues.includes(option.value)
                    : option.value === singleValue;
                  return (
                    <li key={option.value ? `${option.value}-${index}` : `option-${index}`}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                          active ? "bg-purple-600 text-white" : dark ? "text-slate-200 hover:bg-purple-600 hover:text-white" : "text-slate-800 hover:bg-purple-600 hover:text-white",
                        )}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          pick(option.value);
                        }}
                      >
                        {multiple ? (
                          <span
                            aria-hidden
                            className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                              active ? "border-white bg-white text-purple-600" : "border-current/40",
                            )}
                          >
                            {active ? (
                              <svg width="10" height="8" viewBox="0 0 10 8">
                                <path d="M1 4.2 3.4 6.5 9 1" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            ) : null}
                          </span>
                        ) : null}
                        <span className="min-w-0 flex-1">{option.label}</span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={cn("select2-field", dark ? "select2-field-dark" : "select2-field-light", className)}>
      {name ? <input type="hidden" name={name} value={multiple ? selectedValues.join(",") : singleValue} /> : null}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-xl border px-4 text-left text-sm outline-none transition-colors",
          dark
            ? "border-white/10 bg-[#1E293B]/40 text-white"
            : "border-slate-200 bg-white text-slate-900",
          open && "border-purple-600",
          disabled && "cursor-not-allowed opacity-60",
          triggerClassName,
        )}
        onClick={() => {
          if (disabled) {
            return;
          }
          setOpen((current) => !current);
        }}
      >
        <span
          title={multiple && selectedLabels.length > 1 ? selectedLabels.join(", ") : undefined}
          className={cn("truncate", !multiple && !selected && "text-slate-400", multiple && selectedLabels.length === 0 && !exclusiveValue && "text-slate-400")}
        >
          {triggerLabel}
        </span>
        <svg width="12" height="8" viewBox="0 0 12 8" aria-hidden className={cn("shrink-0", open && "rotate-180")}>
          <path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      {menu}
    </div>
  );
}
