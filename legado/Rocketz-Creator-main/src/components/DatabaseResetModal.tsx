import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  RefreshCw, 
  Users, 
  Megaphone, 
  Repeat, 
  Layers, 
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db, ADMIN_EMAILS } from '../lib/firebase';
import { 
  clearCreators, 
  clearCampaigns, 
  clearRecurringContracts, 
  clearDatabaseAll,
  ResetProgress,
  ResetResult 
} from '../lib/dbReset';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export type ResetScope = 'creators' | 'campaigns' | 'recurring' | 'all';

interface DatabaseResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialScope?: ResetScope;
  onSuccess?: () => void;
}

export function DatabaseResetModal({
  isOpen,
  onClose,
  initialScope = 'all',
  onSuccess
}: DatabaseResetModalProps) {
  const [scope, setScope] = useState<ResetScope>(initialScope);
  const [keepAdmins, setKeepAdmins] = useState(true);
  const [confirmText, setConfirmText] = useState('');
  const [counts, setCounts] = useState<{
    creators: number;
    admins: number;
    campaigns: number;
    recurring: number;
  }>({ creators: 0, admins: 0, campaigns: 0, recurring: 0 });
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState<ResetProgress | null>(null);
  const [result, setResult] = useState<ResetResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setScope(initialScope);
      setConfirmText('');
      setProgress(null);
      setResult(null);
      setError(null);
      fetchLiveCounts();
    }
  }, [isOpen, initialScope]);

  const fetchLiveCounts = async () => {
    setLoadingCounts(true);
    try {
      const creatorsSnap = await getDocs(collection(db, 'creators'));
      const adminEmailsLower = ADMIN_EMAILS.map(e => e.toLowerCase());
      let cCount = 0;
      let aCount = 0;

      creatorsSnap.docs.forEach(d => {
        const data = d.data();
        const isAdmin = data.role === 'admin' || (data.email && adminEmailsLower.includes(data.email.toLowerCase()));
        if (isAdmin) {
          aCount++;
        } else {
          cCount++;
        }
      });

      const campSnap = await getDocs(collection(db, 'campaigns'));
      const recSnap = await getDocs(collection(db, 'recurringContracts'));

      setCounts({
        creators: cCount,
        admins: aCount,
        campaigns: campSnap.docs.length,
        recurring: recSnap.docs.length
      });
    } catch (e) {
      console.warn("Error fetching counts:", e);
    } finally {
      setLoadingCounts(false);
    }
  };

  const requiredConfirmWord = "ZERAR";
  const isConfirmed = confirmText.trim().toUpperCase() === requiredConfirmWord;

  const handleExecuteReset = async () => {
    if (!isConfirmed || isDeleting) return;

    setIsDeleting(true);
    setError(null);
    setProgress({ step: 'Iniciando limpeza...', count: 0, total: 100 });

    try {
      if (scope === 'creators') {
        const deleted = await clearCreators(keepAdmins, setProgress);
        setResult({
          creatorsDeleted: deleted,
          campaignsDeleted: 0,
          campaignCreatorsDeleted: 0,
          recurringContractsDeleted: 0,
          contentPlanningDeleted: 0
        });
      } else if (scope === 'campaigns') {
        const { campaignsCount, campaignCreatorsCount } = await clearCampaigns(setProgress);
        setResult({
          creatorsDeleted: 0,
          campaignsDeleted: campaignsCount,
          campaignCreatorsDeleted: campaignCreatorsCount,
          recurringContractsDeleted: 0,
          contentPlanningDeleted: 0
        });
      } else if (scope === 'recurring') {
        const { recurringCount, planningCount } = await clearRecurringContracts(setProgress);
        setResult({
          creatorsDeleted: 0,
          campaignsDeleted: 0,
          campaignCreatorsDeleted: 0,
          recurringContractsDeleted: recurringCount,
          contentPlanningDeleted: planningCount
        });
      } else {
        const res = await clearDatabaseAll(keepAdmins, setProgress);
        setResult(res);
      }

      await fetchLiveCounts();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Error executing reset:", err);
      setError(`Erro ao zerar dados: ${err.message || 'Falha nas permissões do Firestore.'}`);
    } finally {
      setIsDeleting(false);
      setProgress(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="bg-rose-50 border-b border-rose-100 p-6 flex items-start justify-between relative">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 shrink-0">
              <Trash2 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 bg-rose-200/80 text-rose-800 rounded-md">
                  Zona de Perigo • Admin
                </span>
              </div>
              <h2 className="text-xl font-black text-slate-900 mt-0.5 tracking-tight">
                Zerar Banco de Dados
              </h2>
            </div>
          </div>

          <button 
            onClick={onClose}
            disabled={isDeleting}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-white/80 transition-all cursor-pointer disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Result Success State */}
          {result ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl mx-auto flex items-center justify-center">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Banco de Dados Zerado com Sucesso!</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Os registros selecionados foram permanentemente removidos do Firestore.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-700 space-y-2 text-left max-w-md mx-auto">
                <div className="font-bold text-slate-900 border-b border-slate-200 pb-2">Resumo da Limpeza:</div>
                {result.creatorsDeleted > 0 && (
                  <div className="flex justify-between">
                    <span>Criadores de Conteúdo:</span>
                    <span className="font-bold text-rose-600">-{result.creatorsDeleted}</span>
                  </div>
                )}
                {result.campaignsDeleted > 0 && (
                  <div className="flex justify-between">
                    <span>Projetos de Campanhas:</span>
                    <span className="font-bold text-rose-600">-{result.campaignsDeleted}</span>
                  </div>
                )}
                {result.campaignCreatorsDeleted > 0 && (
                  <div className="flex justify-between">
                    <span>Entregas de Criadores (Campanhas):</span>
                    <span className="font-bold text-rose-600">-{result.campaignCreatorsDeleted}</span>
                  </div>
                )}
                {result.recurringContractsDeleted > 0 && (
                  <div className="flex justify-between">
                    <span>Trabalhos Recorrentes:</span>
                    <span className="font-bold text-rose-600">-{result.recurringContractsDeleted}</span>
                  </div>
                )}
                {result.contentPlanningDeleted > 0 && (
                  <div className="flex justify-between">
                    <span>Itens de Planejamento Mensal:</span>
                    <span className="font-bold text-rose-600">-{result.contentPlanningDeleted}</span>
                  </div>
                )}
              </div>

              <button
                onClick={onClose}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-all cursor-pointer shadow-sm"
              >
                Concluir e Fechar
              </button>
            </div>
          ) : (
            <>
              {/* Error Message */}
              {error && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800 text-xs font-semibold">
                  <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                  <div>{error}</div>
                </div>
              )}

              {/* Scope Selection Tabs */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  1. Selecione o que deseja zerar:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setScope('all')}
                    disabled={isDeleting}
                    className={cn(
                      "p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer",
                      scope === 'all'
                        ? "bg-rose-50/80 border-rose-500 text-rose-950 ring-2 ring-rose-500/20 shadow-xs"
                        : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-sm flex items-center gap-1.5">
                        <Trash2 size={16} className="text-rose-600" />
                        Tudo Completo
                      </span>
                      <span className="text-[10px] font-black bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded">
                        Tudo
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Criadores + Campanhas + Contratos Recorrentes
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScope('creators')}
                    disabled={isDeleting}
                    className={cn(
                      "p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer",
                      scope === 'creators'
                        ? "bg-rose-50/80 border-rose-500 text-rose-950 ring-2 ring-rose-500/20 shadow-xs"
                        : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-sm flex items-center gap-1.5">
                        <Users size={16} className="text-indigo-600" />
                        Só Criadores
                      </span>
                      <span className="text-[10px] font-black bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                        {loadingCounts ? '...' : counts.creators}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Limpar todo o casting de influenciadores
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScope('campaigns')}
                    disabled={isDeleting}
                    className={cn(
                      "p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer",
                      scope === 'campaigns'
                        ? "bg-rose-50/80 border-rose-500 text-rose-950 ring-2 ring-rose-500/20 shadow-xs"
                        : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-sm flex items-center gap-1.5">
                        <Megaphone size={16} className="text-amber-600" />
                        Só Campanhas
                      </span>
                      <span className="text-[10px] font-black bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                        {loadingCounts ? '...' : counts.campaigns}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Projetos de marketing e entregas de vídeo
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScope('recurring')}
                    disabled={isDeleting}
                    className={cn(
                      "p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer",
                      scope === 'recurring'
                        ? "bg-rose-50/80 border-rose-500 text-rose-950 ring-2 ring-rose-500/20 shadow-xs"
                        : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-sm flex items-center gap-1.5">
                        <Repeat size={16} className="text-purple-600" />
                        Só Recorrência
                      </span>
                      <span className="text-[10px] font-black bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                        {loadingCounts ? '...' : counts.recurring}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Contratos mensais e cronogramas de conteúdo
                    </p>
                  </button>
                </div>
              </div>

              {/* Safety Option: Keep Admins */}
              {(scope === 'all' || scope === 'creators') && (
                <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-2xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <ShieldAlert size={18} className="text-indigo-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-indigo-950">Preservar Contas de Administrador</div>
                      <div className="text-[11px] text-indigo-700">Mantém seu login e equipe de gestão funcionando</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={keepAdmins}
                    onChange={(e) => setKeepAdmins(e.target.checked)}
                    disabled={isDeleting}
                    className="w-4 h-4 text-indigo-600 rounded border-indigo-300 focus:ring-indigo-500"
                  />
                </div>
              )}

              {/* Live Progress Bar */}
              {isDeleting && progress && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <RefreshCw size={13} className="animate-spin text-rose-600" />
                      {progress.step}
                    </span>
                    <span>{progress.count} / {progress.total}</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-rose-600 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${progress.total > 0 ? (progress.count / progress.total) * 100 : 10}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Type Confirmation Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  2. Para confirmar esta ação irreversível, digite <span className="text-rose-600 font-black">ZERAR</span> abaixo:
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Digite ZERAR"
                  disabled={isDeleting}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-black tracking-wider focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all uppercase placeholder:normal-case placeholder:font-normal"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isDeleting}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleExecuteReset}
                  disabled={!isConfirmed || isDeleting}
                  className={cn(
                    "px-6 py-2.5 text-xs font-black text-white rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer",
                    isConfirmed && !isDeleting
                      ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/30 hover:scale-[1.02]"
                      : "bg-slate-300 text-slate-500 shadow-none cursor-not-allowed"
                  )}
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Limpando Banco...
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      Confirmar e Zerar Agora
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
