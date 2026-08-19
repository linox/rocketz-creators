import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  CheckCircle2, 
  Megaphone, 
  Clock, 
  DollarSign, 
  TrendingUp,
  FileText,
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { formatNumber } from '../lib/utils';
import { usePrivacy } from '../context/PrivacyContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'motion/react';
import { Creator, Campaign, CampaignCreator } from '../types';

interface Stats {
  totalCreators: number;
  activeCreators: number;
  pendingApprovalCreators: number;
  runningCampaigns: number;
  finishedCampaigns: number;
  totalCampaignValue: number;
  upcomingDeliveries: number;
  pendingSignatures: number;
}

interface SignatureItem {
  id: string;
  creatorName: string;
  creatorArtistic: string;
  campaignName: string;
  status: 'pending' | 'sent' | 'signed';
}

interface DeliveryItem {
  id: string;
  creatorArtistic: string;
  campaignName: string;
  type: string;
  deliveryStatus: string;
  dateStr: string;
}

function StatCard({ label, value, icon: Icon, color, trend }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white p-[20px] rounded-[16px] border border-[#E2E8F0] flex flex-col gap-2 shadow-sm"
    >
      <span className="text-[12px] text-[#64748B] uppercase tracking-[0.05em] font-semibold">{label}</span>
      <div className="flex items-baseline justify-between">
        <span className="text-[24px] font-bold text-[#0F172A]">{value}</span>
        {trend !== undefined && trend > 0 && (
          <span className="text-[12px] font-medium text-[#10B981]">
            ↑ {trend}%
          </span>
        )}
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const { formatCurrency } = usePrivacy();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalCreators: 0,
    activeCreators: 0,
    pendingApprovalCreators: 0,
    runningCampaigns: 0,
    finishedCampaigns: 0,
    totalCampaignValue: 0,
    upcomingDeliveries: 0,
    pendingSignatures: 0,
  });

  const [revenueData, setRevenueData] = useState<{ name: string; value: number }[]>([]);
  const [recentSignatures, setRecentSignatures] = useState<SignatureItem[]>([]);
  const [recentDeliveries, setRecentDeliveries] = useState<DeliveryItem[]>([]);

  useEffect(() => {
    async function fetchRealStats() {
      try {
        setLoading(true);

        // 1. Fetch all creators
        const creatorsSnap = await getDocs(collection(db, 'creators'));
        const creatorsList = creatorsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Creator));
        
        // 2. Fetch all campaigns
        const campaignsSnap = await getDocs(collection(db, 'campaigns'));
        const campaignsList = campaignsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));

        // 3. Fetch creators details from each campaign subcollection
        let allCampaignCreators: CampaignCreator[] = [];
        const campCreatorsPromises = campaignsList.map(camp => 
          getDocs(collection(db, `campaigns/${camp.id}/creators`)).then(snap => {
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CampaignCreator));
          })
        );
        const resolvedCampCreators = await Promise.all(campCreatorsPromises);
        resolvedCampCreators.forEach(list => {
          allCampaignCreators = [...allCampaignCreators, ...list];
        });

        // 4. Calculate core stats
        const activeCreatorsCount = creatorsList.filter(c => c.status === 'active').length;
        const pendingApprovalCreatorsCount = creatorsList.filter(c => c.status === 'review').length;
        const runningCampaignsList = campaignsList.filter(c => c.status !== 'finished');
        const runningCampaignsCount = runningCampaignsList.length;
        const finishedCampaignsCount = campaignsList.filter(c => c.status === 'finished').length;
        
        // Verba em Gestão (total budget of running campaigns, or all campaigns)
        const totalCampaignValue = runningCampaignsList.reduce((sum, c) => sum + (c.totalBudget || 0), 0);

        // Pendências (either pending/sent signatures or pending deliveries)
        const pendingSignaturesCount = allCampaignCreators.filter(
          cc => cc.signature?.status === 'pending' || cc.signature?.status === 'sent'
        ).length;

        const upcomingDeliveriesCount = allCampaignCreators.filter(
          cc => cc.deliveryStatus !== 'published'
        ).length;

        setStats({
          totalCreators: creatorsList.length,
          activeCreators: activeCreatorsCount,
          pendingApprovalCreators: pendingApprovalCreatorsCount,
          runningCampaigns: runningCampaignsCount,
          finishedCampaigns: finishedCampaignsCount,
          totalCampaignValue,
          upcomingDeliveries: upcomingDeliveriesCount,
          pendingSignatures: pendingSignaturesCount,
        });

        // 5. Generate Past 6 Months Revenue Growth Chart
        const monthsBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const chartList: { key: string; name: string; value: number }[] = [];
        const today = new Date();
        
        for (let i = 5; i >= 0; i--) {
          const targetDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
          chartList.push({
            key: `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`,
            name: `${monthsBR[targetDate.getMonth()]} ${String(targetDate.getFullYear()).slice(-2)}`,
            value: 0
          });
        }

        campaignsList.forEach(camp => {
          if (camp.startDate) {
            const campYearMonth = camp.startDate.substring(0, 7); // "YYYY-MM"
            const matchIndex = chartList.findIndex(item => item.key === campYearMonth);
            if (matchIndex !== -1) {
              chartList[matchIndex].value += (camp.totalBudget || 0);
            }
          }
        });

        setRevenueData(chartList.map(item => ({ name: item.name, value: item.value })));

        // 6. Map digital signatures to display real state
        const signatures: SignatureItem[] = [];
        allCampaignCreators.forEach(cc => {
          const matchingCreator = creatorsList.find(c => c.id === cc.creatorId);
          const matchingCampaign = campaignsList.find(c => c.id === cc.campaignId);
          if (matchingCreator && matchingCampaign) {
            signatures.push({
              id: cc.id,
              creatorName: matchingCreator.fullName,
              creatorArtistic: matchingCreator.artisticName,
              campaignName: matchingCampaign.name,
              status: cc.signature?.status || 'pending'
            });
          }
        });
        
        // Sort signatures to prioritize signatures in action (pending or sent first)
        signatures.sort((a, b) => {
          if (a.status === 'signed' && b.status !== 'signed') return 1;
          if (a.status !== 'signed' && b.status === 'signed') return -1;
          return 0;
        });

        setRecentSignatures(signatures.slice(0, 5));

        // 7. Map upcoming deliveries
        const deliveries: DeliveryItem[] = [];
        allCampaignCreators
          .filter(cc => cc.deliveryStatus !== 'published')
          .forEach(cc => {
            const matchingCreator = creatorsList.find(c => c.id === cc.creatorId);
            const matchingCampaign = campaignsList.find(c => c.id === cc.campaignId);
            if (matchingCreator && matchingCampaign) {
              let deliveryDateStr = 'Hoje';
              if (cc.deliveryDate) {
                const parts = cc.deliveryDate.split('-');
                if (parts.length === 3) {
                  deliveryDateStr = `${parts[2]}/${parts[1]}`;
                } else {
                  deliveryDateStr = new Date(cc.deliveryDate).toLocaleDateString('pt-BR');
                }
              }

              deliveries.push({
                id: cc.id,
                creatorArtistic: matchingCreator.artisticName,
                campaignName: matchingCampaign.name,
                type: cc.deliveryType || 'Video / Conteúdo',
                deliveryStatus: cc.deliveryStatus,
                dateStr: deliveryDateStr
              });
            }
          });

        setRecentDeliveries(deliveries.slice(0, 5));

      } catch (err) {
        console.error("Error loading dashboard live statistics: ", err);
      } finally {
        setLoading(false);
      }
    }

    fetchRealStats();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] w-full gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#6366F1] border-t-transparent" />
        <span className="text-xs text-[#64748B] font-bold uppercase tracking-wider animate-pulse">Carregando métricas reais do banco...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-[28px] font-bold text-[#0F172A] m-0">Dashboard Geral</h1>
          <p className="m-1 mt-0 text-[#64748B] text-[14px]">Visão geral de casting e performance de campanhas no sistema</p>
        </div>
      </header>

      {/* Pending Creator Approvals Alert Banner */}
      {stats.pendingApprovalCreators > 0 && (
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 border-2 border-amber-400/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Users size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-950 m-0 flex items-center gap-2">
                {stats.pendingApprovalCreators} {stats.pendingApprovalCreators === 1 ? 'Criador Aguardando Aprovação' : 'Criadores Aguardando Aprovação'}
                <span className="text-[10px] bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full font-extrabold uppercase">
                  Novo Cadastro
                </span>
              </h4>
              <p className="text-xs text-amber-800 m-0 mt-0.5 leading-relaxed">
                Existem influenciadores cadastrados pelo site aguardando avaliação da curadoria para ativação.
              </p>
            </div>
          </div>
          <Link
            to="/creators"
            className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm shrink-0"
          >
            Avaliar Criadores
            <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Main KPI Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[24px]">
        <StatCard 
          label="Casting de Criadores" 
          value={formatNumber(stats.totalCreators)} 
        />
        <StatCard 
          label="Campanhas Atuais" 
          value={stats.runningCampaigns} 
        />
        <StatCard 
          label="Verba em Gestão" 
          value={formatCurrency(stats.totalCampaignValue)} 
        />
        <StatCard 
          label="Pendências de Assinatura" 
          value={String(stats.pendingSignatures).padStart(2, '0')} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[24px]">
        {/* Revenue Growth chart area */}
        <div className="lg:col-span-2 bg-white rounded-[16px] border border-[#E2E8F0] overflow-hidden flex flex-col shadow-sm">
          <div className="p-4 px-6 border-b border-[#E2E8F0] flex justify-between items-center">
            <h2 className="text-[16px] font-bold text-[#0F172A]">Crescimento de Receita (Verba de Campanhas)</h2>
            <span className="text-[12px] text-[#6366F1] font-bold">Consolidado Mensal</span>
          </div>
          <div className="p-6 h-[320px] w-full">
            {revenueData.every(d => d.value === 0) ? (
              <div className="h-full w-full border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center p-6 gap-2">
                <TrendingUp size={28} className="text-slate-300 animate-pulse" />
                <span className="text-xs font-bold text-slate-700">Nenhum orçamento de campanha cadastrado nos meses exibidos</span>
                <span className="text-[11px] text-[#64748B] max-w-xs">Adicione campanhas com valores na aba "Campanhas" para alimentar este gráfico</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11}} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `R$ ${formatNumber(val)}`} tick={{fill: '#64748b', fontSize: 10}} />
                  <Tooltip 
                    formatter={(value: any) => [formatCurrency(value), "Verba"]}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#6366F1" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Informational Feeds (Signatures & Upcoming Deliveries) */}
        <div className="flex flex-col gap-[24px]">
          {/* Digital Signatures widget */}
          <div className="bg-white rounded-[16px] border border-[#E2E8F0] overflow-hidden shadow-sm">
            <div className="p-4 px-6 border-b border-[#E2E8F0] flex justify-between items-center">
              <h2 className="text-[16px] font-bold text-[#0F172A]">Contratos & Assinaturas</h2>
              <span className="text-[10px] bg-[#6366F1]/10 text-brand-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Membros</span>
            </div>
            
            <div className="p-6 flex flex-col gap-4">
              {recentSignatures.length === 0 ? (
                <div className="text-center py-6 text-[12px] text-[#64748B] flex flex-col items-center gap-2">
                  <FileText className="text-slate-300" size={24} />
                  <span>Nenhum criador vinculado a campanhas.</span>
                </div>
              ) : (
                recentSignatures.map((sig) => (
                  <div key={sig.id} className="flex justify-between items-center text-[13px] border-b border-dashed border-[#F1F5F9] pb-2 last:border-none last:pb-0">
                    <div className="flex flex-col">
                      <strong className="text-[#0F172A]">{sig.creatorName}</strong>
                      <span className="text-[11px] text-[#64748B] max-w-[150px] truncate">{sig.campaignName}</span>
                    </div>
                    {sig.status === 'signed' ? (
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-[#DCFCE7] text-[#15803D]">Assinado</span>
                    ) : sig.status === 'sent' ? (
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-indigo-50 text-brand-primary animate-pulse">Enviado</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-[#FEF9C3] text-[#A16207]">Pendente</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Upcoming Deliveries widget */}
          <div className="bg-white rounded-[16px] border border-[#E2E8F0] overflow-hidden shadow-sm flex-1">
            <div className="p-4 px-6 border-b border-[#E2E8F0]">
              <h2 className="text-[16px] font-bold text-[#0F172A]">Próximas Entregas ({stats.upcomingDeliveries})</h2>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {recentDeliveries.length === 0 ? (
                <div className="text-center py-6 text-[12px] text-[#64748B] flex flex-col items-center gap-2">
                  <CheckCircle2 className="text-emerald-300 animate-bounce" size={24} />
                  <span>Tudo em dia! Nenhuma entrega pendente.</span>
                </div>
              ) : (
                recentDeliveries.map((delivery) => (
                  <div key={delivery.id} className="flex gap-3 items-center border-b border-dashed border-[#F1F5F9] pb-2 last:border-none last:pb-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-brand-primary font-bold text-xs flex-shrink-0">
                      @{delivery.creatorArtistic.substring(0, 1).toUpperCase()}
                    </div>
                    <div className="text-[13px] flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <strong className="text-[#0F172A] truncate">@{delivery.creatorArtistic}</strong>
                        <span className="text-[10px] text-brand-primary font-bold font-mono tracking-tight shrink-0">{delivery.dateStr}</span>
                      </div>
                      <div className="text-[11px] text-[#64748B] truncate">{delivery.type} • {delivery.campaignName}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

