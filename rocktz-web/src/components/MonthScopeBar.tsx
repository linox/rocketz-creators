"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { currentYearMonth, shiftMonth } from "@/lib/calendar";
import { cn } from "@/lib/cn";

export type MonthDemandOption = { value: string; count: number; detail?: string };

export function formatMonthLabel(month: string, locale: string) {
  const raw = new Date(`${month}-02T12:00:00`).toLocaleDateString(locale, { month: "long", year: "numeric" });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function monthFace(month: string, locale: string) {
  const date = new Date(`${month}-02T12:00:00`);
  const name = date.toLocaleDateString(locale, { month: "long" });
  return {
    name: name.charAt(0).toUpperCase() + name.slice(1),
    year: String(date.getFullYear()),
  };
}

export function planningDemandMonth(item: { month?: string | null; planned_date?: string | null; post_date?: string | null }) {
  const month = item.month?.match(/^(\d{4}-\d{2})/)?.[1];
  if (month) return month;
  const date = item.planned_date || item.post_date || "";
  return date.match(/^(\d{4}-\d{2})/)?.[1] ?? null;
}

export function futureMonthCounts(months: Array<string | null | undefined>, current = currentYearMonth()): MonthDemandOption[] {
  const counts = new Map<string, number>();
  for (const month of months) {
    if (!month || month <= current) continue;
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([value, count]) => ({ value, count }));
}

function MonthChip({
  active,
  label,
  mark,
  caption,
  count,
  title,
  onClick,
}: {
  active: boolean;
  label: string;
  mark?: string;
  caption?: string;
  count: number;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-2.5 text-left transition-colors",
        active
          ? "border-brand-primary bg-brand-primary text-white shadow-sm shadow-indigo-200"
          : "border-indigo-100 bg-white text-slate-700 hover:border-brand-primary/40 hover:bg-indigo-50",
      )}
    >
      {mark ? (
        <span className={cn("text-[10px] font-extrabold tracking-wide uppercase", active ? "text-indigo-100" : "text-brand-primary")}>{mark}</span>
      ) : null}
      <span className="text-sm font-bold leading-none">{label}</span>
      {caption ? (
        <span className={cn("max-w-[14rem] truncate text-[11px] font-medium leading-none", active ? "text-indigo-100" : "text-slate-500")}>{caption}</span>
      ) : null}
      <span
        className={cn(
          "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-extrabold tabular-nums",
          active ? "bg-white/20 text-white" : "bg-indigo-50 text-brand-primary",
        )}
      >
        {count}
      </span>
    </button>
  );
}

export function MonthScopeBar({
  selected,
  onChange,
  upcoming,
  locale,
  thisMonthLabel,
  emptyUpcomingLabel,
  prevLabel,
  nextLabel,
  currentCount = 0,
  selectedCount,
  currentDetail,
  demandsLabel,
  variant = "browse",
}: {
  selected: string;
  onChange: (month: string) => void;
  upcoming: MonthDemandOption[];
  locale: string;
  thisMonthLabel: string;
  upcomingLabel: string;
  emptyUpcomingLabel?: string;
  prevLabel?: string;
  nextLabel?: string;
  currentCount?: number;
  selectedCount?: number;
  currentDetail?: string;
  demandsLabel: (count: number) => string;
  variant?: "browse" | "creator";
}) {
  const current = currentYearMonth();
  const currentFace = monthFace(current, locale);

  if (variant === "creator") {
    return (
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
        <MonthChip
          active={selected === current}
          mark={thisMonthLabel}
          label={currentFace.name}
          caption={currentDetail}
          count={currentCount}
          title={demandsLabel(currentCount)}
          onClick={() => onChange(current)}
        />
        {upcoming.map((option) => {
          const face = monthFace(option.value, locale);
          return (
            <MonthChip
              key={option.value}
              active={selected === option.value}
              label={face.name}
              caption={option.detail}
              count={option.count}
              title={option.detail || demandsLabel(option.count)}
              onClick={() => onChange(option.value)}
            />
          );
        })}
        {upcoming.length === 0 && emptyUpcomingLabel ? (
          <span className="px-1 text-xs font-medium text-slate-400">{emptyUpcomingLabel}</span>
        ) : null}
      </div>
    );
  }

  const selectedFace = monthFace(selected, locale);
  const selectedInRail = selected === current || upcoming.some((option) => option.value === selected);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(shiftMonth(selected, -1))}
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-indigo-100 bg-white text-slate-500 hover:border-brand-primary/40 hover:bg-indigo-50 hover:text-brand-primary"
          title={prevLabel}
          aria-label={prevLabel}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          onClick={() => onChange(shiftMonth(selected, 1))}
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-indigo-100 bg-white text-slate-500 hover:border-brand-primary/40 hover:bg-indigo-50 hover:text-brand-primary"
          title={nextLabel}
          aria-label={nextLabel}
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
        {!selectedInRail ? (
          <MonthChip
            active
            label={selectedFace.name}
            count={selectedCount ?? 0}
            title={demandsLabel(selectedCount ?? 0)}
            onClick={() => onChange(selected)}
          />
        ) : null}
        <MonthChip
          active={selected === current}
          mark={thisMonthLabel}
          label={currentFace.name}
          count={currentCount}
          title={demandsLabel(currentCount)}
          onClick={() => onChange(current)}
        />
        {upcoming.map((option) => {
          const face = monthFace(option.value, locale);
          return (
            <MonthChip
              key={option.value}
              active={selected === option.value}
              label={face.name}
              count={option.count}
              title={demandsLabel(option.count)}
              onClick={() => onChange(option.value)}
            />
          );
        })}
      </div>
    </div>
  );
}
