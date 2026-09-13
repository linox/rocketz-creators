"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { Select2Field } from "@/components/Select2Field";
import { WorkCalendar } from "@/components/WorkCalendar";
import { api } from "@/lib/api";
import { alertApiError } from "@/lib/alerts";
import { currentYearMonth, shiftMonth } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import type { CalendarEvent, CalendarEventKind } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { intlLocale, normalizeLocale } from "@/i18n/locales";

type KindFilter = "all" | CalendarEventKind;

function CalendarScreenInner() {
  const user = useAuth();
  const { t, i18n } = useTranslation("app");
  const locale = intlLocale(normalizeLocale(i18n.language));
  const isCreator = user.role === "creator";
  const [month, setMonth] = useState(currentYearMonth());
  const [kind, setKind] = useState<KindFilter>(isCreator ? "all" : "post");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ month, kind });
    api.calendar(`?${params.toString()}`)
      .then((res) => setEvents(res.data))
      .catch(alertApiError)
      .finally(() => setLoading(false));
  }, [month, kind]);

  const monthLabel = useMemo(
    () => new Date(`${month}-01T00:00:00`).toLocaleDateString(locale, { month: "long", year: "numeric" }),
    [month, locale],
  );

  const kindOptions = [
    { value: "all", label: t("calendar.filterAll") },
    { value: "delivery", label: t("calendar.filterDelivery") },
    { value: "post", label: t("calendar.filterPost") },
  ];

  const agenda = useMemo(
    () => [...events].sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind)),
    [events],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center">
        <div>
          <h1 className="m-0 text-xl font-black text-slate-900">{isCreator ? t("calendar.titleCreator") : t("calendar.titleAgency")}</h1>
          <p className="mt-1 text-sm text-slate-500">{isCreator ? t("calendar.subtitleCreator") : t("calendar.subtitleAgency")}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setMonth((value) => shiftMonth(value, -1))} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label={t("calendar.prev")}>
              <ChevronLeft size={18} />
            </button>
            <span className="min-w-[140px] text-center text-sm font-bold capitalize text-slate-800">{monthLabel}</span>
            <button type="button" onClick={() => setMonth((value) => shiftMonth(value, 1))} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label={t("calendar.next")}>
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="w-full sm:w-52">
            <Select2Field theme="light" value={kind} options={kindOptions} onChange={(value) => setKind(value as KindFilter)} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
        </div>
      ) : (
        <>
          <WorkCalendar month={month} events={events} showCreator={!isCreator} />
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-slate-900">{t("calendar.agendaTitle")}</h2>
            {!agenda.length ? (
              <div className="py-10 text-center">
                <CalendarDays size={28} className="mx-auto text-slate-300" />
                <p className="mt-2 text-sm font-bold text-slate-700">{t("calendar.empty")}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {agenda.map((event) => (
                  <Link key={event.id} href={event.href} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="m-0 truncate text-sm font-bold text-slate-900">{event.title}</p>
                      <p className="m-0 text-xs text-slate-500">
                        {event.company?.name ? `${event.company.name} · ` : ""}
                        {event.creator?.artistic_name ? `${event.creator.artistic_name} · ` : ""}
                        {event.source === "recurring" ? t("calendar.sourceRecurring") : t("calendar.sourceCampaign")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase", event.kind === "post" ? "border-violet-200 bg-violet-50 text-violet-800" : "border-amber-200 bg-amber-50 text-amber-800")}>
                        {t(`calendar.kind.${event.kind}`)}
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        {new Date(`${event.date}T00:00:00`).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function CalendarScreen() {
  return (
    <AuthenticatedShell>
      <CalendarScreenInner />
    </AuthenticatedShell>
  );
}
