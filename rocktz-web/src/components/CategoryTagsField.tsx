"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import { Select2Field } from "@/components/Select2Field";
import { cn } from "@/lib/cn";
import {
  MAX_CREATOR_CATEGORIES,
  creatorCategoryOptions,
  normalizeCreatorCategories,
} from "@/lib/creatorCategories";

type Props = {
  values: string[];
  onChange: (values: string[]) => void;
  theme?: "light" | "dark";
  className?: string;
};

export function CategoryTagsField({ values, onChange, theme = "light", className }: Props) {
  const { t } = useTranslation();
  const tp = (key: string, options?: Record<string, unknown>) => t(`profile:${key}`, options);
  const labels = t("auth:categories", { returnObjects: true }) as Record<string, string>;
  const [custom, setCustom] = useState("");
  const [picker, setPicker] = useState("");

  const selected = useMemo(() => normalizeCreatorCategories(values), [values]);
  const options = useMemo(
    () =>
      creatorCategoryOptions(labels, selected).filter(
        (option) => !selected.some((value) => value.toLowerCase() === option.value.toLowerCase()),
      ),
    [labels, selected],
  );

  function labelFor(value: string) {
    return labels[value] ?? value;
  }

  function commit(next: string[]) {
    onChange(normalizeCreatorCategories(next));
  }

  function add(raw: string) {
    const value = raw.replace(/\s+/g, " ").trim();
    if (!value) return;
    commit([...selected, value]);
    setCustom("");
    setPicker("");
  }

  function onCustomKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    add(custom);
  }

  const atLimit = selected.length >= MAX_CREATOR_CATEGORIES;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((value) => (
            <span
              key={value}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-800"
            >
              <span className="truncate">{labelFor(value)}</span>
              <button
                type="button"
                onClick={() => commit(selected.filter((item) => item !== value))}
                className="shrink-0 rounded-full p-0.5 text-indigo-500 hover:bg-indigo-100 hover:text-indigo-800"
                aria-label={tp("removeCategory", { name: labelFor(value) })}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Select2Field
          theme={theme}
          searchable
          disabled={atLimit || options.length === 0}
          placeholder={tp("addCategoryPh")}
          value={picker}
          options={options}
          onChange={(value) => add(value)}
        />
        <div className="flex gap-2">
          <input
            value={custom}
            disabled={atLimit}
            onChange={(event) => setCustom(event.target.value)}
            onKeyDown={onCustomKey}
            placeholder={tp("customCategoryPh")}
            maxLength={120}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-primary disabled:bg-slate-50"
          />
          <button
            type="button"
            disabled={atLimit || !custom.trim()}
            onClick={() => add(custom)}
            className="inline-flex h-11 shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={14} /> {t("common:add")}
          </button>
        </div>
      </div>
      <p className="text-[10px] text-slate-400">{tp("categoriesHint", { max: MAX_CREATOR_CATEGORIES })}</p>
    </div>
  );
}
