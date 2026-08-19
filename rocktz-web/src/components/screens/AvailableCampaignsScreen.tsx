"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api";
import { alertApiError, alertSuccess } from "@/lib/alerts";
import { useAuth } from "@/lib/use-auth";
import type { Campaign } from "@/lib/types";

function AvailableInner() {
  const user = useAuth();
  const { t } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const [items, setItems] = useState<Campaign[]>([]);
  const [open, setOpen] = useState<Campaign | null>(null);
  const [notes, setNotes] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    api.availableCampaigns().then((res) => setItems(res.data)).catch(alertApiError);
  }, []);

  const blocked = user.role === "creator" && user.creator?.status !== "active";

  return (
    <>
      <PageHeader title={t("available.title")} subtitle={t("available.subtitle")} />
      {blocked ? <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{t("available.blocked")}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((campaign) => (
          <article key={campaign.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-2 flex justify-between">
              <h3 className="font-black">{campaign.name}</h3>
              <StatusBadge status={campaign.status} />
            </div>
            <p className="text-sm text-slate-500">{campaign.company?.name}</p>
            <p className="mt-2 text-sm">{campaign.objective}</p>
            <div className="mt-4 flex gap-2">
              <button type="button" className="rounded-lg border px-3 py-1.5 text-xs font-bold" onClick={() => setOpen(campaign)}>{t("available.seeBriefing")}</button>
              {user.role === "creator" ? (
                <button type="button" disabled={blocked} className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50" onClick={() => setOpen(campaign)}>{t("available.apply")}</button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-lg space-y-3 rounded-3xl bg-white p-6">
            <h2 className="text-xl font-black">{open.name}</h2>
            <p className="text-sm text-slate-600">{String(open.briefing?.key_message ?? open.objective ?? t("available.noBriefing"))}</p>
            {user.role === "creator" && !blocked ? (
              <>
                <textarea className="min-h-20 w-full rounded-xl border p-3 text-sm" placeholder={t("available.notes")} value={notes} onChange={(e) => setNotes(e.target.value)} />
                <input className="h-11 w-full rounded-xl border px-4" placeholder={t("available.amount")} value={amount} onChange={(e) => setAmount(e.target.value)} />
                <button type="button" className="w-full rounded-xl bg-purple-600 py-3 font-bold text-white" onClick={async () => {
                  try {
                    await api.applyCampaign(open.id, { notes, amount: amount ? Number(amount) : null });
                    await alertSuccess(t("available.sent"));
                    setOpen(null);
                  } catch (err) {
                    await alertApiError(err);
                  }
                }}>{t("available.send")}</button>
              </>
            ) : null}
            <button type="button" className="w-full rounded-xl border py-3 font-bold" onClick={() => setOpen(null)}>{tc("close")}</button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function AvailableCampaignsScreen() {
  return <AuthenticatedShell><AvailableInner /></AuthenticatedShell>;
}
