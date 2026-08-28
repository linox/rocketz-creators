"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";
import { Building2, CheckCircle2, Clock, Edit, Eye, Mail, MapPin, Phone, Plus, Search, Trash2, Users, XCircle } from "lucide-react";
import { AuthenticatedShell } from "@/components/AuthenticatedShell";
import { PasswordField } from "@/components/PasswordField";
import { Select2Field } from "@/components/Select2Field";
import { CountrySelect, CurrencySelect } from "@/components/GeoSelectFields";
import { UserAvatar } from "@/components/UserAvatar";
import { api } from "@/lib/api";
import { alertApiError, alertConfirm, alertSuccess, alertWarning } from "@/lib/alerts";
import { cn } from "@/lib/cn";
import { formatCNPJ, formatWhatsApp, isValidCNPJ, isValidEmail, passwordError } from "@/lib/masks";
import { DEFAULT_COUNTRY, DEFAULT_CURRENCY, countryLabel, defaultCurrencyForCountry, isValidCountry, isValidCurrency } from "@/lib/geo";
import type { Company } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";

type CompanyContact = NonNullable<Company["contacts"]>[number];
type FilterTab = "all" | "pending" | "active";

const INPUT = "w-full rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-brand-primary";
const LABEL = "text-[11px] font-bold tracking-wider text-[#64748B] uppercase";
const EMPTY_FORM = { name: "", cnpj: "", segment: "", email: "", whatsapp: "", city: "", country: DEFAULT_COUNTRY, currency: DEFAULT_CURRENCY, observations: "", logo_url: "" };

function CompanyStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation("app");
  const styles: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-800 border-emerald-200",
    rejected: "bg-rose-100 text-rose-800 border-rose-200",
    pending: "bg-amber-100 text-amber-900 border-amber-300",
  };

  return (
    <span className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black tracking-wider uppercase", styles[status] ?? "border-slate-200 bg-slate-100 text-slate-600")}>
      {status === "active" ? <CheckCircle2 size={10} /> : null}
      {status === "pending" ? <Clock size={10} /> : null}
      {status === "rejected" ? <XCircle size={10} /> : null}
      {t(`status.${status}`, { defaultValue: status })}
    </span>
  );
}

function CompanyCard({
  company,
  isAdmin,
  onEdit,
  onApprove,
  onReject,
  onDelete,
}: {
  company: Company;
  isAdmin: boolean;
  onEdit: (company: Company) => void;
  onApprove: (company: Company) => void;
  onReject: (company: Company) => void;
  onDelete: (company: Company) => void;
}) {
  const { t, i18n } = useTranslation("app");
  const status = company.status || "pending";
  const contacts = company.contacts ?? [];

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "flex h-full flex-col rounded-[16px] border bg-white p-6 transition-all hover:border-brand-primary",
        status === "pending" ? "border-amber-300 bg-amber-50/10 ring-2 ring-amber-400/20" : "border-[#E2E8F0]",
      )}
    >
      <div className="mb-4 flex items-start justify-between">
        <UserAvatar
          src={company.logo_url}
          name={company.name}
          size="custom"
          shape="rounded-xl"
          className="h-12 w-12 border border-slate-200 shadow-xs"
          textClassName="text-base font-black"
        />
        <div className="flex items-center gap-1.5">
          <CompanyStatusBadge status={status} />
          {isAdmin ? (
            <>
              <button
                type="button"
                onClick={() => onEdit(company)}
                title={t("companies.editTitle")}
                className="rounded-lg p-2 text-slate-400 transition-all hover:bg-slate-50 hover:text-slate-600"
              >
                <Edit size={16} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(company)}
                title={t("companies.delete")}
                className="rounded-lg p-2 text-slate-400 transition-all hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 size={16} />
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex-1">
        <h2 className="mb-1 text-[18px] font-bold text-[#0F172A]">{company.name}</h2>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-bold tracking-wider text-brand-primary uppercase">
            {company.segment || t("companies.noSegment")}
          </span>
          {contacts.length > 0 ? (
            <span className="flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              <Users size={10} /> {t("companies.contactCount", { count: contacts.length })}
            </span>
          ) : null}
        </div>

        {status === "pending" && isAdmin ? (
          <div className="mb-4 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
              <Clock size={14} className="shrink-0 text-amber-600" />
              <span>{t("companies.awaiting")}</span>
            </div>
            <p className="m-0 text-[11px] leading-snug text-amber-800">{t("companies.awaitingHint")}</p>
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onApprove(company)}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
              >
                <CheckCircle2 size={13} />
                {t("companies.approve")}
              </button>
              <button
                type="button"
                onClick={() => onReject(company)}
                title={t("companies.reject")}
                className="flex items-center justify-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
              >
                <XCircle size={13} />
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-2">
          <div className="flex items-center gap-3 text-xs text-[#64748B]">
            <MapPin size={14} className="shrink-0" />
            {[company.city, countryLabel(company.country || DEFAULT_COUNTRY, i18n.language), company.currency || DEFAULT_CURRENCY].filter(Boolean).join(" · ") || t("companies.cityMissing")}
          </div>
          <div className="flex items-center gap-3 text-xs text-[#64748B]">
            <Mail size={14} className="shrink-0" />
            {company.email || t("companies.emailMissing")}
          </div>
          <div className="flex items-center gap-3 text-xs text-[#64748B]">
            <Phone size={14} className="shrink-0" />
            {company.whatsapp || t("companies.whatsappMissing")}
          </div>
          {company.cnpj ? <div className="mt-1 font-mono text-[11px] text-[#94A3B8]">{t("companies.cnpjLabel")}: {company.cnpj}</div> : null}
        </div>

        {contacts.length > 0 ? (
          <div className="mt-4 border-t border-[#F1F5F9] pt-3">
            <span className="mb-1.5 block text-[10px] font-bold tracking-wider text-slate-400 uppercase">{t("companies.mainContacts")}</span>
            <div className="flex max-h-[70px] flex-col gap-1 overflow-y-auto">
              {contacts.map((contact) => (
                <div key={contact.id} className="flex justify-between gap-1 text-[11px] text-slate-600">
                  <span className="truncate font-semibold">
                    {contact.name}
                    {contact.role ? ` (${contact.role})` : ""}
                  </span>
                  <span className="shrink-0 text-[10px] text-slate-400">{contact.whatsapp || contact.email}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex gap-2 border-t border-[#F1F5F9] pt-4">
        {isAdmin ? (
          <button
            type="button"
            onClick={() => onEdit(company)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] py-2 text-xs font-bold tracking-wider text-[#0F172A] uppercase transition-all hover:bg-slate-100"
          >
            <Edit size={14} className="text-slate-500" />
            {t("companies.edit")}
          </button>
        ) : null}
        <Link
          href={`/company-dashboard?companyId=${company.id}`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50 py-2 text-xs font-bold tracking-wider text-brand-primary uppercase transition-all hover:bg-indigo-100"
        >
          <Eye size={14} />
          {t("companies.viewPanel")}
        </Link>
      </div>
    </motion.article>
  );
}

function LogoPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const { t } = useTranslation("app");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onFile(file: File) {
    if (!file.type.startsWith("image/")) {
      await alertWarning(t("companies.invalidLogoTitle"), t("companies.invalidLogo"));
      return;
    }
    setUploading(true);
    try {
      const uploaded = await api.uploadMedia(file, file.name);
      onChange(uploaded.data.url);
    } catch (err) {
      await alertApiError(err);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className={LABEL}>{label}</label>
      <div className="flex items-center gap-3">
        <UserAvatar src={value || null} name={t("companies.logo")} size="lg" shape="rounded-xl" className="border border-slate-200" />
        <div className="min-w-0 flex-1">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {uploading ? t("companies.uploadingLogo") : t("companies.uploadLogo")}
          </button>
          <p className="mt-1 text-[11px] text-slate-400">{t("companies.logoHint")}</p>
        </div>
        {value ? (
          <button type="button" onClick={() => onChange("")} className="text-xs font-bold text-rose-600 hover:text-rose-700">
            {t("companies.removeLogo")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function CompaniesInner() {
  const user = useAuth();
  const { t } = useTranslation("app");
  const { t: tc } = useTranslation("common");
  const isAdmin = user.role === "admin";
  const [items, setItems] = useState<Company[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterTab>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<Company | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editStatus, setEditStatus] = useState("active");
  const [tempContacts, setTempContacts] = useState<CompanyContact[]>([]);
  const [newContact, setNewContact] = useState({ name: "", role: "", email: "", whatsapp: "" });
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", can_publish_without_approval: false });
  const [creatingUser, setCreatingUser] = useState(false);

  const statusOptions = useMemo(
    () => [
      { value: "active", label: t("companies.statusActive") },
      { value: "pending", label: t("companies.statusPending") },
      { value: "rejected", label: t("companies.statusRejected") },
    ],
    [t],
  );

  async function load() {
    try {
      const res = await api.companies();
      setItems(res.data);
    } catch (err) {
      await alertApiError(err);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const pendingCount = items.filter((company) => company.status === "pending").length;
  const activeCount = items.filter((company) => company.status === "active").length;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((company) => {
      const matchesSearch = !term || company.name.toLowerCase().includes(term);
      const matchesStatus = statusFilter === "all" || company.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [items, search, statusFilter]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!createForm.name.trim()) {
      await alertWarning(tc("alerts.incompleteTitle"), t("companies.incomplete"));
      return;
    }
    if (createForm.email && !isValidEmail(createForm.email)) {
      await alertWarning(tc("alerts.invalidEmailTitle"), tc("alerts.invalidEmail"));
      return;
    }
    if (createForm.cnpj && !isValidCNPJ(createForm.cnpj)) {
      await alertWarning(tc("alerts.checkData"), t("companies.invalidCnpj"));
      return;
    }
    if (!isValidCountry(createForm.country)) {
      await alertWarning(tc("alerts.countryRequiredTitle"), tc("alerts.countryRequired"));
      return;
    }
    if (!isValidCurrency(createForm.currency)) {
      await alertWarning(tc("alerts.currencyRequiredTitle"), tc("alerts.currencyRequired"));
      return;
    }
    try {
      await api.createCompany({
        name: createForm.name.trim(),
        cnpj: createForm.cnpj.trim() || null,
        segment: createForm.segment.trim() || null,
        email: createForm.email.trim() || null,
        whatsapp: createForm.whatsapp.trim() || null,
        city: createForm.city.trim() || null,
        country: createForm.country,
        currency: createForm.currency,
        observations: createForm.observations.trim() || null,
        logo_url: createForm.logo_url.trim() || null,
        status: "active",
      });
      setCreateOpen(false);
      setCreateForm(EMPTY_FORM);
      await alertSuccess(t("companies.created"));
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function openEdit(company: Company) {
    try {
      const res = await api.company(company.id);
      const next = res.data;
      setEditing(next);
      setEditStatus(next.status || "active");
      setEditForm({
        name: next.name || "",
        cnpj: next.cnpj || "",
        segment: next.segment || "",
        email: next.email || "",
        whatsapp: next.whatsapp || "",
        city: next.city || "",
        country: next.country || DEFAULT_COUNTRY,
        currency: next.currency || defaultCurrencyForCountry(next.country),
        observations: next.observations || "",
        logo_url: next.logo_url || "",
      });
      setTempContacts(next.contacts ?? []);
      setNewContact({ name: "", role: "", email: "", whatsapp: "" });
      setNewUser({ name: "", email: "", password: "", can_publish_without_approval: false });
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function onSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    if (!editForm.name.trim()) {
      await alertWarning(tc("alerts.incompleteTitle"), t("companies.incomplete"));
      return;
    }
    if (editForm.email && !isValidEmail(editForm.email)) {
      await alertWarning(tc("alerts.invalidEmailTitle"), tc("alerts.invalidEmail"));
      return;
    }
    if (editForm.cnpj && !isValidCNPJ(editForm.cnpj)) {
      await alertWarning(tc("alerts.checkData"), t("companies.invalidCnpj"));
      return;
    }
    if (!isValidCountry(editForm.country)) {
      await alertWarning(tc("alerts.countryRequiredTitle"), tc("alerts.countryRequired"));
      return;
    }
    if (!isValidCurrency(editForm.currency)) {
      await alertWarning(tc("alerts.currencyRequiredTitle"), tc("alerts.currencyRequired"));
      return;
    }
    try {
      await api.updateCompany(editing.id, {
        name: editForm.name.trim(),
        cnpj: editForm.cnpj.trim() || null,
        segment: editForm.segment.trim() || null,
        email: editForm.email.trim() || null,
        whatsapp: editForm.whatsapp.trim() || null,
        city: editForm.city.trim() || null,
        country: editForm.country,
        currency: editForm.currency,
        observations: editForm.observations.trim() || null,
        logo_url: editForm.logo_url.trim() || null,
        status: editStatus,
        contacts: tempContacts.map((contact) => ({
          name: contact.name,
          role: contact.role,
          email: contact.email,
          whatsapp: contact.whatsapp,
        })),
      });
      setEditing(null);
      await alertSuccess(t("companies.updated"));
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function addContact() {
    if (!newContact.name.trim()) {
      await alertWarning(tc("alerts.incompleteTitle"), t("companies.contactNameRequired"));
      return;
    }
    setTempContacts((current) => [
      ...current,
      {
        id: Date.now(),
        name: newContact.name.trim(),
        role: newContact.role.trim() || t("companies.defaultRole"),
        email: newContact.email.trim() || null,
        whatsapp: newContact.whatsapp.trim() || null,
      },
    ]);
    setNewContact({ name: "", role: "", email: "", whatsapp: "" });
  }

  async function createAccessUser() {
    if (!editing) return;
    if (!newUser.name.trim() || !newUser.email.trim()) {
      await alertWarning(tc("alerts.incompleteTitle"), t("companies.userIncomplete"));
      return;
    }
    if (!isValidEmail(newUser.email)) {
      await alertWarning(tc("alerts.invalidEmailTitle"), tc("alerts.invalidEmail"));
      return;
    }
    if (newUser.password) {
      const issue = passwordError(newUser.password);
      if (issue) {
        await alertWarning(tc("alerts.invalidPasswordTitle"), tc(`password.${issue}`));
        return;
      }
    }
    setCreatingUser(true);
    try {
      await api.createCompanyUser(editing.id, {
        name: newUser.name.trim(),
        email: newUser.email.trim(),
        password: newUser.password || undefined,
        can_publish_without_approval: newUser.can_publish_without_approval,
      });
      const res = await api.company(editing.id);
      setEditing(res.data);
      setNewUser({ name: "", email: "", password: "", can_publish_without_approval: false });
      await alertSuccess(t("companies.userCreated"));
    } catch (err) {
      await alertApiError(err);
    } finally {
      setCreatingUser(false);
    }
  }

  async function togglePublishWithoutApproval(companyUser: NonNullable<Company["users"]>[number]) {
    if (!editing) return;
    try {
      await api.updateCompanyUser(editing.id, companyUser.id, {
        can_publish_without_approval: !companyUser.can_publish_without_approval,
      });
      const res = await api.company(editing.id);
      setEditing(res.data);
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function removeAccessUser(userId: number) {
    if (!editing) return;
    if (!(await alertConfirm(t("companies.removeAccess"), t("companies.removeAccessConfirm")))) return;
    try {
      await api.deleteCompanyUser(editing.id, userId);
      const res = await api.company(editing.id);
      setEditing(res.data);
      await alertSuccess(t("companies.userRemoved"));
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function approve(company: Company) {
    if (!(await alertConfirm(t("companies.approveTitle"), company.name))) return;
    try {
      await api.approveCompany(company.id);
      await alertSuccess(t("companies.approved", { name: company.name }));
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function reject(company: Company) {
    if (!(await alertConfirm(t("companies.rejectTitle"), t("companies.rejectConfirm", { name: company.name }), t("companies.reject")))) return;
    try {
      await api.rejectCompany(company.id);
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  async function removeCompany(company: Company) {
    if (!(await alertConfirm(t("companies.deleteTitle"), t("companies.deleteConfirm", { name: company.name }), t("companies.delete")))) return;
    try {
      await api.deleteCompany(company.id);
      setEditing(null);
      await alertSuccess(t("companies.deleted"));
      load();
    } catch (err) {
      await alertApiError(err);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="m-0 text-xl font-bold text-[#0F172A] sm:text-[28px]">{t("companies.title")}</h1>
          <p className="mt-1 text-[14px] text-[#64748B]">{t("companies.subtitle")}</p>
        </div>
        {isAdmin ? (
          <button
            type="button"
            onClick={() => {
              setCreateForm(EMPTY_FORM);
              setCreateOpen(true);
            }}
            className="flex h-11 items-center gap-2 rounded-lg bg-brand-primary px-6 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-600 active:scale-95"
          >
            <Plus size={18} />
            {t("companies.new")}
          </button>
        ) : null}
      </header>

      <div className="flex flex-col items-stretch justify-between gap-4 rounded-[16px] border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-5 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("companies.search")}
            className="w-full rounded-lg border border-[#E2E8F0] py-2 pr-4 pl-10 text-sm outline-none transition-all focus:border-brand-primary"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={cn("shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-all", statusFilter === "all" ? "bg-slate-900 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
          >
            {t("companies.all", { count: items.length })}
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("pending")}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
              statusFilter === "pending" ? "bg-amber-500 text-white shadow-xs" : "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
            )}
          >
            <Clock size={13} />
            {t("companies.pendingApproval", { count: pendingCount })}
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
              statusFilter === "active" ? "bg-emerald-600 text-white shadow-xs" : "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
            )}
          >
            <CheckCircle2 size={13} />
            {t("companies.activeApproved", { count: activeCount })}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence>
          {filtered.map((company) => (
            <CompanyCard key={company.id} company={company} isAdmin={isAdmin} onEdit={openEdit} onApprove={approve} onReject={reject} onDelete={removeCompany} />
          ))}
        </AnimatePresence>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Building2 size={32} />
          </div>
          <p className="text-slate-500">{t("companies.empty")}</p>
        </div>
      ) : null}

      {createOpen ? (
        <div className="app-modal-overlay fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-3 sm:p-4">
          <button type="button" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setCreateOpen(false)} aria-label={tc("close")} />
          <div className="app-modal-panel relative z-10 my-auto flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-white p-5 sm:p-6">
              <h2 className="text-xl font-bold text-[#0F172A]">{t("companies.modalTitle")}</h2>
              <button type="button" onClick={() => setCreateOpen(false)} className="p-1 font-bold text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <form noValidate className="flex flex-1 flex-col gap-4 overflow-y-auto p-5 sm:p-6" onSubmit={onCreate}>
              <LogoPicker label={t("companies.logo")} value={createForm.logo_url} onChange={(logo_url) => setCreateForm({ ...createForm, logo_url })} />
              <div className="flex flex-col gap-1.5">
                <label className={LABEL}>{t("companies.name")}</label>
                <input className={cn(INPUT, "font-semibold")} value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className={LABEL}>{t("companies.cnpj")}</label>
                  <input className={INPUT} value={createForm.cnpj} onChange={(event) => setCreateForm({ ...createForm, cnpj: formatCNPJ(event.target.value) })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={LABEL}>{t("companies.segment")}</label>
                  <input className={INPUT} value={createForm.segment} onChange={(event) => setCreateForm({ ...createForm, segment: event.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className={LABEL}>{t("companies.email")}</label>
                  <input type="email" className={INPUT} value={createForm.email} onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={LABEL}>{t("companies.whatsapp")}</label>
                  <input className={INPUT} value={createForm.whatsapp} onChange={(event) => setCreateForm({ ...createForm, whatsapp: formatWhatsApp(event.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className={LABEL}>{t("companies.country")}</label>
                  <CountrySelect theme="light" value={createForm.country} onChange={(country) => setCreateForm({ ...createForm, country, currency: defaultCurrencyForCountry(country) })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={LABEL}>{t("companies.currency")}</label>
                  <CurrencySelect theme="light" value={createForm.currency} onChange={(currency) => setCreateForm({ ...createForm, currency })} />
                </div>
              </div>
              <p className="-mt-2 text-[10px] text-[#64748B]">{t("companies.currencyHint")}</p>
              <div className="flex flex-col gap-1.5">
                <label className={LABEL}>{t("companies.city")}</label>
                <input className={INPUT} value={createForm.city} onChange={(event) => setCreateForm({ ...createForm, city: event.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={LABEL}>{t("companies.observations")}</label>
                <textarea rows={3} placeholder={t("companies.observationsPh")} className={cn(INPUT, "resize-none")} value={createForm.observations} onChange={(event) => setCreateForm({ ...createForm, observations: event.target.value })} />
              </div>
              <div className="flex gap-3 border-t border-[#E2E8F0] bg-white pt-4">
                <button type="button" onClick={() => setCreateOpen(false)} className="flex-1 rounded-lg border border-[#E2E8F0] py-2.5 text-sm font-bold text-[#64748B] hover:bg-slate-50">{tc("cancel")}</button>
                <button type="submit" className="flex-1 rounded-lg bg-brand-primary py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-600">{tc("add")}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="app-modal-overlay fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-3 sm:p-4">
          <button type="button" className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setEditing(null)} aria-label={tc("close")} />
          <div className="app-modal-panel relative z-10 my-auto flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-white p-5 sm:p-6">
              <div>
                <h2 className="text-xl font-bold text-[#0F172A]">{t("companies.editModalTitle")}</h2>
                <p className="mt-0.5 text-xs text-[#64748B]">{t("companies.editModalSubtitle")}</p>
              </div>
              <button type="button" onClick={() => setEditing(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-500 hover:bg-slate-200">✕</button>
            </div>
            <form noValidate className="flex flex-1 flex-col gap-4 overflow-y-auto p-5 sm:p-6" onSubmit={onSaveEdit}>
              <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 sm:flex-row sm:items-center">
                <div>
                  <label className="block text-[11px] font-bold tracking-wider text-slate-700 uppercase">{t("companies.statusLabel")}</label>
                  <span className="text-[11px] text-slate-500">{t("companies.statusHint")}</span>
                </div>
                <Select2Field
                  theme="light"
                  searchable={false}
                  value={editStatus}
                  options={statusOptions}
                  onChange={setEditStatus}
                  className="w-full sm:w-64"
                />
              </div>

              <LogoPicker label={t("companies.logoEdit")} value={editForm.logo_url} onChange={(logo_url) => setEditForm({ ...editForm, logo_url })} />

              <div className="flex flex-col gap-1.5">
                <label className={LABEL}>{t("companies.name")}</label>
                <input className={cn(INPUT, "font-semibold")} value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className={LABEL}>{t("companies.cnpj")}</label>
                  <input className={INPUT} value={editForm.cnpj} onChange={(event) => setEditForm({ ...editForm, cnpj: formatCNPJ(event.target.value) })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={LABEL}>{t("companies.segment")}</label>
                  <input className={INPUT} value={editForm.segment} onChange={(event) => setEditForm({ ...editForm, segment: event.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className={LABEL}>{t("companies.emailMain")}</label>
                  <input type="email" className={INPUT} value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={LABEL}>{t("companies.whatsappMain")}</label>
                  <input className={INPUT} value={editForm.whatsapp} onChange={(event) => setEditForm({ ...editForm, whatsapp: formatWhatsApp(event.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className={LABEL}>{t("companies.country")}</label>
                  <CountrySelect theme="light" value={editForm.country} onChange={(country) => setEditForm({ ...editForm, country, currency: defaultCurrencyForCountry(country) })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={LABEL}>{t("companies.currency")}</label>
                  <CurrencySelect theme="light" value={editForm.currency} onChange={(currency) => setEditForm({ ...editForm, currency })} />
                </div>
              </div>
              <p className="-mt-2 text-[10px] text-[#64748B]">{t("companies.currencyHint")}</p>
              <div className="flex flex-col gap-1.5">
                <label className={LABEL}>{t("companies.city")}</label>
                <input className={INPUT} value={editForm.city} onChange={(event) => setEditForm({ ...editForm, city: event.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={LABEL}>{t("companies.observations")}</label>
                <textarea rows={2} placeholder={t("companies.observationsEditPh")} className={cn(INPUT, "resize-none")} value={editForm.observations} onChange={(event) => setEditForm({ ...editForm, observations: event.target.value })} />
              </div>

              <div className="mt-2 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-800 uppercase">
                    <Users size={14} className="text-indigo-600" /> {t("companies.extraContacts")}
                  </h3>
                  <span className="text-[10px] font-bold text-slate-500">{t("companies.registeredCount", { count: tempContacts.length })}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <input className="rounded-md border border-[#E2E8F0] bg-white px-3 py-2 font-medium outline-none" placeholder={t("companies.contactName")} value={newContact.name} onChange={(event) => setNewContact({ ...newContact, name: event.target.value })} />
                  <input className="rounded-md border border-[#E2E8F0] bg-white px-3 py-2 font-medium outline-none" placeholder={t("companies.contactRole")} value={newContact.role} onChange={(event) => setNewContact({ ...newContact, role: event.target.value })} />
                  <input type="email" className="rounded-md border border-[#E2E8F0] bg-white px-3 py-2 outline-none" placeholder={t("companies.contactEmail")} value={newContact.email} onChange={(event) => setNewContact({ ...newContact, email: event.target.value })} />
                  <input className="rounded-md border border-[#E2E8F0] bg-white px-3 py-2 outline-none" placeholder={t("companies.contactWhatsapp")} value={newContact.whatsapp} onChange={(event) => setNewContact({ ...newContact, whatsapp: formatWhatsApp(event.target.value) })} />
                </div>
                <button type="button" onClick={() => void addContact()} className="flex items-center justify-center gap-1.5 self-end rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-100">
                  <Plus size={14} /> {t("companies.addContact")}
                </button>
                <div className="mt-2 flex max-h-[140px] flex-col gap-2 overflow-y-auto">
                  {tempContacts.length === 0 ? (
                    <p className="py-2 text-center text-[11px] text-[#64748B] italic">{t("companies.noContacts")}</p>
                  ) : (
                    tempContacts.map((contact, index) => (
                      <div key={`${contact.id}-${index}`} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2.5 text-xs shadow-sm">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-slate-800">
                            {contact.name}
                            {contact.role ? <span className="ml-1 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-normal text-indigo-600">{contact.role}</span> : null}
                          </span>
                          <span className="flex flex-wrap gap-2 text-[10px] text-[#64748B]">
                            {contact.email ? <span>{contact.email}</span> : null}
                            {contact.whatsapp ? <span>{contact.whatsapp}</span> : null}
                          </span>
                        </div>
                        <button type="button" title={t("companies.removeContact")} onClick={() => setTempContacts((current) => current.filter((_, i) => i !== index))} className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-2 flex flex-col gap-3 rounded-xl border border-slate-200 bg-[#F8FAFC] p-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-800 uppercase">
                    {t("companies.accessUsers")}
                  </h3>
                  <span className="text-[10px] font-bold text-slate-500">{t("companies.registeredCount", { count: editing.users?.length ?? 0 })}</span>
                </div>
                <p className="m-0 text-[11px] leading-snug text-slate-500">{t("companies.accessUsersHint")}</p>
                <p className="m-0 text-[11px] leading-snug text-slate-500">{t("companies.publishWithoutApprovalHint")}</p>
                <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                  <input className="rounded-md border border-[#E2E8F0] bg-white px-3 py-2 font-medium text-slate-800 outline-none" placeholder={t("companies.userName")} value={newUser.name} onChange={(event) => setNewUser({ ...newUser, name: event.target.value })} disabled={creatingUser} />
                  <input type="email" className="rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-slate-800 outline-none" placeholder={t("companies.userEmail")} value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} disabled={creatingUser} />
                  <PasswordField inputClassName="rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-slate-800 outline-none h-auto" placeholder={t("companies.userPasswordOptional")} value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} disabled={creatingUser} />
                </div>
                <label className="flex cursor-pointer items-start gap-2 text-[11px] font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={newUser.can_publish_without_approval}
                    onChange={(event) => setNewUser({ ...newUser, can_publish_without_approval: event.target.checked })}
                    disabled={creatingUser}
                  />
                  <span>{t("companies.publishWithoutApprovalOn")}</span>
                </label>
                <button type="button" disabled={creatingUser} onClick={() => void createAccessUser()} className="flex items-center justify-center gap-1.5 self-end rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-600 hover:bg-emerald-100 disabled:opacity-50">
                  <Plus size={14} /> {creatingUser ? t("companies.creatingUser") : t("companies.addUser")}
                </button>
                <div className="mt-2 flex max-h-[180px] flex-col gap-2 overflow-y-auto">
                  {(editing.users ?? []).length === 0 ? (
                    <p className="py-2 text-center text-[11px] text-[#64748B] italic">{t("companies.noUsers")}</p>
                  ) : (
                    (editing.users ?? []).map((companyUser) => (
                      <div key={companyUser.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs shadow-sm">
                        <div className="min-w-0 flex-1">
                          <span className="block truncate font-bold text-slate-800">{companyUser.name}</span>
                          <span className="block truncate text-[10px] text-[#64748B]">{companyUser.email}</span>
                          <button
                            type="button"
                            onClick={() => void togglePublishWithoutApproval(companyUser)}
                            className={cn(
                              "mt-1 rounded-full border px-2 py-0.5 text-[10px] font-bold",
                              companyUser.can_publish_without_approval
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-amber-200 bg-amber-50 text-amber-800",
                            )}
                          >
                            {companyUser.can_publish_without_approval ? t("companies.publishWithoutApprovalOn") : t("companies.publishWithoutApprovalOff")}
                          </button>
                        </div>
                        <button type="button" title={t("companies.removeAccess")} onClick={() => void removeAccessUser(companyUser.id)} className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-4 flex gap-3 border-t border-[#E2E8F0] bg-white pt-4">
                <button
                  type="button"
                  onClick={() => void removeCompany(editing)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-100"
                >
                  <Trash2 size={14} />
                  {t("companies.delete")}
                </button>
                <button type="button" onClick={() => setEditing(null)} className="flex-1 rounded-lg border border-[#E2E8F0] py-2.5 text-sm font-bold text-[#64748B] hover:bg-slate-50">{tc("cancel")}</button>
                <button type="submit" className="flex-1 rounded-lg bg-brand-primary py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-600">{t("companies.saveChanges")}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CompaniesScreen() {
  return (
    <AuthenticatedShell>
      <CompaniesInner />
    </AuthenticatedShell>
  );
}
