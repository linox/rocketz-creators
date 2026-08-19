import React, { useState, useEffect } from 'react';
import { 
  Megaphone, 
  Plus, 
  Calendar, 
  DollarSign, 
  ArrowRight, 
  Clock, 
  CheckCircle2, 
  Lock, 
  Handshake, 
  Users, 
  Gift, 
  Eye, 
  ChevronDown, 
  ChevronUp, 
  Instagram, 
  Clapperboard, 
  Video, 
  FileText, 
  Check, 
  AlertTriangle, 
  MessageSquare, 
  ExternalLink, 
  Filter, 
  Search, 
  Layers,
  Sparkles,
  Archive,
  Radio,
  Pin,
  Newspaper,
  Mic,
  Package,
  Camera,
  Trash2
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  getDocs, 
  where 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Campaign, Company, CampaignStatus, CampaignCreator, Creator } from '../types';
import { cn, formatDeliverablesSummary } from '../lib/utils';
import { usePrivacy } from '../context/PrivacyContext';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { createNotification } from '../lib/notifications';
import { DatabaseResetModal } from '../components/DatabaseResetModal';
import { CampaignImageUpload } from '../components/CampaignImageUpload';
import { UserAvatar } from '../components/UserAvatar';

// Status map for active campaigns (removed 'approval' as requested)
const activeStatusMap: Partial<Record<CampaignStatus, { label: string; color: string; icon: any }>> = {
  briefing: { label: 'Briefing', color: 'bg-blue-50 text-blue-600 border-blue-100', icon: Clock },
  selection: { label: 'Seleção', color: 'bg-purple-50 text-purple-600 border-purple-100', icon: Megaphone },
  production: { label: 'Produção', color: 'bg-indigo-50 text-indigo-600 border-indigo-100', icon: Megaphone },
  published: { label: 'Publicado', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: CheckCircle2 },
};

const fullStatusMap: Record<CampaignStatus, { label: string; color: string; icon: any }> = {
  briefing: { label: 'Briefing', color: 'bg-blue-50 text-blue-600 border-blue-100', icon: Clock },
  selection: { label: 'Seleção', color: 'bg-purple-50 text-purple-600 border-purple-100', icon: Megaphone },
  approval: { label: 'Aprovação', color: 'bg-amber-50 text-amber-600 border-amber-100', icon: Clock },
  production: { label: 'Produção', color: 'bg-indigo-50 text-indigo-600 border-indigo-100', icon: Megaphone },
  published: { label: 'Publicado', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: CheckCircle2 },
  finished: { label: 'Encerrada', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: CheckCircle2 },
};

// Material format icon resolver
const getFormatBadge = (deliveryType: string = '') => {
  const dt = deliveryType.toLowerCase();
  if (dt.includes('reel')) return { label: 'Reel', icon: Clapperboard, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
  if (dt.includes('storie') || dt.includes('story')) return { label: 'Stories', icon: Instagram, color: 'bg-amber-50 text-amber-700 border-amber-200' };
  if (dt.includes('tiktok')) return { label: 'TikTok', icon: Clapperboard, color: 'bg-rose-50 text-rose-700 border-rose-200' };
  if (dt.includes('youtube') || dt.includes('video') || dt.includes('vídeo')) return { label: 'YouTube', icon: Video, color: 'bg-red-50 text-red-700 border-red-200' };
  if (dt.includes('ugc')) return { label: 'UGC', icon: Camera, color: 'bg-teal-50 text-teal-700 border-teal-200' };
  if (dt.includes('post') || dt.includes('feed')) return { label: 'Feed / Post', icon: Layers, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  return { label: deliveryType || 'Material', icon: FileText, color: 'bg-slate-100 text-slate-700 border-slate-200' };
};

// Platform helper
const getPlatformBadge = (deliveryType: string = '') => {
  const dt = deliveryType.toLowerCase();
  if (dt.includes('tiktok')) return { name: 'TikTok', color: 'bg-rose-50 text-rose-700 border-rose-200' };
  if (dt.includes('youtube')) return { name: 'YouTube', color: 'bg-red-50 text-red-700 border-red-200' };
  return { name: 'Instagram', color: 'bg-pink-50 text-pink-700 border-pink-200' };
};

export default function Campaigns() {
  const { formatCurrency } = usePrivacy();
  const [activeView, setActiveView] = useState<'active' | 'finished' | 'materials'>('active');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [creatorsMap, setCreatorsMap] = useState<Record<string, Creator>>({});
  const [allDeliverables, setAllDeliverables] = useState<Array<CampaignCreator & { campaignName: string; companyName: string }>>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [modalIsBarter, setModalIsBarter] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [materialFilter, setMaterialFilter] = useState<string>('all');
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});

  // Deliverables and Briefing for Campaign Creation Modal
  const [modalActiveTab, setModalActiveTab] = useState<'geral' | 'entregas' | 'briefing'>('geral');
  const [modalApprovalFlow, setModalApprovalFlow] = useState<'script_and_video' | 'video_only' | 'script_only'>('script_and_video');
  const [modalDelReels, setModalDelReels] = useState<number>(1);
  const [modalDelStories, setModalDelStories] = useState<number>(0);
  const [modalDelTikTok, setModalDelTikTok] = useState<number>(0);
  const [modalDelUgc, setModalDelUgc] = useState<number>(0);
  const [modalDelPosts, setModalDelPosts] = useState<number>(0);
  const [modalDelYoutube, setModalDelYoutube] = useState<number>(0);
  const [modalDelSummary, setModalDelSummary] = useState<string>('');
  const [modalDelDeadlineDays, setModalDelDeadlineDays] = useState<number>(5);
  const [modalDelGuidelines, setModalDelGuidelines] = useState<string>('');

  const resetCreationModal = () => {
    setIsModalOpen(false);
    setModalIsBarter(false);
    setModalImageUrl('');
    setModalActiveTab('geral');
    setModalApprovalFlow('script_and_video');
    setModalDelReels(1);
    setModalDelStories(0);
    setModalDelTikTok(0);
    setModalDelUgc(0);
    setModalDelPosts(0);
    setModalDelYoutube(0);
    setModalDelSummary('');
    setModalDelDeadlineDays(5);
    setModalDelGuidelines('');
  };
  
  // Deliverable expansion & adjustment states
  const [expandedDeliverableId, setExpandedDeliverableId] = useState<string | null>(null);
  const [revisionFeedback, setRevisionFeedback] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // 1. Pending candidate counts
  useEffect(() => {
    const q = query(
      collection(db, 'campaignCreators'),
      where('applicationStatus', '==', 'pending')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const counts: Record<string, number> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const campId = data.campaignId;
        if (campId) {
          counts[campId] = (counts[campId] || 0) + 1;
        }
      });
      setPendingCounts(counts);
    }, (err) => {
      console.warn("Pending counts snapshot warning:", err.message);
    });

    return unsubscribe;
  }, []);

  // 2. Query param for modal
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setIsModalOpen(true);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('new');
      setSearchParams(newParams, { replace: true });
    }
    if (searchParams.get('tab') === 'materials') {
      setActiveView('materials');
    }
    if (searchParams.get('tab') === 'finished') {
      setActiveView('finished');
    }
  }, [searchParams, setSearchParams]);

  // 3. Load all creators
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'creators'), (snap) => {
      const map: Record<string, Creator> = {};
      snap.docs.forEach(d => {
        map[d.id] = { id: d.id, ...d.data() } as Creator;
      });
      setCreatorsMap(map);
    });
    return () => unsub();
  }, []);

  // 4. Load all campaigns and companies
  useEffect(() => {
    const q = query(collection(db, 'campaigns'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
      setCampaigns(list);

      // Listen to deliverables for all campaigns
      list.forEach(camp => {
        const comp = companies.find(c => c.id === camp.companyId);
        onSnapshot(collection(db, `campaigns/${camp.id}/creators`), (cSnap) => {
          const items = cSnap.docs.map(d => ({
            id: d.id,
            ...d.data(),
            campaignId: camp.id,
            campaignName: camp.name,
            companyName: comp?.name || 'Cliente'
          } as CampaignCreator & { campaignName: string; companyName: string }));

          setAllDeliverables(prev => {
            const filteredOut = prev.filter(p => p.campaignId !== camp.id);
            return [...filteredOut, ...items];
          });
        });
      });
    }, (err) => {
      console.warn("Campaigns snapshot warning:", err.message);
    });

    getDocs(collection(db, 'companies')).then(snap => {
      setCompanies(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company)));
    });

    return unsubscribe;
  }, [companies.length]);

  // Action: Approve Deliverable
  const handleApproveDeliverable = async (campaignId: string, deliverableId: string, creatorId: string) => {
    setUpdatingId(deliverableId);
    try {
      await updateDoc(doc(db, `campaigns/${campaignId}/creators`, deliverableId), {
        deliveryStatus: 'approved',
        revisionDetails: ''
      });

      const creator = creatorsMap[creatorId];
      if (creator) {
        createNotification({
          title: 'Material Aprovado! 🎉',
          message: `Seu material da campanha foi aprovado pela equipe. Prepare-se para a publicação!`,
          type: 'approval',
          targetRole: 'creator',
          creatorId: creatorId,
          campaignId: campaignId,
          link: `/creators/${creatorId}?tab=campaigns`
        });
      }
    } catch (err) {
      console.error("Erro ao aprovar material:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Action: Request Adjustments
  const handleRequestRevision = async (campaignId: string, deliverableId: string, creatorId: string) => {
    const feedback = revisionFeedback[deliverableId];
    if (!feedback || !feedback.trim()) {
      alert("Por favor, digite as orientações de ajuste para o criador antes de enviar.");
      return;
    }

    setUpdatingId(deliverableId);
    try {
      await updateDoc(doc(db, `campaigns/${campaignId}/creators`, deliverableId), {
        deliveryStatus: 'revision',
        revisionDetails: feedback.trim()
      });

      const creator = creatorsMap[creatorId];
      if (creator) {
        createNotification({
          title: 'Ajuste Solicitado no Material ✍️',
          message: `A agência solicitou alguns ajustes no seu material: "${feedback.trim()}"`,
          type: 'delivery_review',
          targetRole: 'creator',
          creatorId: creatorId,
          campaignId: campaignId,
          link: `/creators/${creatorId}?tab=campaigns`
        });
      }
    } catch (err) {
      console.error("Erro ao solicitar ajuste:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Filtered lists
  const activeCampaigns = campaigns.filter(c => c.status !== 'finished');
  const finishedCampaigns = campaigns.filter(c => c.status === 'finished');

  const filteredActive = activeCampaigns.filter(c => statusFilter === 'all' || c.status === statusFilter);

  // Filtered deliverables
  const filteredDeliverables = allDeliverables.filter(item => {
    if (materialFilter === 'pending') return item.deliveryStatus === 'sent' || item.deliveryStatus === 'pending';
    if (materialFilter === 'revision') return item.deliveryStatus === 'revision';
    if (materialFilter === 'approved') return item.deliveryStatus === 'approved';
    if (materialFilter === 'published') return item.deliveryStatus === 'published';
    return true;
  });

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#0F172A] m-0">Gestão de Campanhas</h1>
          <p className="m-1 mt-0 text-[#64748B] text-[14px]">
            Acompanhe campanhas ativas, encerramentos e aprove roteiros e vídeos de criadores
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsResetModalOpen(true)}
            className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 h-11 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Limpar todos os projetos de campanhas e entregas do banco"
          >
            <Trash2 size={15} className="text-rose-600" />
            Zerar Campanhas
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-brand-primary text-white h-11 px-6 rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-600 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <Plus size={18} />
            Nova Campanha
          </button>
        </div>
      </header>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveView('active')}
          className={cn(
            "pb-3.5 px-3 text-sm font-bold transition-all relative flex items-center gap-2 whitespace-nowrap cursor-pointer",
            activeView === 'active' 
              ? "text-brand-primary border-b-2 border-brand-primary" 
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          <Megaphone size={16} />
          Campanhas Ativas
          <span className="bg-indigo-50 text-brand-primary border border-indigo-100 px-2 py-0.5 rounded-full text-xs font-black">
            {activeCampaigns.length}
          </span>
        </button>

        <button
          onClick={() => setActiveView('finished')}
          className={cn(
            "pb-3.5 px-3 text-sm font-bold transition-all relative flex items-center gap-2 whitespace-nowrap cursor-pointer",
            activeView === 'finished' 
              ? "text-brand-primary border-b-2 border-brand-primary" 
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          <Archive size={16} />
          Campanhas Encerradas
          <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full text-xs font-black">
            {finishedCampaigns.length}
          </span>
        </button>

        <button
          onClick={() => setActiveView('materials')}
          className={cn(
            "pb-3.5 px-3 text-sm font-bold transition-all relative flex items-center gap-2 whitespace-nowrap cursor-pointer",
            activeView === 'materials' 
              ? "text-brand-primary border-b-2 border-brand-primary" 
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          <Layers size={16} />
          Aprovações de Materiais
          <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-xs font-black">
            {allDeliverables.filter(d => d.deliveryStatus === 'sent' || d.content?.script || d.content?.videoUrl).length}
          </span>
        </button>
      </div>

      {/* VIEW 1: CAMPANHAS ATIVAS */}
      {activeView === 'active' && (
        <div className="space-y-6">
          {/* Status filter (Approval removed as requested) */}
          <div className="flex items-center justify-between bg-white px-2 py-2 rounded-xl border border-[#E2E8F0] shadow-sm overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setStatusFilter('all')}
                className={cn(
                  "px-4 py-2 text-[10px] uppercase tracking-wider font-bold rounded-lg transition-all cursor-pointer",
                  statusFilter === 'all' ? "bg-brand-primary text-white" : "text-[#64748B] hover:bg-[#F1F5F9]"
                )}
              >
                Todas ({activeCampaigns.length})
              </button>
              {Object.entries(activeStatusMap).map(([key, value]) => (
                <button 
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={cn(
                    "px-4 py-2 text-[10px] uppercase tracking-wider font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer",
                    statusFilter === key ? "bg-brand-primary text-white" : "text-[#64748B] hover:bg-[#F1F5F9]"
                  )}
                >
                  {value.label}
                </button>
              ))}
            </div>
          </div>

          {filteredActive.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-3">
                <Megaphone size={24} />
              </div>
              <p className="text-sm font-bold text-slate-700">Nenhuma campanha ativa com este filtro.</p>
              <p className="text-xs text-slate-400 mt-1">Crie uma nova campanha ou altere o status dos filtros acima.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {filteredActive.map(campaign => {
                  const company = companies.find(c => c.id === campaign.companyId);
                  const status = fullStatusMap[campaign.status] || fullStatusMap.briefing;

                  return (
                    <motion.div 
                      layout
                      key={campaign.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-[20px] border border-[#E2E8F0] overflow-hidden hover:border-brand-primary transition-all flex flex-col group h-full shadow-sm hover:shadow-md"
                    >
                      {/* Campaign 16:9 Cover Banner */}
                      <div className="relative w-full aspect-[16/9] bg-slate-900 overflow-hidden shrink-0">
                        {campaign.imageUrl ? (
                          <img 
                            src={campaign.imageUrl} 
                            alt={campaign.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-6 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/80 font-black mb-2 shadow-inner">
                              {company?.logo || company?.logoUrl ? (
                                <img src={company.logo || company.logoUrl} alt="" className="w-full h-full object-cover rounded-2xl" />
                              ) : (
                                <Megaphone size={22} className="text-white/80" />
                              )}
                            </div>
                            <span className="text-xs font-bold text-white/90 truncate max-w-[200px]">{campaign.name}</span>
                          </div>
                        )}

                        {/* Top Badges Overlay */}
                        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={cn("px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider backdrop-blur-md shadow-xs", status.color)}>
                              {status.label}
                            </span>
                            {campaign.isSecret && (
                              <span className="flex items-center gap-1 bg-rose-950/80 text-rose-300 border border-rose-500/40 backdrop-blur-md px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
                                <Lock size={10} /> Secreta
                              </span>
                            )}
                            {campaign.isDirectContract && (
                              <span className="flex items-center gap-1 bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 backdrop-blur-md px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
                                <Handshake size={10} /> Contrato Direto
                              </span>
                            )}
                            {campaign.isBarter && (
                              <span className="flex items-center gap-1 bg-amber-950/80 text-amber-300 border border-amber-500/40 backdrop-blur-md px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
                                <Gift size={10} /> Permuta
                              </span>
                            )}
                          </div>

                          {pendingCounts[campaign.id] > 0 && (
                            <span className="flex items-center gap-1 bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider animate-pulse shadow-md">
                              ● {pendingCounts[campaign.id]} pendente{pendingCounts[campaign.id] > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>

                        {/* Company Floating Badge */}
                        <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-slate-950/80 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-xl shadow-lg">
                          <UserAvatar
                            src={company?.logo || company?.logoUrl}
                            name={company?.name || 'Cliente'}
                            size="custom"
                            shape="rounded-lg"
                            className="w-5 h-5 border border-white/20"
                            textClassName="text-[8px]"
                          />
                          <span className="text-[10px] font-bold text-white tracking-wide truncate max-w-[130px]">
                            {company?.name || 'Cliente'}
                          </span>
                        </div>
                      </div>

                      <div className="p-5 flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-[17px] font-bold text-[#0F172A] group-hover:text-brand-primary transition-colors line-clamp-1">
                            <Link to={`/campaigns/${campaign.id}`}>{campaign.name}</Link>
                          </h3>
                          <Link to={`/campaigns/${campaign.id}`} className="text-slate-400 hover:text-brand-primary transition-colors shrink-0 ml-2">
                            <ArrowRight size={18} />
                          </Link>
                        </div>

                        {/* Deliverables per creator pill */}
                        {formatDeliverablesSummary(campaign.deliverablesPerCreator) && (
                          <div className="mb-2 flex items-center gap-1.5 text-[11px] text-indigo-700 bg-indigo-50/70 border border-indigo-100/80 px-2.5 py-1 rounded-lg font-bold">
                            <Package size={13} className="text-brand-primary shrink-0" />
                            <span className="truncate">{formatDeliverablesSummary(campaign.deliverablesPerCreator)} <span className="text-[10px] text-indigo-500 font-medium">/ criador</span></span>
                          </div>
                        )}

                        <div className="mt-auto pt-2 space-y-2.5">
                          <div className="flex items-center gap-2.5 text-xs text-[#64748B]">
                            <Calendar size={13} className="text-slate-400 shrink-0" />
                            <span>{new Date(campaign.startDate).toLocaleDateString()} a {new Date(campaign.endDate).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-2.5 text-xs text-[#0F172A] font-bold">
                            {campaign.isBarter ? (
                              <>
                                <Gift size={13} className="text-amber-500 shrink-0" />
                                <span className="text-amber-600">Permuta de Produtos/Serviços</span>
                              </>
                            ) : (
                              <>
                                <DollarSign size={13} className="text-brand-primary shrink-0" />
                                <span>{campaign.isDirectContract ? 'Contrato Direto' : formatCurrency(campaign.totalBudget)}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="px-5 py-3.5 bg-[#F8FAFC] border-t border-[#F1F5F9] flex items-center justify-between">
                        <Link 
                          to={`/campaigns/${campaign.id}?tab=selection`}
                          className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5"
                        >
                          <Users size={14} /> Casting
                        </Link>
                        <Link 
                          to={`/campaigns/${campaign.id}`}
                          className="text-[11px] font-bold text-brand-primary uppercase tracking-wider hover:underline"
                        >
                          Gerenciar Campanha →
                        </Link>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: CAMPANHAS ENCERRADAS */}
      {activeView === 'finished' && (
        <div className="space-y-6">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-200 text-slate-700 rounded-xl">
                <Archive size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Histórico de Campanhas Encerradas</h3>
                <p className="text-xs text-slate-500">Campanhas finalizadas e arquivadas com todas as entregas concluídas.</p>
              </div>
            </div>
            <span className="text-xs font-black text-slate-600 bg-white border border-slate-200 px-3 py-1 rounded-full">
              {finishedCampaigns.length} Encerradas
            </span>
          </div>

          {finishedCampaigns.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-3">
                <Archive size={24} />
              </div>
              <p className="text-sm font-bold text-slate-700">Nenhuma campanha encerrada no momento.</p>
              <p className="text-xs text-slate-400 mt-1">Ao finalizar um projeto, ele será movido automaticamente para esta seção.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {finishedCampaigns.map(campaign => {
                const company = companies.find(c => c.id === campaign.companyId);

                return (
                  <div 
                    key={campaign.id}
                    className="bg-white rounded-[20px] border border-slate-200 overflow-hidden opacity-90 hover:opacity-100 transition-all flex flex-col shadow-sm group"
                  >
                    {/* 16:9 Banner */}
                    <div className="relative w-full aspect-[16/9] bg-slate-900 overflow-hidden shrink-0">
                      {campaign.imageUrl ? (
                        <img 
                          src={campaign.imageUrl} 
                          alt={campaign.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-800 flex flex-col items-center justify-center p-6 text-center">
                          <Archive size={24} className="text-slate-400 mb-1" />
                          <span className="text-xs font-bold text-slate-300 truncate max-w-[200px]">{campaign.name}</span>
                        </div>
                      )}

                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-slate-900/80 backdrop-blur-md text-slate-300 border border-white/10">
                          Encerrada
                        </span>
                      </div>

                      <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-slate-950/80 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-xl shadow-lg">
                        <UserAvatar
                          src={company?.logo || company?.logoUrl}
                          name={company?.name || 'Cliente'}
                          size="custom"
                          shape="rounded-lg"
                          className="w-5 h-5 border border-white/20"
                          textClassName="text-[8px]"
                        />
                        <span className="text-[10px] font-bold text-white tracking-wide truncate max-w-[130px]">
                          {company?.name || 'Cliente'}
                        </span>
                      </div>
                    </div>

                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-bold text-slate-900 mb-1">{campaign.name}</h3>
                        <Link to={`/campaigns/${campaign.id}`} className="text-slate-400 hover:text-slate-700">
                          <ArrowRight size={18} />
                        </Link>
                      </div>

                      {/* Deliverables per creator pill */}
                      {formatDeliverablesSummary(campaign.deliverablesPerCreator) && (
                        <div className="mb-2 flex items-center gap-1.5 text-[11px] text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg font-bold">
                          <Package size={13} className="text-slate-500 shrink-0" />
                          <span className="truncate">{formatDeliverablesSummary(campaign.deliverablesPerCreator)} <span className="text-[10px] text-slate-400 font-normal">/ criador</span></span>
                        </div>
                      )}

                      <div className="mt-auto space-y-2 text-xs text-slate-500 pt-3">
                        <div className="flex items-center gap-2">
                          <Calendar size={13} className="text-slate-400 shrink-0" />
                          <span>Período: {new Date(campaign.startDate).toLocaleDateString()} a {new Date(campaign.endDate).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2 font-bold text-slate-800">
                          <DollarSign size={13} className="text-slate-400 shrink-0" />
                          <span>{campaign.isBarter ? 'Permuta' : formatCurrency(campaign.totalBudget)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-400 font-medium">Projeto Concluído</span>
                      <Link 
                        to={`/campaigns/${campaign.id}`}
                        className="font-bold text-slate-700 hover:text-brand-primary uppercase text-[11px] tracking-wider"
                      >
                        Ver Relatório →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: APROVAÇÕES DE MATERIAIS (ROTEIRO / VÍDEO / MATERIAL / PLATAFORMA COM EXPANSÃO) */}
      {activeView === 'materials' && (
        <div className="space-y-6">
          {/* Subheader & Filter pills */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Filtrar:</span>
              <button
                onClick={() => setMaterialFilter('all')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  materialFilter === 'all' ? "bg-brand-primary text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                )}
              >
                Todos ({allDeliverables.length})
              </button>
              <button
                onClick={() => setMaterialFilter('pending')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  materialFilter === 'pending' ? "bg-amber-500 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                )}
              >
                Aguardando Avaliação ({allDeliverables.filter(d => d.deliveryStatus === 'sent' || d.deliveryStatus === 'pending').length})
              </button>
              <button
                onClick={() => setMaterialFilter('revision')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  materialFilter === 'revision' ? "bg-rose-500 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                )}
              >
                Ajustes Solicitados ({allDeliverables.filter(d => d.deliveryStatus === 'revision').length})
              </button>
              <button
                onClick={() => setMaterialFilter('approved')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  materialFilter === 'approved' ? "bg-emerald-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                )}
              >
                Aprovados ({allDeliverables.filter(d => d.deliveryStatus === 'approved').length})
              </button>
            </div>
          </div>

          {/* Deliverables Table / List */}
          {filteredDeliverables.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 space-y-3">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mx-auto">
                <Layers size={24} />
              </div>
              <h3 className="text-base font-bold text-slate-800">Nenhum material encontrado</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Assim que os criadores submeterem seus roteiros e vídeos para aprovação nas campanhas ativas, eles aparecerão aqui para revisão.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Criador</th>
                      <th className="py-3.5 px-4">Perfil</th>
                      <th className="py-3.5 px-4">Tipo</th>
                      <th className="py-3.5 px-4">Material (Formato)</th>
                      <th className="py-3.5 px-4">Plataforma</th>
                      <th className="py-3.5 px-4">Campanha</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Avaliar / Expandir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredDeliverables.map((item) => {
                      const creator = creatorsMap[item.creatorId];
                      const isExpanded = expandedDeliverableId === item.id;
                      const format = getFormatBadge(item.deliveryType);
                      const platform = getPlatformBadge(item.deliveryType);
                      const isScriptOnly = item.content?.script && !item.content?.videoUrl;
                      const hasVideo = !!item.content?.videoUrl;

                      return (
                        <React.Fragment key={item.id}>
                          <tr className={cn("hover:bg-slate-50/70 transition-colors", isExpanded && "bg-indigo-50/30")}>
                            {/* Criador */}
                            <td className="py-4 px-4 font-bold text-slate-900">
                              <div className="flex items-center gap-3">
                                <UserAvatar
                                  src={creator?.photoUrl}
                                  name={creator?.artisticName || creator?.fullName || 'Criador'}
                                  size="custom"
                                  shape="circle"
                                  className="w-9 h-9 border border-slate-200 shadow-xs"
                                  textClassName="text-xs"
                                />
                                <div>
                                  <span className="block font-bold text-slate-900">{creator?.artisticName || creator?.fullName || 'Criador'}</span>
                                  <span className="text-[10px] text-slate-400 font-normal">{creator?.fullName || ''}</span>
                                </div>
                              </div>
                            </td>

                            {/* Perfil */}
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-1.5">
                                <Link 
                                  to={`/creators/${item.creatorId}`}
                                  target="_blank"
                                  className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-1"
                                >
                                  @{creator?.artisticName || 'perfil'} <ExternalLink size={11} />
                                </Link>
                              </div>
                            </td>

                            {/* Tipo: Roteiro / Vídeo */}
                            <td className="py-4 px-4">
                              {hasVideo ? (
                                <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                                  <Video size={12} /> Vídeo
                                </span>
                              ) : isScriptOnly ? (
                                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                                  <FileText size={12} /> Roteiro
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                                  Pendente
                                </span>
                              )}
                            </td>

                            {/* Material (Formato) */}
                            <td className="py-4 px-4">
                              <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border", format.color)}>
                                <format.icon size={13} /> {item.deliveryType || 'Material'}
                              </span>
                            </td>

                            {/* Plataforma */}
                            <td className="py-4 px-4">
                              <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border", platform.color)}>
                                {platform.name}
                              </span>
                            </td>

                            {/* Campanha */}
                            <td className="py-4 px-4">
                              <div>
                                <Link to={`/campaigns/${item.campaignId}`} className="font-bold text-slate-800 hover:text-brand-primary hover:underline block truncate max-w-[160px]">
                                  {item.campaignName}
                                </Link>
                                <span className="text-[10px] text-slate-400">{item.companyName}</span>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-4 px-4">
                              <span className={cn(
                                "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                                item.deliveryStatus === 'approved' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                item.deliveryStatus === 'revision' ? "bg-rose-50 text-rose-700 border-rose-200" :
                                item.deliveryStatus === 'sent' ? "bg-amber-50 text-amber-700 border-amber-200" :
                                item.deliveryStatus === 'published' ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                                "bg-slate-100 text-slate-600 border-slate-200"
                              )}>
                                {item.deliveryStatus === 'approved' ? '● Aprovado' :
                                 item.deliveryStatus === 'revision' ? '● Ajustes Solicitados' :
                                 item.deliveryStatus === 'sent' ? '● Aguardando Avaliação' :
                                 item.deliveryStatus === 'published' ? '● Publicado' : '● Pendente'}
                              </span>
                            </td>

                            {/* Botão Expandir */}
                            <td className="py-4 px-4 text-right">
                              <button
                                onClick={() => setExpandedDeliverableId(isExpanded ? null : item.id)}
                                className={cn(
                                  "px-3 py-1.5 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer",
                                  isExpanded 
                                    ? "bg-slate-800 text-white" 
                                    : "bg-indigo-50 text-brand-primary hover:bg-indigo-100 border border-indigo-100"
                                )}
                              >
                                {isExpanded ? (
                                  <>Fechar <ChevronUp size={14} /></>
                                ) : (
                                  <>Expandir Material <ChevronDown size={14} /></>
                                )}
                              </button>
                            </td>
                          </tr>

                          {/* INLINE EXPANDABLE DETAILS */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={8} className="p-0 bg-slate-50/70 border-b border-slate-200">
                                <motion.div 
                                  initial={{ opacity: 0, height: 0 }} 
                                  animate={{ opacity: 1, height: 'auto' }} 
                                  exit={{ opacity: 0, height: 0 }}
                                  className="p-6 space-y-6"
                                >
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Column 1: Script & Content Material */}
                                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                        <div className="flex items-center gap-2">
                                          <FileText size={16} className="text-brand-primary" />
                                          <h4 className="font-bold text-slate-900 text-sm">Roteiro / Ideia Central</h4>
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase">Texto Submetido</span>
                                      </div>

                                      {item.content?.script ? (
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs text-slate-750 font-medium whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                                          {item.content.script}
                                        </div>
                                      ) : (
                                        <p className="text-xs text-slate-400 italic py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                                          Nenhum texto de roteiro submetido pelo criador ainda.
                                        </p>
                                      )}

                                      {item.notes && (
                                        <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-100 text-xs text-amber-900">
                                          <span className="font-bold block mb-0.5">Observações do Criador:</span>
                                          {item.notes}
                                        </div>
                                      )}
                                    </div>

                                    {/* Column 2: Video / Media Material & Links */}
                                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                        <div className="flex items-center gap-2">
                                          <Video size={16} className="text-red-500" />
                                          <h4 className="font-bold text-slate-900 text-sm">Mídia / Gravação do Vídeo</h4>
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase">Arquivo / Link</span>
                                      </div>

                                      {item.content?.videoUrl ? (
                                        <div className="space-y-3">
                                          <div className="p-3 bg-red-50/50 rounded-xl border border-red-100 flex items-center justify-between">
                                            <div className="flex items-center gap-2.5 truncate">
                                              <Video size={18} className="text-red-600 shrink-0" />
                                              <span className="text-xs font-bold text-slate-800 truncate">{item.content.videoUrl}</span>
                                            </div>
                                            <a 
                                              href={item.content.videoUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors shrink-0 flex items-center gap-1"
                                            >
                                              Abrir Vídeo <ExternalLink size={12} />
                                            </a>
                                          </div>

                                          {item.content.publishedLink && (
                                            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                                              <div className="flex items-center gap-2 truncate">
                                                <Sparkles size={16} className="text-emerald-600 shrink-0" />
                                                <span className="text-xs font-bold text-emerald-900 truncate">Post Publicado Oficial</span>
                                              </div>
                                              <a 
                                                href={item.content.publishedLink}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
                                              >
                                                Ver Publicação ↗
                                              </a>
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <p className="text-xs text-slate-400 italic py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                                          Nenhum link de gravação ou vídeo enviado ainda.
                                        </p>
                                      )}

                                      {/* Previous revision history */}
                                      {item.revisionDetails && (
                                        <div className="bg-rose-50 p-3 rounded-xl border border-rose-100 text-xs text-rose-900">
                                          <span className="font-bold block mb-0.5 flex items-center gap-1">
                                            <AlertTriangle size={12} className="text-rose-600" /> Último Ajuste Solicitado:
                                          </span>
                                          {item.revisionDetails}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Approval / Adjustment Decision Bar */}
                                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                    <div className="flex items-center justify-between">
                                      <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                        <MessageSquare size={16} className="text-brand-primary" />
                                        Decisão da Agência: Aprovar ou Solicitar Ajuste
                                      </h4>
                                      <span className="text-xs text-slate-400">
                                        O criador receberá notificações automáticas em tempo real
                                      </span>
                                    </div>

                                    <div className="flex flex-col sm:flex-row gap-3 items-start">
                                      <div className="flex-1 w-full">
                                        <textarea
                                          value={revisionFeedback[item.id] ?? (item.revisionDetails || '')}
                                          onChange={(e) => setRevisionFeedback(prev => ({ ...prev, [item.id]: e.target.value }))}
                                          placeholder="Digite aqui as orientações de ajustes (ex: regravar take final mostrando o logo, acelerar introdução, etc)..."
                                          className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 outline-none focus:border-brand-primary h-20 resize-none bg-slate-50 focus:bg-white transition-all"
                                        />
                                      </div>

                                      <div className="flex sm:flex-col gap-2 w-full sm:w-48 shrink-0">
                                        <button
                                          onClick={() => handleRequestRevision(item.campaignId, item.id, item.creatorId)}
                                          disabled={updatingId === item.id}
                                          className="flex-1 py-2.5 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                        >
                                          <AlertTriangle size={14} /> Solicitar Ajustes
                                        </button>

                                        <button
                                          onClick={() => handleApproveDeliverable(item.campaignId, item.id, item.creatorId)}
                                          disabled={updatingId === item.id}
                                          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-100 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                        >
                                          <Check size={14} /> Aprovar Material
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Criar Nova Campanha */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] overflow-y-auto p-3 sm:p-4 flex items-center justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={resetCreationModal} />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative w-full max-w-2xl bg-white rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto z-10 border border-slate-200">
              
              {/* Modal Header */}
              <div className="p-5 sm:p-6 border-b border-[#E2E8F0] flex items-center justify-between shrink-0 bg-white">
                <div>
                  <h2 className="text-xl font-black text-[#0F172A]">Criar Nova Campanha</h2>
                  <p className="text-xs text-[#64748B] mt-0.5">Defina os dados gerais, entregas exigidas por criador e o briefing criativo.</p>
                </div>
                <button type="button" onClick={resetCreationModal} className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer rounded-lg hover:bg-slate-100 transition-colors">✕</button>
              </div>

              {/* Navigation Tabs inside Modal */}
              <div className="flex border-b border-slate-200 bg-slate-50/70 px-6 shrink-0 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalActiveTab('geral')}
                  className={cn(
                    "px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 cursor-pointer",
                    modalActiveTab === 'geral'
                      ? "bg-white text-brand-primary border-brand-primary shadow-xs"
                      : "text-slate-500 border-transparent hover:text-slate-800"
                  )}
                >
                  <Megaphone size={14} /> 1. Dados Gerais
                </button>
                <button
                  type="button"
                  onClick={() => setModalActiveTab('entregas')}
                  className={cn(
                    "px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 cursor-pointer",
                    modalActiveTab === 'entregas'
                      ? "bg-white text-brand-primary border-brand-primary shadow-xs"
                      : "text-slate-500 border-transparent hover:text-slate-800"
                  )}
                >
                  <Package size={14} /> 2. Entregas por Criador
                  {(modalDelReels > 0 || modalDelStories > 0 || modalDelTikTok > 0 || modalDelUgc > 0 || modalDelPosts > 0 || modalDelYoutube > 0) && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setModalActiveTab('briefing')}
                  className={cn(
                    "px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-1.5 cursor-pointer",
                    modalActiveTab === 'briefing'
                      ? "bg-white text-brand-primary border-brand-primary shadow-xs"
                      : "text-slate-500 border-transparent hover:text-slate-800"
                  )}
                >
                  <FileText size={14} /> 3. Briefing Criativo
                </button>
              </div>

              <form className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-5" onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                
                const calculatedSummary = modalDelSummary.trim() || formatDeliverablesSummary({
                  reels: modalDelReels,
                  stories: modalDelStories,
                  tiktok: modalDelTikTok,
                  ugc: modalDelUgc,
                  posts: modalDelPosts,
                  youtube: modalDelYoutube,
                }) || 'Entregas a combinar';

                await addDoc(collection(db, 'campaigns'), {
                  name: formData.get('name'),
                  companyId: formData.get('companyId'),
                  objective: formData.get('objective') || '',
                  startDate: formData.get('startDate'),
                  endDate: formData.get('endDate'),
                  totalBudget: Number(formData.get('totalBudget')) || 0,
                  imageUrl: modalImageUrl || '',
                  creatorCache: Number(formData.get('creatorCache')) || 0,
                  isSecret: formData.get('isSecret') === 'on',
                  isDirectContract: formData.get('isDirectContract') === 'on',
                  isBarter: modalIsBarter,
                  barterDetails: modalIsBarter ? (formData.get('barterDetails') as string) || '' : '',
                  status: 'briefing',
                  approvalFlow: modalApprovalFlow || 'script_and_video',
                  createdAt: serverTimestamp(),
                  deliverablesPerCreator: {
                    reels: Number(modalDelReels) || 0,
                    stories: Number(modalDelStories) || 0,
                    tiktok: Number(modalDelTikTok) || 0,
                    ugc: Number(modalDelUgc) || 0,
                    posts: Number(modalDelPosts) || 0,
                    youtube: Number(modalDelYoutube) || 0,
                    summary: calculatedSummary,
                    deadlineDays: Number(modalDelDeadlineDays) || 5,
                    guidelines: (formData.get('delGuidelines') as string) || modalDelGuidelines || ''
                  },
                  briefing: {
                    product: (formData.get('briefingProduct') as string) || '',
                    keyMessage: (formData.get('briefingKeyMessage') as string) || '',
                    mustHave: (formData.get('briefingMustHave') as string) || '',
                    donts: (formData.get('briefingDonts') as string) || '',
                    cta: (formData.get('briefingCta') as string) || '',
                    hashtags: (formData.get('briefingHashtags') as string) || '',
                    link: (formData.get('briefingLink') as string) || '',
                    coupon: (formData.get('briefingCoupon') as string) || '',
                    attachments: []
                  }
                });
                resetCreationModal();
              }}>
                
                {/* TAB 1: DADOS GERAIS */}
                {modalActiveTab === 'geral' && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Nome do Projeto *</label>
                      <input name="name" required placeholder="Ex: Lançamento Coleção Outono/Inverno" className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm font-medium" />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Cliente Selecionado *</label>
                      <select name="companyId" required className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm bg-white font-medium">
                        <option value="">Selecione um cliente</option>
                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>

                    {/* Campaign Image Upload Standard Form Component */}
                    <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                      <CampaignImageUpload
                        value={modalImageUrl}
                        onChange={setModalImageUrl}
                        label="Imagem da Campanha (Formato Padrão 16:9)"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Data de Início *</label>
                        <input name="startDate" type="date" required className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm font-semibold" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Data de Término *</label>
                        <input name="endDate" type="date" required className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm font-semibold" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center">
                          <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Verba Total (R$)</label>
                          {modalIsBarter && <span className="text-[10px] text-amber-600 font-bold">Opcional</span>}
                        </div>
                        <input name="totalBudget" type="number" required={!modalIsBarter} placeholder="0.00" className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm font-semibold" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Cachê Médio por Criador (R$)</label>
                        <input name="creatorCache" type="number" placeholder="Ex: 500" className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm font-semibold" />
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                      <input 
                        type="checkbox" 
                        name="isSecret" 
                        id="isSecret" 
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                      />
                      <div className="flex flex-col gap-1">
                        <label htmlFor="isSecret" className="text-xs font-bold text-slate-800 cursor-pointer flex items-center gap-1.5">
                          <Lock size={12} className="text-rose-500" /> Campanha Secreta / Privada
                        </label>
                        <span className="text-[10px] text-[#64748B] leading-relaxed">
                          Ativando esta opção, a campanha não ficará visível na vitrine pública para criadores. Apenas criadores convidados diretamente visualizarão o projeto.
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                      <input 
                        type="checkbox" 
                        name="isDirectContract" 
                        id="isDirectContract" 
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" 
                      />
                      <div className="flex flex-col gap-1">
                        <label htmlFor="isDirectContract" className="text-xs font-bold text-slate-800 cursor-pointer flex items-center gap-1.5">
                          <Handshake size={12} className="text-emerald-600" /> Contrato Direto (Ocultar Valores)
                        </label>
                        <span className="text-[10px] text-[#64748B] leading-relaxed">
                          Se ativado, os valores numéricos serão exibidos como "Contrato Direto" na vitrine.
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 p-4 bg-amber-50/40 border border-amber-100 rounded-xl">
                      <div className="flex items-start gap-3">
                        <input 
                          type="checkbox" 
                          name="isBarter" 
                          id="isBarter" 
                          checked={modalIsBarter}
                          onChange={(e) => setModalIsBarter(e.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer" 
                        />
                        <div className="flex flex-col gap-1">
                          <label htmlFor="isBarter" className="text-xs font-bold text-slate-800 cursor-pointer flex items-center gap-1.5">
                            <Gift size={12} className="text-amber-500" /> Campanha com Permuta
                          </label>
                          <span className="text-[10px] text-[#64748B] leading-relaxed">
                            Ative se a remuneração dos criadores for em envio de produtos ou serviços.
                          </span>
                        </div>
                      </div>
                      {modalIsBarter && (
                        <div className="flex flex-col gap-1.5 mt-1 animate-fadeIn">
                          <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Detalhes da Permuta (Produtos fornecidos)</label>
                          <textarea 
                            name="barterDetails" 
                            required={modalIsBarter}
                            placeholder="Ex: Envio de 1 kit de produtos no valor de R$300 + cupom exclusivo..."
                            className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-xs h-20 resize-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 2: ENTREGAS POR CRIADOR */}
                {modalActiveTab === 'entregas' && (
                  <div className="space-y-5 animate-fadeIn">
                    <div className="bg-indigo-50/60 border border-indigo-100 p-4 rounded-xl">
                      <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs mb-1">
                        <Package size={16} className="text-brand-primary" />
                        Defina o Pacote de Conteúdo Exigido por Criador
                      </div>
                      <p className="text-[11px] text-indigo-700/80 leading-relaxed">
                        Especifique a quantidade exata de materiais e o fluxo de validação e aprovação entre a marca e o influenciador.
                      </p>
                    </div>

                    {/* Approval Flow Selector */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
                        Fluxo de Aprovação da Campanha (Decisão da Empresa) *
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <button
                          type="button"
                          onClick={() => setModalApprovalFlow('script_and_video')}
                          className={cn(
                            "p-3.5 rounded-2xl border text-left flex flex-col justify-between gap-2 transition-all cursor-pointer",
                            modalApprovalFlow === 'script_and_video'
                              ? "bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-500/20 text-indigo-950"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black flex items-center gap-1.5">
                              <FileText size={14} className={modalApprovalFlow === 'script_and_video' ? "text-indigo-600" : "text-slate-400"} />
                              Roteiro + Vídeo
                            </span>
                            <span className={cn(
                              "w-4 h-4 rounded-full border flex items-center justify-center text-[10px]",
                              modalApprovalFlow === 'script_and_video' ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"
                            )}>
                              {modalApprovalFlow === 'script_and_video' ? '✓' : ''}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-snug">
                            1º Aprovar Roteiro antes de gravar, e 2º Aprovar Vídeo Final gravado antes de postar.
                          </p>
                          <span className="text-[9px] font-bold text-indigo-600 bg-white/80 px-2 py-0.5 rounded-md border border-indigo-100 self-start">
                            Mais Seguro (Recomendado)
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setModalApprovalFlow('video_only')}
                          className={cn(
                            "p-3.5 rounded-2xl border text-left flex flex-col justify-between gap-2 transition-all cursor-pointer",
                            modalApprovalFlow === 'video_only'
                              ? "bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-500/20 text-indigo-950"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black flex items-center gap-1.5">
                              <Video size={14} className={modalApprovalFlow === 'video_only' ? "text-indigo-600" : "text-slate-400"} />
                              Apenas Vídeo Final
                            </span>
                            <span className={cn(
                              "w-4 h-4 rounded-full border flex items-center justify-center text-[10px]",
                              modalApprovalFlow === 'video_only' ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"
                            )}>
                              {modalApprovalFlow === 'video_only' ? '✓' : ''}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-snug">
                            O criador grava diretamente conforme o briefing e envia o vídeo pronto para aprovação.
                          </p>
                          <span className="text-[9px] font-bold text-slate-600 bg-white/80 px-2 py-0.5 rounded-md border border-slate-200 self-start">
                            Fluxo Rápido
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setModalApprovalFlow('script_only')}
                          className={cn(
                            "p-3.5 rounded-2xl border text-left flex flex-col justify-between gap-2 transition-all cursor-pointer",
                            modalApprovalFlow === 'script_only'
                              ? "bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-500/20 text-indigo-950"
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black flex items-center gap-1.5">
                              <FileText size={14} className={modalApprovalFlow === 'script_only' ? "text-indigo-600" : "text-slate-400"} />
                              Apenas Roteiro
                            </span>
                            <span className={cn(
                              "w-4 h-4 rounded-full border flex items-center justify-center text-[10px]",
                              modalApprovalFlow === 'script_only' ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"
                            )}>
                              {modalApprovalFlow === 'script_only' ? '✓' : ''}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-snug">
                            Campanha focada em cocriação e redação de roteiros para aprovação comercial.
                          </p>
                          <span className="text-[9px] font-bold text-slate-600 bg-white/80 px-2 py-0.5 rounded-md border border-slate-200 self-start">
                            Redação
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Format Quantity Pickers */}
                    <div>
                      <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block mb-2.5">
                        Quantidade de Conteúdos por Formato
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {/* Reels */}
                        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                              <Clapperboard size={16} />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-slate-800 block">Reels</span>
                              <span className="text-[10px] text-slate-400">Vídeo no feed</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between bg-slate-50 rounded-lg p-1">
                            <button
                              type="button"
                              onClick={() => setModalDelReels(prev => Math.max(0, prev - 1))}
                              className="w-7 h-7 rounded-md bg-white border border-slate-200 text-slate-700 font-black hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
                            >-</button>
                            <span className="text-sm font-black text-slate-900">{modalDelReels}</span>
                            <button
                              type="button"
                              onClick={() => setModalDelReels(prev => prev + 1)}
                              className="w-7 h-7 rounded-md bg-white border border-slate-200 text-slate-700 font-black hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
                            >+</button>
                          </div>
                        </div>

                        {/* Stories */}
                        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                              <Instagram size={16} />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-slate-800 block">Stories</span>
                              <span className="text-[10px] text-slate-400">Sequência com link</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between bg-slate-50 rounded-lg p-1">
                            <button
                              type="button"
                              onClick={() => setModalDelStories(prev => Math.max(0, prev - 1))}
                              className="w-7 h-7 rounded-md bg-white border border-slate-200 text-slate-700 font-black hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
                            >-</button>
                            <span className="text-sm font-black text-slate-900">{modalDelStories}</span>
                            <button
                              type="button"
                              onClick={() => setModalDelStories(prev => prev + 1)}
                              className="w-7 h-7 rounded-md bg-white border border-slate-200 text-slate-700 font-black hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
                            >+</button>
                          </div>
                        </div>

                        {/* TikTok */}
                        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
                              <Clapperboard size={16} />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-slate-800 block">TikTok</span>
                              <span className="text-[10px] text-slate-400">Vídeo nativo</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between bg-slate-50 rounded-lg p-1">
                            <button
                              type="button"
                              onClick={() => setModalDelTikTok(prev => Math.max(0, prev - 1))}
                              className="w-7 h-7 rounded-md bg-white border border-slate-200 text-slate-700 font-black hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
                            >-</button>
                            <span className="text-sm font-black text-slate-900">{modalDelTikTok}</span>
                            <button
                              type="button"
                              onClick={() => setModalDelTikTok(prev => prev + 1)}
                              className="w-7 h-7 rounded-md bg-white border border-slate-200 text-slate-700 font-black hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
                            >+</button>
                          </div>
                        </div>

                        {/* UGC */}
                        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-teal-50 text-teal-600 rounded-lg">
                              <Camera size={16} />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-slate-800 block">Vídeo UGC</span>
                              <span className="text-[10px] text-slate-400">Uso para anúncios</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between bg-slate-50 rounded-lg p-1">
                            <button
                              type="button"
                              onClick={() => setModalDelUgc(prev => Math.max(0, prev - 1))}
                              className="w-7 h-7 rounded-md bg-white border border-slate-200 text-slate-700 font-black hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
                            >-</button>
                            <span className="text-sm font-black text-slate-900">{modalDelUgc}</span>
                            <button
                              type="button"
                              onClick={() => setModalDelUgc(prev => prev + 1)}
                              className="w-7 h-7 rounded-md bg-white border border-slate-200 text-slate-700 font-black hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
                            >+</button>
                          </div>
                        </div>

                        {/* Feed / Carrossel */}
                        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                              <Layers size={16} />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-slate-800 block">Feed / Post</span>
                              <span className="text-[10px] text-slate-400">Foto ou carrossel</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between bg-slate-50 rounded-lg p-1">
                            <button
                              type="button"
                              onClick={() => setModalDelPosts(prev => Math.max(0, prev - 1))}
                              className="w-7 h-7 rounded-md bg-white border border-slate-200 text-slate-700 font-black hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
                            >-</button>
                            <span className="text-sm font-black text-slate-900">{modalDelPosts}</span>
                            <button
                              type="button"
                              onClick={() => setModalDelPosts(prev => prev + 1)}
                              className="w-7 h-7 rounded-md bg-white border border-slate-200 text-slate-700 font-black hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
                            >+</button>
                          </div>
                        </div>

                        {/* YouTube */}
                        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-red-50 text-red-600 rounded-lg">
                              <Video size={16} />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-slate-800 block">YouTube</span>
                              <span className="text-[10px] text-slate-400">Vídeo dedicado/integração</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between bg-slate-50 rounded-lg p-1">
                            <button
                              type="button"
                              onClick={() => setModalDelYoutube(prev => Math.max(0, prev - 1))}
                              className="w-7 h-7 rounded-md bg-white border border-slate-200 text-slate-700 font-black hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
                            >-</button>
                            <span className="text-sm font-black text-slate-900">{modalDelYoutube}</span>
                            <button
                              type="button"
                              onClick={() => setModalDelYoutube(prev => prev + 1)}
                              className="w-7 h-7 rounded-md bg-white border border-slate-200 text-slate-700 font-black hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
                            >+</button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Resumo das Entregas */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                          Resumo Descritivo das Entregas
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const auto = formatDeliverablesSummary({
                              reels: modalDelReels,
                              stories: modalDelStories,
                              tiktok: modalDelTikTok,
                              ugc: modalDelUgc,
                              posts: modalDelPosts,
                              youtube: modalDelYoutube
                            });
                            setModalDelSummary(auto);
                          }}
                          className="text-[10px] text-brand-primary font-bold hover:underline cursor-pointer"
                        >
                          Gerar automaticamente pelos seletores
                        </button>
                      </div>
                      <input
                        value={modalDelSummary}
                        onChange={(e) => setModalDelSummary(e.target.value)}
                        placeholder={formatDeliverablesSummary({
                          reels: modalDelReels,
                          stories: modalDelStories,
                          tiktok: modalDelTikTok,
                          ugc: modalDelUgc,
                          posts: modalDelPosts,
                          youtube: modalDelYoutube
                        }) || "Ex: 1 Reel no feed + 3 Stories com link do produto"}
                        className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm font-semibold text-slate-800"
                      />
                    </div>

                    {/* Prazo de Envio */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                        Prazo de Entrega do Material (Dias úteis após recebimento do produto/briefing)
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min="1"
                          max="60"
                          value={modalDelDeadlineDays}
                          onChange={(e) => setModalDelDeadlineDays(Number(e.target.value) || 5)}
                          className="w-32 px-4 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm font-bold text-slate-800"
                        />
                        <span className="text-xs text-slate-500 font-medium">dias úteis para enviar o material para aprovação</span>
                      </div>
                    </div>

                    {/* Diretrizes de Entrega */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                        Requisitos Técnicos e Diretrizes de Entrega
                      </label>
                      <textarea
                        name="delGuidelines"
                        value={modalDelGuidelines}
                        onChange={(e) => setModalDelGuidelines(e.target.value)}
                        placeholder="Ex: Gravação na vertical 9:16, iluminação natural, mostrar o produto em uso nos primeiros 3 segundos, áudio limpo, marcação @perfil e link nos stories..."
                        className="w-full px-3.5 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-xs h-24 resize-none text-slate-700"
                      />
                    </div>
                  </div>
                )}

                {/* TAB 3: BRIEFING CRIATIVO */}
                {modalActiveTab === 'briefing' && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                      <div className="flex items-center gap-2 text-slate-900 font-bold text-xs mb-1">
                        <FileText size={16} className="text-brand-primary" />
                        Diretrizes Criativas para os Criadores
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Você também pode preencher ou complementar o briefing detalhado posteriormente na tela da campanha.
                      </p>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Produto / Foco da Campanha</label>
                      <input name="briefingProduct" placeholder="Ex: Nova Linha Sérum Hidratante Anti-Idade 30ml" className="w-full px-4 py-2 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-xs font-medium" />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Mensagem Principal (Key Message)</label>
                      <textarea name="briefingKeyMessage" placeholder="Ex: Hidratação profunda sem oleosidade com resultados visíveis em 7 dias..." className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-xs h-18 resize-none" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">O Que DEVE Ter (Must Haves)</label>
                        <textarea name="briefingMustHave" placeholder="Ex: Mostrar aplicação na pele limpa, citar textura leve..." className="w-full px-3 py-2 rounded-lg border border-emerald-200 outline-none focus:border-emerald-500 text-xs h-20 resize-none bg-emerald-50/20" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">O Que NÃO Pode (Don'ts)</label>
                        <textarea name="briefingDonts" placeholder="Ex: Não usar filtros que alterem a cor da pele, não citar concorrentes..." className="w-full px-3 py-2 rounded-lg border border-rose-200 outline-none focus:border-rose-500 text-xs h-20 resize-none bg-rose-50/20" />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-brand-primary uppercase tracking-wider">Chamada para Ação (CTA)</label>
                      <input name="briefingCta" placeholder="Ex: Use meu cupom no link dos stories e garanta 15% OFF!" className="w-full px-4 py-2 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-xs font-medium" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Cupom de Desconto</label>
                        <input name="briefingCoupon" placeholder="Ex: CREATOR15" className="w-full px-4 py-2 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-xs font-medium" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Hashtags Oficiais</label>
                        <input name="briefingHashtags" placeholder="Ex: #PelePerfeita #CuidadosDiarios" className="w-full px-4 py-2 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-xs font-medium" />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Link de Apoio / E-commerce</label>
                      <input name="briefingLink" placeholder="https://..." className="w-full px-4 py-2 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-xs font-medium" />
                    </div>
                  </div>
                )}
                
                {/* Modal Footer */}
                <div className="pt-4 border-t border-[#E2E8F0] flex items-center justify-between gap-3 shrink-0 bg-white">
                  <button 
                    type="button" 
                    onClick={resetCreationModal} 
                    className="px-5 py-2.5 text-sm font-bold text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <div className="flex items-center gap-2">
                    {modalActiveTab === 'geral' && (
                      <button
                        type="button"
                        onClick={() => setModalActiveTab('entregas')}
                        className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        Próximo: Entregas →
                      </button>
                    )}
                    {modalActiveTab === 'entregas' && (
                      <button
                        type="button"
                        onClick={() => setModalActiveTab('briefing')}
                        className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        Próximo: Briefing →
                      </button>
                    )}
                    <button 
                      type="submit" 
                      className="px-6 py-2.5 bg-brand-primary text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-600 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Sparkles size={16} /> Salvar e Criar Campanha
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Database Reset Modal for Campaigns */}
      <DatabaseResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        initialScope="campaigns"
      />
    </div>
  );
}
