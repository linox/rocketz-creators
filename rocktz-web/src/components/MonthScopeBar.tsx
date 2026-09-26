"use client";

import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { currentYearMonth, shiftMonth } from "@/lib/calendar";
import { cn } from "@/lib/cn";

export type MonthDemandOption = { value: string; count: number };

export function formatMonthLabel(month: string, locale: string) {
  const raw = new Date(`${month}-02T12:00:00`).toLocaleDateString(locale, { month: "long", year: "numeric" });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
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
  hint,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  hint?: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-left text-sm font-bold transition-colors",
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "border border-indigo-200 bg-indigo-50 text-indigo-900 hover:border-indigo-300 hover:bg-indigo-100",
      )}
    >
      <Calendar size={15} className={cn("shrink-0", active ? "text-indigo-200" : "text-indigo-600")} />
      <span className="flex min-w-0 flex-col">
        <span className="capitalize">{label}</span>
        {hint ? <span className={cn("text-[11px] font-semibold capitalize", active ? "text-indigo-200" : "text-indigo-700/80")}>{hint}</span> : null}
      </span>
      {count != null ? (
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-extrabold", active ? "bg-white/15 text-white" : "bg-white text-indigo-800")}>
          {count}
        </span>
      ) : null}
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
  currentCount,
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
  variant?: "browse" | "creator";
}) {
  const current = currentYearMonth();
  const selectedLabel = formatMonthLabel(selected, locale);

  if (variant === "creator") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <MonthChip
            active={selected === current}
            label={thisMonthLabel}
            hint={formatMonthLabel(current, locale)}
            count={currentCount}
            onClick={() => onChange(current)}
          />
        </div>
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="m-0 mb-2 text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">{upcomingLabel}</p>
          {upcoming.length === 0 ? (
            <p className="m-0 text-sm font-medium text-slate-500">{emptyUpcomingLabel}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {upcoming.map((option) => (
                <MonthChip
                  key={option.value}
                  active={selected === option.value}
                  label={formatMonthLabel(option.value, locale)}
                  count={option.count}
                  onClick={() => onChange(option.value)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange(shiftMonth(selected, -1))}
            className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            title={prevLabel}
            aria-label={prevLabel}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-[11rem] px-1 text-center">
            <p className="m-0 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">
              {selected === current ? thisMonthLabel : upcomingLabel}
            </p>
            <p className="m-0 text-lg font-black text-slate-900 capitalize">{selectedLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(shiftMonth(selected, 1))}
            className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            title={nextLabel}
            aria-label={nextLabel}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        {selected !== current ? (
          <button
            type="button"
            onClick={() => onChange(current)}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-100"
          >
            <Calendar size={15} className="text-slate-500" />
            {thisMonthLabel}
          </button>
        ) : null}
      </div>
      {upcoming.length > 0 ? (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="m-0 mb-2 text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">{upcomingLabel}</p>
          <div className="flex flex-wrap gap-2">
            {upcoming.map((option) => (
              <MonthChip
                key={option.value}
                active={selected === option.value}
                label={formatMonthLabel(option.value, locale)}
                count={option.count}
                onClick={() => onChange(option.value)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
