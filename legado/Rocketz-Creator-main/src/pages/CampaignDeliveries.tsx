import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { 
  Megaphone, 
  Repeat,
  Calendar, 
  Search, 
  Video, 
  Plus, 
  ArrowRight, 
  Lock, 
  Handshake, 
  Gift, 
  DollarSign, 
  Sparkles
} from 'lucide-react';
import { collection, onSnapshot, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { Campaign, Company, CampaignCreator, Creator, CampaignStatus } from '../types';
import { cn } from '../lib/utils';
import { usePrivacy } from '../context/PrivacyContext';
import { motion, AnimatePresence } from 'motion/react';
import RecurringContracts from './RecurringContracts';
import { UserAvatar } from '../components/UserAvatar';

const statusMap: Record<CampaignStatus, { label: string; bg: string; text: string; border: string }> = {
  briefing: { label: 'Briefing', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  selection: { label: 'Seleção de Casting', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  approval: { label: 'Aprovação', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  production: { label: 'Em Produção', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  published: { label: 'Publicado', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  finished: { label: 'Finalizado', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
};

export default function CampaignDeliveries() {
  const { formatCurrency } = usePrivacy();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'recurring' ? 'recurring' : 'campaigns';

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [creators, setCreators] = useState<Record<string, Creator>>({});
  const [campaignCreatorsMap, setCampaignCreatorsMap] = useState<Record<string, CampaignCreator[]>>({});
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [userRole, setUserRole] = useState<'admin' | 'company' | 'creator' | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modalIsBarter, setModalIsBarter] = useState(false);

  // 1. Fetch user role
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const { getDoc, doc } = await import('firebase/firestore');
        const adminEmailCheck = user.email && (user.email.endsWith('@rocketz.com.br') || user.email === 'diogo.rocketbr@gmail.com');
        if (adminEmailCheck) {
          setUserRole('admin');
          return;
        }

        // Check companyUser
        const compSnap = await getDoc(doc(db, 'companyUsers', user.uid));
        if (compSnap.exists()) {
          setUserRole('company');
          return;
        }

        setUserRole('creator');
      }
    });
    return () => unsub();
  }, []);

  // 2. Load creators map
  useEffect(() => {
    const unsubCreators = onSnapshot(collection(db, 'creators'), (snapshot) => {
      const map: Record<string, Creator> = {};
      snapshot.docs.forEach(d => {
        map[d.id] = { id: d.id, ...d.data() } as Creator;
      });
      setCreators(map);
    }, (err) => {
      console.warn("Error loading creators snapshot:", err.message);
    });
    return () => unsubCreators();
  }, []);

  // 3. Load companies
  useEffect(() => {
    const unsubCompanies = onSnapshot(collection(db, 'companies'), (snapshot) => {
      setCompanies(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Company)));
    }, (err) => {
      console.warn("Error loading companies:", err.message);
    });
    return () => unsubCompanies();
  }, []);

  // 4. Load all campaigns
  useEffect(() => {
    const unsubCampaigns = onSnapshot(collection(db, 'campaigns'), (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Campaign));
      list.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
      setCampaigns(list);

      // Listen to subcollections for each campaign
      list.forEach(c => {
        onSnapshot(collection(db, `campaigns/${c.id}/creators`), (ccSnap) => {
          const ccList = ccSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as CampaignCreator));
          setCampaignCreatorsMap(prev => ({ ...prev, [c.id]: ccList }));
        }, (err) => {
          console.warn(`Error loading cc for campaign ${c.id}:`, err.message);
        });
      });
    }, (err) => {
      console.warn("Error loading campaigns:", err.message);
    });
    return () => unsubCampaigns();
  }, []);

  // 5. Load pending candidate applications count
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
      console.warn("Pending counts warning:", err.message);
    });

    return unsubscribe;
  }, []);

  // Filter campaigns
  const filteredCampaigns = campaigns.filter(c => {
    const company = companies.find(comp => comp.id === c.companyId);
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.objective && c.objective.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (company && company.name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    return c.status === statusFilter;
  });

  // Global calculations
  const totalCampaignsCount = campaigns.length;
  const activeCampaignsCount = campaigns.filter(c => c.status !== 'finished').length;
  const totalBudgetManaged = campaigns.reduce((acc, c) => acc + (c.isBarter || c.isDirectContract ? 0 : (c.totalBudget || 0)), 0);

  return (
    <div className="flex flex-col gap-6 animate-fadeIn pb-16">
      {/* Page Header */}
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-brand-primary text-xs font-bold uppercase tracking-wider mb-1">
              <Video size={16} /> Central de Projetos & Entregas
            </div>
            <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              Gestão de Projetos & Entregas
            </h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Acompanhe cada projeto detalhadamente, aprove roteiros, assista aos vídeos e gerencie prazos por criador.
            </p>
          </div>

          {activeTab === 'campaigns' && userRole !== 'creator' && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-primary hover:bg-indigo-600 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-100 transition-all cursor-pointer border-none shrink-0"
            >
              <Plus size={16} className="stroke-[2.5]" /> Nova Campanha
            </button>
          )}
        </div>

        {/* Sub-Tabs: Campanhas e Trabalhos Recorrentes */}
        <div className="flex items-center gap-2 border-b border-slate-200 pt-2">
          <button
            onClick={() => setSearchParams({ tab: 'campaigns' })}
            className={cn(
              "pb-3 px-5 text-sm font-extrabold transition-all relative flex items-center gap-2 border-b-2 -mb-[2px] cursor-pointer",
              activeTab === 'campaigns' 
                ? "text-brand-primary border-brand-primary bg-indigo-50/70 rounded-t-xl" 
                : "text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-50 rounded-t-xl"
            )}
          >
            <Megaphone size={18} className={activeTab === 'campaigns' ? "text-brand-primary" : "text-slate-400"} />
            Campanhas Pontuais
            {campaigns.length > 0 && (
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-black",
                activeTab === 'campaigns' ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"
              )}>
                {campaigns.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setSearchParams({ tab: 'recurring' })}
            className={cn(
              "pb-3 px-5 text-sm font-extrabold transition-all relative flex items-center gap-2 border-b-2 -mb-[2px] cursor-pointer",
              activeTab === 'recurring' 
                ? "text-brand-primary border-brand-primary bg-indigo-50/70 rounded-t-xl" 
                : "text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-50 rounded-t-xl"
            )}
          >
            <Repeat size={18} className={activeTab === 'recurring' ? "text-brand-primary" : "text-slate-400"} />
            Trabalhos Recorrentes
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-black",
              activeTab === 'recurring' ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"
            )}>
              Recorrente
            </span>
          </button>
        </div>
      </header>

      {/* Main Content View based on Active Tab */}
      {activeTab === 'recurring' ? (
        <div className="animate-fadeIn">
          <RecurringContracts />
        </div>
      ) : (
        /* CAMPAIGNS PROJECT CARDS VIEW (Aligned with RecurringContracts layout) */
        <div className="flex flex-col gap-6">
          {/* Top 2-Line Key Metrics Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Card 1: Campanhas Ativas */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-brand-primary">
                    <Megaphone size={15} />
                  </div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Ações em Andamento</span>
                </div>
                <span className="text-[10px] font-bold text-brand-primary bg-indigo-50 px-2 py-0.5 rounded-full">
                  Ativas
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 pt-3">
                <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {activeCampaignsCount}
                </span>
                <span className="text-xs text-slate-400 font-semibold">de {totalCampaignsCount} campanhas totais</span>
              </div>
            </div>

            {/* Card 2: Investimento Gerenciado */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <DollarSign size={15} />
                  </div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Verba Total Gerenciada</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Volume Total
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 pt-3">
                <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {formatCurrency(totalBudgetManaged)}
                </span>
              </div>
            </div>

            {/* Card 3: Formato do Projeto */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                    <Sparkles size={15} />
                  </div>
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Detalhes por Projeto</span>
                </div>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                  Centralizado
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 pt-3">
                <span className="text-xs sm:text-sm font-black text-slate-800">
                  Clique em qualquer campanha para abrir sua tela detalhada
                </span>
              </div>
            </div>
          </div>

          {/* Search & Status Filters */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar campanha ou cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary focus:bg-white transition-all font-medium"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto scrollbar-hide">
              <button
                onClick={() => setStatusFilter('all')}
                className={cn(
                  "px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer",
                  statusFilter === 'all'
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                Todas ({campaigns.length})
              </button>
              {Object.entries(statusMap).map(([key, config]) => {
                const count = campaigns.filter(c => c.status === key).length;
                return (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key)}
                    className={cn(
                      "px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5",
                      statusFilter === key
                        ? "bg-brand-primary text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    <span>{config.label}</span>
                    <span className={cn(
                      "text-[9px] px-1.5 py-0.2 rounded-full font-black",
                      statusFilter === key ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Campaigns Grid */}
          {filteredCampaigns.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-14 h-14 bg-indigo-50 text-brand-primary rounded-2xl flex items-center justify-center">
                <Megaphone size={28} />
              </div>
              <h3 className="text-base font-bold text-slate-800">Nenhuma campanha encontrada</h3>
              <p className="text-xs text-slate-500 max-w-md">
                Não encontramos nenhuma campanha com os filtros selecionados. Crie uma nova campanha ou altere os termos de busca.
              </p>
              {userRole !== 'creator' && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="mt-2 px-4 py-2 bg-brand-primary text-white font-bold rounded-xl text-xs hover:bg-indigo-600 transition-colors flex items-center gap-1.5"
                >
                  <Plus size={14} /> Criar Campanha
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCampaigns.map(campaign => {
                const company = companies.find(c => c.id === campaign.companyId);
                const assignedCCs = campaignCreatorsMap[campaign.id] || [];
                const approvedCCs = assignedCCs.filter(cc => !cc.applicationStatus || cc.applicationStatus === 'approved');
                const pendingCCsCount = pendingCounts[campaign.id] || 0;

                // Financial calculations
                const totalBudget = campaign.totalBudget || 0;
                const castingCost = approvedCCs.reduce((acc, cc) => acc + (Number(cc.amount) || 0), 0);
                const remainingBudget = totalBudget - castingCost;

                // Deliveries progress
                const completedDeliveries = approvedCCs.filter(cc => cc.deliveryStatus === 'published' || cc.deliveryStatus === 'approved').length;
                const totalDeliveries = approvedCCs.length;

                const statusCfg = statusMap[campaign.status] || statusMap.briefing;

                return (
                  <div
                    key={campaign.id}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md hover:border-brand-primary/60 transition-all flex flex-col justify-between overflow-hidden group"
                  >
                    {/* Card Top */}
                    <div className="p-5 flex flex-col gap-4">
                      {/* Header: Company & Badges */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar
                            src={company?.logo || company?.logoUrl}
                            name={company?.name || 'Cliente'}
                            size="custom"
                            shape="rounded-xl"
                            className="w-10 h-10 border border-slate-200"
                            textClassName="text-xs font-black"
                          />
                          <div className="min-w-0">
                            <span className="text-[11px] font-extrabold text-brand-primary truncate block uppercase tracking-wider">
                              {company?.name || 'Cliente'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                              <Calendar size={11} /> {new Date(campaign.startDate).toLocaleDateString()} a {new Date(campaign.endDate).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Status badge */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase tracking-wider",
                            statusCfg.bg, statusCfg.text, statusCfg.border
                          )}>
                            {statusCfg.label}
                          </span>
                        </div>
                      </div>

                      {/* Campaign Title & Badges */}
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                          {campaign.isSecret && (
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md text-[9px] font-bold flex items-center gap-1">
                              <Lock size={9} /> Secreta
                            </span>
                          )}
                          {campaign.isDirectContract && (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[9px] font-bold flex items-center gap-1">
                              <Handshake size={9} /> Contrato Direto
                            </span>
                          )}
                          {campaign.isBarter && (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-md text-[9px] font-bold flex items-center gap-1">
                              <Gift size={9} /> Permuta
                            </span>
                          )}
                          {pendingCCsCount > 0 && (
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md text-[9px] font-extrabold animate-pulse flex items-center gap-1">
                              ● {pendingCCsCount} candidato{pendingCCsCount > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-bold text-slate-900 group-hover:text-brand-primary transition-colors line-clamp-1">
                          <Link to={`/campaigns/${campaign.id}`}>{campaign.name}</Link>
                        </h3>
                        {campaign.objective && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                            {campaign.objective}
                          </p>
                        )}
                      </div>

                      {/* Financial Summary Strip in 2 Lines */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-[11px] bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/70">
                        {/* Verba Total */}
                        <div className="bg-white/90 p-2 rounded-lg border border-slate-200/60 flex flex-col justify-between">
                          <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Verba Total</span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="font-black text-slate-900 text-xs truncate">
                              {campaign.isBarter ? 'Permuta' : campaign.isDirectContract ? 'Direto' : formatCurrency(totalBudget)}
                            </span>
                          </div>
                        </div>

                        {/* Casting Criadores */}
                        <div className="bg-white/90 p-2 rounded-lg border border-slate-200/60 flex flex-col justify-between">
                          <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block truncate">
                            Casting ({approvedCCs.length})
                          </span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="font-black text-slate-700 text-xs truncate">
                              {campaign.isBarter ? 'Permuta' : campaign.isDirectContract ? 'Contrato' : formatCurrency(castingCost)}
                            </span>
                          </div>
                        </div>

                        {/* Saldo / Margem */}
                        <div className={cn(
                          "p-2 rounded-lg border flex flex-col justify-between",
                          campaign.isBarter || campaign.isDirectContract
                            ? "bg-indigo-50/60 border-indigo-200/60"
                            : remainingBudget >= 0 ? "bg-emerald-50/70 border-emerald-200/70" : "bg-rose-50/70 border-rose-200/70"
                        )}>
                          <span className={cn(
                            "text-[9px] font-extrabold uppercase tracking-wider block truncate",
                            campaign.isBarter || campaign.isDirectContract ? "text-indigo-700" :
                            remainingBudget >= 0 ? "text-emerald-700" : "text-rose-700"
                          )}>
                            {campaign.isBarter || campaign.isDirectContract ? 'Modalidade' : 'Margem'}
                          </span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className={cn(
                              "font-black text-xs block truncate",
                              campaign.isBarter || campaign.isDirectContract ? "text-indigo-700" :
                              remainingBudget >= 0 ? "text-emerald-700" : "text-rose-700"
                            )}>
                              {campaign.isBarter ? 'Permuta' : campaign.isDirectContract ? 'Direto' : formatCurrency(remainingBudget)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Casting Avatars and Deliveries Progress */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-2 overflow-hidden">
                            {approvedCCs.slice(0, 4).map(cc => {
                              const cr = creators[cc.creatorId];
                              return (
                                <div key={cc.id} className="inline-block ring-2 ring-white rounded-full" title={`@${cr?.artisticName}`}>
                                  <UserAvatar
                                    src={cr?.photoUrl}
                                    name={cr?.artisticName || cr?.fullName || 'Criador'}
                                    size="custom"
                                    shape="circle"
                                    className="h-6 w-6"
                                    textClassName="text-[8px]"
                                  />
                                </div>
                              );
                            })}
                            {approvedCCs.length > 4 && (
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[9px] font-black text-slate-700 ring-2 ring-white">
                                +{approvedCCs.length - 4}
                              </div>
                            )}
                          </div>
                          <span className="text-[11px] font-bold text-slate-500">
                            {approvedCCs.length} {approvedCCs.length === 1 ? 'criador' : 'criadores'}
                          </span>
                        </div>

                        {totalDeliveries > 0 && (
                          <div className="text-right">
                            <span className="text-[10px] font-extrabold text-slate-600 block">
                              {completedDeliveries}/{totalDeliveries} Entregas
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Footer: Action Button */}
                    <div className="px-5 py-3.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400">
                        {totalDeliveries === 0 ? 'Sem criadores no casting' : `${totalDeliveries - completedDeliveries} pendentes`}
                      </span>

                      <Link
                        to={`/campaigns/${campaign.id}`}
                        className="px-3.5 py-1.5 bg-brand-primary hover:bg-indigo-600 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer no-underline"
                      >
                        Ver Campanha & Entregas <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Criar Nova Campanha */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-[100] overflow-y-auto p-3 sm:p-4 flex items-center justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)} />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative w-full max-w-xl bg-white rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto z-10">
              <div className="p-5 sm:p-6 border-b border-[#E2E8F0] flex items-center justify-between shrink-0 bg-white">
                <div>
                  <h2 className="text-xl font-bold text-[#0F172A]">Criar Nova Campanha</h2>
                  <p className="text-xs text-slate-500">Cadastre a campanha e defina briefing e casting na tela detalhada</p>
                </div>
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer border-none bg-transparent">✕</button>
              </div>
              <form className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-4 custom-scrollbar" onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const newDocRef = await addDoc(collection(db, 'campaigns'), {
                  name: formData.get('name'),
                  companyId: formData.get('companyId'),
                  objective: formData.get('objective') || '',
                  startDate: formData.get('startDate'),
                  endDate: formData.get('endDate'),
                  totalBudget: Number(formData.get('totalBudget')) || 0,
                  creatorCache: Number(formData.get('creatorCache')) || 0,
                  isSecret: formData.get('isSecret') === 'on',
                  isDirectContract: formData.get('isDirectContract') === 'on',
                  isBarter: modalIsBarter,
                  barterDetails: modalIsBarter ? (formData.get('barterDetails') as string) || '' : '',
                  status: 'briefing',
                  createdAt: serverTimestamp(),
                  briefing: {
                    product: '',
                    keyMessage: '',
                    mustHave: '',
                    donts: '',
                    cta: '',
                    hashtags: '',
                    link: '',
                    coupon: '',
                    attachments: []
                  }
                });

                setIsCreateModalOpen(false);
                navigate(`/campaigns/${newDocRef.id}`);
              }}>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Nome da Campanha</label>
                  <input name="name" required placeholder="Ex: Lançamento Coleção Verão" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand-primary text-sm font-semibold" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Cliente/Empresa</label>
                    <select name="companyId" required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand-primary text-sm bg-white font-medium">
                      <option value="">Selecione o Cliente</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Verba Total (R$)</label>
                    <input name="totalBudget" type="number" step="0.01" placeholder="0,00" disabled={modalIsBarter} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand-primary text-sm font-semibold disabled:bg-slate-100" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Data de Início</label>
                    <input name="startDate" type="date" required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand-primary text-sm" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Data de Término</label>
                    <input name="endDate" type="date" required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand-primary text-sm" />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Objetivo Estratégico</label>
                  <textarea name="objective" rows={3} placeholder="Descreva a meta da campanha (ex: gerar 50k impressões e vendas do produto X)..." className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-brand-primary text-xs font-medium resize-none" />
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Opções Especiais</span>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                      <input type="checkbox" name="isSecret" className="rounded text-brand-primary" />
                      Campanha Secreta / NDA
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                      <input type="checkbox" name="isDirectContract" className="rounded text-brand-primary" />
                      Contrato Direto com a Empresa
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-700">
                      <input type="checkbox" checked={modalIsBarter} onChange={(e) => setModalIsBarter(e.target.checked)} className="rounded text-amber-500" />
                      Permuta de Produtos/Serviços
                    </label>
                  </div>

                  {modalIsBarter && (
                    <div className="pt-2">
                      <label className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block mb-1">Itens / Serviços Oferecidos em Permuta</label>
                      <input name="barterDetails" placeholder="Ex: R$ 500 em créditos na loja + envio do kit verão" className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-white text-xs font-medium outline-none focus:border-amber-400" />
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Cancelar</button>
                  <button type="submit" className="px-5 py-2.5 bg-brand-primary hover:bg-indigo-600 text-white font-extrabold text-xs rounded-xl shadow-md">Salvar e Abrir Campanha</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
