"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Building2, Plus, Search, ShieldCheck, Users, X } from "lucide-react";
import { AppModal } from "@/components/AppModal";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { PasswordField } from "@/components/PasswordField";
import { Select2Field } from "@/components/Select2Field";
import { UserAvatar } from "@/components/UserAvatar";
import { PageHeader, StatCard } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { alertApiError, alertConfirm, alertSuccess, alertWarning } from "@/lib/alerts";
import type { AuthUser, UserRole } from "@/lib/auth";
import { userHasPermission } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { isValidEmail, passwordError } from "@/lib/masks";
import type { Company } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

const ADMIN_PERMISSIONS = [
  "users.manage",
  "creators.moderate",
  "companies.moderate",
  "campaigns.assign",
  "campaigns.approve_agency",
  "data.reset",
  "mail.manage",
  "logs.view",
] as const;

const COMPANY_PERMISSIONS = ["campaigns.publish_without_approval"] as const;

function permissionsForRole(role: string) {
  if (role === "admin") return [...ADMIN_PERMISSIONS];
  if (role === "company") return [...COMPANY_PERMISSIONS];
  return [];
}

function permissionKey(slug: string) {
  return slug.replaceAll(".", "_");
}

const EMPTY_FORM = { name: "", email: "", password: "", role: "admin", company_id: "" };

function linkedCompanies(item: AuthUser) {
  if (item.companies?.length) {
    return item.companies;
  }
  return item.company ? [item.company] : [];
}

function UsersInner() {
  const { t } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const { t: tn } = useTranslation("nav");
  const me = useAuth();
  const [items, setItems] = useState<AuthUser[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formPerms, setFormPerms] = useState<string[]>([...ADMIN_PERMISSIONS]);
  const [editing, setEditing] = useState<AuthUser | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [addCompanyId, setAddCompanyId] = useState("");
  const [saving, setSaving] = useState(false);

  const canManage = userHasPermission(me, "users.manage");

  async function load() {
    try {
      const params = new URLSearchParams();
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (query.trim()) params.set("q", query.trim());
      const suffix = params.toString() ? `?${params}` : "";
      const [usersRes, companiesRes] = await Promise.all([
        api.users(suffix),
        api.companies(),
      ]);
      setItems(usersRes.data);
      setCompanies(companiesRes.data);
    } catch (err) {
      await alertApiError(err);
    }
  }

  useEffect(() => {
    void load();
  }, [roleFilter]);

  const counts = useMemo(() => ({
    all: items.length,
    admin: items.filter((item) => item.role === "admin").length,
    company: items.filter((item) => item.role === "company").length,
    creator: items.filter((item) => item.role === "creator").length,
  }), [items]);

  const roleOptions = [
    { value: "all", label: t("users.filterAll") },
    { value: "admin", label: tn("roleAdmin") },
    { value: "company", label: tn("roleCompany") },
    { value: "creator", label: tn("roleCreator") },
  ];

  const createRoleOptions = [
    { value: "admin", label: tn("roleAdmin") },
    { value: "company", label: tn("roleCompany") },
  ];

  const companyOptions = companies.map((company) => ({
    value: String(company.id),
    label: company.name,
  }));

  function togglePerm(list: string[], slug: string, setList: (next: string[]) => void) {
    setList(list.includes(slug) ? list.filter((item) => item !== slug) : [...list, slug]);
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormPerms([...ADMIN_PERMISSIONS]);
    setCreateOpen(true);
  }

  function onRoleChange(role: string) {
    setForm((current) => ({ ...current, role, company_id: role === "company" ? current.company_id : "" }));
    setFormPerms(role === "admin" ? [...ADMIN_PERMISSIONS] : []);
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      await alertWarning(tc("alerts.incompleteTitle"), t("users.incomplete"));
      return;
    }
    if (!isValidEmail(form.email)) {
      await alertWarning(tc("alerts.invalidEmailTitle"), tc("alerts.invalidEmail"));
      return;
    }
    const passwordIssue = passwordError(form.password);
    if (passwordIssue) {
      await alertWarning(tc("alerts.invalidPasswordTitle"), tc(`password.${passwordIssue}`));
      return;
    }
    if (form.role === "company" && !form.company_id) {
      await alertWarning(tc("alerts.incompleteTitle"), t("users.companyRequired"));
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        permissions: formPerms,
      };
      if (form.role === "company") {
        payload.company_id = Number(form.company_id);
      }
      await api.createUser(payload);
      setCreateOpen(false);
      await alertSuccess(t("users.created"));
      await load();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setSaving(false);
    }
  }

  async function onSavePermissions() {
    if (!editing) return;
    setSaving(true);
    try {
      await api.updateUser(editing.id, { permissions: editPerms });
      setEditing(null);
      await alertSuccess(t("users.permissionsSaved"));
      await load();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setSaving(false);
    }
  }

  async function onRemove(item: AuthUser) {
    const isCreator = item.role === "creator";
    const title = isCreator ? t("users.removeCreatorTitle") : t("users.removeTitle");
    const text = isCreator
      ? t("users.removeCreatorText", { name: item.creator?.artistic_name || item.name, email: item.email })
      : item.email;
    if (!(await alertConfirm(title, text, tc("remove")))) return;
    try {
      await api.deleteUser(item.id);
      await alertSuccess(t("users.removed"));
      await load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  function openEdit(item: AuthUser) {
    setEditing(item);
    setEditPerms(item.permissions ?? []);
    setAddCompanyId("");
  }

  function applyEditedUser(next: AuthUser) {
    setEditing(next);
    setItems((current) => current.map((item) => (item.id === next.id ? next : item)));
  }

  async function onAttachCompany() {
    if (!editing || !addCompanyId) {
      await alertWarning(tc("alerts.incompleteTitle"), t("users.companyRequired"));
      return;
    }
    setSaving(true);
    try {
      const res = await api.attachUserCompany(editing.id, { company_id: Number(addCompanyId) });
      applyEditedUser(res.data);
      setAddCompanyId("");
      await alertSuccess(t("users.companyLinked"));
      await load();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setSaving(false);
    }
  }

  async function onDetachCompany(companyId: number, companyName: string) {
    if (!editing) return;
    if (!(await alertConfirm(t("users.unlinkCompany"), t("users.unlinkCompanyConfirm", { name: editing.name, company: companyName })))) {
      return;
    }
    setSaving(true);
    try {
      const res = await api.detachUserCompany(editing.id, companyId);
      applyEditedUser(res.data);
      await alertSuccess(t("users.companyUnlinked"));
      await load();
    } catch (err) {
      await alertApiError(err);
    } finally {
      setSaving(false);
    }
  }

  function CompanyLinks({ item, onEdit }: { item: AuthUser; onEdit?: () => void }) {
    if (item.role === "creator") {
      return <>{item.creator?.artistic_name || "—"}</>;
    }
    const linked = linkedCompanies(item);
    if (item.role !== "company") {
      return <>{t("users.noContext")}</>;
    }
    return (
      <div className="flex flex-wrap items-center gap-1">
        {linked.length === 0 ? <span>{t("users.noContext")}</span> : null}
        {linked.map((company) => (
          <span key={company.id} className="inline-flex max-w-full items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
            <Building2 size={10} className="shrink-0" />
            <span className="truncate">{company.name}</span>
          </span>
        ))}
        {canManage && onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-emerald-300 bg-white px-2 py-0.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-50"
          >
            <Plus size={10} />
            {t("users.addCompany")}
          </button>
        ) : null}
      </div>
    );
  }

  function roleBadge(role: UserRole) {
    const styles = {
      admin: "border-indigo-200 bg-indigo-50 text-indigo-700",
      company: "border-emerald-200 bg-emerald-50 text-emerald-800",
      creator: "border-amber-200 bg-amber-50 text-amber-800",
    } as const;
    const labels = { admin: tn("roleAdmin"), company: tn("roleCompany"), creator: tn("roleCreator") };
    return (
      <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-extrabold tracking-wider uppercase", styles[role])}>
        {labels[role]}
      </span>
    );
  }

  function PermissionList({
    role,
    selected,
    onToggle,
  }: {
    role: string;
    selected: string[];
    onToggle: (slug: string) => void;
  }) {
    const slugs = permissionsForRole(role);
    if (slugs.length === 0) {
      return <p className="m-0 text-sm text-slate-500">{t("users.noPermissionsForRole")}</p>;
    }
    return (
      <div className="flex flex-col gap-2">
        {slugs.map((slug) => {
          const key = permissionKey(slug);
          const checked = selected.includes(slug);
          return (
            <label key={slug} className={cn("flex cursor-pointer items-start gap-3 rounded-2xl border p-3", checked ? "border-indigo-200 bg-indigo-50/50" : "border-slate-200 bg-white")}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(slug)}
                className="mt-0.5 h-4 w-4 accent-brand-primary"
              />
              <span>
                <span className="block text-sm font-bold text-slate-900">{t(`users.permissions.${key}.label`)}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{t(`users.permissions.${key}.hint`)}</span>
              </span>
            </label>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={t("users.title")}
        subtitle={t("users.subtitle")}
        actions={canManage ? (
          <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 text-xs font-bold text-white hover:bg-indigo-600">
            <Plus size={14} /> {t("users.new")}
          </button>
        ) : undefined}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("users.kpiAll")} value={counts.all} />
        <StatCard label={tn("roleAdmin")} value={counts.admin} />
        <StatCard label={tn("roleCompany")} value={counts.company} />
        <StatCard label={tn("roleCreator")} value={counts.creator} />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400" />
          <input
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pr-4 pl-10 text-sm outline-none focus:border-brand-primary"
            placeholder={t("users.searchPh")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void load();
            }}
          />
        </div>
        <Select2Field theme="light" className="sm:w-52" value={roleFilter} options={roleOptions} onChange={setRoleFilter} />
        <button type="button" onClick={() => void load()} className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50">
          {tc("search")}
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden lg:block">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-extrabold tracking-wider text-slate-500 uppercase">
                <th className="p-3.5 pl-5">{t("users.colUser")}</th>
                <th className="p-3.5">{t("users.colRole")}</th>
                <th className="p-3.5">{t("users.colContext")}</th>
                <th className="p-3.5">{t("users.colPermissions")}</th>
                <th className="p-3.5 pr-5 text-right">{t("users.colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80">
                  <td className="p-3.5 pl-5">
                    <div className="flex items-center gap-3">
                      <UserAvatar src={item.avatar_url || item.creator?.photo_url || item.company?.logo_url} name={item.name} size="custom" shape="rounded-xl" className="h-9 w-9 border border-slate-200" textClassName="text-[10px]" />
                      <div>
                        <p className="m-0 text-sm font-bold text-slate-900">{item.name}</p>
                        <p className="m-0 text-[11px] text-slate-500">{item.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5">{roleBadge(item.role)}</td>
                  <td className="p-3.5 text-slate-600">
                    <CompanyLinks item={item} onEdit={canManage ? () => openEdit(item) : undefined} />
                  </td>
                  <td className="p-3.5 font-semibold text-slate-700">
                    {t("users.permissionCount", { count: (item.permissions ?? []).length })}
                  </td>
                  <td className="p-3.5 pr-5 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {item.role === "creator" && item.creator?.id ? (
                        <Link href={`/creators/${item.creator.id}`} className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-200">
                          {t("users.openProfile")}
                        </Link>
                      ) : null}
                      {canManage && (item.role === "company" || permissionsForRole(item.role).length > 0) ? (
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="rounded-lg bg-indigo-50 px-3 py-1.5 text-[11px] font-bold text-brand-primary hover:bg-indigo-100"
                        >
                          {item.role === "company" ? t("users.manageCompanies") : t("users.editPermissions")}
                        </button>
                      ) : null}
                      {canManage && item.id !== me.id ? (
                        <button type="button" onClick={() => void onRemove(item)} className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-rose-600 hover:bg-rose-50">
                          {tc("remove")}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col divide-y divide-slate-100 lg:hidden">
          {items.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <UserAvatar src={item.avatar_url || item.creator?.photo_url || item.company?.logo_url} name={item.name} size="custom" shape="rounded-xl" className="h-10 w-10 border border-slate-200" textClassName="text-xs" />
                  <div className="min-w-0">
                    <p className="m-0 truncate text-sm font-bold text-slate-900">{item.name}</p>
                    <p className="m-0 truncate text-[11px] text-slate-500">{item.email}</p>
                  </div>
                </div>
                {roleBadge(item.role)}
              </div>
              <div className="text-xs text-slate-500"><CompanyLinks item={item} onEdit={canManage ? () => openEdit(item) : undefined} /></div>
              <div className="flex flex-wrap gap-2">
                {item.role === "creator" && item.creator?.id ? (
                  <Link href={`/creators/${item.creator.id}`} className="rounded-lg bg-slate-100 px-3 py-2 text-[11px] font-bold text-slate-700">{t("users.openProfile")}</Link>
                ) : null}
                {canManage && (item.role === "company" || permissionsForRole(item.role).length > 0) ? (
                  <button type="button" onClick={() => openEdit(item)} className="rounded-lg bg-indigo-50 px-3 py-2 text-[11px] font-bold text-brand-primary">{item.role === "company" ? t("users.manageCompanies") : t("users.editPermissions")}</button>
                ) : null}
                {canManage && item.id !== me.id ? (
                  <button type="button" onClick={() => void onRemove(item)} className="rounded-lg px-3 py-2 text-[11px] font-bold text-rose-600">{tc("remove")}</button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        {items.length === 0 ? (
          <div className="p-12 text-center">
            <Users size={28} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-700">{t("users.empty")}</p>
          </div>
        ) : null}
      </div>

      {createOpen ? (
        <AppModal onClose={() => setCreateOpen(false)}>
          <form noValidate onSubmit={onCreate} className="flex min-h-0 flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="m-0 flex items-center gap-2 text-[10px] font-bold tracking-wider text-brand-primary uppercase">
                  <ShieldCheck size={14} /> {t("users.new")}
                </p>
                <h3 className="m-0 mt-1 text-base font-black text-slate-900">{t("users.createTitle")}</h3>
              </div>
              <button type="button" onClick={() => setCreateOpen(false)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100" aria-label={tc("close")}>✕</button>
            </div>
            <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">{t("users.role")}</span>
                  <Select2Field theme="light" value={form.role} options={createRoleOptions} onChange={onRoleChange} />
                </label>
                {form.role === "company" ? (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">{t("users.company")}</span>
                    <Select2Field theme="light" value={form.company_id} options={companyOptions} placeholder={t("users.companyPh")} onChange={(value) => setForm((current) => ({ ...current, company_id: value }))} />
                  </label>
                ) : (
                  <div className="hidden sm:block" />
                )}
                <input className="h-11 rounded-xl border border-slate-200 px-4 text-sm" placeholder={t("users.name")} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                <input className="h-11 rounded-xl border border-slate-200 px-4 text-sm" placeholder={t("users.email")} value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
                <PasswordField className="sm:col-span-2" placeholder={t("users.password")} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} inputClassName="border border-slate-200 px-4 text-sm" />
              </div>
              <div>
                <p className="mb-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase">{t("users.permissionsTitle")}</p>
                <PermissionList role={form.role} selected={formPerms} onToggle={(slug) => togglePerm(formPerms, slug, setFormPerms)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button type="button" onClick={() => setCreateOpen(false)} className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">{tc("cancel")}</button>
              <button type="submit" disabled={saving} className="rounded-xl bg-brand-primary px-4 py-2 text-xs font-bold text-white hover:bg-indigo-600 disabled:opacity-50">{saving ? tc("saving") : tc("create")}</button>
            </div>
          </form>
        </AppModal>
      ) : null}

      {editing ? (
        <AppModal onClose={() => setEditing(null)} lockBackdrop zIndexClassName="z-[200]">
          <div className="flex min-h-0 flex-col">
            <div className="border-b border-slate-100 px-5 py-4">
              <p className="m-0 text-[10px] font-bold tracking-wider text-brand-primary uppercase">
                {editing.role === "company" ? t("users.manageCompanies") : t("users.editPermissions")}
              </p>
              <h3 className="m-0 mt-1 text-base font-black text-slate-900">{editing.name}</h3>
              <p className="m-0 text-xs text-slate-500">{editing.email}</p>
            </div>
            <div className="flex min-h-0 flex-col gap-5 overflow-y-auto p-5">
              {editing.role === "company" ? (
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="m-0 text-[10px] font-bold tracking-wider text-slate-500 uppercase">{t("users.manageCompaniesTitle")}</p>
                    <p className="m-0 mt-1 text-xs leading-relaxed text-slate-500">{t("users.manageCompaniesHint")}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {linkedCompanies(editing).length === 0 ? (
                      <p className="m-0 text-xs text-slate-500">{t("users.noContext")}</p>
                    ) : (
                      linkedCompanies(editing).map((company) => (
                        <div key={company.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <span className="min-w-0 truncate text-sm font-bold text-slate-800">{company.name}</span>
                          {linkedCompanies(editing).length > 1 ? (
                            <button
                              type="button"
                              disabled={saving}
                              title={t("users.unlinkCompany")}
                              onClick={() => void onDetachCompany(company.id, company.name)}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                            >
                              <X size={12} />
                              {t("users.unlinkCompany")}
                            </button>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                  {(() => {
                    const linkedIds = new Set(linkedCompanies(editing).map((company) => Number(company.id)));
                    const available = companies.filter((company) => !linkedIds.has(Number(company.id)));
                    if (companies.length === 0) {
                      return <p className="m-0 text-xs text-slate-500">{t("users.noCompaniesRegistered")}</p>;
                    }
                    if (available.length === 0) {
                      return <p className="m-0 text-xs text-slate-500">{t("users.noOtherCompanies")}</p>;
                    }
                    return (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <label className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">{t("users.companyToAdd")}</span>
                          <Select2Field
                            theme="light"
                            value={addCompanyId}
                            options={available.map((company) => ({ value: String(company.id), label: company.name }))}
                            placeholder={t("users.companyPh")}
                            onChange={setAddCompanyId}
                          />
                        </label>
                        <button
                          type="button"
                          disabled={saving || !addCompanyId}
                          onClick={() => void onAttachCompany()}
                          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <Plus size={14} />
                          {t("users.addCompany")}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ) : null}
              {permissionsForRole(editing.role).length > 0 ? (
                <div>
                  <p className="mb-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase">{t("users.permissionsTitle")}</p>
                  <PermissionList role={editing.role} selected={editPerms} onToggle={(slug) => togglePerm(editPerms, slug, setEditPerms)} />
                </div>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button type="button" onClick={() => setEditing(null)} className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">{tc("close")}</button>
              {permissionsForRole(editing.role).length > 0 ? (
                <button type="button" disabled={saving} onClick={() => void onSavePermissions()} className="rounded-xl bg-brand-primary px-4 py-2 text-xs font-bold text-white hover:bg-indigo-600 disabled:opacity-50">{saving ? tc("saving") : tc("save")}</button>
              ) : null}
            </div>
          </div>
        </AppModal>
      ) : null}
    </>
  );
}

export function AdminUsersScreen() {
  return (
    <AuthenticatedShell>
      <UsersInner />
    </AuthenticatedShell>
  );
}

export function UsersScreen() {
  return <AdminUsersScreen />;
}
