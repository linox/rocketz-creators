import { useState } from 'react';
import { 
  Campaign, 
  CampaignCreator, 
  Creator, 
  RecurringContract, 
  ContentPlanningItem,
  Company 
} from '../types';
import { 
  Megaphone, 
  Repeat, 
  Users, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Video, 
  FileText, 
  Play, 
  ArrowRight, 
  Sparkles, 
  Calendar,
  Layers,
  Send,
  X,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePrivacy } from '../context/PrivacyContext';
import { UserAvatar } from './UserAvatar';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

const cn = (...classes: (string | boolean | undefined | null)[]) => classes.filter(Boolean).join(' ');

interface CompanyOverviewSectionProps {
  company: Company;
  campaigns: Campaign[];
  campaignCreators: Record<string, CampaignCreator[]>;
  recurringContracts: RecurringContract[];
  contentPlanningItems: ContentPlanningItem[];
  creators: Record<string, Creator>;
  onSelectCampaign: (camp: Campaign) => void;
  onSwitchTab: (tab: 'campaigns' | 'recurring' | 'favorites') => void;
  onOpenMediaPreview: (preview: {
    url: string;
    type: 'video' | 'script';
    creatorName: string;
    scriptText?: string;
  }) => void;
}

export function CompanyOverviewSection({
  company,
  campaigns,
  campaignCreators,
  recurringContracts,
  contentPlanningItems,
  creators,
  onSelectCampaign,
  onSwitchTab,
  onOpenMediaPreview
}: CompanyOverviewSectionProps) {
  const { formatCurrency, hideValues } = usePrivacy();

  // Feedback / Approval modal for quick actions
  const [activeActionItem, setActiveActionItem] = useState<{
    type: 'campaign_script' | 'campaign_video' | 'recurring_content';
    id: string;
    campaignId?: string;
    title: string;
    creatorName: string;
    contentPreview?: string;
    videoUrl?: string;
  } | null>(null);

  const [feedbackNote, setFeedbackNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // 1. Calculate Unified Metrics
  const activeCampaigns = campaigns.filter(c => c.status === 'production' || c.status === 'briefing' || c.status === 'selection');
  const activeRecurring = recurringContracts.filter(c => c.status === 'active');

  // Total Creators across both
  const campaignCreatorIds = new Set<string>();
  Object.values(campaignCreators).forEach(list => {
    list.forEach(cc => { if (cc.creatorId) campaignCreatorIds.add(cc.creatorId); });
  });

  const recurringCreatorIds = new Set<string>();
  activeRecurring.forEach(c => {
    c.creators?.forEach(cr => { if (cr.creatorId) recurringCreatorIds.add(cr.creatorId); });
  });

  const allUniqueCreatorsCount = new Set([...campaignCreatorIds, ...recurringCreatorIds]).size;

  // Investment
  let totalCampaignInvested = 0;
  let totalCampaignDeliveriesDone = 0;
  let totalCampaignDeliveriesTotal = 0;

  campaigns.forEach(camp => {
    const list = campaignCreators[camp.id] || [];
    totalCampaignDeliveriesTotal += list.length;
    list.forEach(cc => {
      if (!camp.isDirectContract && !camp.isBarter) {
        totalCampaignInvested += cc.amount || 0;
      }
      if (cc.deliveryStatus === 'published' || cc.deliveryStatus === 'approved') {
        totalCampaignDeliveriesDone++;
      }
    });
  });

  const totalRecurringMonthly = activeRecurring.reduce((acc, c) => {
    if (c.monthlyFee) return acc + c.monthlyFee;
    return acc + (c.creators?.reduce((crAcc, cr) => crAcc + (cr.monthlyCache || cr.deliverablesFee || 0), 0) || 0);
  }, 0);

  const totalRecurringQuota = activeRecurring.reduce((acc, c) => {
    return acc + (c.creators?.reduce((crAcc, cr) => {
      const d = cr.monthlyDeliverables || {};
      return crAcc + (d.stories||0)+(d.reels||0)+(d.posts||0)+(d.tiktok||0)+(d.youtube||0)+(d.live||0)+(d.pinterest||0)+(d.blog||0)+(d.podcast||0)+(d.unboxing||0)+(d.ugc||0);
    }, 0) || 0);
  }, 0);

  const recurringPublishedThisMonth = contentPlanningItems.filter(i => i.status === 'published' || i.status === 'approved').length;

  // 2. Pending Approvals Collection
  interface PendingApproval {
    id: string;
    source: 'campaign' | 'recurring';
    campaignId?: string;
    stage: 'script' | 'video' | 'recurring';
    title: string;
    creatorName: string;
    creatorPhoto?: string;
    scriptText?: string;
    videoUrl?: string;
    submittedAt?: string;
  }

  const pendingApprovals: PendingApproval[] = [];

  // Check campaign deliveries pending approval
  campaigns.forEach(camp => {
    const list = campaignCreators[camp.id] || [];
    list.forEach(cc => {
      const cr = creators[cc.creatorId];
      const creatorName = cr?.artisticName || cr?.fullName || 'Criador';

      // Script approval pending
      if (cc.scriptStatus === 'submitted' || (!cc.scriptStatus && cc.deliveryStatus === 'sent' && cc.content?.script && !cc.content?.videoUrl)) {
        pendingApprovals.push({
          id: cc.id,
          source: 'campaign',
          campaignId: camp.id,
          stage: 'script',
          title: `Roteiro: ${camp.name}`,
          creatorName,
          creatorPhoto: cr?.photoUrl,
          scriptText: cc.content?.script,
          submittedAt: cc.scriptSubmittedAt || cc.deliveryDate
        });
      }

      // Video approval pending
      if (cc.videoStatus === 'submitted' || (!cc.videoStatus && cc.deliveryStatus === 'sent' && cc.content?.videoUrl)) {
        pendingApprovals.push({
          id: cc.id,
          source: 'campaign',
          campaignId: camp.id,
          stage: 'video',
          title: `Vídeo Final: ${camp.name}`,
          creatorName,
          creatorPhoto: cr?.photoUrl,
          videoUrl: cc.content?.videoUrl,
          scriptText: cc.content?.script,
          submittedAt: cc.videoSubmittedAt || cc.deliveryDate
        });
      }
    });
  });

  // Check recurring content items in 'review'
  contentPlanningItems.forEach(item => {
    if (item.status === 'review') {
      const cr = creators[item.creatorId];
      pendingApprovals.push({
        id: item.id,
        source: 'recurring',
        stage: 'recurring',
        title: item.title || 'Conteúdo Recorrente',
        creatorName: item.creatorName || cr?.artisticName || cr?.fullName || 'Criador',
        creatorPhoto: cr?.photoUrl,
        videoUrl: item.mediaUrl || item.submissionUrl,
        scriptText: item.script || item.briefingNote,
        submittedAt: item.submittedAt || item.plannedDate
      });
    }
  });

  // Handlers for quick approval / feedback from Overview
  const handleQuickApprove = async (item: PendingApproval) => {
    setIsProcessing(true);
    try {
      if (item.source === 'campaign' && item.campaignId) {
        const payload: any = {};
        if (item.stage === 'script') {
          payload.scriptStatus = 'approved';
          payload.scriptFeedback = '';
        } else if (item.stage === 'video') {
          payload.videoStatus = 'approved';
          payload.deliveryStatus = 'approved';
          payload.videoFeedback = '';
        }
        await updateDoc(doc(db, `campaigns/${item.campaignId}/creators`, item.id), payload);
      } else if (item.source === 'recurring') {
        await updateDoc(doc(db, 'contentPlanning', item.id), {
          status: 'approved',
          reviewedAt: new Date().toISOString(),
          feedbackNote: ''
        });
      }
      alert('✓ Aprovado com sucesso!');
      setActiveActionItem(null);
      setFeedbackNote('');
    } catch (err) {
      console.error(err);
      alert('Erro ao aprovar item.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickRequestChanges = async () => {
    if (!activeActionItem) return;
    if (!feedbackNote.trim()) {
      alert('Por favor, descreva as orientações de ajustes.');
      return;
    }
    setIsProcessing(true);
    try {
      if (activeActionItem.type === 'campaign_script' && activeActionItem.campaignId) {
        await updateDoc(doc(db, `campaigns/${activeActionItem.campaignId}/creators`, activeActionItem.id), {
          scriptStatus: 'revision',
          scriptFeedback: feedbackNote,
          deliveryStatus: 'revision',
          revisionDetails: feedbackNote
        });
      } else if (activeActionItem.type === 'campaign_video' && activeActionItem.campaignId) {
        await updateDoc(doc(db, `campaigns/${activeActionItem.campaignId}/creators`, activeActionItem.id), {
          videoStatus: 'revision',
          videoFeedback: feedbackNote,
          deliveryStatus: 'revision',
          revisionDetails: feedbackNote
        });
      } else if (activeActionItem.type === 'recurring_content') {
        await updateDoc(doc(db, 'contentPlanning', activeActionItem.id), {
          status: 'revision',
          feedbackNote: feedbackNote
        });
      }
      alert('Ajustes solicitados e feedback enviado ao criador!');
      setActiveActionItem(null);
      setFeedbackNote('');
    } catch (err) {
      console.error(err);
      alert('Erro ao solicitar ajustes.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      
      {/* 1. Top Executive Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Total Active Operations */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <Layers size={24} />
          </div>
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Operações Ativas</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-slate-900">{activeCampaigns.length + activeRecurring.length}</span>
              <span className="text-xs text-slate-500 font-semibold">
                ({activeCampaigns.length} camp. + {activeRecurring.length} recorrentes)
              </span>
            </div>
          </div>
        </div>

        {/* Unified Total Creators */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
            <Users size={24} />
          </div>
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Criadores Ativos</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-slate-900">{allUniqueCreatorsCount}</span>
              <span className="text-xs text-slate-500 font-semibold">influenciadores</span>
            </div>
          </div>
        </div>

        {/* Total Deliverables & Progress */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Entregas Publicadas</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-slate-900">
                {totalCampaignDeliveriesDone + recurringPublishedThisMonth}
              </span>
              <span className="text-xs text-slate-500 font-semibold">
                / {totalCampaignDeliveriesTotal + totalRecurringQuota} previstas
              </span>
            </div>
          </div>
        </div>

        {/* Investment Summary */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <DollarSign size={24} />
          </div>
          <div>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Investimento Contratado</span>
            <span className="text-xl font-black text-slate-900 mt-1 block">
              {formatCurrency(totalCampaignInvested + totalRecurringMonthly)}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              Campanhas + Recorrente mensal
            </span>
          </div>
        </div>

      </div>

      {/* 2. Pending Approvals Callout (If any item is waiting for brand decision) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Clock size={16} className="text-amber-600" />
              Central de Aprovações Pendentes da Marca ({pendingApprovals.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Roteiros e vídeos aguardando validação para publicação
          </span>
        </div>

        {pendingApprovals.length === 0 ? (
          <div className="p-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center flex flex-col items-center justify-center gap-2">
            <CheckCircle2 size={28} className="text-emerald-500" />
            <p className="text-xs font-bold text-slate-700 m-0">Tudo em dia! Nenhuma aprovação pendente no momento.</p>
            <span className="text-[11px] text-slate-400">Assim que os criadores submeterem roteiros ou vídeos, eles aparecerão aqui.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingApprovals.map(item => (
              <div 
                key={item.id + item.stage}
                className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex flex-col justify-between gap-3 hover:border-indigo-300 transition-all shadow-xs"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border",
                      item.stage === 'script' ? "bg-amber-100 text-amber-800 border-amber-200" :
                      item.stage === 'video' ? "bg-purple-100 text-purple-800 border-purple-200" :
                      "bg-indigo-100 text-indigo-800 border-indigo-200"
                    )}>
                      {item.stage === 'script' ? '📝 Roteiro p/ Aprovar' : item.stage === 'video' ? '🎬 Vídeo p/ Aprovar' : '🔁 Recorrente'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">
                      {item.source === 'campaign' ? 'Campanha' : 'Recorrente'}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{item.title}</h4>

                  <div className="flex items-center gap-2 mt-1">
                    <UserAvatar
                      src={item.creatorPhoto}
                      name={item.creatorName}
                      size="custom"
                      shape="circle"
                      className="w-6 h-6 border border-slate-200"
                      textClassName="text-[10px]"
                    />
                    <span className="text-xs font-semibold text-slate-700">@{item.creatorName}</span>
                  </div>

                  {item.scriptText && (
                    <p className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200/60 line-clamp-2 italic">
                      "{item.scriptText}"
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60">
                  {item.videoUrl && (
                    <button
                      type="button"
                      onClick={() => onOpenMediaPreview({
                        url: item.videoUrl!,
                        type: 'video',
                        creatorName: item.creatorName,
                        scriptText: item.scriptText
                      })}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold rounded-lg border border-slate-200 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    >
                      <Play size={10} fill="currentColor" /> Assistir
                    </button>
                  )}

                  {item.scriptText && !item.videoUrl && (
                    <button
                      type="button"
                      onClick={() => onOpenMediaPreview({
                        url: '',
                        type: 'script',
                        creatorName: item.creatorName,
                        scriptText: item.scriptText
                      })}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold rounded-lg border border-slate-200 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    >
                      <FileText size={10} /> Ler Roteiro
                    </button>
                  )}

                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      type="button"
                      onClick={() => setActiveActionItem({
                        type: item.source === 'campaign' 
                          ? (item.stage === 'script' ? 'campaign_script' : 'campaign_video')
                          : 'recurring_content',
                        id: item.id,
                        campaignId: item.campaignId,
                        title: item.title,
                        creatorName: item.creatorName,
                        contentPreview: item.scriptText,
                        videoUrl: item.videoUrl
                      })}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold rounded-lg border border-rose-200 cursor-pointer transition-colors"
                    >
                      Ajustes
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickApprove(item)}
                      disabled={isProcessing}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg cursor-pointer transition-colors flex items-center gap-1 shadow-xs"
                    >
                      <CheckCircle2 size={11} /> Aprovar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Side-by-Side: Active Campaigns vs Active Recurring Works */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* Left Column: Campanhas */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Megaphone size={18} className="text-indigo-600" />
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Campanhas Ativas ({activeCampaigns.length})
              </h3>
            </div>
            <button
              onClick={() => onSwitchTab('campaigns')}
              className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
            >
              Ver Todas <ArrowRight size={12} />
            </button>
          </div>

          {activeCampaigns.length === 0 ? (
            <div className="p-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs">
              Nenhuma campanha ativa no momento.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {activeCampaigns.map(camp => {
                const list = campaignCreators[camp.id] || [];
                const approvedOrPublished = list.filter(c => c.deliveryStatus === 'approved' || c.deliveryStatus === 'published').length;

                return (
                  <div
                    key={camp.id}
                    onClick={() => {
                      onSelectCampaign(camp);
                      onSwitchTab('campaigns');
                    }}
                    className="p-4 rounded-xl border border-slate-200/90 hover:border-indigo-400 hover:bg-indigo-50/20 transition-all cursor-pointer flex flex-col gap-2.5 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-black text-slate-900 m-0">{camp.name}</h4>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {new Date(camp.startDate).toLocaleDateString()} a {new Date(camp.endDate).toLocaleDateString()}
                        </span>
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase">
                        {camp.approvalFlow === 'video_only' ? 'Apenas Vídeo' : camp.approvalFlow === 'script_only' ? 'Apenas Roteiro' : 'Roteiro + Vídeo'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-100">
                      <span className="text-slate-500 font-semibold flex items-center gap-1">
                        <Users size={12} className="text-indigo-600" /> {list.length} criadores alocados
                      </span>
                      <span className="font-bold text-emerald-700">
                        {approvedOrPublished}/{list.length} entregas concluídas
                      </span>
                    </div>

                    {/* Mini Progress Bar */}
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-600 transition-all duration-300"
                        style={{ width: `${list.length > 0 ? (approvedOrPublished / list.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Trabalhos Recorrentes com Etiquetas de Status (Devendo, etc.) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Repeat size={18} className="text-purple-600" />
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Trabalhos Recorrentes & Status ({activeRecurring.length})
              </h3>
            </div>
            <button
              onClick={() => onSwitchTab('recurring')}
              className="text-xs font-bold text-purple-600 hover:underline flex items-center gap-1 cursor-pointer"
            >
              Ver Calendário <ArrowRight size={12} />
            </button>
          </div>

          {activeRecurring.length === 0 ? (
            <div className="p-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs">
              Nenhum contrato recorrente ativo no momento.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {activeRecurring.map(contract => {
                return (
                  <div
                    key={contract.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-900 m-0">{contract.title}</h4>
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 uppercase">
                        Contrato Recorrente
                      </span>
                    </div>

                    {/* Breakdown of creators and quota labels */}
                    <div className="flex flex-col gap-2">
                      {contract.creators?.map(cConfig => {
                        const cr = creators[cConfig.creatorId];
                        const d = cConfig.monthlyDeliverables || {};
                        const creatorQuota = (d.stories||0)+(d.reels||0)+(d.posts||0)+(d.tiktok||0)+(d.youtube||0)+(d.live||0)+(d.pinterest||0)+(d.blog||0)+(d.podcast||0)+(d.unboxing||0)+(d.ugc||0);
                        
                        const creatorPlanningItems = contentPlanningItems.filter(i => i.creatorId === cConfig.creatorId);
                        const publishedCount = creatorPlanningItems.filter(i => i.status === 'published' || i.status === 'approved').length;
                        const isOwing = creatorQuota > 0 && publishedCount < creatorQuota;

                        return (
                          <div 
                            key={cConfig.creatorId}
                            className="bg-white p-3 rounded-lg border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <UserAvatar
                                src={cr?.photoUrl}
                                name={cConfig.creatorName || cr?.artisticName || 'Criador'}
                                size="custom"
                                shape="circle"
                                className="w-7 h-7 border border-slate-200"
                                textClassName="text-[10px] font-bold"
                              />
                              <div>
                                <span className="font-bold text-slate-800 block">
                                  @{cConfig.creatorName || cr?.artisticName}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {publishedCount} de {creatorQuota} peças entregues
                                </span>
                              </div>
                            </div>

                            {/* Status label: Devendo / Em dia */}
                            <div>
                              {creatorQuota === 0 ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                  Sem cota
                                </span>
                              ) : isOwing ? (
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1 shadow-2xs">
                                  ⚠️ Devendo ({creatorQuota - publishedCount} no mês)
                                </span>
                              ) : (
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                  ✓ Quota em dia
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Quick Revision/Feedback Modal */}
      <AnimatePresence>
        {activeActionItem && (
          <div className="fixed inset-0 z-[300] overflow-y-auto p-3 sm:p-4 flex items-center justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
              onClick={() => setActiveActionItem(null)}
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] my-auto z-10 p-5 sm:p-6 gap-4"
            >
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 bg-rose-100 px-2.5 py-1 rounded-md">
                  Solicitar Ajustes no Material
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-2 m-0">{activeActionItem.title}</h3>
                <p className="text-xs text-slate-500 m-0 mt-1">
                  Criador: <strong>@{activeActionItem.creatorName}</strong>
                </p>
              </div>

              {activeActionItem.contentPreview && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 max-h-32 overflow-y-auto font-medium">
                  <strong>Texto/Roteiro:</strong> {activeActionItem.contentPreview}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Orientações para o Criador:
                </label>
                <textarea 
                  rows={4}
                  placeholder="Descreva detalhadamente as correções necessárias..."
                  value={feedbackNote}
                  onChange={(e) => setFeedbackNote(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-rose-500 focus:bg-white transition-all resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveActionItem(null)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-300 transition-all border-none cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleQuickRequestChanges}
                  disabled={isProcessing || !feedbackNote.trim()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send size={13} /> Enviar Solicitação de Ajustes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
