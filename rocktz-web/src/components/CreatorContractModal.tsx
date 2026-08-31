"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  Check,
  CheckCircle2,
  X,
  Printer,
  Search,
  AlertCircle,
  Scale,
  ArrowRight,
} from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getCreatorContract, type CreatorContractAuditRecord } from "@/data/creatorContractTerms";
import { intlLocale, normalizeLocale } from "@/i18n/locales";
import { DEFAULT_COUNTRY } from "@/lib/geo";
import {
  formatTaxDocument,
  isValidTaxDocument,
  taxDocumentKindLabel,
  taxDocumentMaxLength,
  taxDocumentPlaceholder,
  taxDocumentsLabel,
} from "@/lib/taxDocuments";

interface CreatorContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: (auditRecord: CreatorContractAuditRecord) => void;
  readOnly?: boolean;
  existingAuditRecord?: CreatorContractAuditRecord | null;
  existingAudit?: CreatorContractAuditRecord | null;
  creatorName?: string;
  prefilledName?: string;
  creatorEmail?: string;
  prefilledEmail?: string;
  creatorDocument?: string;
  prefilledDocument?: string;
  creatorCountry?: string | null;
}

export function CreatorContractModal({
  isOpen,
  onClose,
  onAccept,
  readOnly = false,
  existingAuditRecord = null,
  existingAudit = null,
  creatorName = '',
  prefilledName = '',
  creatorEmail = '',
  prefilledEmail = '',
  creatorDocument = '',
  prefilledDocument = '',
  creatorCountry = null,
}: CreatorContractModalProps) {
  const { t, i18n } = useTranslation("profile");
  const { t: tc } = useTranslation("common");
  const locale = normalizeLocale(i18n.language);
  const dateLocale = intlLocale(locale);
  const country = creatorCountry || DEFAULT_COUNTRY;
  const documentsLabel = taxDocumentsLabel(country, tc("orConjunction"), tc("taxIdFallback"));
  const contract = React.useMemo(
    () => getCreatorContract(locale, documentsLabel),
    [locale, documentsLabel],
  );
  const { metadata, preamble, parts, declarations } = contract;

  const finalExistingAudit = existingAuditRecord || existingAudit || null;
  const initialName = creatorName || prefilledName || finalExistingAudit?.fullName || '';
  const initialEmail = creatorEmail || prefilledEmail || finalExistingAudit?.email || '';
  const initialDoc = creatorDocument || prefilledDocument || finalExistingAudit?.document || '';

  const [activePartIndex, setActivePartIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'parts' | 'full'>('parts');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Declarations State
  const [checkedDeclarations, setCheckedDeclarations] = useState<Record<string, boolean>>(() => {
    if (finalExistingAudit?.declarations) {
      return finalExistingAudit.declarations;
    }
    const initial: Record<string, boolean> = {};
    declarations.forEach((d) => {
      initial[d.id] = false;
    });
    return initial;
  });

  const [documentInput, setDocumentInput] = useState(initialDoc);
  const [nameInput, setNameInput] = useState(initialName);
  const [emailInput, setEmailInput] = useState(initialEmail);
  const [errorValidation, setErrorValidation] = useState<string | null>(null);

  // Sync when props change or modal opens
  React.useEffect(() => {
    if (isOpen) {
      if (initialDoc && !documentInput) setDocumentInput(initialDoc);
      if (initialName && !nameInput) setNameInput(initialName);
      if (initialEmail && !emailInput) setEmailInput(initialEmail);
      if (finalExistingAudit?.declarations) {
        setCheckedDeclarations(finalExistingAudit.declarations);
      }
    }
  }, [isOpen, initialDoc, initialName, initialEmail, finalExistingAudit]);

  // Computed Acceptance Status
  const allDeclarationsChecked = declarations.every((d) => !!checkedDeclarations[d.id]);

  // Generated Acceptance Term ID
  const generatedTermId = React.useMemo(() => {
    if (finalExistingAudit?.termId) return finalExistingAudit.termId;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `RC-TERMO-${dateStr}-${rand}`;
  }, [finalExistingAudit]);

  const toggleDeclaration = (id: string) => {
    if (readOnly) return;
    setCheckedDeclarations((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
    setErrorValidation(null);
  };

  const handleSelectAllDeclarations = () => {
    if (readOnly) return;
    const updated: Record<string, boolean> = {};
    declarations.forEach((d) => {
      updated[d.id] = true;
    });
    setCheckedDeclarations(updated);
    setErrorValidation(null);
  };

  const handleConfirmAcceptance = () => {
    if (readOnly) {
      onClose();
      return;
    }

    if (!allDeclarationsChecked) {
      setErrorValidation(t("termModal.needAllDeclarations"));
      return;
    }

    if (!documentInput.trim()) {
      setErrorValidation(t("termModal.needCpf", { documents: documentsLabel }));
      return;
    }

    const formattedDocument = formatTaxDocument(country, documentInput);
    if (!isValidTaxDocument(country, documentInput)) {
      setErrorValidation(t("termModal.invalidCpf", { documents: documentsLabel }));
      return;
    }

    const now = new Date();
    const auditRecord: CreatorContractAuditRecord = {
      termId: generatedTermId,
      version: metadata.version,
      fullName: nameInput.trim() || t("termModal.creatorFallback"),
      document: formattedDocument,
      email: emailInput.trim(),
      acceptedAt: now.toISOString(),
      formattedDate: now.toLocaleDateString(dateLocale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      ipUserAgent: typeof navigator !== "undefined" ? navigator.userAgent : "Web Browser",
      declarations: checkedDeclarations,
      allAccepted: true,
      status: "valid",
    };

    if (onAccept) {
      onAccept(auditRecord);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="app-modal-overlay fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-900/60 p-3 backdrop-blur-sm sm:p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="app-modal-panel relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
        {/* MODAL HEADER */}
        <div className="px-5 sm:px-8 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white relative shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-400/30">
                  <ShieldCheck size={12} />
                  {t("termModal.officialBadge")}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-slate-300">
                  {t("termModal.version", { version: metadata.version })}
                </span>
                {existingAuditRecord && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <Check size={11} />
                    {t("termModal.acceptedOn", {
                      date: existingAuditRecord.formattedDate || new Date(existingAuditRecord.acceptedAt).toLocaleDateString(dateLocale),
                    })}
                  </span>
                )}
              </div>
              
              <h2 className="text-base sm:text-lg md:text-xl font-extrabold tracking-tight text-white line-clamp-1">
                {metadata.title}
              </h2>
              <p className="text-xs text-slate-400">
                {t("termModal.operatedBy", { company: metadata.companyName, cnpj: metadata.cnpj })}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <LanguageSwitcher theme="dark" layout="menu" />
              <button
                onClick={handlePrint}
                title={t("termModal.printTitle")}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={15} />
                <span className="hidden sm:inline">{t("termModal.print")}</span>
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* CONTROLS BAR: Parts Navigation Pills & Search */}
          <div className="mt-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* View Mode & Parts Nav */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {parts.map((part, index) => (
                <button
                  key={part.id}
                  type="button"
                  onClick={() => { setViewMode("parts"); setActivePartIndex(index); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    viewMode === "parts" && activePartIndex === index
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {part.partNumber}. {part.badge}
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setViewMode("parts"); setActivePartIndex(5); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                  viewMode === "parts" && activePartIndex === 5
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30"
                }`}
              >
                <CheckCircle2 size={13} />
                <span>6. {t("termModal.formalAccept")}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode(viewMode === "full" ? "parts" : "full")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ml-1 ${
                  viewMode === "full"
                    ? "bg-indigo-600 text-white"
                    : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                }`}
              >
                {viewMode === "full" ? t("termModal.splitParts") : t("termModal.fullText")}
              </button>
            </div>

            {/* Quick search */}
            <div className="relative shrink-0">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={t("termModal.searchClause")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-44 pl-7 pr-2.5 py-1 rounded-lg bg-white/10 border border-white/10 text-white text-xs outline-none placeholder:text-slate-400 focus:bg-white/15 focus:border-purple-400 transition-all"
              />
            </div>
          </div>
        </div>

        {/* MODAL BODY (Scrollable Contract Content) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 text-slate-700 text-sm leading-relaxed">
          {/* PREAMBLE */}
          <div className="p-4 sm:p-5 rounded-2xl bg-purple-50/70 border border-purple-100/80 space-y-2.5 text-xs text-slate-700">
            <div className="flex items-center gap-2 text-purple-900 font-extrabold text-sm">
              <Scale size={16} className="text-purple-600 shrink-0" />
              <span>{t("termModal.preambleTitle")}</span>
            </div>
            <p className="whitespace-pre-line text-slate-600 leading-relaxed font-normal">
              {preamble}
            </p>
          </div>

          {/* CONTRACT PARTS RENDERING */}
          {viewMode === 'parts' && activePartIndex < 5 && (
            <div className="space-y-6">
              {(() => {
                const part = parts[activePartIndex];
                if (!part) return null;

                return (
                  <div key={part.id} className="space-y-6">
                    {/* Part Header Card */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500 text-white">
                            {t("termModal.partOf", { n: part.partNumber })}
                          </span>
                          <span className="text-xs font-semibold text-purple-200">
                            {part.badge}
                          </span>
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-white mt-1">
                          {part.partTitle}
                        </h3>
                        <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-normal">
                          {part.summary}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {activePartIndex > 0 && (
                          <button
                            onClick={() => setActivePartIndex(prev => prev - 1)}
                            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all cursor-pointer"
                          >
                            {t("termModal.previous")}
                          </button>
                        )}
                        <button
                          onClick={() => setActivePartIndex(prev => prev + 1)}
                          className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>{activePartIndex === 4 ? t("termModal.goToAcceptance") : t("termModal.nextPart")}</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Part Sections */}
                    <div className="space-y-4">
                      {part.sections
                        .filter(s => {
                          if (!searchTerm) return true;
                          const term = searchTerm.toLowerCase();
                          return s.title.toLowerCase().includes(term) || s.items.some(i => i.toLowerCase().includes(term));
                        })
                        .map(section => (
                          <div 
                            key={section.number}
                            className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-3"
                          >
                            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                              <span className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center shrink-0">
                                {section.number}
                              </span>
                              <h4 className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
                                {section.title}
                              </h4>
                            </div>

                            <div className="space-y-2.5 text-xs text-slate-700">
                              {section.items.map((item, idx) => (
                                <p key={idx} className="whitespace-pre-line leading-relaxed pl-1">
                                  {item}
                                </p>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* FULL VIEW MODE */}
          {(viewMode === 'full' || searchTerm.length > 0) && (
            <div className="space-y-8">
              {parts.map((part) => (
                <div key={part.id} className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b-2 border-purple-200">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-600 text-white">
                      {t("termModal.partShort", { n: part.partNumber })}
                    </span>
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                      {part.partTitle}
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {part.sections
                      .filter(s => {
                        if (!searchTerm) return true;
                        const term = searchTerm.toLowerCase();
                        return s.title.toLowerCase().includes(term) || s.items.some(i => i.toLowerCase().includes(term));
                      })
                      .map(section => (
                        <div 
                          key={section.number}
                          className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-3"
                        >
                          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                            <span className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center shrink-0">
                              {section.number}
                            </span>
                            <h4 className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
                              {section.title}
                            </h4>
                          </div>

                          <div className="space-y-2.5 text-xs text-slate-700">
                            {section.items.map((item, idx) => (
                              <p key={idx} className="whitespace-pre-line leading-relaxed pl-1">
                                {item}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* PART 6: FORMAL DECLARATIONS & ACCEPTANCE */}
          {(viewMode === 'full' || activePartIndex === 5) && (
            <div className="space-y-6 pt-4 border-t-2 border-slate-100">
              <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-purple-900 via-indigo-950 to-slate-950 text-white shadow-lg space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white">
                      {t("termModal.formalStep")}
                    </span>
                    <h3 className="text-lg sm:text-xl font-black text-white mt-1">
                      {t("termModal.declarationsTitle")}
                    </h3>
                    <p className="text-xs text-slate-300 mt-1">
                      {t("termModal.declarationsHint")}
                    </p>
                  </div>

                  {!readOnly && !existingAuditRecord && (
                    <button
                      type="button"
                      onClick={handleSelectAllDeclarations}
                      className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-emerald-300 hover:text-white border border-emerald-400/30 text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle2 size={15} />
                      <span>{t("termModal.markAll")}</span>
                    </button>
                  )}
                </div>

                {/* Checklist of Declarations */}
                <div className="space-y-3 pt-2">
                  {declarations.map((decl) => {
                    const isChecked = !!checkedDeclarations[decl.id];

                    return (
                      <label
                        key={decl.id}
                        onClick={() => toggleDeclaration(decl.id)}
                        className={`flex items-start gap-3.5 p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer ${
                          isChecked 
                            ? 'bg-emerald-500/15 border-emerald-400/40 text-white' 
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <div className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                          isChecked
                            ? 'bg-emerald-500 border-emerald-400 text-white shadow-sm'
                            : 'border-slate-400 bg-white/10'
                        }`}>
                          {isChecked && <Check size={14} className="stroke-[3]" />}
                        </div>

                        <div className="space-y-0.5 text-xs leading-relaxed select-none">
                          <p className={`font-medium ${isChecked ? 'text-emerald-100 font-semibold' : 'text-slate-200'}`}>
                            {decl.label}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {/* Audit & Legal Identifiers Form */}
                <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      {t("termModal.fullNameLabel")}
                    </label>
                    <input
                      type="text"
                      disabled={readOnly || !!existingAuditRecord}
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder={t("termModal.namePh")}
                      className="w-full px-3.5 py-2 rounded-xl bg-white/10 border border-white/15 text-white text-xs outline-none focus:border-purple-400 focus:bg-white/20 transition-all disabled:opacity-70"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-300 block">
                        {t("termModal.cpfLabel", { documents: documentsLabel })}
                      </label>
                      {documentInput && (
                        <span className={`text-[10px] font-bold ${isValidTaxDocument(country, documentInput) ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {isValidTaxDocument(country, documentInput)
                            ? t("termModal.cpfValid", { kind: taxDocumentKindLabel(country, documentInput, documentsLabel) })
                            : taxDocumentPlaceholder(country, documentsLabel)}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      maxLength={taxDocumentMaxLength(country)}
                      disabled={readOnly || !!existingAuditRecord}
                      value={documentInput}
                      onChange={(e) => {
                        setDocumentInput(formatTaxDocument(country, e.target.value));
                        if (errorValidation) setErrorValidation(null);
                      }}
                      placeholder={taxDocumentPlaceholder(country, documentsLabel)}
                      className={`w-full px-3.5 py-2 rounded-xl bg-white/10 border text-white text-xs outline-none transition-all disabled:opacity-70 ${
                        documentInput && !isValidTaxDocument(country, documentInput) && documentInput.length >= taxDocumentMaxLength(country)
                          ? 'border-rose-400/80 bg-rose-950/20 focus:border-rose-400'
                          : 'border-white/15 focus:border-purple-400 focus:bg-white/20'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      {t("termModal.emailLabel")}
                    </label>
                    <input
                      type="email"
                      disabled={readOnly || !!existingAuditRecord}
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder={t("termModal.emailPh")}
                      className="w-full px-3.5 py-2 rounded-xl bg-white/10 border border-white/15 text-white text-xs outline-none focus:border-purple-400 focus:bg-white/20 transition-all disabled:opacity-70"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      {t("termModal.acceptIdLabel")}
                    </label>
                    <div className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-purple-300 font-mono text-xs flex items-center justify-between">
                      <span>{existingAuditRecord?.termId || generatedTermId}</span>
                      <span className="text-[10px] text-slate-400">{t("termModal.auditHash")}</span>
                    </div>
                  </div>
                </div>

                {errorValidation && (
                  <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-200 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0 text-rose-300" />
                    <span>{errorValidation}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-5 sm:px-8 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck size={16} className="text-purple-600 shrink-0" />
            <span>
              {t("termModal.legalFooter")}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer"
            >
              {readOnly ? tc("close") : tc("cancel")}
            </button>

            {!readOnly && (
              <button
                type="button"
                onClick={handleConfirmAcceptance}
                disabled={!allDeclarationsChecked}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-extrabold tracking-wide shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <CheckCircle2 size={16} />
                <span>{t("termModal.acceptAndContinue")}</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
