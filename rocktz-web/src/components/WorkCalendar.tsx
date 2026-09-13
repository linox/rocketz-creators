"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { getCalendarDays, localDateStr, toDateKey } from "@/lib/calendar";
import type { CalendarEvent } from "@/lib/types";
import { intlLocale, normalizeLocale } from "@/i18n/locales";

function kindClass(kind: CalendarEvent["kind"]) {
  return kind === "post"
    ? "border-violet-200 bg-violet-50 text-violet-800"
    : "border-amber-200 bg-amber-50 text-amber-800";
}

export function WorkCalendar({
  month,
  events,
  showCreator = true,
}: {
  month: string;
  events: CalendarEvent[];
  showCreator?: boolean;
}) {
  const { t, i18n } = useTranslation("app");
  const locale = intlLocale(normalizeLocale(i18n.language));
  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = toDateKey(event.date);
    const list = byDay.get(key) ?? [];
    list.push(event);
    byDay.set(key, list);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/70 py-3 text-center text-xs font-extrabold tracking-wider text-slate-500 uppercase">
            {[t("recurring.weekMon"), t("recurring.weekTue"), t("recurring.weekWed"), t("recurring.weekThu"), t("recurring.weekFri"), t("recurring.weekSat"), t("recurring.weekSun")].map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-[9.5rem] divide-x divide-y divide-slate-100">
            {getCalendarDays(month).map((cell) => {
              const dayEvents = byDay.get(cell.dateStr) ?? [];
              const isToday = cell.dateStr === localDateStr();
              return (
                <div key={cell.dateStr} className={cn("flex h-full min-h-0 flex-col overflow-hidden p-2", cell.isCurrentMonth ? "bg-white" : "bg-slate-50/40 text-slate-300")}>
                  <div className="mb-1.5 flex shrink-0 items-center justify-between">
                    <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-extrabold", isToday ? "bg-brand-primary text-white" : cell.isCurrentMonth ? "text-slate-700" : "text-slate-300")}>{cell.dayNumber}</span>
                    {dayEvents.length > 1 ? (
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-black text-slate-500">{dayEvents.length}</span>
                    ) : null}
                  </div>
                  <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pr-0.5">
                    {dayEvents.map((event) => (
                      <Link
                        key={event.id}
                        href={event.href}
                        className={cn("block w-full rounded-lg border p-1.5 text-left text-[10px] font-bold transition-all hover:scale-[1.02]", kindClass(event.kind))}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[9px] font-black uppercase opacity-80">{t(`calendar.kind.${event.kind}`)}</span>
                          {showCreator ? <span className="truncate text-[9px] font-semibold">{event.creator?.artistic_name}</span> : null}
                        </div>
                        <p className="mt-0.5 truncate font-bold">{event.title}</p>
                        <p className="truncate text-[9px] font-medium opacity-80">
                          {event.source === "recurring" ? t("calendar.sourceRecurring") : t("calendar.sourceCampaign")}
                          {event.format ? ` · ${event.format}` : ""}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 border-t border-slate-100 px-4 py-3 text-[10px] font-bold uppercase">
        <span className="inline-flex items-center gap-1.5 text-amber-800">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> {t("calendar.kind.delivery")}
        </span>
        <span className="inline-flex items-center gap-1.5 text-violet-800">
          <span className="h-2 w-2 rounded-full bg-violet-400" /> {t("calendar.kind.post")}
        </span>
        <span className="ml-auto font-medium normal-case tracking-normal text-slate-400">
          {new Date(`${month}-01T00:00:00`).toLocaleDateString(locale, { month: "long", year: "numeric" })}
        </span>
      </div>
    </div>
  );
}
