import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Search, 
  Filter, 
  Calendar, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  FileText, 
  Send, 
  ExternalLink, 
  Building2, 
  Tag, 
  Megaphone, 
  Layers, 
  Info, 
  X, 
  ArrowRight,
  Check,
  AlertCircle,
  HelpCircle,
  Clapperboard,
  Video,
  Instagram,
  Gift
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  doc, 
  getDoc 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Campaign, Company, Creator, CampaignCreator } from '../types';
import { cn } from '../lib/utils';
import { usePrivacy } from '../context/PrivacyContext';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { createNotification } from '../lib/notifications';

export default function AvailableCampaigns() {
  const { formatCurrency } = usePrivacy();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [creatorProfile, setCreatorProfile] = useState<Creator | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'creator' | 'company' | null>(null);
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Data states
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [myParticipations, setMyParticipations] = useState<Record<string, CampaignCreator>>({});

  // Filter and Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'detailed'>('grid');

  // Modals state
  const [selectedBriefingCamp, setSelectedBriefingCamp] = useState<Campaign | null>(null);
  const [applyingCamp, setApplyingCamp] = useState<Campaign | null>(null);
  const [applyingAmount, setApplyingAmount] = useState<number>(0);
  const [applyingNotes, setApplyingNotes] = useState<string>('');
  const [isSubmittingApp, setIsSubmittingApp] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // 1. Auth & Creator profile loading
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setCurrentUser(u);
      if (!u) {
        setLoading(false);
        return;
      }

      try {
        const { isAdminEmail } = await import('../lib/firebase');
        if (isAdminEmail(u.email)) {
          setUserRole('admin');
        } else {
          const compSnap = await getDoc(doc(db, 'companyUsers', u.uid));
          if (compSnap.exists()) {
            setUserRole('company');
            const cData = compSnap.data();
            setUserCompanyId(cData?.companyId || null);
          } else {
            setUserRole('creator');
          }
        }

        // Fetch Creator Doc if creator exists
        const creatorSnap = await getDoc(doc(db, 'creators', u.uid));
        if (creatorSnap.exists()) {
          setCreatorProfile({ id: creatorSnap.id, ...creatorSnap.data() } as Creator);
        }
      } catch (err) {
        console.error("Error loading user profile in available campaigns:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubAuth();
  }, []);

  // 2. Load Campaigns and Companies
  useEffect(() => {
    const unsubCamp = onSnapshot(collection(db, 'campaigns'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Campaign));
      // Sort newest first
      list.sort((a, b) => {
        const tA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const tB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return tB - tA;
      });
      setCampaigns(list);
    }, (err) => console.warn("Campaigns listener warning:", err));

    const unsubComp = onSnapshot(collection(db, 'companies'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Company));
      setCompanies(list);
    }, (err) => console.warn("Companies listener warning:", err));

    return () => {
      unsubCamp();
      unsubComp();
    };
  }, []);

  // 3. Load Creator's participations/candidacies in all campaigns
  const loadMyParticipations = async () => {
    if (!currentUser) return;
    try {
      const map: Record<string, CampaignCreator> = {};
      const campsSnap = await getDocs(collection(db, 'campaigns'));
      for (const cDoc of campsSnap.docs) {
        const creatorsSnap = await getDocs(collection(db, `campaigns/${cDoc.id}/creators`));
        const found = creatorsSnap.docs.find(d => d.data().creatorId === currentUser.uid);
        if (found) {
          map[cDoc.id] = { id: found.id, ...found.data() } as CampaignCreator;
        }
      }
      setMyParticipations(map);
    } catch (err) {
      console.error("Error fetching creator participations:", err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadMyParticipations();
    }
  }, [currentUser, campaigns]);

  // Handle Application Submit
  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyingCamp || !currentUser) return;

    if (userRole === 'company' || (userCompanyId && applyingCamp.companyId === userCompanyId)) {
      alert('Usuários da empresa não podem se candidatar às próprias campanhas criadas.');
      return;
    }

    if (!applyingNotes.trim()) {
      alert('Por favor, descreva como você pode ajudar nesta campanha.');
      return;
    }

    setIsSubmittingApp(true);
    try {
      const creatorName = creatorProfile?.artisticName || creatorProfile?.fullName || currentUser.displayName || 'Criador';
      const cacheValue = Number((applyingCamp as any).creatorCache || (applyingCamp as any).budget || 0);

      const campaignCreatorData = {
        campaignId: applyingCamp.id,
        creatorId: currentUser.uid,
        deliveryType: applyingCamp.isBarter ? 'Permuta de Produtos' : 'Reels + Stories',
        amount: cacheValue,
        deliveryDate: applyingCamp.endDate || '',
        postDate: '',
        deliveryStatus: 'pending',
        paymentStatus: 'pending',
        notes: applyingNotes.trim(),
        applicationStatus: 'pending', // Awaiting agency approval
        signature: {
          status: 'pending',
          sentAt: null,
          signedAt: null,
          contractUrl: ''
        },
        content: {
          script: '',
          videoUrl: '',
          imageUrl: '',
          publishedLink: '',
          storyPrints: [],
          metrics: { reach: 0, impressions: 0, clicks: 0, views: 0, engagement: 0 }
        },
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'campaigns', applyingCamp.id, 'creators'), campaignCreatorData);

      // Create agency notification
      try {
        await createNotification({
          title: 'Nova Candidatura de Criador 👤',
          message: `@${creatorName} se candidatou para a campanha "${applyingCamp.name}". Proposta: "${applyingNotes.trim().slice(0, 90)}..."`,
          type: 'application',
          targetRole: 'admin',
          creatorId: currentUser.uid,
          campaignId: applyingCamp.id,
          link: `/campaigns/${applyingCamp.id}`
        });
      } catch (notifErr) {
        console.error("Error creating notification:", notifErr);
      }

      setApplyingCamp(null);
      setApplyingNotes('');
      setSuccessToast(`Sua candidatura para "${applyingCamp.name}" foi enviada com sucesso! A equipe de casting avaliará seu perfil e ideias.`);
      setTimeout(() => setSuccessToast(null), 6000);
      loadMyParticipations();
    } catch (err: any) {
      console.error("Error applying to campaign:", err);
      alert(err.message || 'Erro ao enviar candidatura. Tente novamente.');
    } finally {
      setIsSubmittingApp(false);
    }
  };

  // Filter available campaigns (all active non-finished and non-secret campaigns)
  const openCampaigns = campaigns.filter(camp => {
    // If the logged-in user belongs to a company, hide campaigns created by their own company
    if (userCompanyId && camp.companyId === userCompanyId) {
      return false;
    }
    // Admin can see all non-secret
    if (userRole === 'admin') return !camp.isSecret;
    // Creators see all active campaigns that are not finished and not secret
    return camp.status !== 'finished' && !camp.isSecret;
  });

  // Extract categories / niches for filter buttons
  const availableCategories = Array.from(new Set([
    'Todos',
    ...companies.map(c => c.segment).filter(Boolean),
    'UGC & Reviews',
    'Moda & Beleza',
    'Tech & Games',
    'Lifestyle & Saúde',
    'Gastronomia'
  ]));

  // Apply search & category filters
  const filteredCampaigns = openCampaigns.filter(camp => {
    const company = companies.find(c => c.id === camp.companyId);
    const companyName = company?.name || '';
    const segment = company?.segment || '';
    const product = camp.briefing?.product || '';
    const objective = camp.objective || '';
    const keyMessage = camp.briefing?.keyMessage || '';

    const textMatch = 
      camp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      segment.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.toLowerCase().includes(searchTerm.toLowerCase()) ||
      objective.toLowerCase().includes(searchTerm.toLowerCase()) ||
      keyMessage.toLowerCase().includes(searchTerm.toLowerCase());

    if (!textMatch) return false;

    if (selectedCategory !== 'all' && selectedCategory !== 'Todos') {
      const matchSegment = segment.toLowerCase().includes(selectedCategory.toLowerCase()) ||
        product.toLowerCase().includes(selectedCategory.toLowerCase()) ||
        camp.name.toLowerCase().includes(selectedCategory.toLowerCase());
      if (!matchSegment) return false;
    }

    if (selectedFormat === 'barter' && !camp.isBarter) return false;
    if (selectedFormat === 'paid' && camp.isBarter) return false;

    return true;
  });

  const defaultImages = [
    "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=700",
    "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=700",
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=700",
    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=700",
    "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80&w=700"
  ];

  return (
    <div className="min-h-full bg-[#F8FAFC] pb-16">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="fixed top-5 right-5 z-50 max-w-md bg-emerald-600 text-white p-4 rounded-2xl shadow-xl flex items-start gap-3 border border-emerald-500"
          >
            <div className="p-1 bg-white/20 rounded-lg shrink-0 mt-0.5">
              <CheckCircle2 size={18} />
            </div>
            <div className="flex-1 text-xs leading-relaxed font-medium">
              <span className="font-bold block text-sm mb-0.5">Candidatura Registrada!</span>
              {successToast}
            </div>
            <button 
              onClick={() => setSuccessToast(null)} 
              className="text-white/70 hover:text-white border-none bg-transparent cursor-pointer p-1"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 flex flex-col gap-8">
        
        {/* Page Hero Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-8 sm:p-10 rounded-[28px] text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-white/5 relative overflow-hidden">
          <div className="flex flex-col max-w-2xl relative z-10">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold text-indigo-300 uppercase tracking-widest bg-white/10 px-3 py-1 rounded-lg w-fit flex items-center gap-1.5">
                <Sparkles size={13} className="text-brand-primary" /> Oportunidades & Castings
              </span>
              <span className="text-[11px] font-extrabold text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1 rounded-lg uppercase tracking-wider">
                {openCampaigns.length} Abertas
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold mt-3 text-white tracking-tight">
              Campanhas Disponíveis
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-2 leading-relaxed">
              Explore briefings abertos das marcas parceiras, confira os requisitos criativos, valores de cachê e candidate-se para participar das próximas produções.
            </p>
          </div>

          {/* Quick stats badge */}
          <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl shrink-0 font-medium relative z-10">
            <div className="flex flex-col">
              <span className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider">Oportunidades</span>
              <span className="text-2xl font-black text-white mt-0.5">{openCampaigns.length}</span>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div className="flex flex-col">
              <span className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider">Minhas Inscrições</span>
              <span className="text-2xl font-black text-brand-primary mt-0.5">
                {Object.keys(myParticipations).length}
              </span>
            </div>
          </div>
        </div>

        {/* Pending Review Banner for Newly Registered Creators */}
        {creatorProfile?.status === 'review' && (
          <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 border-2 border-amber-400/60 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Clock size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-950 m-0 flex items-center gap-2">
                  Cadastro Sob Análise da Curadoria
                  <span className="text-[10px] bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full font-extrabold uppercase">
                    Aguardando Aprovação
                  </span>
                </h4>
                <p className="text-xs text-amber-800 m-0 mt-0.5 leading-relaxed">
                  Seu perfil de criador está sendo analisado pela nossa equipe. Você já pode explorar todas as campanhas e enviar suas candidaturas!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filter & Search Bar Controls */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Search Input */}
          <div className="relative w-full md:w-96">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por marca, produto, tema ou nicho..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-brand-primary focus:bg-white transition-all font-medium text-slate-900"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Format Buttons & View Mode */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end overflow-x-auto">
            {/* Format toggle: Todos / Cachê Pago / Permuta */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedFormat('all')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer",
                  selectedFormat === 'all' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                )}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setSelectedFormat('paid')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-1",
                  selectedFormat === 'paid' ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                )}
              >
                <DollarSign size={13} /> Cachê em R$
              </button>
              <button
                type="button"
                onClick={() => setSelectedFormat('barter')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-1",
                  selectedFormat === 'barter' ? "bg-white text-purple-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                )}
              >
                <Gift size={13} /> Permuta
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-1",
                  viewMode === 'grid' ? "bg-white text-brand-primary shadow-sm" : "text-slate-500 hover:text-slate-800"
                )}
                title="Visualização em Grade"
              >
                <Layers size={14} /> Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode('detailed')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-1",
                  viewMode === 'detailed' ? "bg-white text-brand-primary shadow-sm" : "text-slate-500 hover:text-slate-800"
                )}
                title="Visualização Detalhada"
              >
                <FileText size={14} /> Lista Completa
              </button>
            </div>
          </div>
        </div>

        {/* Categories Quick Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider mr-1 shrink-0">Segmentos:</span>
          {availableCategories.slice(0, 8).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat === 'Todos' ? 'all' : cat)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border cursor-pointer shrink-0",
                (selectedCategory === cat || (cat === 'Todos' && selectedCategory === 'all'))
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="flex items-center justify-center p-16 bg-white rounded-2xl border border-slate-200">
            <div className="animate-spin rounded-full h-9 w-9 border-t-2 border-b-2 border-brand-primary"></div>
          </div>
        ) : filteredCampaigns.length === 0 ? (
          /* Empty State */
          <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-16 text-center flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100">
              <Sparkles size={28} />
            </div>
            <div className="flex flex-col gap-1 max-w-md">
              <h3 className="text-base font-bold text-slate-900">Nenhuma campanha encontrada</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Não encontramos nenhuma oportunidade aberta com os filtros atuais. Tente buscar por outros termos ou verifique novamente em breve!
              </p>
            </div>
            {(searchTerm || selectedCategory !== 'all' || selectedFormat !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                  setSelectedFormat('all');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border-none cursor-pointer transition-colors"
              >
                Limpar Todos os Filtros
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          /* GRID VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-medium">
            {filteredCampaigns.map((camp, idx) => {
              const company = companies.find(c => c.id === camp.companyId);
              const companyName = company?.name || 'Marca Parceira';
              const companySegment = company?.segment || 'Publicidade';
              const campImg = (camp as any).imageUrl || defaultImages[idx % defaultImages.length];
              const cacheVal = Number((camp as any).creatorCache || creatorProfile?.pricing?.combo || 250);
              const myParticipation = myParticipations[camp.id];

              return (
                <div 
                  key={camp.id} 
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:border-brand-primary hover:shadow-md transition-all group"
                >
                  {/* Campaign Image Banner */}
                  <div className="aspect-[16/10] bg-slate-100 relative overflow-hidden shrink-0">
                    <img 
                      src={campImg} 
                      alt={camp.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    
                    {/* Top Badges */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <span className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] text-white font-extrabold uppercase tracking-wide border border-white/10 flex items-center gap-1">
                        <Building2 size={11} className="text-indigo-300" /> {companyName}
                      </span>
                    </div>

                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
                      <span className="bg-indigo-600 px-2.5 py-1 rounded-full text-[10px] text-white font-bold uppercase tracking-wide shadow-sm">
                        {camp.status === 'briefing' ? 'Briefing Aberto' : 'Em Seleção'}
                      </span>
                    </div>

                    {/* Bottom overlay with Cache and segment */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between text-white">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-indigo-200 font-bold uppercase tracking-wider">
                          {camp.isBarter ? 'Remuneração' : 'Cachê Sugerido'}
                        </span>
                        <span className="text-base font-black text-emerald-400">
                          {camp.isBarter ? '🎁 Permuta / Recebidos' : formatCurrency(cacheVal)}
                        </span>
                      </div>

                      {companySegment && (
                        <span className="text-[10px] bg-white/15 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-slate-200 font-medium">
                          {companySegment}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div className="flex flex-col gap-2">
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-brand-primary transition-colors leading-snug">
                        {camp.name}
                      </h3>

                      {/* Dates */}
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold">
                        <Calendar size={13} className="text-slate-400 shrink-0" />
                        <span>
                          {camp.startDate ? new Date(camp.startDate).toLocaleDateString('pt-BR') : 'A definir'} até {camp.endDate ? new Date(camp.endDate).toLocaleDateString('pt-BR') : 'A definir'}
                        </span>
                      </div>

                      {/* Product or Subject */}
                      {camp.briefing?.product && (
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-0.5">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Produto / Foco:</span>
                          <span className="text-xs font-bold text-slate-800 line-clamp-1">{camp.briefing.product}</span>
                        </div>
                      )}

                      {/* Brief Explanation */}
                      <div className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                        {camp.objective || camp.briefing?.keyMessage || 'Participe desta campanha e conecte sua audiência à marca.'}
                      </div>
                    </div>

                    {/* Status or Application Actions */}
                    <div className="flex flex-col gap-2 pt-3 border-t border-slate-100 mt-2">
                      
                      {/* If creator already applied */}
                      {myParticipation ? (
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                          <div className="flex items-center gap-2">
                            {myParticipation.applicationStatus === 'approved' ? (
                              <span className="flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                <CheckCircle2 size={12} /> Selecionado!
                              </span>
                            ) : myParticipation.applicationStatus === 'rejected' ? (
                              <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                                Não selecionado
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                <Clock size={12} /> Candidatura em Análise
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedBriefingCamp(camp)}
                            className="text-xs text-brand-primary font-bold hover:underline border-none bg-transparent cursor-pointer flex items-center gap-1"
                          >
                            <FileText size={13} /> Ver Briefing
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedBriefingCamp(camp)}
                            className="h-9 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 transition-all border-none cursor-pointer"
                          >
                            <FileText size={13} /> Briefing
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setApplyingCamp(camp);
                              setApplyingAmount(cacheVal);
                            }}
                            className="h-9 bg-brand-primary hover:bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm shadow-indigo-600/20 border-none cursor-pointer"
                          >
                            <Send size={13} /> Candidatar-se
                          </button>
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* DETAILED LIST VIEW with Full Explanations */
          <div className="flex flex-col gap-6 font-medium">
            {filteredCampaigns.map((camp, idx) => {
              const company = companies.find(c => c.id === camp.companyId);
              const companyName = company?.name || 'Marca Parceira';
              const companySegment = company?.segment || 'Publicidade';
              const campImg = (camp as any).imageUrl || defaultImages[idx % defaultImages.length];
              const cacheVal = Number((camp as any).creatorCache || creatorProfile?.pricing?.combo || 250);
              const myParticipation = myParticipations[camp.id];

              return (
                <div
                  key={camp.id}
                  className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col lg:flex-row hover:border-brand-primary/80 transition-all group"
                >
                  {/* Left Column: Image & Quick Details */}
                  <div className="lg:w-80 h-56 lg:h-auto bg-slate-100 relative shrink-0 overflow-hidden">
                    <img
                      src={campImg}
                      alt={camp.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent lg:hidden" />
                    
                    <div className="absolute top-4 left-4 flex flex-col gap-1.5">
                      <span className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] text-white font-extrabold uppercase tracking-wide border border-white/10 w-fit flex items-center gap-1">
                        <Building2 size={11} className="text-indigo-300" /> {companyName}
                      </span>
                    </div>

                    <div className="absolute bottom-4 left-4 right-4 text-white lg:hidden">
                      <span className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider block">Cachê Líquido</span>
                      <span className="text-lg font-black text-emerald-400">
                        {camp.isBarter ? 'Permuta / Recebidos' : formatCurrency(cacheVal)}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Full Campaign Explanation & Requirements */}
                  <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between gap-6">
                    <div className="flex flex-col gap-4">
                      
                      {/* Header row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 text-brand-primary border border-indigo-100">
                              {camp.status === 'briefing' ? 'Briefing Aberto' : 'Em Seleção de Criadores'}
                            </span>
                            {companySegment && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase text-slate-500 bg-slate-100">
                                {companySegment}
                              </span>
                            )}
                          </div>
                          <h2 className="text-xl font-black text-slate-900 group-hover:text-brand-primary transition-colors">
                            {camp.name}
                          </h2>
                        </div>

                        {/* Remuneration block on desktop */}
                        <div className="hidden lg:flex flex-col items-end shrink-0">
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                            {camp.isBarter ? 'Modalidade' : 'Cachê Sugerido'}
                          </span>
                          <span className="text-xl font-black text-emerald-600">
                            {camp.isBarter ? '🎁 Permuta / Produtos' : formatCurrency(cacheVal)}
                          </span>
                        </div>
                      </div>

                      {/* Explanation Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        
                        {/* Objective / Overview */}
                        <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100 flex flex-col gap-1.5">
                          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <Info size={13} className="text-brand-primary" /> Objetivo da Campanha
                          </span>
                          <p className="text-slate-700 leading-relaxed m-0">
                            {camp.objective || 'Campanha de marketing de influência para promoção de marca, aumento de autoridade e conversão junto ao público-alvo.'}
                          </p>
                        </div>

                        {/* Product / Key Message */}
                        <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100 flex flex-col gap-1.5">
                          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <Megaphone size={13} className="text-indigo-600" /> Produto & Mensagem-Chave
                          </span>
                          <p className="text-slate-800 font-semibold m-0">
                            {camp.briefing?.product ? `Foco: ${camp.briefing.product}` : 'Produto ou serviço da marca'}
                          </p>
                          <p className="text-slate-600 text-[11px] leading-relaxed m-0 mt-0.5">
                            {camp.briefing?.keyMessage || 'Transmitir os diferenciais do produto com autenticidade, dinamismo e apelo visual.'}
                          </p>
                        </div>

                        {/* Creative Must-Haves if available */}
                        {camp.briefing?.mustHave && (
                          <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-100 flex flex-col gap-1.5">
                            <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                              <CheckCircle2 size={13} /> O que a Marca Espera (Must-Haves)
                            </span>
                            <p className="text-slate-700 text-[11px] leading-relaxed m-0 whitespace-pre-line">
                              {camp.briefing.mustHave}
                            </p>
                          </div>
                        )}

                        {/* Creative Dont's if available */}
                        {camp.briefing?.donts && (
                          <div className="bg-rose-50/40 p-4 rounded-2xl border border-rose-100 flex flex-col gap-1.5">
                            <span className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                              <AlertCircle size={13} /> O que Não Fazer (Dont's)
                            </span>
                            <p className="text-slate-700 text-[11px] leading-relaxed m-0 whitespace-pre-line">
                              {camp.briefing.donts}
                            </p>
                          </div>
                        )}

                      </div>

                      {/* Additional Delivery / Timeline tags */}
                      <div className="flex items-center gap-3 flex-wrap text-xs text-slate-600 pt-1">
                        <div className="flex items-center gap-1.5 font-semibold bg-slate-100 px-3 py-1.5 rounded-xl">
                          <Calendar size={13} className="text-slate-400" />
                          <span>Período: {camp.startDate ? new Date(camp.startDate).toLocaleDateString('pt-BR') : 'A definir'} - {camp.endDate ? new Date(camp.endDate).toLocaleDateString('pt-BR') : 'A definir'}</span>
                        </div>

                        {camp.briefing?.hashtags && (
                          <div className="flex items-center gap-1 font-mono text-[11px] bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl border border-indigo-100">
                            <span>{camp.briefing.hashtags}</span>
                          </div>
                        )}

                        {camp.briefing?.coupon && (
                          <div className="flex items-center gap-1 font-bold text-[11px] bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-100">
                            <span>Cupom: {camp.briefing.coupon}</span>
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Bottom Action Footer */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100 flex-wrap gap-4">
                      
                      {myParticipation ? (
                        <div className="flex items-center gap-2">
                          {myParticipation.applicationStatus === 'approved' ? (
                            <span className="flex items-center gap-1 text-xs font-black text-emerald-800 bg-emerald-100 px-3.5 py-1.5 rounded-xl">
                              <CheckCircle2 size={14} /> Candidatura Aprovada — Você está nesta campanha!
                            </span>
                          ) : myParticipation.applicationStatus === 'rejected' ? (
                            <span className="flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 px-3.5 py-1.5 rounded-xl">
                              Candidatura finalizada pelo casting
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-100/80 px-3.5 py-1.5 rounded-xl border border-amber-200">
                              <Clock size={14} /> Candidatura Enviada — Em Análise da Agência
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 font-medium">
                          Candidate-se para ser avaliado pela equipe de casting da agência.
                        </div>
                      )}

                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setSelectedBriefingCamp(camp)}
                          className="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold uppercase tracking-wider rounded-xl transition-all border-none cursor-pointer flex items-center gap-1.5"
                        >
                          <FileText size={14} /> Ver Briefing Completo
                        </button>

                        {!myParticipation && (
                          <button
                            type="button"
                            onClick={() => {
                              setApplyingCamp(camp);
                              setApplyingAmount(cacheVal);
                            }}
                            className="h-10 px-6 bg-brand-primary hover:bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-600/20 border-none cursor-pointer flex items-center gap-2 active:scale-95"
                          >
                            <Send size={14} /> Candidatar-se à Campanha
                          </button>
                        )}
                      </div>

                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* MODAL 1: Briefing Completo */}
      <AnimatePresence>
        {selectedBriefingCamp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-indigo-50 text-brand-primary rounded-xl">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 m-0">{selectedBriefingCamp.name}</h3>
                    <p className="text-xs text-slate-400 m-0">Briefing Criativo e Diretrizes da Marca</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBriefingCamp(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors border-none bg-transparent cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto flex flex-col gap-6 text-xs font-medium">
                
                {/* Product & Key Message */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Produto / Serviço</span>
                    <span className="text-sm font-bold text-slate-900">{selectedBriefingCamp.briefing?.product || 'Não informado'}</span>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Mensagem-Chave</span>
                    <span className="text-xs font-bold text-slate-900">{selectedBriefingCamp.briefing?.keyMessage || 'Não informada'}</span>
                  </div>
                </div>

                {/* Must-Haves */}
                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex flex-col gap-1.5">
                  <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 size={13} /> Requisitos Obrigatórios (Must-Haves)
                  </span>
                  <p className="text-slate-800 text-xs whitespace-pre-line leading-relaxed m-0">
                    {selectedBriefingCamp.briefing?.mustHave || 'Sem especificações adicionais.'}
                  </p>
                </div>

                {/* Dont's */}
                <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-100 flex flex-col gap-1.5">
                  <span className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider flex items-center gap-1">
                    <AlertCircle size={13} /> O que Evitar (Dont's)
                  </span>
                  <p className="text-slate-800 text-xs whitespace-pre-line leading-relaxed m-0">
                    {selectedBriefingCamp.briefing?.donts || 'Sem restrições adicionais.'}
                  </p>
                </div>

                {/* CTA & Hashtags */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Chamada para Ação (CTA)</span>
                    <span className="text-xs font-bold text-slate-900">{selectedBriefingCamp.briefing?.cta || 'Livre'}</span>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Hashtags Obrigatórias</span>
                    <span className="text-xs font-mono text-indigo-700">{selectedBriefingCamp.briefing?.hashtags || 'Nenhuma'}</span>
                  </div>
                </div>

                {/* Cupom & Links */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Cupom de Desconto</span>
                    <span className="text-xs font-bold text-emerald-700">{selectedBriefingCamp.briefing?.coupon || 'Nenhum'}</span>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Link de Apoio / Referência</span>
                    {selectedBriefingCamp.briefing?.link ? (
                      <a
                        href={selectedBriefingCamp.briefing.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-brand-primary font-bold flex items-center gap-1 hover:underline truncate"
                      >
                        {selectedBriefingCamp.briefing.link} <ExternalLink size={12} />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">Nenhum link fornecido</span>
                    )}
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedBriefingCamp(null)}
                  className="px-4 py-2 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors border-none bg-transparent cursor-pointer"
                >
                  Fechar
                </button>

                {!myParticipations[selectedBriefingCamp.id] && (
                  <button
                    type="button"
                    onClick={() => {
                      const camp = selectedBriefingCamp;
                      setSelectedBriefingCamp(null);
                      setApplyingCamp(camp);
                      setApplyingAmount(Number((camp as any).creatorCache || creatorProfile?.pricing?.combo || 250));
                    }}
                    className="h-10 px-5 bg-brand-primary hover:bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-600/20 border-none cursor-pointer flex items-center gap-2"
                  >
                    <Send size={13} /> Candidatar-se Agora
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Candidatura à Campanha */}
      <AnimatePresence>
        {applyingCamp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full overflow-hidden flex flex-col shadow-2xl border border-slate-200"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-indigo-50 text-brand-primary rounded-xl">
                    <Send size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 m-0">Candidatura à Campanha</h3>
                    <p className="text-xs text-slate-400 m-0">{applyingCamp.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setApplyingCamp(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors border-none bg-transparent cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleApplySubmit} className="p-6 flex flex-col gap-5 text-xs font-medium">
                
                <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100 text-slate-700 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase text-brand-primary tracking-wider">Como funciona a candidatura:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBriefingCamp(applyingCamp);
                      }}
                      className="text-[11px] text-brand-primary font-bold hover:underline border-none bg-transparent cursor-pointer flex items-center gap-1"
                    >
                      <FileText size={13} /> Consultar Briefing Completo
                    </button>
                  </div>
                  <p className="m-0 text-slate-600 leading-relaxed">
                    Descreva como você pode ajudar a marca a atingir seus objetivos. Seu perfil, métricas e proposta serão avaliados pela equipe de casting para definir a seleção.
                  </p>
                </div>

                {applyingCamp.isBarter && (
                  <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 font-bold text-xs flex items-center gap-2">
                    <Gift size={16} /> Campanha em formato de Permuta / Recebidos de Produtos
                  </div>
                )}

                {/* Como pode ajudar / Proposta / Descrição */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                    <span>Como você pode ajudar nesta campanha? *</span>
                    <span className="text-slate-400 font-normal normal-case">Obrigatório</span>
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Conte como você pode ajudar a marca, ideias de roteiro ou abordagem, formatos sugeridos e por que seu perfil é o ideal para esta campanha..."
                    value={applyingNotes}
                    onChange={(e) => setApplyingNotes(e.target.value)}
                    className="w-full p-3.5 rounded-xl border border-slate-200 outline-none focus:border-brand-primary focus:bg-white text-xs font-medium resize-none bg-slate-50 transition-all leading-relaxed"
                    required
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 mt-2">
                  <button
                    type="button"
                    onClick={() => setApplyingCamp(null)}
                    className="px-4 py-2.5 text-slate-600 hover:text-slate-900 font-bold text-xs rounded-xl border-none bg-transparent cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingApp}
                    className="h-11 px-6 bg-brand-primary hover:bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-600/20 border-none cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmittingApp ? (
                      <>
                        <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <Send size={14} /> Confirmar Candidatura
                      </>
                    )}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
