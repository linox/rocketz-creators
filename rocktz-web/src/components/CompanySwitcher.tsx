"use client";

import { useTranslation } from "react-i18next";
import { Select2Field } from "@/components/Select2Field";
import { api } from "@/lib/api";
import { alertApiError } from "@/lib/alerts";
import type { AuthUser } from "@/lib/auth";
import { emitNavRefresh } from "@/lib/session-cache";

export function CompanySwitcher({
  user,
  onUserChange,
}: {
  user: AuthUser;
  onUserChange: (user: AuthUser) => void;
}) {
  const { t } = useTranslation("nav");
  const companies = user.companies?.length ? user.companies : user.company ? [user.company] : [];

  if (user.role !== "company" || companies.length < 2) {
    return null;
  }

  const value = user.company?.id ? String(user.company.id) : "";

  async function switchCompany(next: string) {
    const id = Number(next);
    if (!id || id === user.company?.id) {
      return;
    }
    try {
      const res = await api.switchActiveCompany(id);
      onUserChange(res.user);
      emitNavRefresh();
      window.dispatchEvent(new Event("rocketz:auth-refresh"));
    } catch (err) {
      await alertApiError(err);
    }
  }

  return (
    <div className="min-w-[10.5rem] max-w-[16rem] shrink-0">
      <Select2Field
        theme="light"
        searchable={companies.length > 8}
        value={value}
        options={companies.map((company) => ({ value: String(company.id), label: company.name }))}
        placeholder={t("switchCompany")}
        onChange={(next) => void switchCompany(next)}
        triggerClassName="h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700"
      />
    </div>
  );
}
