"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { Select2Field } from "@/components/Select2Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { alertApiError } from "@/lib/alerts";
import { userHasPermission } from "@/lib/auth";
import { useAuth } from "@/lib/use-auth";

type MailRow = {
  id: number;
  email: string;
  template_key: string;
  subject: string;
  status: string;
  attempts: number;
  failure_reason: string | null;
  provider_id: string | null;
  created_at: string;
  user?: { role?: string; name?: string };
};

const STATUSES = ["scheduled", "queued", "processing", "sent", "delivered", "opened", "clicked", "temporary_failed", "permanent_failed", "bounced", "complained", "cancelled"];

function MailLogInner() {
  const { t } = useTranslation("app");
  const { t: tn } = useTranslation("nav");
  const me = useAuth();
  const [status, setStatus] = useState("");
  const [email, setEmail] = useState("");
  const [rows, setRows] = useState<MailRow[]>([]);
  const [sendingOff, setSendingOff] = useState(false);

  function load() {
    const query = new URLSearchParams();
    if (status) query.set("status", status);
    if (email) query.set("email", email);
    const suffix = query.toString() ? `?${query}` : "";
    return api.mailMessages(suffix).then((res) => setRows(res.data)).catch(alertApiError);
  }

  useEffect(() => {
    if (!userHasPermission(me, "mail.manage")) return;
    void load();
    api.mailSettings()
      .then((res) => setSendingOff(!res.data.sending_enabled))
      .catch(() => undefined);
  }, [me, status]);

  return (
    <>
      <PageHeader
        title={t("mail.logTitle")}
        subtitle={t("mail.logSubtitle")}
        actions={<Link href="/mail" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">{tn("mailTemplates")}</Link>}
      />
      {sendingOff ? (
        <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{t("mail.sendingPausedBanner")}</p>
      ) : null}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="w-56">
          <Select2Field
            theme="light"
            placeholder={t("mail.status")}
            value={status}
            options={[{ value: "", label: t("mail.filterAll") }, ...STATUSES.map((id) => ({ value: id, label: id }))]}
            onChange={setStatus}
          />
        </div>
        <input className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder={t("mail.recipient")} value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => void load()} />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left">{t("mail.when")}</th>
              <th className="px-4 py-3 text-left">{t("mail.recipient")}</th>
              <th className="px-4 py-3 text-left">{t("mail.template")}</th>
              <th className="px-4 py-3 text-left">{t("mail.subject")}</th>
              <th className="px-4 py-3 text-left">{t("mail.status")}</th>
              <th className="px-4 py-3 text-left">{t("mail.attempts")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className="px-4 py-8 text-slate-500" colSpan={6}>{t("mail.emptyLog")}</td></tr>
            ) : rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-500">{row.created_at}</td>
                <td className="px-4 py-3">{row.email}<div className="text-[11px] text-slate-400">{row.user?.role}</div></td>
                <td className="px-4 py-3">{row.template_key}</td>
                <td className="px-4 py-3">{row.subject}</td>
                <td className="px-4 py-3">{row.status}{row.failure_reason ? <div className="text-[11px] text-rose-500">{row.failure_reason}</div> : null}</td>
                <td className="px-4 py-3">{row.attempts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function MailLogScreen() {
  return (
    <AuthenticatedShell>
      <MailLogInner />
    </AuthenticatedShell>
  );
}
