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

function MonthTile({
  active,
  kicker,
  title,
  year,
  detail,
  count,
  onClick,
}: {
  active: boolean;
  kicker: string;
  title: string;
  year?: string;
  detail: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex min-h-[108px] w-[210px] shrink-0 cursor-pointer flex-col rounded-2xl border px-4 py-3.5 text-left transition-all",
        active
          ? "border-slate-900 bg-slate-900 text-white shadow-md shadow-slate-900/10"
          : "border-slate-200 bg-white text-slate-900 shadow-sm hover:border-indigo-200 hover:shadow-md",
      )}
    >
      <span className={cn("text-[10px] font-extrabold tracking-[0.14em] uppercase", active ? "text-indigo-300" : "text-slate-400")}>{kicker}</span>
      <span className="mt-1 flex items-baseline gap-1.5">
        <span className="text-[15px] font-black tracking-tight">{title}</span>
        {year ? <span className={cn("text-xs font-semibold", active ? "text-slate-400" : "text-slate-400")}>{year}</span> : null}
      </span>
      <span className="mt-3 flex items-end justify-between gap-3">
        <span className={cn("text-xs font-semibold leading-snug", active ? "text-slate-300" : "text-slate-500")}>{detail}</span>
        <span className={cn("text-2xl leading-none font-black tabular-nums", active ? "text-white" : "text-slate-900")}>{count}</span>
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
  upcomingLabel,
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
      <div className="flex gap-3 overflow-x-auto pb-1">
        <MonthTile
          active={selected === current}
          kicker={thisMonthLabel}
          title={currentFace.name}
          year={currentFace.year}
          detail={currentDetail || demandsLabel(currentCount)}
          count={currentCount}
          onClick={() => onChange(current)}
        />
        {upcoming.map((option) => {
          const face = monthFace(option.value, locale);
          return (
            <MonthTile
              key={option.value}
              active={selected === option.value}
              kicker={face.year}
              title={face.name}
              detail={option.detail || demandsLabel(option.count)}
              count={option.count}
              onClick={() => onChange(option.value)}
            />
          );
        })}
        {upcoming.length === 0 && emptyUpcomingLabel ? (
          <div className="flex min-h-[108px] w-[210px] shrink-0 items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3.5 text-xs font-semibold leading-snug text-slate-500">
            {emptyUpcomingLabel}
          </div>
        ) : null}
      </div>
    );
  }

  const selectedFace = monthFace(selected, locale);
  const selectedInRail = selected === current || upcoming.some((option) => option.value === selected);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(shiftMonth(selected, -1))}
          className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          title={prevLabel}
          aria-label={prevLabel}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => onChange(shiftMonth(selected, 1))}
          className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          title={nextLabel}
          aria-label={nextLabel}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {!selectedInRail ? (
          <MonthTile
            active
            kicker={selected < current ? prevLabel || selectedFace.year : upcomingLabel}
            title={selectedFace.name}
            year={selectedFace.year}
            detail={demandsLabel(selectedCount ?? 0)}
            count={selectedCount ?? 0}
            onClick={() => onChange(selected)}
          />
        ) : null}
        <MonthTile
          active={selected === current}
          kicker={thisMonthLabel}
          title={currentFace.name}
          year={currentFace.year}
          detail={demandsLabel(currentCount)}
          count={currentCount}
          onClick={() => onChange(current)}
        />
        {upcoming.map((option) => {
          const face = monthFace(option.value, locale);
          return (
            <MonthTile
              key={option.value}
              active={selected === option.value}
              kicker={face.year}
              title={face.name}
              detail={demandsLabel(option.count)}
              count={option.count}
              onClick={() => onChange(option.value)}
            />
          );
        })}
      </div>
    </div>
  );
}
