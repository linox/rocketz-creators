"use client";

import { useEffect, useState } from "react";
import { Globe, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Select2Field } from "@/components/Select2Field";
import { api } from "@/lib/api";
import { alertApiError, alertConfirm, alertSuccess, alertWarning } from "@/lib/alerts";
import { useAuth } from "@/lib/use-auth";
import type { Company, Creator } from "@/lib/types";

export function CreatorLandingOriginCard({
  creator,
  onChanged,
}: {
  creator: Creator;
  onChanged: () => Promise<void> | void;
}) {
  const { t } = useTranslation("app");
  const user = useAuth();
  const isAdmin = user.role === "admin";
  const fixedCompanyId = user.company?.id ?? null;
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState(isAdmin ? "" : String(fixedCompanyId || ""));
  const [landingId, setLandingId] = useState("");
  const [landingOptions, setLandingOptions] = useState<{ value: string; label: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    api.companies()
      .then((res) => {
        if (!cancelled) setCompanies(res.data);
      })
      .catch(() => {
        if (!cancelled) setCompanies([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    const id = isAdmin ? Number(companyId) : fixedCompanyId;
    if (!id) {
      setLandingOptions([]);
      return;
    }
    const taken = new Set((creator.landing_origins ?? []).map((origin) => origin.landing?.id).filter((value): value is number => Boolean(value)));
    let cancelled = false;
    api.companyLandings(id)
      .then((res) => {
        if (cancelled) return;
        setLandingOptions(
          res.data
            .filter((page) => !taken.has(page.id))
            .map((page) => ({ value: String(page.id), label: page.display_name })),
        );
      })
      .catch(() => {
        if (!cancelled) setLandingOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, creator.landing_origins, fixedCompanyId, isAdmin]);

  async function addOrigin() {
    if (!landingId) {
      await alertWarning(t("creators.originTitle"), t("creators.originPick"));
      return;
    }
    setSaving(true);
    try {
      await api.attachCreatorLanding(creator.id, Number(landingId));
      setLandingId("");
      await alertSuccess(t("creators.originAdded"));
      await onChanged();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setSaving(false);
    }
  }

  async function removeOrigin(signupId: number) {
    if (!(await alertConfirm(t("creators.originRemoveTitle"), t("creators.originRemoveText"), t("creators.originRemove")))) return;
    try {
      await api.detachCreatorLanding(creator.id, signupId);
      await onChanged();
    } catch (err) {
      await alertApiError(err);
    }
  }

  const origins = creator.landing_origins ?? [];

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-violet-200 bg-violet-50/60 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
          <Globe size={20} />
        </div>
        <div>
          <h4 className="m-0 text-sm font-bold text-violet-950">{t("creators.originTitle")}</h4>
          <p className="mt-0.5 max-w-xl text-xs text-violet-800">{t("creators.originHint")}</p>
        </div>
      </div>

      {origins.length ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {origins.map((origin) => (
            <li key={origin.id} className="flex items-center justify-between gap-3 rounded-xl border border-violet-100 bg-white px-3 py-2">
              <span className="text-xs font-bold text-slate-800">
                {t("creators.landingOrigin", {
                  landing: origin.landing?.display_name || "—",
                  company: origin.company?.name || "—",
                })}
              </span>
              <button
                type="button"
                onClick={() => void removeOrigin(origin.id)}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-800 hover:bg-rose-100"
              >
                <X size={12} /> {t("creators.originRemove")}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-xs text-violet-800">{t("creators.originEmpty")}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        {isAdmin ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold tracking-wider text-violet-900 uppercase">{t("creators.originCompany")}</label>
            <Select2Field
              theme="light"
              placeholder={t("creators.originCompanyPh")}
              value={companyId}
              options={companies.map((company) => ({ value: String(company.id), label: company.name }))}
              onChange={(value) => {
                setCompanyId(value);
                setLandingId("");
              }}
            />
          </div>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold tracking-wider text-violet-900 uppercase">{t("creators.originLanding")}</label>
          <Select2Field
            theme="light"
            placeholder={t("creators.originLandingPh")}
            value={landingId}
            options={landingOptions}
            onChange={setLandingId}
            disabled={!isAdmin && !fixedCompanyId}
          />
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void addOrigin()}
          className="rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {t("creators.originAdd")}
        </button>
      </div>
    </div>
  );
}
