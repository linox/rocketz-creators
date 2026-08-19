import { useState, useEffect, ChangeEvent } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  collection, 
  getDocs, 
  getDoc,
  doc, 
  query, 
  where, 
  onSnapshot,
  updateDoc
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Company, Campaign, CampaignCreator, Creator, RecurringContract, ContentPlanningItem, ContentPlanningStatus, ContentType } from '../types';
import { CONTENT_TYPE_CONFIG } from './RecurringContracts';
import { 
  Building2, 
  Megaphone, 
  Users, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  Eye, 
  EyeOff,
  FileText, 
  Play, 
  ExternalLink, 
  TrendingUp, 
  Layers, 
  Calendar, 
  Lock,
  ChevronRight,
  Info,
  Heart,
  HeartOff,
  Star,
  Search,
  Sparkles,
  Filter,
  Instagram,
  Youtube,
  Globe,
  Repeat,
  Film,
  Clapperboard,
  Video,
  Radio,
  Pin,
  Newspaper,
  Mic,
  Package,
  Camera,
  X,
  CheckCircle,
  Tag,
  UploadCloud,
  AlertCircle,
  Send,
  Edit
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SubmissionMediaPreview } from '../components/SubmissionMediaPreview';
import { usePrivacy } from '../context/PrivacyContext';
import { UserAvatar } from '../components/UserAvatar';
import { CompanyOverviewSection } from '../components/CompanyOverviewSection';
import { CompanyLogoUpload } from '../components/CompanyLogoUpload';

const cn = (...classes: (string | boolean | undefined | null)[]) => classes.filter(Boolean).join(' ');

export default function CompanyDashboard() {
  const { hideValues, toggleHideValues, formatCurrency } = usePrivacy();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryCompanyId = searchParams.get('companyId') || '';

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(queryCompanyId);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  
  // Maps campaign ID to its creator participations
  const [campaignCreators, setCampaignCreators] = useState<Record<string, CampaignCreator[]>>({});
  const [creators, setCreators] = useState<Record<string, Creator>>({});
  const [recurringContracts, setRecurringContracts] = useState<RecurringContract[]>([]);
  const [contentPlanningItems, setContentPlanningItems] = useState<ContentPlanningItem[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [activeTab, setActiveTab] = useState<'creators' | 'briefing' | 'results'>('creators');

  // Favorite creators & Dashboard tabs
  const [dashboardTab, setDashboardTab] = useState<'overview' | 'campaigns' | 'recurring' | 'favorites'>('overview');
  const [favCreatorSearch, setFavCreatorSearch] = useState('');
  const [favCreatorCategory, setFavCreatorCategory] = useState('all');
  const [favFilterMode, setFavFilterMode] = useState<'only_favorites' | 'browse_all'>('only_favorites');

  // Media preview modal state
  const [previewMedia, setPreviewMedia] = useState<{
    url: string;
    type: 'video' | 'script';
    creatorName: string;
    scriptText?: string;
  } | null>(null);

  // Edit Company & Logo Modal State
  const [isEditCompanyModalOpen, setIsEditCompanyModalOpen] = useState(false);
  const [editCompanyLogo, setEditCompanyLogo] = useState('');
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editCompanySegment, setEditCompanySegment] = useState('');
  const [editCompanyEmail, setEditCompanyEmail] = useState('');
  const [editCompanyWhatsapp, setEditCompanyWhatsapp] = useState('');
  const [isSavingCompany, setIsSavingCompany] = useState(false);

  const [isCompanyUser, setIsCompanyUser] = useState(false);
  const [currentUserCompanyId, setCurrentUserCompanyId] = useState<string | null>(null);

  // Derived selectedCompany object
  const selectedCompany = companies.find(c => c.id === selectedCompanyId) || null;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          let snap = await getDoc(doc(db, 'companyUsers', user.uid));
          let companyUserData = snap.exists() ? snap.data() : null;

          if (!companyUserData && user.email) {
            const { query, where, getDocs, setDoc } = await import('firebase/firestore');
            const qComp = query(collection(db, 'companyUsers'), where('email', '==', user.email.trim().toLowerCase()));
            const qSnap = await getDocs(qComp);
            if (!qSnap.empty) {
              companyUserData = qSnap.docs[0].data();
              if (qSnap.docs[0].id !== user.uid) {
                try {
                  await setDoc(doc(db, 'companyUsers', user.uid), {
                    ...companyUserData,
                    uid: user.uid
                  }, { merge: true });
                } catch (syncErr) {
                  console.warn("Could not sync companyUser doc:", syncErr);
                }
              }
            }
          }

          if (companyUserData && companyUserData.companyId) {
            setIsCompanyUser(true);
            setCurrentUserCompanyId(companyUserData.companyId);
            setSelectedCompanyId(companyUserData.companyId);
          } else {
            setIsCompanyUser(false);
            setCurrentUserCompanyId(null);
          }
        } catch (err) {
          console.error("Error fetching company user record:", err);
          setIsCompanyUser(false);
          setCurrentUserCompanyId(null);
        }
      } else {
        setIsCompanyUser(false);
        setCurrentUserCompanyId(null);
      }
    });
    return () => unsub();
  }, []);

  // 1. Subscribe to all companies and creators in real-time (on mount only)
  useEffect(() => {
    setLoading(true);

    const unsubscribeCompanies = onSnapshot(collection(db, 'companies'), (snapshot) => {
      const companiesList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Company));
      setCompanies(companiesList);
      setLoading(false);
    }, (err) => {
      console.error("Error subscribing to companies:", err);
      setLoading(false);
    });

    const unsubscribeCreators = onSnapshot(collection(db, 'creators'), (snapshot) => {
      const creatorsMap: Record<string, Creator> = {};
      snapshot.docs.forEach(d => {
        creatorsMap[d.id] = { id: d.id, ...d.data() } as Creator;
      });
      setCreators(creatorsMap);
    }, (err) => {
      console.error("Error subscribing to creators:", err);
    });

    return () => {
      unsubscribeCompanies();
      unsubscribeCreators();
    };
  }, []);

  // Initial and reactive synchronization of selectedCompanyId
  useEffect(() => {
    if (companies.length === 0) return;

    if (currentUserCompanyId) {
      if (selectedCompanyId !== currentUserCompanyId) {
        setSelectedCompanyId(currentUserCompanyId);
      }
    } else {
      // If Admin, check if there is a companyId in the URL
      const urlCompanyId = searchParams.get('companyId');
      if (urlCompanyId && companies.some(c => c.id === urlCompanyId)) {
        if (selectedCompanyId !== urlCompanyId) {
          setSelectedCompanyId(urlCompanyId);
        }
      } else {
        // No valid companyId in URL, default to the first company
        const defaultCompanyId = companies[0].id;
        setSelectedCompanyId(defaultCompanyId);
        setSearchParams({ companyId: defaultCompanyId }, { replace: true });
      }
    }
  }, [companies, currentUserCompanyId, searchParams, setSearchParams, selectedCompanyId]);

  // 2. Load campaigns for the selected company and their creator participations
  useEffect(() => {
    if (!selectedCompanyId) return;

    const q = query(collection(db, 'campaigns'), where('companyId', '==', selectedCompanyId));
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const campaignsList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Campaign));
      // Sort by start date descending
      campaignsList.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
      setCampaigns(campaignsList);

      // Fetch creators for each campaign
      const creatorMap: Record<string, CampaignCreator[]> = {};
      
      for (const camp of campaignsList) {
        try {
          const ccSnap = await getDocs(collection(db, `campaigns/${camp.id}/creators`));
          creatorMap[camp.id] = ccSnap.docs.map(d => ({ id: d.id, ...d.data() } as CampaignCreator));
        } catch (err) {
          console.error(`Error loading creators for campaign ${camp.id}:`, err);
        }
      }

      setCampaignCreators(creatorMap);
    }, (err) => {
      console.error("Error loading campaigns snapshot:", err);
    });

    const unsubRec = onSnapshot(collection(db, 'recurringContracts'), (snapshot) => {
      const list = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as RecurringContract))
        .filter(c => c.companyId === selectedCompanyId);
      setRecurringContracts(list);
    }, (err) => console.warn("Error loading recurring contracts snapshot:", err));

    const unsubPlan = onSnapshot(collection(db, 'contentPlanning'), (snapshot) => {
      const list = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as ContentPlanningItem))
        .filter(i => i.companyId === selectedCompanyId);
      list.sort((a, b) => {
        const dateA = a.plannedDate ? new Date(a.plannedDate).getTime() : 0;
        const dateB = b.plannedDate ? new Date(b.plannedDate).getTime() : 0;
        return dateA - dateB;
      });
      setContentPlanningItems(list);
    }, (err) => console.warn("Error loading content planning snapshot:", err));

    return () => {
      unsubscribe();
      unsubRec();
      unsubPlan();
    };
  }, [selectedCompanyId]);

  // Calculate metrics for selected company
  const activeCampaigns = campaigns.filter(c => c.status === 'production' || c.status === 'briefing' || c.status === 'selection');
  const finishedCampaigns = campaigns.filter(c => c.status === 'finished');

  // Sum budgets & metrics across all company's campaigns
  let totalInvested = 0;
  let totalCreatorsInvolved = 0;
  let totalPublishedPieces = 0;
  
  // Aggregated metrics
  let totalReach = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalViews = 0;
  let totalEngagement = 0;

  campaigns.forEach(camp => {
    const ccList = campaignCreators[camp.id] || [];
    totalCreatorsInvolved += ccList.length;

    ccList.forEach(cc => {
      if (!camp.isDirectContract && !camp.isBarter) {
        totalInvested += cc.amount || 0;
      }
      if (cc.deliveryStatus === 'published' || cc.deliveryStatus === 'approved') {
        totalPublishedPieces++;
      }
      
      // Accumulate performance metrics
      if (cc.signature?.metrics) {
        totalReach += cc.signature.metrics.reach || 0;
        totalImpressions += cc.signature.metrics.impressions || 0;
        totalClicks += cc.signature.metrics.clicks || 0;
        totalViews += cc.signature.metrics.views || 0;
        totalEngagement += cc.signature.metrics.engagement || 0;
      }
    });
  });

  const handleCompanyChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedCompanyId(newId);
    setSelectedCampaign(null); // Reset detail panel
    setSearchParams({ companyId: newId }, { replace: true });
  };

  const toggleFavoriteCreator = async (creatorId: string) => {
    if (!selectedCompany) return;
    const currentFavs = selectedCompany.favoriteCreators || [];
    let newFavs: string[];
    if (currentFavs.includes(creatorId)) {
      newFavs = currentFavs.filter(id => id !== creatorId);
    } else {
      newFavs = [...currentFavs, creatorId];
    }
    
    try {
      await updateDoc(doc(db, 'companies', selectedCompany.id), {
        favoriteCreators: newFavs
      });
    } catch (err) {
      console.error("Error toggling favorite creator:", err);
    }
  };

  const getStatusBadge = (status: Campaign['status']) => {
    switch (status) {
      case 'briefing':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider">Ajustes Briefing</span>;
      case 'selection':
        return <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider">Casting / Seleção</span>;
      case 'production':
        return <span className="bg-sky-50 text-sky-700 border border-sky-200 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider">Em Produção</span>;
      case 'finished':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider">Concluída</span>;
      default:
        return <span className="bg-slate-50 text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider">{status}</span>;
    }
  };

  const getDeliveryStatusBadge = (status: CampaignCreator['deliveryStatus']) => {
    switch (status) {
      case 'pending':
        return <span className="bg-slate-50 text-slate-600 border border-slate-200 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">Pendente</span>;
      case 'revision':
        return <span className="bg-rose-50 text-rose-600 border border-rose-200 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">Em Revisão</span>;
      case 'approved':
        return <span className="bg-indigo-50 text-indigo-600 border border-indigo-200 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">Aprovado</span>;
      case 'published':
        return <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">Publicado</span>;
      default:
        return <span className="bg-slate-50 text-slate-600 border border-slate-200 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">{status}</span>;
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className="flex flex-col gap-8 pb-16">
      
      {/* Header & Company Switcher */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-md">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
            Painel do Cliente / Marca
          </span>
          <div className="flex items-center gap-3 mt-3">
            <UserAvatar
              src={selectedCompany?.logo || selectedCompany?.logoUrl}
              name={selectedCompany?.name || 'Cliente'}
              size="custom"
              shape="rounded-xl"
              className="w-12 h-12 border border-slate-200 shadow-xs"
              textClassName="text-base font-black"
            />
            <h1 className="text-2xl font-extrabold text-[#0F172A] m-0">
              {selectedCompany ? selectedCompany.name : "Painel da Empresa"}
            </h1>
          </div>
          <p className="m-1 mt-1 text-[#64748B] text-[13px] leading-relaxed">
            Acompanhe o andamento de campanhas, aprove roteiros/vídeos de criadores e visualize os resultados consolidados das suas ações.
          </p>
        </div>

        {/* Impersonation Selector */}
        {!isCompanyUser && (
          <div className="flex flex-col gap-2 shrink-0">
            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Selecionar Empresa para Visualização</label>
            <div className="relative">
              <select
                value={selectedCompanyId}
                onChange={handleCompanyChange}
                className="w-full md:w-[280px] bg-slate-50 border border-slate-200 text-slate-800 text-sm font-bold rounded-lg px-4 py-2.5 outline-none focus:border-indigo-600 focus:bg-white transition-all cursor-pointer shadow-sm"
              >
                {companies.map(c => (
                  <option key={c.id} value={c.id}>
                    🏢 {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </header>

      {selectedCompany ? (
        <>
          {/* Company Status Pending / Rejected Banner */}
          {(selectedCompany.status === 'pending' || !selectedCompany.status) && (
            <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 border-2 border-amber-400/60 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-pulse">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Clock size={22} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-950 m-0">
                    {!isCompanyUser ? 'Empresa Aguardando Aprovação de Cadastro' : 'Cadastro da Empresa Sob Análise'}
                  </h4>
                  <p className="text-xs text-amber-800 m-0 mt-0.5 max-w-xl">
                    {!isCompanyUser 
                      ? 'Esta empresa solicitou cadastro pelo site e aguarda a aprovação do administrador para ter total acesso e visibilidade.' 
                      : 'O cadastro da sua empresa está sob revisão e aguarda aprovação do administrador para liberação completa do painel.'}
                  </p>
                </div>
              </div>

              {!isCompanyUser && (
                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                  <button
                    onClick={async () => {
                      try {
                        const { doc, updateDoc } = await import('firebase/firestore');
                        await updateDoc(doc(db, 'companies', selectedCompany.id), {
                          status: 'active'
                        });
                        alert(`Empresa "${selectedCompany.name}" aprovada com sucesso!`);
                      } catch (err: any) {
                        console.error(err);
                        alert("Erro ao aprovar empresa.");
                      }
                    }}
                    className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <CheckCircle2 size={16} />
                    Aprovar Empresa
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Metrics Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            
            {/* Total Invested */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                  <DollarSign size={24} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Verba Contratada</span>
                  <span className="text-xl font-black text-slate-900 mt-1">{formatCurrency(totalInvested)}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">
                    {campaigns.some(c => c.isDirectContract || c.isBarter) ? '* Exclui contratos diretos e permutas' : 'Em todas as campanhas'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleHideValues}
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
                title={hideValues ? "Mostrar valores monetários" : "Ocultar valores monetários"}
              >
                {hideValues ? <EyeOff size={18} className="text-amber-600" /> : <Eye size={18} />}
              </button>
            </div>

            {/* Total Campaigns */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                <Megaphone size={24} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Campanhas Ativas</span>
                <span className="text-xl font-black text-slate-900 mt-1">{activeCampaigns.length} <span className="text-sm font-semibold text-slate-500">ativas</span></span>
                <span className="text-[10px] text-slate-400 mt-0.5">{finishedCampaigns.length} concluídas anteriormente</span>
              </div>
            </div>

            {/* Total Creators */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                <Users size={24} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Criadores no Casting</span>
                <span className="text-xl font-black text-slate-900 mt-1">{totalCreatorsInvolved}</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Influenciadores participantes</span>
              </div>
            </div>

            {/* Delivery Progress */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                <CheckCircle2 size={24} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Entregas Publicadas</span>
                <span className="text-xl font-black text-slate-900 mt-1">
                  {totalPublishedPieces}
                  <span className="text-sm font-semibold text-slate-400"> / {totalCreatorsInvolved}</span>
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">Vídeos ou posts no ar</span>
              </div>
            </div>

          </div>

          {/* Aggregated Performance Metrics (Only show if we have any results / values) */}
          {totalImpressions > 0 && (
            <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                  <TrendingUp size={16} /> Métricas Consolidadas das Ações
                </h3>
                <p className="text-xs text-slate-400 mt-1">Soma de todo o engajamento e alcance gerado pelos criadores aprovados nas redes sociais.</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-2">
                <div className="bg-slate-800/55 p-4 rounded-xl border border-slate-700/50 flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alcance</span>
                  <span className="text-xl font-black text-white mt-1">{formatNumber(totalReach)}</span>
                </div>
                <div className="bg-slate-800/55 p-4 rounded-xl border border-slate-700/50 flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Impressões</span>
                  <span className="text-xl font-black text-white mt-1">{formatNumber(totalImpressions)}</span>
                </div>
                <div className="bg-slate-800/55 p-4 rounded-xl border border-slate-700/50 flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Visualizações</span>
                  <span className="text-xl font-black text-white mt-1">{formatNumber(totalViews)}</span>
                </div>
                <div className="bg-slate-800/55 p-4 rounded-xl border border-slate-700/50 flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cliques no Link</span>
                  <span className="text-xl font-black text-white mt-1">{formatNumber(totalClicks)}</span>
                </div>
                <div className="bg-slate-800/55 p-4 rounded-xl border border-slate-700/50 flex flex-col col-span-2 md:col-span-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Engajamento</span>
                  <span className="text-xl font-black text-indigo-400 mt-1">{formatNumber(totalEngagement)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Top-level Dashboard Tab Switcher */}
          <div className="flex border-b border-slate-200 gap-6 mt-4 flex-wrap">
            <button
              onClick={() => setDashboardTab('overview')}
              className={`pb-3 font-extrabold text-sm uppercase tracking-wider relative transition-all cursor-pointer outline-none border-none bg-transparent flex items-center gap-2 ${
                dashboardTab === 'overview' ? 'text-indigo-600 font-black' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Sparkles size={16} />
              Visão Geral Executiva
              {dashboardTab === 'overview' && (
                <motion.div layoutId="dashboardTabUnderline" className="absolute bottom-0 inset-x-0 h-0.5 bg-indigo-600" />
              )}
            </button>
            <button
              onClick={() => setDashboardTab('campaigns')}
              className={`pb-3 font-extrabold text-sm uppercase tracking-wider relative transition-all cursor-pointer outline-none border-none bg-transparent flex items-center gap-2 ${
                dashboardTab === 'campaigns' ? 'text-indigo-600 font-black' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Megaphone size={16} />
              Campanhas & Ações ({campaigns.length})
              {dashboardTab === 'campaigns' && (
                <motion.div layoutId="dashboardTabUnderline" className="absolute bottom-0 inset-x-0 h-0.5 bg-indigo-600" />
              )}
            </button>
            <button
              onClick={() => setDashboardTab('recurring')}
              className={`pb-3 font-extrabold text-sm uppercase tracking-wider relative transition-all cursor-pointer outline-none border-none bg-transparent flex items-center gap-2 ${
                dashboardTab === 'recurring' ? 'text-purple-600 font-black' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Repeat size={16} />
              Trabalhos Recorrentes & Calendário ({recurringContracts.filter(c => c.status === 'active').length})
              {dashboardTab === 'recurring' && (
                <motion.div layoutId="dashboardTabUnderline" className="absolute bottom-0 inset-x-0 h-0.5 bg-purple-600" />
              )}
            </button>
            <button
              onClick={() => setDashboardTab('favorites')}
              className={`pb-3 font-extrabold text-sm uppercase tracking-wider relative transition-all cursor-pointer outline-none border-none bg-transparent flex items-center gap-2 ${
                dashboardTab === 'favorites' ? 'text-indigo-600 font-black' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Heart size={16} className={dashboardTab === 'favorites' ? 'fill-current' : ''} />
              Casting Favorito da Marca
              {dashboardTab === 'favorites' && (
                <motion.div layoutId="dashboardTabUnderline" className="absolute bottom-0 inset-x-0 h-0.5 bg-indigo-600" />
              )}
            </button>
          </div>

          {dashboardTab === 'overview' ? (
            <CompanyOverviewSection
              company={selectedCompany}
              campaigns={campaigns}
              campaignCreators={campaignCreators}
              recurringContracts={recurringContracts}
              contentPlanningItems={contentPlanningItems}
              creators={creators}
              onSelectCampaign={(camp) => {
                setSelectedCampaign(camp);
                setActiveTab('creators');
              }}
              onSwitchTab={(tab) => setDashboardTab(tab)}
              onOpenMediaPreview={(preview) => setPreviewMedia(preview)}
            />
          ) : dashboardTab === 'campaigns' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left side: Campaigns list */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-extrabold text-[#0F172A] flex items-center gap-2">
                  <Layers size={18} className="text-indigo-600" />
                  Campanhas Cadastradas ({campaigns.length})
                </h2>
              </div>

              <div className="flex flex-col gap-3">
                {campaigns.length === 0 ? (
                  <div className="bg-white p-10 text-center rounded-2xl border border-slate-200 shadow-sm text-slate-500">
                    <p className="text-sm font-semibold">Nenhuma campanha cadastrada para esta empresa.</p>
                    <p className="text-xs text-slate-400 mt-1">Crie campanhas para esta marca no menu "Campanhas".</p>
                  </div>
                ) : (
                  campaigns.map(camp => {
                    const cList = campaignCreators[camp.id] || [];
                    const isSelected = selectedCampaign?.id === camp.id;

                    return (
                      <div 
                        key={camp.id}
                        onClick={() => {
                          setSelectedCampaign(camp);
                          setActiveTab('creators');
                        }}
                        className={`bg-white rounded-xl border p-5 shadow-sm hover:border-indigo-400 transition-all cursor-pointer flex flex-col gap-4 ${
                          isSelected ? 'ring-2 ring-indigo-600 border-transparent bg-indigo-50/20' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col gap-1">
                            <h3 className="font-bold text-slate-800 text-sm leading-tight hover:text-indigo-600 flex items-center gap-1.5 flex-wrap">
                              {camp.name}
                              {camp.isSecret && (
                                <span className="inline-flex items-center gap-0.5 bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded text-[8px] font-extrabold tracking-wider border border-rose-100">
                                  <Lock size={8} /> Secreta
                                </span>
                              )}
                            </h3>
                            <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Calendar size={10} />
                              {new Date(camp.startDate).toLocaleDateString()} até {new Date(camp.endDate).toLocaleDateString()}
                            </span>
                          </div>
                          {getStatusBadge(camp.status)}
                        </div>

                        <div className="flex justify-between items-center bg-slate-50/60 p-2.5 rounded-lg border border-slate-100 text-xs text-slate-600">
                          <div>
                            <span className="font-bold text-slate-800">{cList.length}</span> {cList.length === 1 ? 'Criador' : 'Criadores'}
                          </div>
                          <div>
                            Investido: <span className="font-extrabold text-slate-800">{formatCurrency(cList.reduce((acc, curr) => acc + (curr.amount || 0), 0))}</span>
                          </div>
                        </div>

                        {/* Avatars preview of casting */}
                        {cList.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mr-1">Casting:</span>
                            <div className="flex -space-x-2 overflow-hidden">
                              {cList.slice(0, 5).map(cc => {
                                const creatorInfo = creators[cc.creatorId];
                                return (
                                  <div key={cc.id} className="inline-block ring-2 ring-white rounded-full" title={creatorInfo?.artisticName}>
                                    <UserAvatar
                                      src={creatorInfo?.profileImageUrl}
                                      name={creatorInfo?.artisticName || 'Criador'}
                                      size="custom"
                                      shape="circle"
                                      className="h-6 w-6"
                                      textClassName="text-[8px]"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                            {cList.length > 5 && (
                              <span className="text-[10px] text-slate-400 font-bold ml-1">+{cList.length - 5}</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right side: Selected Campaign Details Panel */}
            <div className="lg:col-span-7">
              {selectedCampaign ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-md flex flex-col overflow-hidden">
                  
                  {/* Campaign Detail Header */}
                  <div className="p-6 border-b border-slate-200 bg-slate-50/70">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-indigo-600">Detalhes da Campanha</span>
                        <h2 className="text-xl font-extrabold text-slate-900 mt-1 flex items-center gap-1.5">
                          {selectedCampaign.name}
                          {selectedCampaign.isSecret && (
                            <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-600 px-2 py-0.5 rounded text-[9px] font-black tracking-wider border border-rose-100">
                              <Lock size={10} /> Secreta
                            </span>
                          )}
                        </h2>
                        <span className="text-xs text-slate-500 font-medium">
                          Objetivo: <span className="font-semibold text-slate-700">{selectedCampaign.objective}</span>
                        </span>
                      </div>
                      {getStatusBadge(selectedCampaign.status)}
                    </div>

                    {/* Navigation Tabs for detailed section */}
                    <div className="flex border-b border-slate-200 mt-6 -mb-6">
                      <button
                        onClick={() => setActiveTab('creators')}
                        className={`py-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all ${
                          activeTab === 'creators' 
                            ? 'border-indigo-600 text-indigo-600' 
                            : 'border-transparent text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        Casting e Entregas ({ (campaignCreators[selectedCampaign.id] || []).length })
                      </button>
                      <button
                        onClick={() => setActiveTab('briefing')}
                        className={`py-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all ${
                          activeTab === 'briefing' 
                            ? 'border-indigo-600 text-indigo-600' 
                            : 'border-transparent text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        Briefing Criativo
                      </button>
                      <button
                        onClick={() => setActiveTab('results')}
                        className={`py-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all ${
                          activeTab === 'results' 
                            ? 'border-indigo-600 text-indigo-600' 
                            : 'border-transparent text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        Métricas da Ação
                      </button>
                    </div>
                  </div>

                  {/* Tab contents */}
                  <div className="p-6">
                    <AnimatePresence mode="wait">
                      
                      {/* 1. CREATORS CASTING TAB */}
                      {activeTab === 'creators' && (
                        <motion.div 
                          key="creators"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="flex flex-col gap-4"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Criadores Contratados nesta Ação</span>
                          </div>

                          {(campaignCreators[selectedCampaign.id] || []).length === 0 ? (
                            <p className="text-sm text-slate-400 italic text-center py-8">Nenhum criador selecionado para esta campanha até o momento.</p>
                          ) : (
                            <div className="flex flex-col gap-4">
                              {(campaignCreators[selectedCampaign.id] || []).map(cc => {
                                const creatorInfo = creators[cc.creatorId];

                                return (
                                  <div key={cc.id} className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                      <UserAvatar
                                        src={creatorInfo?.profileImageUrl}
                                        name={creatorInfo?.artisticName || 'Criador'}
                                        size="custom"
                                        shape="rounded-xl"
                                        className="w-11 h-11 border border-slate-200 shadow-sm"
                                        textClassName="text-sm font-bold"
                                      />
                                      <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-800">{creatorInfo?.artisticName || `@${cc.creatorId}`}</span>
                                        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">{cc.deliveryType || 'Entrega Não Definida'}</span>
                                        <span className="text-[10px] text-slate-400">Cache: {formatCurrency(cc.amount || 0)}</span>
                                      </div>
                                    </div>

                                    {/* Action items and state */}
                                    <div className="flex items-center gap-3 justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-slate-200">
                                      <div className="flex flex-col gap-1 md:items-end">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Status de Entrega</span>
                                        {getDeliveryStatusBadge(cc.deliveryStatus)}
                                      </div>

                                      {/* Submissions view / play action */}
                                      <div className="flex gap-1.5">
                                        {/* Script preview */}
                                        {cc.signature?.script ? (
                                          <button 
                                            onClick={() => setPreviewMedia({
                                              url: '',
                                              type: 'script',
                                              creatorName: creatorInfo?.artisticName || 'Criador',
                                              scriptText: cc.signature.script
                                            })}
                                            className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-all"
                                            title="Ver Roteiro Submetido"
                                          >
                                            <FileText size={16} />
                                          </button>
                                        ) : (
                                          <button className="p-2 bg-slate-100 text-slate-350 rounded-lg cursor-not-allowed" title="Sem Roteiro" disabled>
                                            <FileText size={16} />
                                          </button>
                                        )}

                                        {/* Video preview */}
                                        {cc.signature?.videoUrl ? (
                                          <button 
                                            onClick={() => setPreviewMedia({
                                              url: cc.signature.videoUrl,
                                              type: 'video',
                                              creatorName: creatorInfo?.artisticName || 'Criador'
                                            })}
                                            className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-all flex items-center justify-center animate-pulse"
                                            title="Assistir Vídeo de Portfólio / Entrega"
                                          >
                                            <Play size={16} fill="currentColor" />
                                          </button>
                                        ) : (
                                          <button className="p-2 bg-slate-100 text-slate-350 rounded-lg cursor-not-allowed" title="Sem Vídeo de Entrega" disabled>
                                            <Play size={16} />
                                          </button>
                                        )}

                                        {/* External link */}
                                        {cc.signature?.publishedLink ? (
                                          <a 
                                            href={cc.signature.publishedLink} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="p-2 bg-sky-50 hover:bg-sky-100 text-sky-600 rounded-lg transition-all flex items-center justify-center"
                                            title="Ver Post Oficial Publicado"
                                          >
                                            <ExternalLink size={16} />
                                          </a>
                                        ) : (
                                          <button className="p-2 bg-slate-100 text-slate-350 rounded-lg cursor-not-allowed" title="Sem Link Publicado" disabled>
                                            <ExternalLink size={16} />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </motion.div>
                      )}

                      {/* 2. BRIEFING INFO TAB */}
                      {activeTab === 'briefing' && (
                        <motion.div 
                          key="briefing"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="flex flex-col gap-6 text-sm"
                        >
                          <div>
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider block mb-1">Informações Básicas do Produto</span>
                            <h3 className="text-base font-extrabold text-slate-800">{selectedCampaign.briefing?.product || "Produto Não Especificado"}</h3>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Mensagem Chave</span>
                              <p className="text-xs text-slate-600 font-medium leading-relaxed">{selectedCampaign.briefing?.keyMessage || "Não definida"}</p>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Diretrizes / Evitar</span>
                              <p className="text-xs text-slate-600 font-medium leading-relaxed">{selectedCampaign.briefing?.doNotShow || "Não especificadas"}</p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Formatos e Entregáveis Desejados</span>
                            <p className="text-xs text-slate-700 leading-relaxed font-semibold bg-slate-50 border border-slate-200 p-3 rounded-lg">
                              {selectedCampaign.briefing?.deliverables || "Não especificado"}
                            </p>
                          </div>

                          <div className="flex items-start gap-2 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 text-xs text-indigo-900 leading-relaxed font-semibold">
                            <Info size={16} className="text-indigo-600 mt-0.5 shrink-0" />
                            <div>
                              <span>Instruções de Cronograma:</span>
                              <p className="font-normal text-slate-500 mt-0.5">
                                Esta campanha iniciou oficialmente em {new Date(selectedCampaign.startDate).toLocaleDateString()} e possui data prevista de finalização das publicações para {new Date(selectedCampaign.endDate).toLocaleDateString()}.
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* 3. METRICS INDIVIDUAL TAB */}
                      {activeTab === 'results' && (
                        <motion.div 
                          key="results"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="flex flex-col gap-6"
                        >
                          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Métricas Totais desta Ação Específica</span>

                          {/* Calculate performance metrics for this campaign only */}
                          {(() => {
                            const ccList = campaignCreators[selectedCampaign.id] || [];
                            let campReach = 0;
                            let campImpressions = 0;
                            let campViews = 0;
                            let campClicks = 0;
                            let campEngagement = 0;

                            ccList.forEach(cc => {
                              if (cc.signature?.metrics) {
                                campReach += cc.signature.metrics.reach || 0;
                                campImpressions += cc.signature.metrics.impressions || 0;
                                campViews += cc.signature.metrics.views || 0;
                                campClicks += cc.signature.metrics.clicks || 0;
                                campEngagement += cc.signature.metrics.engagement || 0;
                              }
                            });

                            if (campImpressions === 0) {
                              return (
                                <div className="bg-slate-50 p-8 text-center rounded-xl border border-slate-200 text-slate-500">
                                  <TrendingUp className="text-slate-400 mx-auto mb-2" size={32} />
                                  <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Sem Métricas Postadas Ainda</p>
                                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">As métricas estarão disponíveis após os criadores publicarem os posts e os relatórios de engajamento forem consolidados pela agência.</p>
                                </div>
                              );
                            }

                            return (
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col shadow-sm">
                                  <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Alcance</span>
                                  <span className="text-2xl font-black text-indigo-600 mt-1">{formatNumber(campReach)}</span>
                                </div>
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col shadow-sm">
                                  <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Impressões</span>
                                  <span className="text-2xl font-black text-indigo-600 mt-1">{formatNumber(campImpressions)}</span>
                                </div>
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col shadow-sm">
                                  <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Visualizações</span>
                                  <span className="text-2xl font-black text-indigo-600 mt-1">{formatNumber(campViews)}</span>
                                </div>
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col shadow-sm">
                                  <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Cliques</span>
                                  <span className="text-2xl font-black text-indigo-600 mt-1">{formatNumber(campClicks)}</span>
                                </div>
                                <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl flex flex-col shadow-sm col-span-2">
                                  <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">Engajamento Total</span>
                                  <span className="text-2xl font-black text-indigo-600 mt-1">{formatNumber(campEngagement)}</span>
                                </div>
                              </div>
                            );
                          })()}
                        </motion.div>
                      )}

                    </AnimatePresence>
                  </div>
                  
                  {/* Campaign Actions Footer */}
                  <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold">Rocketz Creators System</span>
                    <Link 
                      to={`/campaigns/${selectedCampaign.id}`}
                      className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 hover:underline uppercase tracking-wider"
                    >
                      Acessar Gestão Completa <ChevronRight size={14} />
                    </Link>
                  </div>

                </div>
              ) : (
                <div className="bg-white p-16 text-center rounded-2xl border border-slate-200 shadow-sm text-slate-500 h-full flex flex-col justify-center items-center gap-4">
                  <Megaphone className="text-indigo-200" size={48} />
                  <div>
                    <p className="text-base font-extrabold text-slate-800">Nenhuma Campanha Selecionada</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                      Selecione uma campanha na barra lateral esquerda para visualizar o briefing de criação, casting contratado, acompanhar aprovações e ver resultados de engajamento.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          ) : dashboardTab === 'recurring' ? (
            <CompanyRecurringSection
              recurringContracts={recurringContracts}
              contentPlanningItems={contentPlanningItems}
              creators={creators}
              companyName={selectedCompany.name}
            />
          ) : (
            /* Favorites View */
            <div className="flex flex-col gap-6">
              {/* Header inside Favorites tab */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-4">
                <div className="flex flex-col gap-1 w-full lg:w-auto">
                  <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <Heart className="text-rose-500 fill-rose-500" size={20} />
                    Casting Favorito de {selectedCompany.name}
                  </h2>
                  <p className="text-xs text-slate-400">Curadoria de influenciadores preferidos da marca para ações rápidas e convites diretos.</p>
                </div>

                {/* Sub-toggle: Only Favorites vs Browse All */}
                <div className="flex bg-slate-100 p-1 rounded-xl shrink-0 w-full lg:w-auto">
                  <button
                    onClick={() => setFavFilterMode('only_favorites')}
                    className={`flex-1 lg:flex-none px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 outline-none border-none ${
                      favFilterMode === 'only_favorites' 
                        ? 'bg-white text-slate-900 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-800 bg-transparent'
                    }`}
                  >
                    <Heart size={14} className="fill-current" />
                    Favoritos ({selectedCompany.favoriteCreators?.length || 0})
                  </button>
                  <button
                    onClick={() => setFavFilterMode('browse_all')}
                    className={`flex-1 lg:flex-none px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 outline-none border-none ${
                      favFilterMode === 'browse_all' 
                        ? 'bg-white text-indigo-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-800 bg-transparent'
                    }`}
                  >
                    <Search size={14} />
                    Explorar Todos ({Object.keys(creators).length})
                  </button>
                </div>
              </div>

              {/* Filters Panel */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                <div className="flex-1 relative w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Pesquisar criadores por nome ou @..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 text-sm transition-all bg-slate-50/50 focus:bg-white"
                    value={favCreatorSearch}
                    onChange={(e) => setFavCreatorSearch(e.target.value)}
                  />
                </div>
                <div className="w-full md:w-[220px]">
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-500 outline-none cursor-pointer focus:bg-white focus:border-indigo-600"
                    value={favCreatorCategory}
                    onChange={(e) => setFavCreatorCategory(e.target.value)}
                  >
                    <option value="all">TODAS CATEGORIAS</option>
                    {[
                      'Beleza', 'Gastronomia', 'Lifestyle', 'Fitness', 'Maternidade', 'Pets', 
                      'Automotivo', 'Tecnologia', 'Saúde', 'Humor', 'Moda', 'Educação', 'Casa e Decoração'
                    ].map(cat => (
                      <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Creators Grid */}
              {(() => {
                const favoriteList = selectedCompany.favoriteCreators || [];
                const creatorsArray = Object.values(creators) as Creator[];
                
                const filtered = creatorsArray.filter(creator => {
                  const isFavorite = favoriteList.includes(creator.id);
                  if (favFilterMode === 'only_favorites' && !isFavorite) return false;
                  
                  const matchesSearch = 
                    (creator.fullName || '').toLowerCase().includes(favCreatorSearch.toLowerCase()) || 
                    (creator.artisticName || '').toLowerCase().includes(favCreatorSearch.toLowerCase());
                    
                  const matchesCategory = 
                    favCreatorCategory === 'all' || 
                    creator.categories?.includes(favCreatorCategory);
                    
                  return matchesSearch && matchesCategory;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="bg-white p-16 text-center rounded-2xl border border-slate-200 shadow-sm text-slate-500 flex flex-col justify-center items-center gap-4">
                      {favFilterMode === 'only_favorites' ? (
                        <>
                          <Heart className="text-slate-300 animate-pulse" size={48} />
                          <div>
                            <p className="text-base font-extrabold text-slate-800">Nenhum criador favorito salvo</p>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                              Sua marca ainda não favoritou criadores. Alterne para a aba "Explorar Todos" para descobrir talentos e salvá-los no seu casting preferido.
                            </p>
                            <button
                              onClick={() => setFavFilterMode('browse_all')}
                              className="mt-4 px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all cursor-pointer border-none shadow-md shadow-indigo-100"
                            >
                              Explorar Criadores
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <Search className="text-slate-300" size={48} />
                          <div>
                            <p className="text-base font-extrabold text-slate-800">Nenhum criador localizado</p>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">
                              Tente mudar seus filtros de busca ou categoria acima para encontrar influenciadores.
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence mode="popLayout">
                      {filtered.map(creator => {
                        const isFavorite = favoriteList.includes(creator.id);
                        return (
                          <motion.div
                            layout
                            key={creator.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-indigo-400 transition-all shadow-sm hover:shadow-md relative group flex flex-col justify-between"
                          >
                            <div>
                              {/* Favorite Heart Toggle Icon (Top Right) */}
                              <button
                                onClick={() => toggleFavoriteCreator(creator.id)}
                                className={`absolute top-5 right-5 h-8 w-8 rounded-full border flex items-center justify-center transition-all shadow-sm cursor-pointer ${
                                  isFavorite 
                                    ? 'bg-rose-50 text-rose-500 border-rose-100 hover:bg-rose-100' 
                                    : 'bg-white text-slate-400 hover:text-rose-500 border-slate-200 hover:bg-rose-50'
                                }`}
                              >
                                <Heart size={16} className={isFavorite ? 'fill-current' : ''} />
                              </button>

                              <div className="flex items-center gap-4 mb-4">
                                <UserAvatar
                                  src={creator.photoUrl}
                                  name={creator.artisticName || creator.fullName}
                                  size="custom"
                                  shape="rounded-xl"
                                  className="w-14 h-14 border border-slate-100 shadow-sm"
                                  textClassName="text-base font-bold"
                                />
                                <div className="min-w-0 pr-8">
                                  <h3 className="font-bold text-slate-900 truncate">@{creator.artisticName}</h3>
                                  <p className="text-xs text-slate-400 truncate mt-0.5">{creator.fullName}</p>
                                  <span className="inline-flex items-center gap-1 mt-1.5 bg-slate-100 px-2 py-0.5 rounded text-[9px] font-bold text-slate-500">
                                    {creator.city}, {creator.state}
                                  </span>
                                </div>
                              </div>

                              {/* Metrics */}
                              <div className="grid grid-cols-2 gap-4 mb-4 border-t border-b border-slate-100 py-3.5">
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Seguidores</span>
                                  <span className="text-sm font-black text-slate-800">{formatNumber(creator.metrics?.followers || 0)}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Média Views</span>
                                  <span className="text-sm font-black text-slate-800">{formatNumber(creator.metrics?.avgViews || 0)}</span>
                                </div>
                              </div>

                              {/* Categories list */}
                              <div className="flex flex-wrap gap-1.5 mb-4">
                                {creator.categories?.slice(0, 3).map(cat => (
                                  <span key={cat} className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500 bg-slate-100/80 px-2 py-0.5 rounded">
                                    {cat}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Actions and Pricing Footer */}
                            <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-2">
                              <div className="flex flex-col">
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Preço Comercial</span>
                                <span className="text-xs font-extrabold text-slate-800">
                                  {formatCurrency(creator.pricing?.reel || 0)} <span className="text-[9px] text-slate-400 font-bold">/ reel</span>
                                </span>
                              </div>
                              <Link 
                                to={`/creators/${creator.id}`}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                              >
                                Ver Perfil <ChevronRight size={12} />
                              </Link>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                );
              })()}
            </div>
          )}
        </>
      ) : (
        <div className="text-center bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-slate-500">
          <p className="text-base font-bold">Nenhuma empresa encontrada no banco de dados.</p>
          <p className="text-xs text-slate-400 mt-1">Por favor, crie uma empresa no menu de Empresas antes de acessar.</p>
        </div>
      )}

      {/* Media & Script Preview Modal Overlay */}
      <AnimatePresence>
        {previewMedia && (
          <div className="fixed inset-0 z-[200] overflow-y-auto p-3 sm:p-4 flex items-center justify-center">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md" 
              onClick={() => setPreviewMedia(null)} 
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 15 }} 
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-100 max-h-[90vh] my-auto z-10"
            >
              <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded">
                    {previewMedia.type === 'video' ? 'Visualizar Vídeo Entregue' : 'Roteiro de Publicação'}
                  </span>
                  <h3 className="text-base font-black text-slate-950 mt-1.5">Enviado por @{previewMedia.creatorName}</h3>
                </div>
                <button 
                  onClick={() => setPreviewMedia(null)}
                  className="h-8 w-8 rounded-full bg-slate-200/60 text-slate-600 flex items-center justify-center hover:bg-slate-200 font-bold transition-all text-sm cursor-pointer border-none"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 sm:p-6 overflow-y-auto bg-slate-900 flex-1 flex flex-col justify-center min-h-[300px]">
                {previewMedia.type === 'video' ? (
                  <SubmissionMediaPreview 
                    url={previewMedia.url} 
                    maxHeight="max-h-[50vh]"
                    className="w-full"
                  />
                ) : (
                  <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 font-mono text-xs text-indigo-300 leading-relaxed whitespace-pre-wrap max-h-[50vh] overflow-y-auto">
                    {previewMedia.scriptText || "Nenhum texto de roteiro enviado."}
                  </div>
                )}
              </div>

              <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-xs shrink-0">
                <span className="text-slate-400 font-bold">Visualização do Cliente</span>
                <button 
                  onClick={() => setPreviewMedia(null)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all cursor-pointer border-none"
                >
                  Fechar Visualização
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

function CompanyRecurringSection({
  recurringContracts,
  contentPlanningItems,
  creators,
  companyName
}: {
  recurringContracts: RecurringContract[];
  contentPlanningItems: ContentPlanningItem[];
  creators: Record<string, Creator>;
  companyName: string;
}) {
  const { formatCurrency } = usePrivacy();
  const [searchQuery, setSearchQuery] = useState('');
  const [networkFilter, setNetworkFilter] = useState<string>('all');
  const [creatorFilter, setCreatorFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');

  const [selectedDetailItem, setSelectedDetailItem] = useState<ContentPlanningItem | null>(null);

  const activeContracts = recurringContracts.filter(c => c.status === 'active');
  
  // Collect all creator IDs from active recurring contracts
  const recurringCreatorIds = Array.from(
    new Set(activeContracts.flatMap(c => c.creators?.map(cr => cr.creatorId) || []))
  );

  // Total monthly fee
  const totalMonthlyInvestment = activeContracts.reduce((acc, c) => {
    if (c.monthlyFee) return acc + c.monthlyFee;
    const sumCreators = c.creators?.reduce((cAcc, cr) => cAcc + (cr.monthlyCache || cr.deliverablesFee || 0), 0) || 0;
    return acc + sumCreators;
  }, 0);

  // Total monthly deliverables quota
  const totalDeliverablesQuota = activeContracts.reduce((acc, c) => {
    return acc + (c.creators?.reduce((crAcc, cr) => {
      const d = cr.monthlyDeliverables || {};
      return crAcc + (d.stories||0)+(d.reels||0)+(d.posts||0)+(d.tiktok||0)+(d.youtube||0)+(d.live||0)+(d.pinterest||0)+(d.blog||0)+(d.podcast||0)+(d.unboxing||0)+(d.ugc||0);
    }, 0) || 0);
  }, 0);

  // Extract unique months from content planning items
  const availableMonths = Array.from(
    new Set(contentPlanningItems.map(i => i.month).filter(Boolean))
  ).sort();

  // Filter content planning items
  const filteredItems = contentPlanningItems.filter(item => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchCreator = item.creatorName?.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q) || item.briefingNote?.toLowerCase().includes(q);
      if (!matchTitle && !matchCreator && !matchDesc) return false;
    }
    if (networkFilter !== 'all' && item.contentType !== networkFilter) return false;
    if (creatorFilter !== 'all' && item.creatorId !== creatorFilter) return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (monthFilter !== 'all' && item.month !== monthFilter) return false;
    return true;
  });

  const resetFilters = () => {
    setSearchQuery('');
    setNetworkFilter('all');
    setCreatorFilter('all');
    setStatusFilter('all');
    setMonthFilter('all');
  };

  const hasActiveFilters = searchQuery !== '' || networkFilter !== 'all' || creatorFilter !== 'all' || statusFilter !== 'all' || monthFilter !== 'all';

  const pendingReviewItems = contentPlanningItems.filter(item => item.status === 'review');

  const [feedbackInput, setFeedbackInput] = useState('');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [rejectReasonInput, setRejectReasonInput] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const handleApproveContent = async (item: ContentPlanningItem) => {
    try {
      setUpdatingStatusId(item.id);
      await updateDoc(doc(db, 'contentPlanning', item.id), {
        status: 'approved',
        reviewedAt: new Date().toISOString(),
        feedbackNote: ''
      });
      if (selectedDetailItem?.id === item.id) {
        setSelectedDetailItem(prev => prev ? { ...prev, status: 'approved', feedbackNote: '' } : null);
      }
    } catch (err) {
      console.error('Erro ao aprovar conteúdo:', err);
      alert('Erro ao aprovar conteúdo.');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleRejectContent = async () => {
    if (!selectedDetailItem) return;
    if (!rejectReasonInput.trim()) {
      alert('Por favor, descreva o motivo da reprovação do conteúdo.');
      return;
    }
    try {
      setUpdatingStatusId(selectedDetailItem.id);
      await updateDoc(doc(db, 'contentPlanning', selectedDetailItem.id), {
        status: 'rejected',
        feedbackNote: `[REPROVADO]: ${rejectReasonInput.trim()}`,
        reviewedAt: new Date().toISOString()
      });
      setSelectedDetailItem(prev => prev ? { ...prev, status: 'rejected', feedbackNote: `[REPROVADO]: ${rejectReasonInput.trim()}` } : null);
      setShowRejectModal(false);
      setRejectReasonInput('');
    } catch (err) {
      console.error('Erro ao reprovar conteúdo:', err);
      alert('Erro ao reprovar conteúdo.');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleRequestRevision = async () => {
    if (!selectedDetailItem) return;
    if (!feedbackInput.trim()) {
      alert('Por favor, descreva os ajustes necessários para o criador.');
      return;
    }
    try {
      setUpdatingStatusId(selectedDetailItem.id);
      await updateDoc(doc(db, 'contentPlanning', selectedDetailItem.id), {
        status: 'in_production',
        feedbackNote: feedbackInput.trim(),
        reviewedAt: new Date().toISOString()
      });
      setSelectedDetailItem(prev => prev ? { ...prev, status: 'in_production', feedbackNote: feedbackInput.trim() } : null);
      setShowFeedbackModal(false);
      setFeedbackInput('');
    } catch (err) {
      console.error('Erro ao solicitar ajustes:', err);
      alert('Erro ao solicitar ajustes.');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleMarkPublished = async (item: ContentPlanningItem) => {
    const pubUrl = prompt('Insira o link oficial da publicação nas redes sociais:', item.publishedUrl || '');
    if (pubUrl === null) return;
    try {
      setUpdatingStatusId(item.id);
      await updateDoc(doc(db, 'contentPlanning', item.id), {
        status: 'published',
        publishedUrl: pubUrl.trim(),
        reviewedAt: new Date().toISOString()
      });
      if (selectedDetailItem?.id === item.id) {
        setSelectedDetailItem(prev => prev ? { ...prev, status: 'published', publishedUrl: pubUrl.trim() } : null);
      }
    } catch (err) {
      console.error('Erro ao marcar publicação:', err);
      alert('Erro ao marcar publicação.');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-purple-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl shrink-0">
            <Repeat size={22} />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Contratos Ativos</span>
            <h4 className="text-xl font-black text-slate-900 m-0 mt-0.5">{activeContracts.length}</h4>
            <span className="text-[10px] text-slate-400">Em recorrência com {companyName}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-purple-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
            <Users size={22} />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Criadores Fixos</span>
            <h4 className="text-xl font-black text-slate-900 m-0 mt-0.5">{recurringCreatorIds.length}</h4>
            <span className="text-[10px] text-slate-400">Influenciadores sob contrato</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-purple-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
            <Layers size={22} />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Cota Mensal de Entregas</span>
            <h4 className="text-xl font-black text-slate-900 m-0 mt-0.5">{totalDeliverablesQuota} <span className="text-xs font-semibold text-slate-400">conteúdos/mês</span></h4>
            <span className="text-[10px] text-slate-400">{contentPlanningItems.length} agendados no calendário</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-purple-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl shrink-0">
            <DollarSign size={22} />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase text-purple-700 tracking-wider">Cachê Mensal Total</span>
            <h4 className="text-xl font-black text-purple-950 m-0 mt-0.5">
              {formatCurrency(totalMonthlyInvestment)}
            </h4>
            <span className="text-[10px] text-slate-400">Investimento mensal fixo</span>
          </div>
        </div>
      </div>

      {/* Section 1: Active Recurring Contracts */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
              <Repeat size={18} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 m-0">Trabalhos Recorrentes Ativos ({recurringContracts.length})</h3>
              <p className="text-xs text-slate-500 m-0">Contratos contínuos firmados entre a empresa e os criadores</p>
            </div>
          </div>
        </div>

        {recurringContracts.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center flex flex-col items-center gap-2">
            <Repeat className="text-purple-300" size={32} />
            <h4 className="font-bold text-slate-800 text-sm m-0">Nenhum Contrato Recorrente Cadastrado</h4>
            <p className="text-xs text-slate-500 max-w-md m-0">
              Esta empresa ainda não possui contratos recorrentes configurados. Contratos contínuos e suas entregas periódicas podem ser gerenciados no módulo de Contratos Recorrentes.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5">
            {recurringContracts.map(contract => {
              const contractCreators = contract.creators || [];
              const contractFee = contract.monthlyFee || contractCreators.reduce((acc, cr) => acc + (cr.monthlyCache || cr.deliverablesFee || 0), 0);

              return (
                <div key={contract.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-5 hover:border-purple-300 transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-base text-slate-900 m-0">{contract.title}</h4>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                          contract.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          contract.status === 'paused' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {contract.status === 'active' ? 'Ativo' : contract.status === 'paused' ? 'Pausado' : 'Finalizado'}
                        </span>
                      </div>
                      {contract.objective && (
                        <p className="text-xs text-slate-500 mt-1 m-0">{contract.objective}</p>
                      )}
                      <span className="text-[11px] text-slate-400 block mt-1">
                        Início: {new Date(contract.startDate).toLocaleDateString('pt-BR')} {contract.endDate ? `• Término: ${new Date(contract.endDate).toLocaleDateString('pt-BR')}` : '• Contínuo'}
                      </span>
                    </div>

                    <div className="bg-purple-50 px-4 py-2.5 rounded-xl border border-purple-100 flex flex-col items-start sm:items-end shrink-0">
                      <span className="text-[10px] font-extrabold uppercase text-purple-700 tracking-wider">Investimento Mensal do Contrato</span>
                      <span className="text-lg font-black text-purple-950">
                        {formatCurrency(contractFee)}<span className="text-xs font-semibold text-purple-700">/mês</span>
                      </span>
                    </div>
                  </div>

                  {/* Creators breakdown in contract */}
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block mb-3">
                      Criadores e Cotas de Entregas ({contractCreators.length} influenciadores)
                    </span>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {contractCreators.map(cConfig => {
                        const creatorObj = creators[cConfig.creatorId];
                        const deliv = cConfig.monthlyDeliverables || {};
                        return (
                          <div key={cConfig.creatorId} className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/70 flex flex-col gap-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <UserAvatar
                                  src={creatorObj?.photoUrl}
                                  name={cConfig.artisticName || cConfig.creatorName || creatorObj?.fullName || 'Criador'}
                                  size="custom"
                                  shape="circle"
                                  className="w-9 h-9 border border-white shadow-sm"
                                  textClassName="text-xs font-bold"
                                />
                                <div className="min-w-0">
                                  <Link to={`/creators/${cConfig.creatorId}`} className="font-bold text-xs text-slate-900 truncate block hover:text-purple-600 transition-colors">
                                    @{cConfig.artisticName || cConfig.creatorName}
                                  </Link>
                                  <span className="text-[10px] text-slate-400 block truncate">
                                    {creatorObj?.fullName || cConfig.creatorName}
                                  </span>
                                </div>
                              </div>
                              <span className="text-xs font-black text-purple-900 bg-white px-2.5 py-1 rounded-lg border border-purple-100 shrink-0">
                                {formatCurrency(cConfig.monthlyCache || cConfig.deliverablesFee || 0)}/mês
                              </span>
                            </div>

                            {/* Deliverables badges */}
                            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-200/60">
                              {(deliv.reels || 0) > 0 && <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded text-[10px] font-bold"><Film size={10} className="inline mr-1" />{deliv.reels} Reels</span>}
                              {(deliv.stories || 0) > 0 && <span className="bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded text-[10px] font-bold"><Instagram size={10} className="inline mr-1" />{deliv.stories} Stories</span>}
                              {(deliv.posts || 0) > 0 && <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded text-[10px] font-bold"><Layers size={10} className="inline mr-1" />{deliv.posts} Posts</span>}
                              {(deliv.tiktok || 0) > 0 && <span className="bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded text-[10px] font-bold"><Clapperboard size={10} className="inline mr-1" />{deliv.tiktok} TikTok</span>}
                              {(deliv.youtube || 0) > 0 && <span className="bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded text-[10px] font-bold"><Video size={10} className="inline mr-1" />{deliv.youtube} YT</span>}
                              {(deliv.live || 0) > 0 && <span className="bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded text-[10px] font-bold"><Radio size={10} className="inline mr-1" />{deliv.live} Lives</span>}
                              {(deliv.pinterest || 0) > 0 && <span className="bg-pink-50 text-pink-700 border border-pink-100 px-2 py-0.5 rounded text-[10px] font-bold"><Pin size={10} className="inline mr-1" />{deliv.pinterest} Pins</span>}
                              {(deliv.blog || 0) > 0 && <span className="bg-sky-50 text-sky-700 border border-sky-100 px-2 py-0.5 rounded text-[10px] font-bold"><Newspaper size={10} className="inline mr-1" />{deliv.blog} Artigos</span>}
                              {(deliv.podcast || 0) > 0 && <span className="bg-violet-50 text-violet-700 border border-violet-100 px-2 py-0.5 rounded text-[10px] font-bold"><Mic size={10} className="inline mr-1" />{deliv.podcast} Podcast</span>}
                              {(deliv.unboxing || 0) > 0 && <span className="bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-100 px-2 py-0.5 rounded text-[10px] font-bold"><Package size={10} className="inline mr-1" />{deliv.unboxing} Unboxing</span>}
                              {(deliv.ugc || 0) > 0 && <span className="bg-teal-50 text-teal-700 border border-teal-100 px-2 py-0.5 rounded text-[10px] font-bold"><Camera size={10} className="inline mr-1" />{deliv.ugc} UGC</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Delivery Calendar & Planning with Filters */}
      <div className="flex flex-col gap-5 pt-4 border-t border-slate-200">
        {pendingReviewItems.length > 0 && (
          <div className="bg-purple-900 text-white p-5 rounded-2xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-800 text-purple-200 rounded-xl shrink-0">
                <Clock size={22} className="animate-pulse" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-white m-0 flex items-center gap-2">
                  {pendingReviewItems.length} Conteúdo{pendingReviewItems.length > 1 ? 's' : ''} Recorrente{pendingReviewItems.length > 1 ? 's' : ''} Aguardando Aprovação!
                </h4>
                <p className="text-xs text-purple-200 m-0 mt-0.5">
                  Os criadores enviaram novos materiais para revisão da empresa. Analise e aprove para autorizar a publicação.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setStatusFilter('review');
              }}
              className="px-4 py-2 bg-white text-purple-900 hover:bg-purple-50 rounded-xl text-xs font-bold transition-all border-none cursor-pointer shrink-0 shadow-sm"
            >
              Ver Conteúdos em Aprovação ({pendingReviewItems.length})
            </button>
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 m-0 flex items-center gap-2">
              <Calendar className="text-purple-600" size={20} />
              Calendário e Cronograma de Entregas ({filteredItems.length})
            </h3>
            <p className="text-xs text-slate-500 m-0 mt-0.5">
              Filtre o planejamento mensal por rede social, formato, criador ou status de produção.
            </p>
          </div>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg border border-rose-200 transition-all cursor-pointer flex items-center gap-1.5 self-start md:self-auto"
            >
              <X size={14} /> Limpar Filtros
            </button>
          )}
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar pauta ou título..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:border-purple-600 focus:bg-white transition-all"
              />
            </div>

            {/* Network / Format Filter */}
            <div>
              <select
                value={networkFilter}
                onChange={(e) => setNetworkFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-purple-600 focus:bg-white transition-all cursor-pointer"
              >
                <option value="all">🌐 Todas as Redes / Formatos</option>
                <option value="reel">🎬 Reel / Instagram</option>
                <option value="story">📸 Story Instagram</option>
                <option value="post">🖼️ Feed Post / Carrossel</option>
                <option value="tiktok">🎵 TikTok</option>
                <option value="youtube">▶️ YouTube</option>
                <option value="live">🎙️ Live / Transmissão</option>
                <option value="pinterest">📌 Pinterest</option>
                <option value="blog">📝 Blog / Artigo</option>
                <option value="podcast">🎧 Podcast</option>
                <option value="unboxing">📦 Unboxing</option>
                <option value="ugc">📹 UGC</option>
                <option value="event">📅 Evento</option>
                <option value="other">✨ Outro</option>
              </select>
            </div>

            {/* Creator Filter */}
            <div>
              <select
                value={creatorFilter}
                onChange={(e) => setCreatorFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-purple-600 focus:bg-white transition-all cursor-pointer"
              >
                <option value="all">👤 Todos os Criadores</option>
                {recurringCreatorIds.map(cId => {
                  const cr = creators[cId];
                  return (
                    <option key={cId} value={cId}>
                      @{cr?.artisticName || cr?.fullName || cId}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Delivery Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-purple-600 focus:bg-white transition-all cursor-pointer"
              >
                <option value="all">📊 Todos os Status</option>
                <option value="planned">⏳ Planejado</option>
                <option value="in_production">🎬 Em Produção</option>
                <option value="review">👀 Em Revisão</option>
                <option value="approved">✅ Aprovado</option>
                <option value="published">🚀 Publicado</option>
              </select>
            </div>

            {/* Month Filter */}
            <div>
              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-purple-600 focus:bg-white transition-all cursor-pointer"
              >
                <option value="all">📅 Todos os Meses</option>
                {availableMonths.map(m => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Deliveries Grid */}
        {filteredItems.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center flex flex-col items-center gap-3">
            <Calendar className="text-slate-300" size={36} />
            <h4 className="font-bold text-slate-800 text-sm m-0">Nenhuma entrega encontrada para esses filtros</h4>
            <p className="text-xs text-slate-400 max-w-sm m-0">
              Tente redefinir ou ajustar os filtros de rede social, criador ou status para visualizar os conteúdos agendados.
            </p>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="mt-2 text-xs font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 px-4 py-2 rounded-xl transition-all border-none cursor-pointer"
              >
                Limpar Filtros
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map(item => {
              const cfg = CONTENT_TYPE_CONFIG[item.contentType] || CONTENT_TYPE_CONFIG.other;
              const IconComp = cfg.icon;
              const creatorObj = creators[item.creatorId];

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedDetailItem(item)}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-purple-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-4 group"
                >
                  <div className="flex flex-col gap-3">
                    {/* Format & Planned Date */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase border flex items-center gap-1.5 ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                        <IconComp size={12} />
                        {cfg.shortLabel}
                      </span>

                      <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                        <Calendar size={11} className="text-slate-400" />
                        {item.plannedDate ? new Date(item.plannedDate).toLocaleDateString('pt-BR') : 'Data a definir'}
                      </span>
                    </div>

                    {/* Title */}
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 group-hover:text-purple-600 transition-colors line-clamp-2 m-0">
                        {item.title}
                      </h4>
                      {item.briefingNote && (
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1 m-0">
                          {item.briefingNote}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Creator & Status Footer */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserAvatar
                        src={creatorObj?.photoUrl}
                        name={creatorObj?.artisticName || item.creatorName || 'Criador'}
                        size="custom"
                        shape="circle"
                        className="w-7 h-7 border border-slate-200"
                        textClassName="text-[10px]"
                      />
                      <span className="text-xs font-bold text-slate-700 truncate">
                        @{creatorObj?.artisticName || item.creatorName || 'Criador'}
                      </span>
                    </div>

                    <div className="shrink-0">
                      {item.status === 'published' && (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase">
                          Publicado
                        </span>
                      )}
                      {item.status === 'approved' && (
                        <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase">
                          Aprovado
                        </span>
                      )}
                      {item.status === 'review' && (
                        <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase">
                          Revisão
                        </span>
                      )}
                      {item.status === 'in_production' && (
                        <span className="bg-sky-50 text-sky-700 border border-sky-200 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase">
                          Em Produção
                        </span>
                      )}
                      {item.status === 'planned' && (
                        <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase">
                          Planejado
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

      {/* Item Detail Modal */}
      <AnimatePresence>
        {selectedDetailItem && (
          <div className="fixed inset-0 z-[220] overflow-y-auto p-3 sm:p-4 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
              onClick={() => setSelectedDetailItem(null)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] my-auto z-10"
            >
              <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
                <div className="flex items-center gap-2.5">
                  {(() => {
                    const cfg = CONTENT_TYPE_CONFIG[selectedDetailItem.contentType] || CONTENT_TYPE_CONFIG.other;
                    const IconC = cfg.icon;
                    return (
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase border flex items-center gap-1.5 ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                        <IconC size={14} />
                        {cfg.label}
                      </span>
                    );
                  })()}
                </div>
                <button
                  onClick={() => setSelectedDetailItem(null)}
                  className="w-8 h-8 rounded-full bg-slate-200/60 text-slate-600 flex items-center justify-center hover:bg-slate-200 font-bold transition-all text-sm cursor-pointer border-none"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-5 custom-scrollbar">
                <div>
                  <h3 className="text-lg font-black text-slate-900 m-0">{selectedDetailItem.title}</h3>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-bold text-slate-700">
                      <Calendar size={13} className="text-purple-600" />
                      {selectedDetailItem.plannedDate ? new Date(selectedDetailItem.plannedDate).toLocaleDateString('pt-BR') : 'Data não definida'}
                    </span>
                    <span>•</span>
                    <span className="font-semibold text-slate-600">
                      Criador: @{selectedDetailItem.creatorName || creators[selectedDetailItem.creatorId]?.artisticName || 'Criador'}
                    </span>
                  </div>
                </div>

                {selectedDetailItem.briefingNote && (
                  <div className="p-4 bg-purple-50/60 border border-purple-100 rounded-2xl flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-700">Orientação / Briefing da Pauta</span>
                    <p className="text-xs text-purple-950 leading-relaxed m-0 whitespace-pre-wrap">{selectedDetailItem.briefingNote}</p>
                  </div>
                )}

                {selectedDetailItem.caption && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Legenda Sugerida</span>
                    <p className="text-xs text-slate-800 leading-relaxed m-0 whitespace-pre-wrap font-mono">{selectedDetailItem.caption}</p>
                  </div>
                )}

                {selectedDetailItem.submissionUrl && (
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
                        <UploadCloud size={14} /> Material Enviado pelo Criador
                      </span>
                      {selectedDetailItem.submittedAt && (
                        <span className="text-[10px] font-semibold text-purple-600">
                          Enviado em {new Date(selectedDetailItem.submittedAt).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                    
                    {/* Video / File Player preview */}
                    <SubmissionMediaPreview url={selectedDetailItem.submissionUrl} />

                    {selectedDetailItem.submissionNotes && (
                      <div className="pt-2 border-t border-purple-100">
                        <span className="text-[10px] font-bold text-purple-800 uppercase block">Observações do Criador:</span>
                        <p className="text-xs text-purple-950 m-0 mt-0.5 whitespace-pre-wrap leading-relaxed">
                          {selectedDetailItem.submissionNotes}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {selectedDetailItem.feedbackNote && (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-700">Ajustes Solicitados / Feedback:</span>
                    <p className="text-xs text-rose-950 leading-relaxed m-0 whitespace-pre-wrap">{selectedDetailItem.feedbackNote}</p>
                  </div>
                )}

                {selectedDetailItem.publishedUrl && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="text-emerald-600" size={18} />
                      <span className="text-xs font-bold text-emerald-900">Conteúdo publicado nas redes</span>
                    </div>
                    <a
                      href={selectedDetailItem.publishedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all flex items-center gap-1 text-decoration-none"
                    >
                      Abrir Publicação <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </div>

              {/* Action Bar for Company / Agency Approval */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Aprovar */}
                  <button
                    onClick={() => handleApproveContent(selectedDetailItem)}
                    disabled={updatingStatusId === selectedDetailItem.id || selectedDetailItem.status === 'approved'}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-1.5 shadow-sm",
                      selectedDetailItem.status === 'approved' 
                        ? "bg-emerald-100 text-emerald-800 cursor-default" 
                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                    )}
                  >
                    <CheckCircle size={14} />
                    {selectedDetailItem.status === 'approved' ? 'Conteúdo Aprovado' : 'Aprovar Conteúdo'}
                  </button>

                  {/* Reprovar */}
                  <button
                    onClick={() => {
                      setRejectReasonInput(selectedDetailItem.feedbackNote?.replace('[REPROVADO]: ', '') || '');
                      setShowRejectModal(true);
                    }}
                    disabled={updatingStatusId === selectedDetailItem.id}
                    className={cn(
                      "px-3.5 py-2 rounded-xl text-xs font-bold transition-all border border-rose-200 cursor-pointer flex items-center gap-1.5",
                      selectedDetailItem.status === 'rejected'
                        ? "bg-rose-100 text-rose-900 font-extrabold"
                        : "bg-rose-50 hover:bg-rose-100 text-rose-700"
                    )}
                  >
                    <X size={14} />
                    {selectedDetailItem.status === 'rejected' ? 'Reprovado' : 'Reprovar Conteúdo'}
                  </button>

                  {/* Pedir Alteração */}
                  <button
                    onClick={() => {
                      setFeedbackInput(selectedDetailItem.feedbackNote || '');
                      setShowFeedbackModal(true);
                    }}
                    disabled={updatingStatusId === selectedDetailItem.id}
                    className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <AlertCircle size={14} /> Pedir Alteração
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleMarkPublished(selectedDetailItem)}
                    className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <ExternalLink size={14} /> Marcar Publicado
                  </button>
                  <button
                    onClick={() => setSelectedDetailItem(null)}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-300 transition-all cursor-pointer border-none"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rejection Modal */}
      <AnimatePresence>
        {showRejectModal && selectedDetailItem && (
          <div className="fixed inset-0 z-[300] overflow-y-auto p-3 sm:p-4 flex items-center justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
              onClick={() => setShowRejectModal(false)}
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] my-auto z-10 p-5 sm:p-6 gap-4"
            >
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 bg-rose-100 px-2.5 py-1 rounded-md">
                  Reprovar Conteúdo Enviado
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-2 m-0">{selectedDetailItem.title}</h3>
                <p className="text-xs text-slate-500 m-0 mt-1">
                  Descreva o motivo pelo qual este conteúdo foi reprovado pela empresa.
                </p>
              </div>

              <textarea 
                rows={4}
                placeholder="Ex: Conteúdo fora da identidade da marca e sem seguir o roteiro acordado..."
                value={rejectReasonInput}
                onChange={(e) => setRejectReasonInput(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-rose-500 focus:bg-white transition-all resize-none"
              />

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-300 transition-all border-none cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleRejectContent}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <X size={13} /> Confirmar Reprovação
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Revision Feedback Modal */}
      <AnimatePresence>
        {showFeedbackModal && selectedDetailItem && (
          <div className="fixed inset-0 z-[300] overflow-y-auto p-3 sm:p-4 flex items-center justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
              onClick={() => setShowFeedbackModal(false)}
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] my-auto z-10 p-5 sm:p-6 gap-4"
            >
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 bg-rose-100 px-2.5 py-1 rounded-md">
                  Solicitar Ajustes no Conteúdo
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-2 m-0">{selectedDetailItem.title}</h3>
                <p className="text-xs text-slate-500 m-0 mt-1">
                  Descreva detalhadamente o que o criador precisa corrigir ou alterar neste material.
                </p>
              </div>

              <textarea 
                rows={4}
                placeholder="Ex: Favor ajustar a pronúncia da marca aos 0:15 e destacar a embalagem na cena inicial..."
                value={feedbackInput}
                onChange={(e) => setFeedbackInput(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-rose-500 focus:bg-white transition-all resize-none"
              />

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFeedbackModal(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-300 transition-all border-none cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleRequestRevision}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-1.5"
                >
                  <Send size={13} /> Enviar Feedback de Ajustes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
