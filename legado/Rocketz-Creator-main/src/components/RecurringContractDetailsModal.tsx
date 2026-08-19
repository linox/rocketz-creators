import React from 'react';
import { 
  X, 
  Repeat, 
  Building2, 
  Calendar, 
  Users, 
  DollarSign, 
  FileText, 
  Film, 
  Instagram, 
  Layers, 
  Clapperboard, 
  Video, 
  Radio, 
  Pin, 
  Newspaper, 
  Mic, 
  Package, 
  Camera, 
  UploadCloud, 
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';
import { RecurringContract, Company, Creator, ContentPlanningItem } from '../types';
import { cn } from '../lib/utils';
import { usePrivacy } from '../context/PrivacyContext';
import { UserAvatar } from './UserAvatar';

interface RecurringContractDetailsModalProps {
  contract: RecurringContract | null;
  isOpen: boolean;
  onClose: () => void;
  companies?: Company[];
  creators?: Creator[];
  planningItems?: ContentPlanningItem[];
  onOpenSubmitModal?: (item: ContentPlanningItem) => void;
  userRole?: 'admin' | 'agency' | 'creator' | 'company' | null;
  creatorId?: string | null;
}

export const RecurringContractDetailsModal: React.FC<RecurringContractDetailsModalProps> = ({
  contract,
  isOpen,
  onClose,
  companies = [],
  creators = [],
  planningItems = [],
  onOpenSubmitModal,
  userRole,
  creatorId
}) => {
  const { formatCurrency } = usePrivacy();
  if (!isOpen || !contract) return null;

  const isCreatorView = userRole === 'creator' || (!!creatorId && userRole !== 'admin' && userRole !== 'agency');

  const company = companies.find(c => c.id === contract.companyId);

  // If creator view, find this creator's specific config
  const currentCreatorConfig = creatorId 
    ? contract.creators?.find(c => c.creatorId === creatorId)
    : null;

  // Filter creators list if creator view (only show logged creator)
  const visibleCreators = isCreatorView && creatorId
    ? (contract.creators || []).filter(c => c.creatorId === creatorId)
    : (contract.creators || []);

  // Filter planning items if creator view (only show logged creator's pautas)
  const contractPlanningItems = planningItems.filter(
    item => item.recurringContractId === contract.id && (!isCreatorView || !creatorId || item.creatorId === creatorId)
  );

  const totalMonthlyFee = Number(contract.monthlyFee || 0);
  const totalCreatorsCost = (contract.creators || []).reduce((sum, c) => sum + Number(c.monthlyCache || c.monthlyFee || 0), 0);
  const remainingBudget = totalMonthlyFee - totalCreatorsCost;
  const marginPercent = totalMonthlyFee > 0 ? Math.round((remainingBudget / totalMonthlyFee) * 100) : 0;

  const calculateContractMonths = (startDate?: string, endDate?: string): number => {
    if (!startDate || !endDate) return 1;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;
    const yearDiff = end.getFullYear() - start.getFullYear();
    const monthDiff = end.getMonth() - start.getMonth();
    const totalMonths = yearDiff * 12 + monthDiff + 1;
    return Math.max(1, totalMonths);
  };

  const durationMonths = calculateContractMonths(contract.startDate, contract.endDate);
  const totalPeriodValue = totalMonthlyFee * durationMonths;
  const totalCreatorsPeriodCost = totalCreatorsCost * durationMonths;
  const totalPeriodRemainingBudget = remainingBudget * durationMonths;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div 
        className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-auto max-h-[90vh] flex flex-col animate-scaleUp relative z-10"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4">
            <UserAvatar
              src={company?.logo}
              name={company?.name || contract.companyName || 'Empresa Cliente'}
              size="custom"
              shape="rounded-2xl"
              className="w-14 h-14 border border-white/20 shadow-inner"
              textClassName="text-xl font-bold"
            />
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
                  {company?.name || contract.companyName || 'Empresa Cliente'}
                </span>
                <span className={cn(
                  "text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border",
                  contract.status === 'active' 
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
                    : contract.status === 'paused'
                    ? "bg-amber-500/20 text-amber-300 border-amber-400/30"
                    : "bg-slate-500/20 text-slate-300 border-slate-400/30"
                )}>
                  {contract.status === 'active' ? '● Contrato Ativo' : contract.status === 'paused' ? 'Pausado' : 'Finalizado'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mt-1.5 leading-tight">{contract.title}</h2>
              <p className="text-xs text-slate-300 mt-1 flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar size={13} className="text-indigo-300" />
                  <span>Início: {new Date(contract.startDate).toLocaleDateString('pt-BR')}</span>
                </span>
                {!isCreatorView && contract.monthlyFee ? (
                  <>
                    <span>•</span>
                    <span className="font-bold text-emerald-400">Orçamento Mensal: {formatCurrency(contract.monthlyFee)}</span>
                    {contract.endDate && durationMonths > 1 && (
                      <>
                        <span>•</span>
                        <span className="font-bold text-indigo-300">Total do Período ({durationMonths}m): {formatCurrency(totalPeriodValue)}</span>
                      </>
                    )}
                  </>
                ) : isCreatorView && currentCreatorConfig && (currentCreatorConfig.monthlyCache || currentCreatorConfig.monthlyFee) ? (
                  <>
                    <span>•</span>
                    <span className="font-bold text-emerald-400">Meu Cachê: {formatCurrency(currentCreatorConfig.monthlyCache || currentCreatorConfig.monthlyFee)}/mês</span>
                    {contract.endDate && durationMonths > 1 && (
                      <>
                        <span>•</span>
                        <span className="font-bold text-indigo-300">Total Período ({durationMonths}m): {formatCurrency(Number(currentCreatorConfig.monthlyCache || currentCreatorConfig.monthlyFee || 0) * durationMonths)}</span>
                      </>
                    )}
                  </>
                ) : null}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors shrink-0"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700">
          
          {/* Section 0: Financial Breakdown (Hidden in Creator View) */}
          {!isCreatorView && totalMonthlyFee > 0 && (
            <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <DollarSign size={15} className="text-brand-primary" />
                  Balanço Financeiro (Mensal & Período Total: {durationMonths} {durationMonths === 1 ? 'mês' : 'meses'})
                </span>
                <span className={cn(
                  "text-[10px] font-black px-2 py-0.5 rounded-md",
                  remainingBudget >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                )}>
                  {remainingBudget >= 0 ? `+${marginPercent}% de Margem` : 'Déficit no Orçamento'}
                </span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Orçamento Mensal</span>
                    <span className="text-base font-black text-slate-900 mt-0.5 block">{formatCurrency(totalMonthlyFee)}/mês</span>
                  </div>
                  {contract.endDate && durationMonths > 1 && (
                    <div className="pt-1.5 mt-1.5 border-t border-slate-100">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Total do Período ({durationMonths}m)</span>
                      <span className="text-xs font-extrabold text-indigo-700 block">{formatCurrency(totalPeriodValue)}</span>
                    </div>
                  )}
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Custo Criadores ({contract.creators?.length || 0})
                    </span>
                    <span className="text-base font-black text-slate-700 mt-0.5 block">{formatCurrency(totalCreatorsCost)}/mês</span>
                  </div>
                  {contract.endDate && durationMonths > 1 && (
                    <div className="pt-1.5 mt-1.5 border-t border-slate-100">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Total do Período ({durationMonths}m)</span>
                      <span className="text-xs font-bold text-slate-700 block">{formatCurrency(totalCreatorsPeriodCost)}</span>
                    </div>
                  )}
                </div>

                <div className={cn(
                  "p-3 rounded-xl border shadow-sm flex flex-col justify-between",
                  remainingBudget >= 0 ? "bg-emerald-50/70 border-emerald-200" : "bg-rose-50/70 border-rose-200"
                )}>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Saldo Restante</span>
                    <span className={cn("text-base font-black mt-0.5 block", remainingBudget >= 0 ? "text-emerald-700" : "text-rose-700")}>
                      {formatCurrency(remainingBudget)}/mês
                    </span>
                  </div>
                  {contract.endDate && durationMonths > 1 && (
                    <div className="pt-1.5 mt-1.5 border-t border-emerald-200/50">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Saldo Total ({durationMonths}m)</span>
                      <span className={cn("text-xs font-bold block", remainingBudget >= 0 ? "text-emerald-700" : "text-rose-700")}>
                        {formatCurrency(totalPeriodRemainingBudget)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Section 1: Objective & Description */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <FileText size={15} className="text-brand-primary" />
              Objetivos & Diretrizes do Projeto Recorrente
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium whitespace-pre-line m-0">
              {contract.objective || 'Nenhum objetivo especificado para este projeto recorrente.'}
            </p>
            {contract.notes && (
              <div className="pt-2 border-t border-slate-200/60 mt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Observações Gerais:</span>
                <p className="text-xs text-slate-600 m-0 mt-0.5">{contract.notes}</p>
              </div>
            )}
          </div>

          {/* Section 2: Creators & Deliverables Quotas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Users size={15} className="text-brand-primary" />
                {isCreatorView ? 'Minha Cota & Cachê Contratado' : `Criadores Vinculados ao Projeto (${visibleCreators.length})`}
              </h3>
            </div>

            {visibleCreators.length === 0 ? (
              <p className="text-xs italic text-slate-400 p-4 bg-slate-50 rounded-xl border border-slate-200/80">
                {isCreatorView ? 'Nenhuma configuração de entregas encontrada para seu perfil neste contrato.' : 'Nenhum criador associado a este contrato ainda.'}
              </p>
            ) : (
              <div className={cn("grid gap-4", isCreatorView ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2")}>
                {visibleCreators.map(cConfig => {
                  const cr = creators.find(c => c.id === cConfig.creatorId);
                  const deliv = cConfig.monthlyDeliverables || {};
                  const creatorName = cConfig.creatorName || cConfig.artisticName || cr?.artisticName || cr?.fullName || (isCreatorView ? 'Meu Perfil' : 'Criador');

                  return (
                    <div key={cConfig.creatorId} className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between gap-3">
                      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            src={cr?.photoUrl}
                            name={creatorName}
                            size="custom"
                            shape="circle"
                            className="w-10 h-10 border border-indigo-200"
                            textClassName="text-sm font-bold"
                          />
                          <div>
                            <span className="font-bold text-slate-900 text-sm block">{creatorName}</span>
                            <span className="text-[10px] text-slate-400 block">{cr?.city ? `${cr.city}, ${cr.state}` : 'Criador de Conteúdo'}</span>
                          </div>
                        </div>

                        {cConfig.monthlyCache || cConfig.monthlyFee ? (
                          <div className="bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-xl text-right">
                            <span className="text-[9px] font-extrabold uppercase text-emerald-700 block">Cachê Mensal</span>
                            <span className="text-xs font-black text-emerald-800">{formatCurrency(cConfig.monthlyCache || cConfig.monthlyFee || 0)}</span>
                          </div>
                        ) : null}
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                          Cota Mensal de Entregas:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {(deliv.reels || 0) > 0 && (
                            <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
                              <Film size={11} /> {deliv.reels} Reels
                            </span>
                          )}
                          {(deliv.stories || 0) > 0 && (
                            <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
                              <Instagram size={11} /> {deliv.stories} Stories
                            </span>
                          )}
                          {(deliv.posts || 0) > 0 && (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
                              <Layers size={11} /> {deliv.posts} Feed
                            </span>
                          )}
                          {(deliv.tiktok || 0) > 0 && (
                            <span className="bg-rose-50 text-rose-700 border border-rose-100 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
                              <Clapperboard size={11} /> {deliv.tiktok} TikTok
                            </span>
                          )}
                          {(deliv.youtube || 0) > 0 && (
                            <span className="bg-red-50 text-red-700 border border-red-100 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
                              <Video size={11} /> {deliv.youtube} YouTube
                            </span>
                          )}
                          {(deliv.live || 0) > 0 && (
                            <span className="bg-purple-50 text-purple-700 border border-purple-100 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
                              <Radio size={11} /> {deliv.live} Lives
                            </span>
                          )}
                          {(deliv.pinterest || 0) > 0 && (
                            <span className="bg-pink-50 text-pink-700 border border-pink-100 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
                              <Pin size={11} /> {deliv.pinterest} Pins
                            </span>
                          )}
                          {(deliv.blog || 0) > 0 && (
                            <span className="bg-sky-50 text-sky-700 border border-sky-100 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
                              <Newspaper size={11} /> {deliv.blog} Artigos
                            </span>
                          )}
                          {(deliv.podcast || 0) > 0 && (
                            <span className="bg-violet-50 text-violet-700 border border-violet-100 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
                              <Mic size={11} /> {deliv.podcast} Podcasts
                            </span>
                          )}
                          {(deliv.unboxing || 0) > 0 && (
                            <span className="bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-100 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
                              <Package size={11} /> {deliv.unboxing} Unboxing
                            </span>
                          )}
                          {(deliv.ugc || 0) > 0 && (
                            <span className="bg-teal-50 text-teal-700 border border-teal-100 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
                              <Camera size={11} /> {deliv.ugc} UGC
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 3: Scheduled Pautas / Deliverables */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Repeat size={15} className="text-purple-600" />
                {isCreatorView ? `Minhas Pautas Cadastradas (${contractPlanningItems.length})` : `Cronograma e Pautas Cadastradas (${contractPlanningItems.length})`}
              </h3>
            </div>

            {contractPlanningItems.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-4 bg-slate-50 rounded-xl border border-slate-200/80">
                {isCreatorView ? 'Nenhuma pauta cadastrada para você neste contrato ainda. As pautas são adicionadas pela agência ou cliente.' : 'Nenhuma pauta cadastrada no cronograma deste contrato ainda.'}
              </p>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                        {!isCreatorView && <th className="p-3 pl-4">Criador</th>}
                        <th className={cn("p-3", isCreatorView && "pl-4")}>Título da Pauta</th>
                        <th className="p-3">Formato</th>
                        <th className="p-3">Data Limite</th>
                        <th className="p-3">Status</th>
                        {onOpenSubmitModal && <th className="p-3 text-right pr-4">Ação</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {contractPlanningItems.map(item => {
                        const creatorObj = creators.find(c => c.id === item.creatorId);
                        const cName = item.creatorName || creatorObj?.artisticName || creatorObj?.fullName || 'Criador';

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                            {!isCreatorView && <td className="p-3 pl-4 font-bold text-slate-900">{cName}</td>}
                            <td className={cn("p-3", isCreatorView && "pl-4")}>
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800">{item.title}</span>
                                {item.briefingNote && (
                                  <span className="text-[10px] text-slate-500 line-clamp-1">{item.briefingNote}</span>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100">
                                {item.contentType}
                              </span>
                            </td>
                            <td className="p-3 text-slate-700">
                              {item.plannedDate ? new Date(item.plannedDate).toLocaleDateString('pt-BR') : 'A definir'}
                            </td>
                            <td className="p-3">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border",
                                item.status === 'published' ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                                item.status === 'approved' ? "bg-indigo-100 text-indigo-800 border-indigo-200" :
                                item.status === 'review' ? "bg-purple-100 text-purple-900 border-purple-200" :
                                item.status === 'rejected' ? "bg-rose-100 text-rose-800 border-rose-200" :
                                item.status === 'in_production' ? "bg-sky-100 text-sky-800 border-sky-200" :
                                "bg-amber-50 text-amber-800 border-amber-200"
                              )}>
                                {item.status === 'published' ? '🚀 Publicado' :
                                 item.status === 'approved' ? '✅ Aprovado' :
                                 item.status === 'review' ? '⏳ Em Aprovação' :
                                 item.status === 'rejected' ? '⚠️ Ajuste' :
                                 item.status === 'in_production' ? '🎬 Em Produção' : '📋 Planejado'}
                              </span>
                            </td>
                            {onOpenSubmitModal && (
                              <td className="p-3 text-right pr-4">
                                <button
                                  onClick={() => onOpenSubmitModal(item)}
                                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] rounded-lg transition-colors flex items-center gap-1 ml-auto cursor-pointer"
                                >
                                  <UploadCloud size={12} />
                                  {item.submissionUrl ? 'Reenviar' : 'Enviar'}
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            ID do Contrato: <code className="text-slate-700 font-mono text-[11px]">{contract.id}</code>
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Fechar Detalhes
          </button>
        </div>
      </div>
    </div>
  );
};
