"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { Select2Field } from "@/components/Select2Field";
import { PageHeader, StatCard } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { alertApiError } from "@/lib/alerts";
import { userHasPermission } from "@/lib/auth";
import { useAuth } from "@/lib/use-auth";

export type ActivityLogRow = {
  id: number;
  user_id: number | null;
  actor_email: string | null;
  actor_name: string | null;
  actor_role: string | null;
  category: "access" | "action" | string;
  action: string;
  method: string | null;
  path: string | null;
  status_code: number | null;
  ip: string | null;
  user_agent: string | null;
  subject_type: string | null;
  subject_id: number | null;
  properties: Record<string, unknown> | null;
  created_at: string;
};

const ACTION_KEYS = [
  "login.success",
  "login.failed",
  "login.two_factor",
  "logout",
  "register.creator",
  "register.company",
  "password.reset_requested",
  "password.reset",
  "two_factor.enabled",
  "two_factor.disabled",
  "company.switch",
  "profile.update",
  "creator.create",
  "creator.update",
  "creator.approve",
  "creator.reject",
  "creator.delete",
  "company.create",
  "company.update",
  "company.approve",
  "company.reject",
  "campaign.create",
  "campaign.update",
  "campaign.apply",
  "campaign.assign",
  "campaign.participation.update",
  "user.create",
  "user.update",
  "user.delete",
  "other",
];

function eventI18nKey(action: string) {
  return `logs.event.${action.replaceAll(".", "_")}`;
}

function LogsInner() {
  const { t, i18n } = useTranslation("app");
  const { t: tn } = useTranslation("nav");
  const me = useAuth();
  const canView = userHasPermission(me, "logs.view");
  const [category, setCategory] = useState("");
  const [action, setAction] = useState("");
  const [role, setRole] = useState("");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<ActivityLogRow[]>([]);
  const [meta, setMeta] = useState({ today_logins: 0, today_failed: 0, today_actions: 0 });
  const [openId, setOpenId] = useState<number | null>(null);

  function load() {
    if (!canView) return Promise.resolve();
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (action) params.set("action", action);
    if (role) params.set("role", role);
    if (query.trim()) params.set("q", query.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const suffix = params.toString() ? `?${params}` : "";
    return api.activityLogs(suffix).then((res) => {
      setRows(res.data);
      setMeta(res.meta);
    }).catch(alertApiError);
  }

  useEffect(() => {
    if (!canView) return;
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (action) params.set("action", action);
    if (role) params.set("role", role);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const suffix = params.toString() ? `?${params}` : "";
    void api.activityLogs(suffix).then((res) => {
      setRows(res.data);
      setMeta(res.meta);
    }).catch(alertApiError);
  }, [canView, category, action, role, from, to]);

  const actionOptions = useMemo(
    () => [
      { value: "", label: t("logs.filterAll") },
      ...ACTION_KEYS.map((id) => ({ value: id, label: t(eventI18nKey(id), { defaultValue: id }) })),
    ],
    [t],
  );

  function formatWhen(iso: string) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString(i18n.language);
  }

  if (!canView) {
    return (
      <>
        <PageHeader title={t("logs.title")} subtitle={t("logs.subtitle")} />
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-sm text-slate-500">{t("logs.forbidden")}</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("logs.title")}
        subtitle={t("logs.subtitle")}
        actions={
          <button type="button" onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">
            <RefreshCw size={16} />
            {t("logs.refresh")}
          </button>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label={t("logs.todayLogins")} value={meta.today_logins} />
        <StatCard label={t("logs.todayFailed")} value={meta.today_failed} />
        <StatCard label={t("logs.todayActions")} value={meta.today_actions} />
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-44">
          <Select2Field
            theme="light"
            placeholder={t("logs.category")}
            value={category}
            options={[
              { value: "", label: t("logs.filterAll") },
              { value: "access", label: t("logs.access") },
              { value: "action", label: t("logs.actions") },
            ]}
            onChange={setCategory}
          />
        </div>
        <div className="w-64">
          <Select2Field theme="light" placeholder={t("logs.action")} value={action} options={actionOptions} onChange={setAction} />
        </div>
        <div className="w-44">
          <Select2Field
            theme="light"
            placeholder={t("logs.role")}
            value={role}
            options={[
              { value: "", label: t("logs.filterAll") },
              { value: "admin", label: tn("roleAdmin") },
              { value: "company", label: tn("roleCompany") },
              { value: "creator", label: tn("roleCreator") },
            ]}
            onChange={setRole}
          />
        </div>
        <input className="min-w-48 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder={t("logs.search")} value={query} onChange={(e) => setQuery(e.target.value)} onBlur={() => void load()} />
        <label className="text-xs font-semibold text-slate-500">
          {t("logs.from")}
          <input type="date" className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          {t("logs.to")}
          <input type="date" className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">{t("logs.when")}</th>
              <th className="px-4 py-3 text-left">{t("logs.user")}</th>
              <th className="px-4 py-3 text-left">{t("logs.action")}</th>
              <th className="px-4 py-3 text-left">{t("logs.category")}</th>
              <th className="px-4 py-3 text-left">{t("logs.target")}</th>
              <th className="px-4 py-3 text-left">{t("logs.ip")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className="px-4 py-8 text-slate-500" colSpan={6}>{t("logs.empty")}</td></tr>
            ) : rows.map((row) => (
              <Fragment key={row.id}>
                <tr className="cursor-pointer border-t border-slate-100 hover:bg-slate-50" onClick={() => setOpenId(openId === row.id ? null : row.id)}>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatWhen(row.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{row.actor_name || t("logs.anonymous")}</div>
                    <div className="text-[11px] text-slate-400">{row.actor_email}</div>
                    <div className="text-[11px] text-slate-400">{row.actor_role ? tn(row.actor_role === "admin" ? "roleAdmin" : row.actor_role === "company" ? "roleCompany" : "roleCreator") : null}</div>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{t(eventI18nKey(row.action), { defaultValue: row.action })}</td>
                  <td className="px-4 py-3">{row.category === "access" ? t("logs.access") : t("logs.actions")}</td>
                  <td className="px-4 py-3 text-slate-500">{row.subject_type ? `${row.subject_type} #${row.subject_id}` : "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{row.ip || "—"}</td>
                </tr>
                {openId === row.id ? (
                  <tr className="border-t border-slate-100 bg-slate-50/80">
                    <td colSpan={6} className="px-4 py-3 text-xs text-slate-600">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div><span className="font-bold">{t("logs.path")}:</span> {row.method} /{row.path}</div>
                        <div><span className="font-bold">{t("logs.status")}:</span> {row.status_code ?? "—"}</div>
                        <div className="sm:col-span-2"><span className="font-bold">{t("logs.userAgent")}:</span> {row.user_agent || "—"}</div>
                        {row.properties && Object.keys(row.properties).length > 0 ? (
                          <pre className="sm:col-span-2 overflow-x-auto rounded-xl bg-white p-3 text-[11px]">{JSON.stringify(row.properties, null, 2)}</pre>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function ActivityLogsScreen() {
  return (
    <AuthenticatedShell>
      <LogsInner />
    </AuthenticatedShell>
  );
}
