import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Users, 
  Search, 
  Plus, 
  Filter, 
  Grid, 
  List as ListIcon, 
  MoreVertical,
  Instagram,
  Youtube,
  Globe,
  MapPin,
  CheckCircle2,
  Clock,
  Pause,
  XCircle,
  Repeat,
  Building2,
  Trash2,
  KeyRound
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Creator, CreatorStatus, RecurringContract } from '../types';
import { formatNumber, cn } from '../lib/utils';
import { usePrivacy } from '../context/PrivacyContext';
import { motion, AnimatePresence } from 'motion/react';
import { DatabaseResetModal } from '../components/DatabaseResetModal';
import { ChangeCreatorPasswordModal } from '../components/ChangeCreatorPasswordModal';
import { formatCPF, isValidCPF } from '../lib/cpfValidation';
import { UserAvatar } from '../components/UserAvatar';

const categoriesList = [
  'Beleza', 'Gastronomia', 'Lifestyle', 'Fitness', 'Maternidade', 'Pets', 
  'Automotivo', 'Tecnologia', 'Saúde', 'Humor', 'Moda', 'Educação', 'Casa e Decoração'
];

function StatusBadge({ status }: { status: CreatorStatus }) {
  const styles = {
    active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    review: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
    paused: 'bg-[#F1F5F9] text-[#475569] border-slate-200',
    rejected: 'bg-[#FEE2E2] text-[#B91C1C] border-rose-200',
  };

  const labels = { active: 'ATIVO', review: 'AGUARDANDO APROVAÇÃO', paused: 'PAUSADO', rejected: 'RECUSADO' };

  return (
    <span className={cn(
      "px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider border flex items-center gap-1",
      styles[status]
    )}>
      {status === 'active' && <CheckCircle2 size={10} />}
      {status === 'review' && <Clock size={10} />}
      {labels[status]}
    </span>
  );
}

function CreatorCard({ creator, recurringContracts = [], onApprove, onReject, onChangePassword }: { 
  creator: Creator; 
  recurringContracts?: RecurringContract[]; 
  key?: any;
  onApprove?: (id: string, name: string) => void;
  onReject?: (id: string, name: string) => void;
  onChangePassword?: (creator: Creator) => void;
}) {
  const { formatCurrency } = usePrivacy();
  const creatorContracts = recurringContracts.filter(c => 
    c.status === 'active' && c.creators?.some(cr => cr.creatorId === creator.id)
  );

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-white rounded-[16px] border p-5 hover:border-brand-primary transition-all group flex flex-col justify-between",
        creator.status === 'review' ? "border-amber-300 ring-2 ring-amber-400/20 bg-amber-50/10" : "border-[#E2E8F0]"
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <UserAvatar
              src={creator.photoUrl}
              name={creator.artisticName || creator.fullName}
              size="lg"
              shape="rounded-xl"
              className="border border-slate-200"
              textClassName="text-base"
            />
            <div className="min-w-0">
              <h3 className="font-bold text-[#0F172A] truncate m-0">@{creator.artisticName}</h3>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                <StatusBadge status={creator.status} />
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider border",
                  creator.role === 'admin' ? "bg-purple-100 text-purple-800 border-purple-200" : "bg-blue-100 text-blue-800 border-blue-200"
                )}>
                  {creator.role === 'admin' ? 'ADMIN' : 'INFLUENCIADOR'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Change Password Action Button */}
          {onChangePassword && (
            <button
              type="button"
              onClick={() => onChangePassword(creator)}
              title="Alterar Senha do Criador"
              className="w-8 h-8 rounded-lg border border-slate-200 hover:border-purple-300 bg-slate-50/80 hover:bg-purple-50 text-slate-500 hover:text-brand-primary flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-2xs"
            >
              <KeyRound size={14} />
            </button>
          )}
        </div>

        {/* Quick Pending Approval Banner for Admins */}
        {creator.status === 'review' && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs text-amber-900 font-bold">
              <Clock size={13} className="text-amber-600 shrink-0" />
              <span>Aguardando Aprovação</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-snug m-0">
              Cadastrado pelo site. Aprove para liberar o perfil em campanhas.
            </p>
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => onApprove && onApprove(creator.id, creator.artisticName || creator.fullName)}
                className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
              >
                <CheckCircle2 size={13} />
                Aprovar
              </button>
              <button
                onClick={() => onReject && onReject(creator.id, creator.artisticName || creator.fullName)}
                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                Recusar
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-4 border-t border-b border-[#F1F5F9] py-3.5">
          <div className="flex flex-col">
            <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider mb-0.5">Seguidores</span>
            <span className="text-[14px] font-bold text-[#0F172A]">{formatNumber(creator.metrics?.followers || 0)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider mb-0.5">Média Views</span>
            <span className="text-[14px] font-bold text-[#0F172A]">{formatNumber(creator.metrics?.avgViews || 0)}</span>
          </div>
        </div>

        {/* Recurring Contracts Badge per Company */}
        {creatorContracts.length > 0 && (
          <div className="mb-4 p-2.5 bg-purple-50/80 border border-purple-100 rounded-xl flex items-center justify-between text-xs text-purple-900 font-bold gap-2">
            <span className="flex items-center gap-1.5 text-[11px] text-purple-800 font-bold shrink-0">
              <Repeat size={13} className="text-purple-600 shrink-0" />
              {creatorContracts.length} {creatorContracts.length === 1 ? 'Empresa Recorrente' : 'Empresas Recorrentes'}
            </span>
            <span className="text-[10px] text-purple-900 bg-white/90 px-2 py-0.5 rounded-md border border-purple-200 font-extrabold truncate max-w-[130px]" title={creatorContracts.map(c => c.companyName).join(', ')}>
              {creatorContracts.map(c => c.companyName).join(', ')}
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          {(creator.categories || []).slice(0, 2).map(cat => (
            <span key={cat} className="text-[10px] uppercase tracking-wide font-bold text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded-md">
              {cat}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-[#F1F5F9] mt-2">
         <div className="text-[13px] font-bold text-[#0F172A]">
           {formatCurrency(creator.pricing?.reel || 0)} <span className="text-[10px] text-[#64748B] font-medium">/ reel</span>
         </div>
         <Link 
           to={`/creators/${creator.id}`} 
           className="px-3 py-1.5 bg-purple-50 hover:bg-brand-primary text-brand-primary hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-xs"
         >
           Ver Tela do Criador →
         </Link>
      </div>
    </motion.div>
  );
}

export default function Creators() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [recurringContracts, setRecurringContracts] = useState<RecurringContract[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [creatorToChangePassword, setCreatorToChangePassword] = useState<Creator | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchParams, setSearchParams] = useSearchParams();
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [minFollowers, setMinFollowers] = useState<string>('');
  const [maxFollowers, setMaxFollowers] = useState<string>('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');

  useEffect(() => {
    if (searchParams.get('filters') === 'true') {
      setShowAdvancedFilters(true);
    } else {
      setShowAdvancedFilters(false);
    }
  }, [searchParams]);

  useEffect(() => {
    const q = query(collection(db, 'creators'), orderBy('createdAt', 'desc'));
    const unsubCreators = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Creator));
      setCreators(data);
    }, (err) => {
      console.warn("Creators snapshot warning:", err.message);
    });

    const unsubRecurring = onSnapshot(collection(db, 'recurringContracts'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RecurringContract));
      setRecurringContracts(data);
    }, (err) => {
      console.warn("Recurring contracts snapshot warning:", err.message);
    });

    return () => {
      unsubCreators();
      unsubRecurring();
    };
  }, []);

  const handleApproveCreator = async (creatorId: string, name: string) => {
    try {
      await updateDoc(doc(db, 'creators', creatorId), {
        status: 'active'
      });

      try {
        const { createNotification } = await import('../lib/notifications');
        await createNotification({
          title: 'Cadastro Aprovado! 🎉',
          message: `Parabéns @${name}! Seu perfil no Rocketz Creators foi aprovado. Você agora pode participar de campanhas e receber propostas de marcas.`,
          type: 'approval',
          targetRole: 'creator',
          creatorId: creatorId,
          link: `/creators/${creatorId}`
        });
      } catch (notifErr) {
        console.warn("Could not create approval notification:", notifErr);
      }

      alert(`O criador @${name} foi aprovado com sucesso e agora está disponível para campanhas!`);
    } catch (err: any) {
      console.error("Error approving creator:", err);
      alert("Erro ao aprovar criador.");
    }
  };

  const handleRejectCreator = async (creatorId: string, name: string) => {
    if (!confirm(`Deseja recusar o cadastro do criador @${name}?`)) return;
    try {
      await updateDoc(doc(db, 'creators', creatorId), {
        status: 'rejected'
      });
      alert(`O cadastro do criador @${name} foi marcado como recusado.`);
    } catch (err: any) {
      console.error("Error rejecting creator:", err);
      alert("Erro ao recusar criador.");
    }
  };

  const pendingCreatorsCount = creators.filter(c => c.status === 'review').length;
  const activeCreatorsCount = creators.filter(c => c.status === 'active').length;

  const filteredCreators = creators.filter(cre => {
    const matchesSearch = (cre.fullName || '').toLowerCase().includes(search.toLowerCase()) || 
                          (cre.artisticName || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || cre.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || (cre.categories || []).includes(categoryFilter);
    
    const matchesMinFollowers = !minFollowers || (cre.metrics?.followers || 0) >= Number(minFollowers);
    const matchesMaxFollowers = !maxFollowers || (cre.metrics?.followers || 0) <= Number(maxFollowers);
    const matchesMinPrice = !minPrice || (cre.pricing?.reel || 0) >= Number(minPrice);
    const matchesMaxPrice = !maxPrice || (cre.pricing?.reel || 0) <= Number(maxPrice);

    return matchesSearch && matchesStatus && matchesCategory && 
           matchesMinFollowers && matchesMaxFollowers && matchesMinPrice && matchesMaxPrice;
  });

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#0F172A] m-0">Casting de Criadores</h1>
          <p className="m-1 mt-0 text-[#64748B] text-[14px]">Gerencie e descubra talentos para suas campanhas</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsResetModalOpen(true)}
            className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 h-11 px-4 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Limpar todos os criadores de conteúdo do banco"
          >
            <Trash2 size={15} className="text-rose-600" />
            Zerar Casting
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-brand-primary text-white h-11 px-6 rounded-lg text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-600 transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <Plus size={18} />
            Novo Criador
          </button>
        </div>
      </header>

      {/* Quick Status Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Todos ({creators.length})
        </button>
        <button
          onClick={() => setStatusFilter('review')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
            statusFilter === 'review'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100'
          }`}
        >
          <Clock size={13} />
          Aguardando Aprovação ({pendingCreatorsCount})
        </button>
        <button
          onClick={() => setStatusFilter('active')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
            statusFilter === 'active'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-emerald-50 text-emerald-900 border border-emerald-300 hover:bg-emerald-100'
          }`}
        >
          <CheckCircle2 size={13} />
          Ativos ({activeCreatorsCount})
        </button>
        <button
          onClick={() => setStatusFilter('paused')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            statusFilter === 'paused'
              ? 'bg-slate-700 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Pausados
        </button>
      </div>

      <div className="bg-white p-6 rounded-[16px] border border-[#E2E8F0] shadow-sm flex flex-col lg:flex-row gap-4 items-center">
          <div className="flex-1 relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Pesquisar por nome ou arroba..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <select 
              className="flex-1 lg:flex-none bg-[#F9FAFB] border border-[#E2E8F0] rounded-lg px-4 py-2.5 text-xs font-bold text-[#64748B] outline-none"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">TODAS CATEGORIAS</option>
              {categoriesList.map(cat => <option key={cat} value={cat}>{cat.toUpperCase()}</option>)}
            </select>
            <select 
              className="flex-1 lg:flex-none bg-[#F9FAFB] border border-[#E2E8F0] rounded-lg px-4 py-2.5 text-xs font-bold text-[#64748B] outline-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">TODOS STATUS</option>
              <option value="active">ATIVO</option>
              <option value="review">EM ANÁLISE / AGUARDANDO APROVAÇÃO</option>
              <option value="paused">PAUSADO</option>
              <option value="rejected">RECUSADO</option>
            </select>
          </div>
      </div>

      <AnimatePresence>
        {showAdvancedFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-slate-50 border border-[#E2E8F0] rounded-[16px] p-6 -mt-4 overflow-hidden shadow-sm"
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E2E8F0]">
              <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider">Filtros Avançados</h3>
              <button 
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams);
                  newParams.delete('filters');
                  setSearchParams(newParams);
                }}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold uppercase tracking-wide cursor-pointer"
              >
                Fechar Filtros
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Mínimo de Seguidores</label>
                <input 
                  type="number" 
                  placeholder="Ex: 50000"
                  className="w-full px-3.5 py-2 rounded-lg border border-[#E2E8F0] bg-white outline-none focus:border-brand-primary text-sm"
                  value={minFollowers}
                  onChange={(e) => setMinFollowers(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Máximo de Seguidores</label>
                <input 
                  type="number" 
                  placeholder="Ex: 1000000"
                  className="w-full px-3.5 py-2 rounded-lg border border-[#E2E8F0] bg-white outline-none focus:border-brand-primary text-sm"
                  value={maxFollowers}
                  onChange={(e) => setMaxFollowers(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Preço Mínimo (Reel)</label>
                <input 
                  type="number" 
                  placeholder="Ex: 500"
                  className="w-full px-3.5 py-2 rounded-lg border border-[#E2E8F0] bg-white outline-none focus:border-brand-primary text-sm"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">Preço Máximo (Reel)</label>
                <input 
                  type="number" 
                  placeholder="Ex: 5000"
                  className="w-full px-3.5 py-2 rounded-lg border border-[#E2E8F0] bg-white outline-none focus:border-brand-primary text-sm"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setMinFollowers('');
                  setMaxFollowers('');
                  setMinPrice('');
                  setMaxPrice('');
                }}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-white transition-all cursor-pointer bg-transparent"
              >
                Limpar Filtros
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AnimatePresence>
          {filteredCreators.map(creator => (
            <CreatorCard 
              key={creator.id} 
              creator={creator} 
              recurringContracts={recurringContracts} 
              onApprove={handleApproveCreator}
              onReject={handleRejectCreator}
              onChangePassword={setCreatorToChangePassword}
            />
          ))}
        </AnimatePresence>
      </div>

      {filteredCreators.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4">
            <Users size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Nenhum criador encontrado</h3>
          <p className="text-slate-500 max-w-xs">Tente ajustar seus filtros ou cadastrar um novo criador no sistema.</p>
        </div>
      )}

      {/* Modal matching theme */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] overflow-y-auto p-3 sm:p-4 flex items-center justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[20px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto z-10"
            >
              <div className="p-5 sm:p-6 border-b border-[#E2E8F0] flex items-center justify-between shrink-0 bg-white">
                <h2 className="text-xl font-bold text-[#0F172A]">Novo Criador</h2>
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer">✕</button>
              </div>
              
              <form className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5" onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const rawCpf = (formData.get('cpf') as string) || '';
                const formattedCpf = formatCPF(rawCpf);

                if (rawCpf && !isValidCPF(rawCpf)) {
                  alert('Por favor, informe um CPF válido (000.000.000-00).');
                  return;
                }

                const newData = {
                  fullName: formData.get('fullName') as string,
                  artisticName: formData.get('artisticName') as string,
                  email: formData.get('email') as string,
                  cpf: formattedCpf,
                  document: formattedCpf,
                  photoUrl: (formData.get('photoUrl') as string) || '',
                  categories: [formData.get('category') as string],
                  status: 'review',
                  metrics: { followers: 10000, avgViews: 2500, avgEngagement: 4.5 },
                  pricing: { story: 200, reel: 450, post: 300, combo: 800 },
                  socials: { instagram: `https://instagram.com/${formData.get('artisticName')}` },
                  createdAt: serverTimestamp(),
                };
                await addDoc(collection(db, 'creators'), newData);
                setIsModalOpen(false);
              }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Nome Completo</label>
                    <input name="fullName" required className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Nome Artístico / @</label>
                    <input name="artisticName" required placeholder="ex: juliana.fit" className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">CPF do Criador</label>
                    <input 
                      name="cpf" 
                      placeholder="000.000.000-00" 
                      maxLength={14}
                      onChange={(e) => {
                        e.target.value = formatCPF(e.target.value);
                      }}
                      className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm" 
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">E-mail</label>
                    <input name="email" type="email" required className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm" />
                  </div>
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Categoria Principal</label>
                    <select name="category" className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm bg-white">
                      {categoriesList.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">URL da Foto de Perfil (Opcional)</label>
                    <input name="photoUrl" placeholder="https://..." className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm" />
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-[#E2E8F0] flex justify-end gap-3 shrink-0 bg-white">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-sm font-bold text-[#64748B] hover:text-[#0F172A] transition-all cursor-pointer">Cancelar</button>
                  <button type="submit" className="px-8 py-2.5 bg-brand-primary text-white text-sm font-bold rounded-lg shadow-lg shadow-indigo-200 hover:bg-indigo-600 transition-all active:scale-95 cursor-pointer">Salvar Cadastro</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Database Reset Modal for Creators */}
      <DatabaseResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        initialScope="creators"
      />

      {/* Change Creator Password Modal */}
      <ChangeCreatorPasswordModal
        isOpen={!!creatorToChangePassword}
        onClose={() => setCreatorToChangePassword(null)}
        creator={creatorToChangePassword}
      />
    </div>
  );
}
