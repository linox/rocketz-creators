import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Check, 
  CheckCircle2, 
  FileText, 
  Scale, 
  ChevronRight, 
  ArrowRight,
  Eye,
  Lock,
  Sparkles,
  Info,
  ExternalLink
} from 'lucide-react';
import { 
  CONTRACT_METADATA, 
  CONTRACT_PREAMBLE, 
  CONTRACT_PARTS, 
  CONTRACT_DECLARATIONS,
  ContractPart,
  CreatorContractAuditRecord 
} from '../data/creatorContractTerms';
import { formatCPF, isValidCPF } from '../lib/cpfValidation';
import { CreatorContractModal } from './CreatorContractModal';

interface CreatorContractStepProps {
  fullName: string;
  email: string;
  document: string;
  onDocumentChange: (val: string) => void;
  declarations: Record<string, boolean>;
  onDeclarationsChange: (updated: Record<string, boolean>) => void;
  termId: string;
}

export function CreatorContractStep({
  fullName,
  email,
  document,
  onDocumentChange,
  declarations,
  onDeclarationsChange,
  termId
}: CreatorContractStepProps) {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [isFullModalOpen, setIsFullModalOpen] = useState(false);

  const allChecked = CONTRACT_DECLARATIONS.every(d => !!declarations[d.id]);
  const checkedCount = CONTRACT_DECLARATIONS.filter(d => !!declarations[d.id]).length;

  const toggleDeclaration = (id: string) => {
    onDeclarationsChange({
      ...declarations,
      [id]: !declarations[id]
    });
  };

  const selectAll = () => {
    const next: Record<string, boolean> = {};
    CONTRACT_DECLARATIONS.forEach(d => {
      next[d.id] = true;
    });
    onDeclarationsChange(next);
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-sm border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500 text-white">
                Contrato de Casting
              </span>
              <span className="text-[11px] font-semibold text-purple-200">
                Versão {CONTRACT_METADATA.version}
              </span>
            </div>
            <h4 className="font-extrabold text-sm sm:text-base text-white mt-1">
              Termo de Adesão, Licença de Conteúdo & Uso de Imagem
            </h4>
            <p className="text-xs text-slate-300 mt-0.5">
              Dividido em 5 partes essenciais para leitura simplificada e transparente.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsFullModalOpen(true)}
            className="self-start sm:self-center px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-purple-200 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-white/10 shrink-0"
          >
            <Eye size={14} />
            <span>Ver Termo Completo / Imprimir</span>
          </button>
        </div>
      </div>

      {/* Part Selection Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-slate-100">
        {CONTRACT_PARTS.map((part, idx) => (
          <button
            key={part.id}
            type="button"
            onClick={() => setActiveTab(idx)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === idx 
                ? 'bg-purple-600 text-white shadow-sm' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>P{part.partNumber}. {part.badge}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setActiveTab(5)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeTab === 5 
              ? 'bg-emerald-600 text-white shadow-sm' 
              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
          }`}
        >
          <CheckCircle2 size={13} />
          <span>Aceite ({checkedCount}/6)</span>
        </button>
      </div>

      {/* PART CONTENT DISPLAY */}
      {activeTab < 5 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-4 text-xs">
          {(() => {
            const part = CONTRACT_PARTS[activeTab];
            return (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200">
                  <div>
                    <span className="text-[10px] font-black text-purple-700 uppercase tracking-wider bg-purple-100 px-2 py-0.5 rounded-md">
                      Parte {part.partNumber} de 5: {part.badge}
                    </span>
                    <h5 className="font-extrabold text-sm text-slate-900 mt-1">
                      {part.partTitle}
                    </h5>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      {part.summary}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveTab(prev => Math.min(5, prev + 1))}
                      className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <span>{activeTab === 4 ? 'Ir para Aceite' : 'Próxima'}</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                {/* Sections of this Part */}
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {part.sections.map(sec => (
                    <div key={sec.number} className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                        <span className="w-5 h-5 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center text-[10px]">
                          {sec.number}
                        </span>
                        <span>{sec.title}</span>
                      </div>
                      <div className="space-y-1.5 text-slate-600 text-[11px]">
                        {sec.items.map((item, i) => (
                          <p key={i} className="whitespace-pre-line leading-relaxed">
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

      {/* TAB 5 / ACEITE FORMAL */}
      {activeTab === 5 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-purple-950 via-slate-900 to-indigo-950 text-white border border-purple-800/40 space-y-4">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white">
                Obrigatório
              </span>
              <h5 className="font-extrabold text-sm sm:text-base text-white mt-1">
                Declarações de Concordância e Aceite
              </h5>
            </div>

            <button
              type="button"
              onClick={selectAll}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-300 hover:text-white border border-emerald-400/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <CheckCircle2 size={14} />
              <span>Marcar Todas</span>
            </button>
          </div>

          {/* 6 Declarations */}
          <div className="space-y-2.5">
            {CONTRACT_DECLARATIONS.map(decl => {
              const isChecked = !!declarations[decl.id];
              return (
                <label
                  key={decl.id}
                  onClick={() => toggleDeclaration(decl.id)}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    isChecked 
                      ? 'bg-emerald-500/15 border-emerald-400/40 text-white' 
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <div className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                    isChecked
                      ? 'bg-emerald-500 border-emerald-400 text-white'
                      : 'border-slate-400 bg-white/10'
                  }`}>
                    {isChecked && <Check size={12} className="stroke-[3]" />}
                  </div>

                  <p className={`text-[11px] leading-snug select-none ${isChecked ? 'text-emerald-100 font-semibold' : 'text-slate-300'}`}>
                    {decl.label}
                  </p>
                </label>
              );
            })}
          </div>

          {/* CPF/CNPJ & Identifier for the audit log */}
          <div className="pt-3 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">
                  Seu CPF (Obrigatório para o Termo) *
                </label>
                {document && (
                  <span className={`text-[9px] font-bold ${isValidCPF(document) ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {isValidCPF(document) ? '✓ CPF Válido' : '000.000.000-00'}
                  </span>
                )}
              </div>
              <input
                type="text"
                required
                maxLength={14}
                placeholder="000.000.000-00"
                value={document}
                onChange={(e) => onDocumentChange(formatCPF(e.target.value))}
                className={`w-full px-3 py-2 rounded-xl bg-white/10 border text-white text-xs outline-none transition-all ${
                  document && !isValidCPF(document) && document.length === 14
                    ? 'border-rose-400/80 bg-rose-950/20 focus:border-rose-400'
                    : 'border-white/20 focus:border-purple-400 focus:bg-white/20'
                }`}
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                Identificador Único do Registro
              </label>
              <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-purple-300 font-mono text-xs flex items-center justify-between">
                <span>{termId}</span>
                <span className="text-[9px] text-slate-400 uppercase">Validade Digital</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className={allChecked ? 'text-emerald-600' : 'text-purple-600'} />
          <span className="font-semibold text-slate-800">
            {allChecked ? 'Todas as 6 declarações foram aceitas com sucesso.' : `Declarações aceitas: ${checkedCount} de 6`}
          </span>
        </div>

        {!allChecked && (
          <button
            type="button"
            onClick={() => setActiveTab(5)}
            className="text-purple-600 font-bold hover:underline cursor-pointer text-xs"
          >
            Completar Aceite →
          </button>
        )}
      </div>

      {/* Full Modal Viewer for Creator Contract */}
      <CreatorContractModal
        isOpen={isFullModalOpen}
        onClose={() => setIsFullModalOpen(false)}
        readOnly={false}
        creatorName={fullName}
        creatorEmail={email}
        creatorDocument={document}
        onAccept={(record) => {
          setIsFullModalOpen(false);
          onDocumentChange(record.document);
          onDeclarationsChange(record.declarations);
          setActiveTab(5);
        }}
      />
    </div>
  );
}
