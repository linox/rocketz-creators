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
import { calendarSourceTone, currentYearMonth, shiftMonth } from "@/lib/calendar";
import { cn } from "@/lib/cn";
import type { CalendarEvent, CalendarEventKind, Company } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { intlLocale, normalizeLocale } from "@/i18n/locales";

type KindFilter = "all" | CalendarEventKind;
type SourceFilter = "all" | CalendarEvent["source"];

function calendarCompanyKey(userId: number) {
  return `rocktz.calendar.company.${userId}`;
}

function CalendarScreenInner() {
  const user = useAuth();
  const { t, i18n } = useTranslation("app");
  const locale = intlLocale(normalizeLocale(i18n.language));
  const isCreator = user.role === "creator";
  const isAgency = user.role === "admin";
  const [month, setMonth] = useState(currentYearMonth());
  const [kind, setKind] = useState<KindFilter>(isCreator ? "all" : "post");
  const [source, setSource] = useState<SourceFilter>("all");
  const [companyId, setCompanyIdState] = useState("all");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  function setCompanyId(next: string) {
    setCompanyIdState(next);
    if (!isAgency) return;
    try {
      window.localStorage.setItem(calendarCompanyKey(user.id), next);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!isAgency) return;
    try {
      const stored = window.localStorage.getItem(calendarCompanyKey(user.id));
      if (stored) setCompanyIdState(stored);
    } catch {
      /* ignore */
    }
  }, [isAgency, user.id]);

  useEffect(() => {
    if (!isAgency) return;
    api.companies()
      .then((res) => setCompanies(res.data))
      .catch(alertApiError);
  }, [isAgency]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ month, kind });
    api.calendar(`?${params.toString()}`)
      .then((res) => setEvents(res.data))
      .catch(alertApiError)
      .finally(() => setLoading(false));
  }, [month, kind]);

  const monthLabel = useMemo(() => {
    const label = new Date(`${month}-01T00:00:00`).toLocaleDateString(locale, { month: "long", year: "numeric" });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [month, locale]);

  const kindOptions = [
    { value: "all", label: t("calendar.filterAll") },
    { value: "delivery", label: t("calendar.filterDelivery") },
    { value: "post", label: t("calendar.filterPost") },
  ];

  const sourceOptions = [
    { value: "all", label: t("calendar.filterSourceAll") },
    { value: "campaign", label: t("calendar.filterSourceCampaign") },
    { value: "recurring", label: t("calendar.filterSourceRecurring") },
  ];

  const companyOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const company of companies) byId.set(String(company.id), company.name);
    for (const event of events) {
      if (event.company?.id) byId.set(String(event.company.id), event.company.name);
    }
    const options = [...byId.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, locale));
    return [{ value: "all", label: t("calendar.filterCompanyAll") }, ...options];
  }, [companies, events, locale, t]);

  useEffect(() => {
    if (!isAgency || companyId === "all" || companies.length === 0) return;
    if (!companyOptions.some((option) => option.value === companyId)) setCompanyId("all");
  }, [isAgency, companyId, companies.length, companyOptions]);

  const visible = useMemo(
    () => events.filter((event) => {
      if (source !== "all" && event.source !== source) return false;
      if (isAgency && companyId !== "all" && String(event.company?.id ?? "") !== companyId) return false;
      return true;
    }),
    [events, source, isAgency, companyId],
  );

  const agenda = useMemo(
    () => [...visible].sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind)),
    [visible],
  );

  const agendaGroups = useMemo(() => {
    if (!isAgency || companyId !== "all") {
      return [{ id: "flat", name: null as string | null, events: agenda }];
    }
    const groups = new Map<string, { id: string; name: string; events: CalendarEvent[] }>();
    for (const event of agenda) {
      const id = event.company?.id ? String(event.company.id) : "none";
      const group = groups.get(id) ?? { id, name: event.company?.name || t("calendar.noCompany"), events: [] };
      group.events.push(event);
      groups.set(id, group);
    }
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [agenda, isAgency, companyId, locale, t]);

  const showCompanyOnCalendar = isAgency && companyId === "all";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="m-0 text-xl font-black text-slate-900">{isCreator ? t("calendar.titleCreator") : t("calendar.titleAgency")}</h1>
            <p className="mt-1 text-sm text-slate-500">{isCreator ? t("calendar.subtitleCreator") : t("calendar.subtitleAgency")}</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button type="button" onClick={() => setMonth((value) => shiftMonth(value, -1))} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label={t("calendar.prev")}>
              <ChevronLeft size={18} />
            </button>
            <span className="min-w-[148px] text-center text-sm font-bold text-slate-800">{monthLabel}</span>
            <button type="button" onClick={() => setMonth((value) => shiftMonth(value, 1))} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label={t("calendar.next")}>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className={cn("grid gap-3 border-t border-slate-100 pt-4", isAgency ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          {isAgency ? (
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[10px] font-extrabold tracking-wider text-slate-500 uppercase">{t("calendar.filterCompanyLabel")}</span>
              <Select2Field searchable theme="light" value={companyId} options={companyOptions} onChange={setCompanyId} />
            </label>
          ) : null}
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[10px] font-extrabold tracking-wider text-slate-500 uppercase">{t("calendar.filterSourceLabel")}</span>
            <Select2Field theme="light" value={source} options={sourceOptions} onChange={(value) => setSource(value as SourceFilter)} />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[10px] font-extrabold tracking-wider text-slate-500 uppercase">{t("calendar.filterKindLabel")}</span>
            <Select2Field theme="light" value={kind} options={kindOptions} onChange={(value) => setKind(value as KindFilter)} />
          </label>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
        </div>
      ) : (
        <>
          <WorkCalendar month={month} events={visible} showCreator={!isCreator} showCompany={showCompanyOnCalendar} />
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-slate-900">{t("calendar.agendaTitle")}</h2>
            {!agenda.length ? (
              <div className="py-10 text-center">
                <CalendarDays size={28} className="mx-auto text-slate-300" />
                <p className="mt-2 text-sm font-bold text-slate-700">{t("calendar.empty")}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {agendaGroups.map((group) => (
                  <section key={group.id}>
                    {group.name ? <h3 className="mb-1 text-xs font-extrabold tracking-widest text-slate-500 uppercase">{group.name}</h3> : null}
                    <div className="divide-y divide-slate-100">
                      {group.events.map((event) => {
                        const tone = calendarSourceTone(event.source);
                        const showCompanyName = !isAgency && Boolean(event.company?.name);
                        return (
                          <Link key={event.id} href={event.href} className={cn("flex flex-col gap-1 border-l-4 py-3 pl-3 sm:flex-row sm:items-center sm:justify-between", tone.rail)}>
                            <div className="min-w-0">
                              <p className="m-0 truncate text-sm font-bold text-slate-900">{event.title}</p>
                              <p className="m-0 text-xs text-slate-500">
                                {showCompanyName ? `${event.company?.name} · ` : ""}
                                {event.creator?.artistic_name || ""}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase", tone.tag)}>
                                {event.source === "recurring" ? t("calendar.sourceRecurring") : t("calendar.sourceCampaign")}
                              </span>
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-extrabold text-slate-600 uppercase">
                                {t(`calendar.kind.${event.kind}`)}
                              </span>
                              <span className="text-xs font-bold text-slate-700">
                                {new Date(`${event.date}T00:00:00`).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
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
