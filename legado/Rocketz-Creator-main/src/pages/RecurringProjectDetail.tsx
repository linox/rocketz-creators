import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Repeat, 
  Calendar, 
  Users, 
  Building2, 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  Edit3, 
  ExternalLink, 
  FileText, 
  Sparkles, 
  Video, 
  Layers, 
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  X,
  Instagram,
  Clapperboard,
  Film,
  DollarSign,
  UserCheck,
  AlertCircle,
  Radio,
  Pin,
  Newspaper,
  Mic,
  Package,
  Camera,
  Play,
  ArrowLeft,
  CalendarCheck,
  Send,
  Eye,
  Check,
  AlertTriangle,
  Wallet,
  TrendingUp,
  Target,
  PieChart
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { createNotification } from '../lib/notifications';
import { onAuthStateChanged } from 'firebase/auth';
import { cn } from '../lib/utils';
import { usePrivacy } from '../context/PrivacyContext';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { UserAvatar } from '../components/UserAvatar';
import { 
  RecurringContract, 
  RecurringCreatorConfig, 
  ContentPlanningItem, 
  ContentPlanningStatus,
  ContentType,
  Company, 
  Creator 
} from '../types';
import { motion, AnimatePresence } from 'motion/react';

export const CONTENT_TYPE_CONFIG: Record<string, { label: string; shortLabel: string; bg: string; text: string; border: string; icon: any }> = {
  reel: { label: 'Reel / Instagram', shortLabel: 'Reel', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-100', icon: Film },
  story: { label: 'Sequência de Stories', shortLabel: 'Story', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', icon: Instagram },
  post: { label: 'Feed Post / Carrossel', shortLabel: 'Post', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', icon: Layers },
  tiktok: { label: 'TikTok Video', shortLabel: 'TikTok', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-100', icon: Clapperboard },
  youtube: { label: 'YouTube Short/Vídeo', shortLabel: 'YouTube', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-100', icon: Video },
  live: { label: 'Live / Transmissão', shortLabel: 'Live', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100', icon: Radio },
  pinterest: { label: 'Pinterest Pin', shortLabel: 'Pinterest', bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-100', icon: Pin },
  blog: { label: 'Artigo / Blog', shortLabel: 'Blog', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-100', icon: Newspaper },
  podcast: { label: 'Podcast / Áudio', shortLabel: 'Podcast', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-100', icon: Mic },
  unboxing: { label: 'Unboxing / Review', shortLabel: 'Unboxing', bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', border: 'border-fuchsia-100', icon: Package },
  ugc: { label: 'Vídeo UGC', shortLabel: 'UGC', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-100', icon: Camera },
  event: { label: 'Evento / Presença VIP', shortLabel: 'Evento', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100', icon: Calendar },
  other: { label: 'Outro Formato', shortLabel: 'Outro', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', icon: Sparkles },
};

export default function RecurringProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { formatCurrency } = usePrivacy();

  // Project state
  const [project, setProject] = useState<RecurringContract | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [contentItems, setContentItems] = useState<ContentPlanningItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab & Filter states
  const [activeView, setActiveView] = useState<'creators' | 'pautas' | 'calendar'>('creators');
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  const [expandedCreatorIds, setExpandedCreatorIds] = useState<string[]>([]);
  const [creatorSearchTerm, setCreatorSearchTerm] = useState('');
  const [creatorStatusFilter, setCreatorStatusFilter] = useState<'all' | 'owing' | 'completed' | 'no_demand'>('all');
  const [creatorSegmentFilter, setCreatorSegmentFilter] = useState<string>('all');
  const [creatorStateFilter, setCreatorStateFilter] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showCompleted, setShowCompleted] = useState(false);

  // Modals
  const [isAddCreatorModalOpen, setIsAddCreatorModalOpen] = useState(false);
  const [editingCreatorConfig, setEditingCreatorConfig] = useState<RecurringCreatorConfig | null>(null);
  const [isAddPautaModalOpen, setIsAddPautaModalOpen] = useState(false);
  const [editingPauta, setEditingPauta] = useState<ContentPlanningItem | null>(null);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);

  // Delete Confirmation Modal State
  const [deleteModalConfig, setDeleteModalConfig] = useState<{
    isOpen: boolean;
    type: 'project' | 'creator' | 'pauta';
    id: string;
    title: string;
    isDeleting?: boolean;
  }>({
    isOpen: false,
    type: 'project',
    id: '',
    title: '',
    isDeleting: false
  });

  // Form states: Add Creator to Project
  const [formCreatorId, setFormCreatorId] = useState('');
  const [formContractStart, setFormContractStart] = useState('');
  const [formContractEnd, setFormContractEnd] = useState('');
  const [formMonthlyCache, setFormMonthlyCache] = useState<number>(0);
  const [formDeliverables, setFormDeliverables] = useState({
    reels: 4,
    stories: 8,
    posts: 0,
    tiktok: 0,
    youtube: 0,
    ugc: 0
  });
  const [formCreatorNotes, setFormCreatorNotes] = useState('');

  // Form states: Add/Edit Pauta
  const [pautaTitle, setPautaTitle] = useState('');
  const [pautaContentType, setPautaContentType] = useState<ContentType>('reel');
  const [pautaPlannedDate, setPautaPlannedDate] = useState('');
  const [pautaBriefing, setPautaBriefing] = useState('');
  const [pautaScript, setPautaScript] = useState('');
  const [pautaReferences, setPautaReferences] = useState('');
  const [pautaStatus, setPautaStatus] = useState<ContentPlanningStatus>('planned');

  // Load Project and related data
  useEffect(() => {
    if (!id) return;

    const unsubProject = onSnapshot(doc(db, 'recurringContracts', id), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as RecurringContract;
        setProject(data);
        
        // Fetch company
        if (data.companyId) {
          getDocs(query(collection(db, 'companies'), where('__name__', '==', data.companyId))).then(cSnap => {
            if (!cSnap.empty) {
              setCompany({ id: cSnap.docs[0].id, ...cSnap.docs[0].data() } as Company);
            }
          });
        }
      } else {
        setProject(null);
      }
      setLoading(false);
    }, (err) => {
      console.warn("Error loading project:", err.message);
      setLoading(false);
    });

    const unsubCreators = onSnapshot(collection(db, 'creators'), (snap) => {
      setCreators(snap.docs.map(d => ({ id: d.id, ...d.data() } as Creator)));
    });

    const unsubPlanning = onSnapshot(
      query(collection(db, 'contentPlanning'), where('recurringContractId', '==', id)),
      (snap) => {
        setContentItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as ContentPlanningItem)));
      }
    );

    return () => {
      unsubProject();
      unsubCreators();
      unsubPlanning();
    };
  }, [id]);

  // Set default creator selection if available
  useEffect(() => {
    if (project?.creators && project.creators.length > 0 && !selectedCreatorId) {
      setSelectedCreatorId(project.creators[0].creatorId);
    }
  }, [project, selectedCreatorId]);

  // Calculate Creator debts/status in selected month (useCallback before early returns)
  const getCreatorMonthSummary = React.useCallback((creatorConfig: RecurringCreatorConfig) => {
    const creatorItems = contentItems.filter(item => 
      item.creatorId === creatorConfig.creatorId &&
      (item.month === selectedMonth || (item.plannedDate && item.plannedDate.startsWith(selectedMonth)))
    );

    // Target quota total
    const quotaTotal = Object.values(creatorConfig.monthlyDeliverables || {}).reduce((acc: number, val: any) => {
      return typeof val === 'number' ? acc + val : acc;
    }, 0);

    // Completed deliveries
    const completedCount = creatorItems.filter(i => i.status === 'published' || i.status === 'approved').length;
    const pendingCount = creatorItems.filter(i => i.status !== 'published' && i.status !== 'approved').length;

    // Is owing (devendo)? True if quota > 0 and (completed < quota or has overdue items)
    const isOwing = quotaTotal > 0 && ((completedCount < quotaTotal) || (creatorItems.some(i => {
      if (i.plannedDate && (i.status === 'planned' || i.status === 'in_production')) {
        return new Date(i.plannedDate) < new Date();
      }
      return false;
    })));

    const missingToCreate = Math.max(0, quotaTotal - (completedCount + pendingCount));
    const missingToComplete = Math.max(0, quotaTotal - completedCount);

    const statusCategory: 'no_demand' | 'completed' | 'owing' = 
      quotaTotal === 0 ? 'no_demand' : completedCount >= quotaTotal ? 'completed' : 'owing';

    return {
      quotaTotal,
      completedCount,
      pendingCount,
      isOwing,
      missingToCreate,
      missingToComplete,
      statusCategory,
      items: creatorItems
    };
  }, [contentItems, selectedMonth]);

  // Status counts for filtering badges
  const creatorStatusCounts = React.useMemo(() => {
    if (!project?.creators) return { all: 0, owing: 0, completed: 0, no_demand: 0 };
    let owing = 0;
    let completed = 0;
    let no_demand = 0;

    project.creators.forEach(cConfig => {
      const summary = getCreatorMonthSummary(cConfig);
      if (summary.statusCategory === 'no_demand') {
        no_demand++;
      } else if (summary.statusCategory === 'completed') {
        completed++;
      } else {
        owing++;
      }
    });

    return {
      all: project.creators.length,
      owing,
      completed,
      no_demand
    };
  }, [project?.creators, getCreatorMonthSummary]);

  // Extract unique available segments among allocated creators
  const availableSegments = React.useMemo(() => {
    if (!project?.creators) return [];
    const segSet = new Set<string>();
    project.creators.forEach(cConfig => {
      const cr = creators.find(c => c.id === cConfig.creatorId);
      if (cr?.categories && Array.isArray(cr.categories)) {
        cr.categories.forEach(cat => {
          if (cat && typeof cat === 'string') segSet.add(cat.trim());
        });
      }
    });
    return Array.from(segSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [project?.creators, creators]);

  // Extract unique available states among allocated creators
  const availableStates = React.useMemo(() => {
    if (!project?.creators) return [];
    const stateSet = new Set<string>();
    project.creators.forEach(cConfig => {
      const cr = creators.find(c => c.id === cConfig.creatorId);
      if (cr?.state && typeof cr.state === 'string') {
        stateSet.add(cr.state.trim().toUpperCase());
      }
    });
    return Array.from(stateSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [project?.creators, creators]);

  // Sort and filter project creators alphabetically and by status, segment, state & search term
  const sortedAndFilteredCreators = React.useMemo(() => {
    if (!project?.creators) return [];
    
    // Clone array
    let list = [...project.creators];
    
    // 1. Filter by Status Category (owing, completed, no_demand)
    if (creatorStatusFilter !== 'all') {
      list = list.filter(cConfig => {
        const summary = getCreatorMonthSummary(cConfig);
        return summary.statusCategory === creatorStatusFilter;
      });
    }

    // 2. Filter by Segment (Categories)
    if (creatorSegmentFilter !== 'all') {
      list = list.filter(cConfig => {
        const cr = creators.find(c => c.id === cConfig.creatorId);
        return cr?.categories?.some(cat => cat.trim().toLowerCase() === creatorSegmentFilter.trim().toLowerCase());
      });
    }

    // 3. Filter by State (UF)
    if (creatorStateFilter !== 'all') {
      list = list.filter(cConfig => {
        const cr = creators.find(c => c.id === cConfig.creatorId);
        return cr?.state?.trim().toUpperCase() === creatorStateFilter.trim().toUpperCase();
      });
    }

    // 4. Sort alphabetically by creator artistic name or full name
    list.sort((a, b) => {
      const crA = creators.find(c => c.id === a.creatorId);
      const crB = creators.find(c => c.id === b.creatorId);
      const nameA = (a.creatorName || crA?.artisticName || crA?.fullName || '').trim();
      const nameB = (b.creatorName || crB?.artisticName || crB?.fullName || '').trim();
      return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
    });

    // 5. Filter if search term exists
    if (!creatorSearchTerm.trim()) {
      return list;
    }

    const term = creatorSearchTerm.toLowerCase().trim();
    return list.filter(cConfig => {
      const cr = creators.find(c => c.id === cConfig.creatorId);
      const name = (cConfig.creatorName || cr?.artisticName || cr?.fullName || '').toLowerCase();
      const instagram = (cr?.socials?.instagram || '').toLowerCase();
      const city = (cr?.city || '').toLowerCase();
      const state = (cr?.state || '').toLowerCase();
      const categories = (cr?.categories || []).join(' ').toLowerCase();
      
      return name.includes(term) || instagram.includes(term) || city.includes(term) || state.includes(term) || categories.includes(term);
    });
  }, [project?.creators, creators, creatorSearchTerm, creatorStatusFilter, creatorSegmentFilter, creatorStateFilter, getCreatorMonthSummary]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 mb-2">Projeto Recorrente não encontrado</h2>
        <p className="text-sm text-slate-500 mb-4">O projeto solicitado pode ter sido removido ou o link está incorreto.</p>
        <Link to="/recurring" className="px-4 py-2 bg-brand-primary text-white text-xs font-bold rounded-xl">
          Voltar para Recorrentes
        </Link>
      </div>
    );
  }

  // Open Add Creator Modal
  const handleOpenAddCreatorModal = (config?: RecurringCreatorConfig) => {
    if (config) {
      setEditingCreatorConfig(config);
      setFormCreatorId(config.creatorId);
      setFormContractStart((config as any).startDate || project.startDate || '');
      setFormContractEnd((config as any).endDate || project.endDate || '');
      setFormMonthlyCache(config.monthlyCache || config.monthlyFee || 0);
      setFormDeliverables({
        reels: config.monthlyDeliverables?.reels || 0,
        stories: config.monthlyDeliverables?.stories || 0,
        posts: config.monthlyDeliverables?.posts || 0,
        tiktok: config.monthlyDeliverables?.tiktok || 0,
        youtube: config.monthlyDeliverables?.youtube || 0,
        ugc: config.monthlyDeliverables?.ugc || 0
      });
      setFormCreatorNotes(config.notes || '');
    } else {
      setEditingCreatorConfig(null);
      setFormCreatorId(creators[0]?.id || '');
      setFormContractStart(project.startDate || new Date().toISOString().split('T')[0]);
      setFormContractEnd(project.endDate || '');
      setFormMonthlyCache(0);
      setFormDeliverables({
        reels: 4,
        stories: 8,
        posts: 0,
        tiktok: 0,
        youtube: 0,
        ugc: 0
      });
      setFormCreatorNotes('');
    }
    setIsAddCreatorModalOpen(true);
  };

  // Save Creator to Project
  const handleSaveCreatorToProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCreatorId || !project) return;

    const cr = creators.find(c => c.id === formCreatorId);
    const newConfig: any = {
      creatorId: formCreatorId,
      creatorName: cr?.artisticName || cr?.fullName || 'Criador',
      artisticName: cr?.artisticName || cr?.fullName || 'Criador',
      startDate: formContractStart,
      endDate: formContractEnd,
      monthlyCache: Number(formMonthlyCache) || 0,
      monthlyDeliverables: formDeliverables,
      notes: formCreatorNotes
    };

    let updatedCreators = [...(project.creators || [])];
    if (editingCreatorConfig) {
      updatedCreators = updatedCreators.map(c => c.creatorId === editingCreatorConfig.creatorId ? newConfig : c);
    } else {
      // Avoid duplicate
      updatedCreators = updatedCreators.filter(c => c.creatorId !== formCreatorId);
      updatedCreators.push(newConfig);
    }

    try {
      await updateDoc(doc(db, 'recurringContracts', project.id), {
        creators: updatedCreators
      });

      // Notify creator
      await createNotification({
        title: 'Você foi adicionado a um Projeto Recorrente! 🚀',
        message: `Você agora faz parte do projeto "${project.title}" com a empresa ${company?.name || project.companyName || 'Parceira'}.`,
        type: 'approval',
        targetRole: 'creator',
        creatorId: formCreatorId,
        link: `/creators/${formCreatorId}?tab=recurring`
      });

      setIsAddCreatorModalOpen(false);
    } catch (err) {
      console.error("Erro ao salvar criador no projeto:", err);
      alert("Erro ao adicionar criador ao projeto.");
    }
  };

  // Remove Creator Trigger (Opens Modal)
  const handleRemoveCreator = (creatorId: string) => {
    const cr = creators.find(c => c.id === creatorId);
    setDeleteModalConfig({
      isOpen: true,
      type: 'creator',
      id: creatorId,
      title: cr?.artisticName || cr?.fullName || 'Criador do Projeto',
      isDeleting: false
    });
  };

  // Delete Pauta Trigger (Opens Modal)
  const handleDeletePauta = (pautaId: string, title?: string) => {
    const item = contentItems.find(p => p.id === pautaId);
    setDeleteModalConfig({
      isOpen: true,
      type: 'pauta',
      id: pautaId,
      title: title || item?.title || 'Pauta/Entregável',
      isDeleting: false
    });
  };

  // Delete Entire Project Trigger (Opens Modal)
  const handleDeleteProject = () => {
    if (!project) return;
    setDeleteModalConfig({
      isOpen: true,
      type: 'project',
      id: project.id,
      title: project.title,
      isDeleting: false
    });
  };

  // Perform Confirmation Deletion
  const handleConfirmDelete = async () => {
    if (!deleteModalConfig.id || !project) return;
    setDeleteModalConfig(prev => ({ ...prev, isDeleting: true }));

    try {
      if (deleteModalConfig.type === 'project') {
        // 1. Delete all contentPlanning docs
        try {
          const planningSnap = await getDocs(
            query(collection(db, 'contentPlanning'), where('recurringContractId', '==', project.id))
          );
          const deletePromises = planningSnap.docs.map(d => deleteDoc(doc(db, 'contentPlanning', d.id)));
          await Promise.all(deletePromises);
        } catch (errCleanup) {
          console.warn("Aviso ao limpar pautas do projeto:", errCleanup);
        }

        // 2. Delete the recurringContract doc
        await deleteDoc(doc(db, 'recurringContracts', project.id));
        navigate('/recurring');
      } else if (deleteModalConfig.type === 'creator') {
        const creatorId = deleteModalConfig.id;
        const updated = (project.creators || []).filter(c => c.creatorId !== creatorId);
        await updateDoc(doc(db, 'recurringContracts', project.id), {
          creators: updated
        });
        if (selectedCreatorId === creatorId) {
          setSelectedCreatorId(updated[0]?.creatorId || null);
        }
        setDeleteModalConfig({ isOpen: false, type: 'creator', id: '', title: '', isDeleting: false });
      } else if (deleteModalConfig.type === 'pauta') {
        const pautaId = deleteModalConfig.id;
        await deleteDoc(doc(db, 'contentPlanning', pautaId));
        if (editingPauta?.id === pautaId) {
          setIsAddPautaModalOpen(false);
          setEditingPauta(null);
        }
        setDeleteModalConfig({ isOpen: false, type: 'pauta', id: '', title: '', isDeleting: false });
      }
    } catch (err: any) {
      console.error("Erro ao excluir:", err);
      alert(`Erro ao apagar: ${err.message || 'Tente novamente.'}`);
      setDeleteModalConfig(prev => ({ ...prev, isDeleting: false }));
    }
  };

  // Open Add/Edit Pauta Modal
  const handleOpenPautaModal = (pauta?: ContentPlanningItem, defaultCreatorId?: string) => {
    if (pauta) {
      setEditingPauta(pauta);
      setPautaTitle(pauta.title);
      setPautaContentType(pauta.contentType);
      setPautaPlannedDate(pauta.plannedDate || '');
      setPautaBriefing(pauta.briefing || pauta.briefingNote || '');
      setPautaScript(pauta.script || '');
      setPautaReferences(pauta.references || '');
      setPautaStatus(pauta.status || 'planned');
    } else {
      setEditingPauta(null);
      setPautaTitle('');
      setPautaContentType('reel');
      setPautaPlannedDate('');
      setPautaBriefing('');
      setPautaScript('');
      setPautaReferences('');
      setPautaStatus('planned');
      if (defaultCreatorId) {
        setSelectedCreatorId(defaultCreatorId);
      }
    }
    setIsAddPautaModalOpen(true);
  };

  // Save Pauta / Entregável
  const handleSavePauta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pautaTitle || !selectedCreatorId || !project) return;

    const cr = creators.find(c => c.id === selectedCreatorId);
    const pMonth = pautaPlannedDate ? pautaPlannedDate.substring(0, 7) : selectedMonth;

    const pautaData = {
      recurringContractId: project.id,
      companyId: project.companyId,
      creatorId: selectedCreatorId,
      creatorName: cr?.artisticName || cr?.fullName || 'Criador',
      month: pMonth,
      contentType: pautaContentType,
      title: pautaTitle,
      briefing: pautaBriefing,
      briefingNote: pautaBriefing,
      script: pautaScript,
      references: pautaReferences,
      plannedDate: pautaPlannedDate,
      status: pautaStatus,
      updatedAt: serverTimestamp()
    };

    try {
      if (editingPauta) {
        await updateDoc(doc(db, 'contentPlanning', editingPauta.id), pautaData);
      } else {
        await addDoc(collection(db, 'contentPlanning'), {
          ...pautaData,
          createdAt: serverTimestamp()
        });

        // Notify creator about new pauta / briefing
        await createNotification({
          title: `Nova Pauta no Projeto "${project.title}" 📝`,
          message: `Uma nova pauta (${CONTENT_TYPE_CONFIG[pautaContentType]?.label || pautaContentType}) foi adicionada com briefing para você.`,
          type: 'delivery_review',
          targetRole: 'creator',
          creatorId: selectedCreatorId,
          link: `/creators/${selectedCreatorId}?tab=recurring`
        });
      }
      setIsAddPautaModalOpen(false);
    } catch (err) {
      console.error("Erro ao salvar pauta:", err);
      alert("Erro ao salvar pauta do mês.");
    }
  };

  // Mark Pauta as Concluded / Approved
  const handleTogglePautaStatus = async (item: ContentPlanningItem, newStatus: ContentPlanningStatus) => {
    try {
      await updateDoc(doc(db, 'contentPlanning', item.id), {
        status: newStatus,
        reviewedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Erro ao atualizar status da pauta:", err);
    }
  };

  const selectedCreator = creators.find(c => c.id === selectedCreatorId);
  const selectedCreatorConfig = project.creators?.find(c => c.creatorId === selectedCreatorId);
  const selectedCreatorSummary = selectedCreatorConfig ? getCreatorMonthSummary(selectedCreatorConfig) : null;

  // Filtered pautas for selected creator and month
  const activeCreatorPautas = contentItems.filter(item => {
    const matchCreator = item.creatorId === selectedCreatorId;
    const matchMonth = item.month === selectedMonth || (item.plannedDate && item.plannedDate.startsWith(selectedMonth));
    if (!matchCreator || !matchMonth) return false;
    // When added as concluded, it hides by default (unless user checked showCompleted)
    if (!showCompleted && (item.status === 'published' || item.status === 'approved')) {
      return false;
    }
    return true;
  });

  const completedPautasCount = contentItems.filter(item => 
    item.creatorId === selectedCreatorId && 
    (item.month === selectedMonth || (item.plannedDate && item.plannedDate.startsWith(selectedMonth))) &&
    (item.status === 'published' || item.status === 'approved')
  ).length;

  const totalMonthlyFee = Number(project.monthlyFee || 0);
  const totalCreatorsCost = (project.creators || []).reduce((acc, c) => acc + Number(c.monthlyCache || c.monthlyFee || 0), 0);
  const remainingBudget = totalMonthlyFee - totalCreatorsCost;
  const marginPercent = totalMonthlyFee > 0 ? Math.round((remainingBudget / totalMonthlyFee) * 100) : 0;

  // Calculate project duration in months for Total Period Value calculation
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

  const durationMonths = calculateContractMonths(project.startDate, project.endDate);
  const totalPeriodValue = totalMonthlyFee * durationMonths;
  const totalCreatorsPeriodCost = totalCreatorsCost * durationMonths;
  const totalPeriodRemainingBudget = remainingBudget * durationMonths;

  return (
    <div className="flex flex-col gap-6 animate-fadeIn pb-12 font-sans">
      {/* Back button & Breadcrumbs */}
      <div className="flex items-center justify-between">
        <Link 
          to="/recurring" 
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-brand-primary bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-sm transition-all cursor-pointer"
        >
          <ArrowLeft size={14} /> Voltar para Projetos Recorrentes
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDeleteProject}
            className="px-3.5 py-2 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 text-xs font-bold rounded-xl border border-slate-200 hover:border-rose-200 shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
            title="Excluir este projeto e todas as suas pautas"
          >
            <Trash2 size={14} /> Excluir Projeto
          </button>

          <button
            type="button"
            onClick={() => handleOpenAddCreatorModal()}
            className="px-4 py-2 bg-brand-primary hover:bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer border-none"
          >
            <Plus size={14} /> Adicionar Criador ao Projeto
          </button>
        </div>
      </div>

      {/* Project Master Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <UserAvatar
              src={company?.logo || company?.logoUrl}
              name={company?.name || project.companyName || 'Empresa Parceira'}
              size="custom"
              shape="rounded-2xl"
              className="w-14 h-14 border border-indigo-100 shadow-sm"
              textClassName="text-base font-black"
            />
            <div>
              <div className="flex items-center gap-2.5 flex-wrap mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-100 text-brand-primary border border-indigo-200">
                  {company?.name || project.companyName || 'Empresa Parceira'}
                </span>
                <span className={cn(
                  "px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border",
                  project.status === 'active' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                  project.status === 'paused' ? "bg-amber-50 text-amber-700 border-amber-200" :
                  "bg-slate-100 text-slate-700 border-slate-200"
                )}>
                  {project.status === 'active' ? '● Projeto Ativo' : project.status === 'paused' ? '⏸ Pausado' : '✓ Encerrado'}
                </span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{project.title}</h1>
              {project.objective && (
                <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">{project.objective}</p>
              )}
            </div>
          </div>
        </div>

        {/* Project Key Metrics: 2-Line Diagrammed Financial & Operational Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 mt-5 pt-5 border-t border-slate-100">
          {/* Card 1: Orçamento Mensal & Total do Período */}
          <div className="bg-slate-50/80 hover:bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col justify-between gap-2.5 transition-all shadow-2xs">
            {/* Line 1: Header / Descriptor */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-indigo-100/80 text-brand-primary flex items-center justify-center shrink-0">
                  <DollarSign size={13} className="stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider truncate">
                  Orçamento Mensal
                </span>
              </div>
              <span className="text-[9px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200 shrink-0">
                Fee Cliente
              </span>
            </div>
            {/* Line 2: Value & Total do Período */}
            <div className="flex flex-col gap-1 pt-1 border-t border-slate-200/50">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  {formatCurrency(totalMonthlyFee)}
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  /mês
                </span>
              </div>
              {project.endDate && durationMonths > 1 && (
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/40 text-slate-500">
                  <span className="font-semibold text-slate-400">Total do Período:</span>
                  <span className="font-extrabold text-indigo-700">{formatCurrency(totalPeriodValue)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Custo Criadores */}
          <div className="bg-slate-50/80 hover:bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col justify-between gap-2.5 transition-all shadow-2xs">
            {/* Line 1: Header / Descriptor */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-blue-100/80 text-blue-700 flex items-center justify-center shrink-0">
                  <Users size={13} className="stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider truncate">
                  Custo Criadores
                </span>
              </div>
              <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 shrink-0">
                {project.creators?.length || 0} {project.creators?.length === 1 ? 'criador' : 'criadores'}
              </span>
            </div>
            {/* Line 2: Value & Total do Período */}
            <div className="flex flex-col gap-1 pt-1 border-t border-slate-200/50">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-lg sm:text-xl font-black text-slate-700 tracking-tight">
                  {formatCurrency(totalCreatorsCost)}
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  /mês
                </span>
              </div>
              {project.endDate && durationMonths > 1 && (
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/40 text-slate-500">
                  <span className="font-semibold text-slate-400">Total do Período:</span>
                  <span className="font-extrabold text-slate-700">{formatCurrency(totalCreatorsPeriodCost)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Saldo Restante / Margem */}
          <div className={cn(
            "p-4 rounded-2xl border flex flex-col justify-between gap-2.5 transition-all shadow-2xs",
            remainingBudget >= 0 ? "bg-emerald-50/40 border-emerald-200/70 hover:bg-emerald-50/60" : "bg-rose-50/40 border-rose-200/70 hover:bg-rose-50/60"
          )}>
            {/* Line 1: Header / Descriptor */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className={cn(
                  "w-6 h-6 rounded-lg flex items-center justify-center shrink-0",
                  remainingBudget >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                )}>
                  <PieChart size={13} className="stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider truncate">
                  Saldo / Margem
                </span>
              </div>
              {totalMonthlyFee > 0 && (
                <span className={cn(
                  "text-[9px] font-black px-2 py-0.5 rounded-full border shrink-0",
                  remainingBudget >= 0 ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-rose-100 text-rose-800 border-rose-200"
                )}>
                  {remainingBudget >= 0 ? `${marginPercent}% saldo` : 'Déficit'}
                </span>
              )}
            </div>
            {/* Line 2: Value & Total do Período */}
            <div className="flex flex-col gap-1 pt-1 border-t border-slate-200/50">
              <div className="flex items-baseline justify-between gap-2">
                <span className={cn(
                  "text-lg sm:text-xl font-black tracking-tight",
                  remainingBudget >= 0 ? "text-emerald-700" : "text-rose-700"
                )}>
                  {formatCurrency(remainingBudget)}
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  /mês
                </span>
              </div>
              {project.endDate && durationMonths > 1 && (
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/40 text-slate-500">
                  <span className="font-semibold text-slate-400">Total do Período:</span>
                  <span className={cn("font-extrabold", remainingBudget >= 0 ? "text-emerald-700" : "text-rose-700")}>
                    {formatCurrency(totalPeriodRemainingBudget)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Card 4: Vigência & Período Total */}
          <div className="bg-slate-50/80 hover:bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col justify-between gap-2.5 transition-all shadow-2xs">
            {/* Line 1: Header / Descriptor */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-amber-100/80 text-amber-800 flex items-center justify-center shrink-0">
                  <Calendar size={13} className="stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider truncate">
                  Vigência & Período
                </span>
              </div>
              <span className="text-[9px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 shrink-0">
                {durationMonths} {durationMonths === 1 ? 'Mês' : 'Meses'}
              </span>
            </div>
            {/* Line 2: Value & Unit */}
            <div className="flex flex-col gap-1 pt-1 border-t border-slate-200/50">
              <span className="text-xs font-black text-slate-800 truncate" title={project.startDate ? `${new Date(project.startDate).toLocaleDateString('pt-BR')} até ${project.endDate ? new Date(project.endDate).toLocaleDateString('pt-BR') : 'Contínuo'}` : 'Sem data'}>
                {project.startDate ? new Date(project.startDate).toLocaleDateString('pt-BR') : 'Início N/D'} 
                {project.endDate ? ` → ${new Date(project.endDate).toLocaleDateString('pt-BR')}` : ' (Contínuo)'}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">
                {project.endDate ? `Duração total: ${durationMonths} meses contratados` : 'Contrato por tempo indeterminado'}
              </span>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 border-t border-slate-100 mt-6 pt-4">
          <button
            type="button"
            onClick={() => setActiveView('creators')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer border-none",
              activeView === 'creators' 
                ? "bg-slate-900 text-white shadow-sm" 
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            <Users size={14} /> Criadores & Entregáveis ({project.creators?.length || 0})
          </button>

          <button
            type="button"
            onClick={() => setActiveView('calendar')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer border-none",
              activeView === 'calendar' 
                ? "bg-slate-900 text-white shadow-sm" 
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            <Calendar size={14} /> Calendário do Projeto
          </button>

          {/* Month selector */}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase hidden sm:inline">Mês de Referência:</span>
            <input 
              type="month" 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)} 
              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none shadow-sm focus:border-brand-primary"
            />
          </div>
        </div>
      </div>

      {/* Main View 1: Criadores & Entregáveis */}
      {activeView === 'creators' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: List of Creators in this Project */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Users size={14} className="text-brand-primary" /> Criadores Alocados ({project.creators?.length || 0})
              </h3>
              <div className="flex items-center gap-2">
                {project.creators && project.creators.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (expandedCreatorIds.length === project.creators.length) {
                        setExpandedCreatorIds([]);
                      } else {
                        setExpandedCreatorIds(project.creators.map(c => c.creatorId));
                      }
                    }}
                    className="text-[10px] font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg border-none"
                  >
                    {expandedCreatorIds.length === project.creators.length ? 'Minimizar Todos' : 'Expandir Todos'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleOpenAddCreatorModal()}
                  className="text-[11px] font-bold text-brand-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={12} /> Adicionar
                </button>
              </div>
            </div>

            {/* Search and Segment/State Filters for creators */}
            {project.creators && project.creators.length > 0 && (
              <div className="space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={creatorSearchTerm}
                    onChange={(e) => setCreatorSearchTerm(e.target.value)}
                    placeholder="Buscar por nome, @, cidade ou segmento..."
                    className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 shadow-2xs transition-all"
                  />
                  {creatorSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setCreatorSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors border-none cursor-pointer"
                      title="Limpar busca"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Dropdowns for Segment and State Filters */}
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={creatorSegmentFilter}
                    onChange={(e) => setCreatorSegmentFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 outline-none focus:border-brand-primary shadow-2xs cursor-pointer"
                  >
                    <option value="all">Todos os Segmentos</option>
                    {availableSegments.map(seg => (
                      <option key={seg} value={seg}>{seg}</option>
                    ))}
                  </select>

                  <select
                    value={creatorStateFilter}
                    onChange={(e) => setCreatorStateFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 outline-none focus:border-brand-primary shadow-2xs cursor-pointer"
                  >
                    <option value="all">Todos os Estados (UF)</option>
                    {availableStates.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Status Filter Chips: Todos, Deve Entregas, Entregou Tudo, Sem Demanda */}
            {project.creators && project.creators.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                <button
                  type="button"
                  onClick={() => setCreatorStatusFilter('all')}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl font-bold text-[11px] whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border",
                    creatorStatusFilter === 'all'
                      ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <span>Todos</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-md text-[10px] font-black",
                    creatorStatusFilter === 'all' ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  )}>
                    {creatorStatusCounts.all}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCreatorStatusFilter('owing')}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl font-bold text-[11px] whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border",
                    creatorStatusFilter === 'owing'
                      ? "bg-rose-600 text-white border-rose-600 shadow-2xs"
                      : "bg-white text-rose-700 border-rose-200 hover:bg-rose-50"
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
                  <span>Deve Entregas</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-md text-[10px] font-black",
                    creatorStatusFilter === 'owing' ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700"
                  )}>
                    {creatorStatusCounts.owing}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCreatorStatusFilter('completed')}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl font-bold text-[11px] whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border",
                    creatorStatusFilter === 'completed'
                      ? "bg-emerald-700 text-white border-emerald-700 shadow-2xs"
                      : "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  <span>Entregou Tudo</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-md text-[10px] font-black",
                    creatorStatusFilter === 'completed' ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
                  )}>
                    {creatorStatusCounts.completed}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCreatorStatusFilter('no_demand')}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl font-bold text-[11px] whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border",
                    creatorStatusFilter === 'no_demand'
                      ? "bg-slate-700 text-white border-slate-700 shadow-2xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <span>Sem Demanda</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-md text-[10px] font-black",
                    creatorStatusFilter === 'no_demand' ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  )}>
                    {creatorStatusCounts.no_demand}
                  </span>
                </button>
              </div>
            )}

            {(!project.creators || project.creators.length === 0) ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full bg-indigo-50 text-brand-primary flex items-center justify-center">
                  <Users size={24} />
                </div>
                <h4 className="text-sm font-bold text-slate-800">Nenhum criador alocado ainda</h4>
                <p className="text-xs text-slate-500 max-w-xs">
                  Adicione criadores a este projeto com início e fim de contrato, cota mensal e valores.
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenAddCreatorModal()}
                  className="px-4 py-2 bg-brand-primary hover:bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer border-none"
                >
                  Adicionar Criador Agora
                </button>
              </div>
            ) : sortedAndFilteredCreators.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center flex flex-col items-center justify-center gap-2">
                <Search size={24} className="text-slate-300" />
                <h4 className="text-xs font-bold text-slate-700">Nenhum influenciador encontrado</h4>
                <p className="text-[11px] text-slate-400 max-w-xs">
                  {creatorSearchTerm 
                    ? `Nenhum resultado corresponde a "${creatorSearchTerm}".`
                    : `Nenhum criador com os filtros selecionados (Segmento: ${creatorSegmentFilter !== 'all' ? creatorSegmentFilter : 'Todos'}, Estado: ${creatorStateFilter !== 'all' ? creatorStateFilter : 'Todos'}).`}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {(creatorSearchTerm || creatorSegmentFilter !== 'all' || creatorStateFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setCreatorSearchTerm('');
                        setCreatorSegmentFilter('all');
                        setCreatorStateFilter('all');
                        setCreatorStatusFilter('all');
                      }}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer border-none"
                    >
                      Limpar Filtros
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {sortedAndFilteredCreators.map((creatorConfig) => {
                  const cr = creators.find(c => c.id === creatorConfig.creatorId);
                  const isSelected = selectedCreatorId === creatorConfig.creatorId;
                  const isExpanded = expandedCreatorIds.includes(creatorConfig.creatorId);
                  const summary = getCreatorMonthSummary(creatorConfig);

                  const toggleExpand = (e?: React.MouseEvent) => {
                    if (e) e.stopPropagation();
                    setExpandedCreatorIds(prev =>
                      prev.includes(creatorConfig.creatorId)
                        ? prev.filter(id => id !== creatorConfig.creatorId)
                        : [...prev, creatorConfig.creatorId]
                    );
                  };

                  const handleAddPauta = (e?: React.MouseEvent) => {
                    if (e) e.stopPropagation();
                    // 1. Expand the card
                    setExpandedCreatorIds(prev =>
                      prev.includes(creatorConfig.creatorId) ? prev : [...prev, creatorConfig.creatorId]
                    );
                    // 2. Select creator
                    setSelectedCreatorId(creatorConfig.creatorId);
                    // 3. Open add pauta modal
                    handleOpenPautaModal(undefined, creatorConfig.creatorId);
                  };

                  return (
                    <div
                      key={creatorConfig.creatorId}
                      onClick={() => setSelectedCreatorId(creatorConfig.creatorId)}
                      className={cn(
                        "bg-white rounded-2xl border transition-all cursor-pointer relative overflow-hidden shadow-sm",
                        isSelected 
                          ? "border-brand-primary ring-2 ring-indigo-500/10 shadow-md bg-indigo-50/10" 
                          : "border-slate-200 hover:border-slate-300",
                        summary.statusCategory === 'owing' && "border-rose-200/80 bg-rose-50/10"
                      )}
                    >
                      {/* Owing status ribbon */}
                      {summary.statusCategory === 'owing' && (
                        <div className="bg-rose-500 text-white px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider absolute top-0 right-0 rounded-bl-lg flex items-center gap-1 shadow-sm z-10">
                          <AlertTriangle size={10} /> Deve Entregas
                        </div>
                      )}
                      {summary.statusCategory === 'completed' && (
                        <div className="bg-emerald-600 text-white px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider absolute top-0 right-0 rounded-bl-lg flex items-center gap-1 shadow-sm z-10">
                          <Check size={10} className="stroke-[3]" /> Concluído
                        </div>
                      )}

                      {/* Card Content */}
                      <div className="p-3.5 sm:p-4 space-y-3">
                        {/* Line 1: Photo, Name, @ Handle, Location, Segment and Actions */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <UserAvatar
                              src={cr?.photoUrl}
                              name={cr?.artisticName || creatorConfig.creatorName || cr?.fullName || 'Criador'}
                              size="custom"
                              shape="rounded-xl"
                              className="w-10 h-10 sm:w-11 sm:h-11 border border-slate-200 shrink-0"
                              textClassName="text-sm font-bold"
                            />
                            
                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm font-bold text-slate-900 truncate">
                                {cr?.artisticName || creatorConfig.creatorName || cr?.fullName}
                              </h4>
                              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                <span className="text-[11px] text-slate-400 truncate">
                                  {cr?.socials?.instagram ? `@${cr.socials.instagram}` : 'Criador Parceiro'}
                                </span>

                                {/* State / Location Badge */}
                                {(cr?.state || cr?.city) && (
                                  <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded-md border border-slate-200 shrink-0">
                                    📍 {cr?.city ? `${cr.city}/` : ''}{cr?.state || ''}
                                  </span>
                                )}

                                {/* Segment / Category Badges */}
                                {cr?.categories && cr.categories.length > 0 && (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {cr.categories.slice(0, 2).map((cat, idx) => (
                                      <span key={idx} className="text-[9px] font-extrabold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded-md border border-indigo-100 shrink-0">
                                        {cat}
                                      </span>
                                    ))}
                                    {cr.categories.length > 2 && (
                                      <span className="text-[9px] font-bold text-slate-400">
                                        +{cr.categories.length - 2}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={toggleExpand}
                              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer border-none"
                              title={isExpanded ? "Minimizar detalhes" : "Expandir detalhes"}
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          </div>
                        </div>

                        {/* Line 2: 2-Line Values & Status Bar */}
                        <div className="pt-2.5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {/* Cachê Mensal in 2 Lines */}
                          <div className="bg-slate-50/90 p-2.5 rounded-xl border border-slate-200/60 flex flex-col justify-between">
                            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">
                              Cachê Mensal
                            </span>
                            <div className="flex items-baseline gap-1 mt-0.5">
                              <span className="text-xs sm:text-sm font-black text-slate-900">
                                {formatCurrency(creatorConfig.monthlyCache || creatorConfig.monthlyFee || 0)}
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold">/mês</span>
                            </div>
                          </div>

                          {/* Deliverables Status in 2 Lines */}
                          <div className="bg-slate-50/90 p-2.5 rounded-xl border border-slate-200/60 flex flex-col justify-between">
                            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">
                              Entregas ({selectedMonth})
                            </span>
                            <div className="flex items-center justify-between gap-1.5 mt-0.5">
                              {summary.statusCategory === 'owing' ? (
                                <span className="text-[10px] font-extrabold text-rose-600 bg-rose-100/80 px-2 py-0.5 rounded-md border border-rose-200 truncate">
                                  Faltam {summary.missingToComplete} ({summary.completedCount}/{summary.quotaTotal})
                                </span>
                              ) : summary.statusCategory === 'completed' ? (
                                <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200 truncate">
                                  ✓ {summary.completedCount}/{summary.quotaTotal} Concluído
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-md border border-slate-300/60 truncate">
                                  {summary.completedCount} entregue{summary.completedCount === 1 ? '' : 's'}
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={handleAddPauta}
                                className="px-2 py-1 bg-brand-primary text-white font-bold rounded-lg text-[10px] transition-all flex items-center gap-1 cursor-pointer border-none shadow-xs shrink-0 hover:bg-indigo-600"
                                title={`Adicionar pauta para ${creatorConfig.creatorName || 'este criador'}`}
                              >
                                <Plus size={11} className="stroke-[2.5]" /> Pauta
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Expanded details (Quotas badges, Notes, and Contract Actions) */}
                        {isExpanded && (
                          <div className="pt-3 border-t border-slate-100 space-y-3">
                            {/* Quotas and status badges */}
                            <div className="space-y-1.5">
                              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">
                                Cotas Contratadas
                              </span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {creatorConfig.monthlyDeliverables?.reels ? (
                                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[10px] font-extrabold border border-indigo-100">
                                    {creatorConfig.monthlyDeliverables.reels} Reels
                                  </span>
                                ) : null}
                                {creatorConfig.monthlyDeliverables?.stories ? (
                                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md text-[10px] font-extrabold border border-amber-100">
                                    {creatorConfig.monthlyDeliverables.stories} Stories
                                  </span>
                                ) : null}
                                {creatorConfig.monthlyDeliverables?.posts ? (
                                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-[10px] font-extrabold border border-emerald-100">
                                    {creatorConfig.monthlyDeliverables.posts} Posts
                                  </span>
                                ) : null}
                                {creatorConfig.monthlyDeliverables?.tiktok ? (
                                  <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded-md text-[10px] font-extrabold border border-rose-100">
                                    {creatorConfig.monthlyDeliverables.tiktok} TikTok
                                  </span>
                                ) : null}
                                {summary.quotaTotal === 0 && (
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[10px] font-bold border border-slate-200">
                                    Nenhum entregável definido
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Full action buttons */}
                            <div className="pt-2 flex items-center justify-end gap-2 text-xs border-t border-slate-100">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenAddCreatorModal(creatorConfig);
                                }}
                                className="text-[11px] font-bold text-slate-600 hover:text-brand-primary px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1 cursor-pointer border-none"
                              >
                                <Edit3 size={12} /> Editar Contrato
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveCreator(creatorConfig.creatorId);
                                }}
                                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 transition-colors flex items-center gap-1 cursor-pointer border-none"
                              >
                                <Trash2 size={12} /> Remover
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Selected Creator's Pautas / Entregáveis & Briefing Space */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {selectedCreator ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-5">
                {/* Header for Creator's deliverables */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <span className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">
                      Pautas & Entregáveis do Mês ({selectedMonth})
                    </span>
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 flex-wrap">
                      {selectedCreator?.artisticName || selectedCreator?.fullName}
                      {selectedCreatorSummary?.isOwing ? (
                        <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                          ⚠️ Devendo no mês
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          ✓ Quota em dia
                        </span>
                      )}
                    </h3>

                    {/* State and Segment Badges for Selected Creator */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      {(selectedCreator?.state || selectedCreator?.city) && (
                        <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          📍 {selectedCreator?.city ? `${selectedCreator.city}/` : ''}{selectedCreator?.state || ''}
                        </span>
                      )}
                      {selectedCreator?.categories?.map((cat, idx) => (
                        <span key={idx} className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                          🏷️ {cat}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCompleted(!showCompleted)}
                      className={cn(
                        "text-xs font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5",
                        showCompleted 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      <CheckCircle2 size={13} />
                      {showCompleted ? 'Ocultar Concluídos' : `Ver Concluídos (${completedPautasCount})`}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenPautaModal(undefined, selectedCreatorId!)}
                      className="px-3.5 py-1.5 bg-brand-primary hover:bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all cursor-pointer border-none"
                    >
                      <Plus size={13} /> Nova Pauta
                    </button>
                  </div>
                </div>

                {/* Selected Creator 2-Line Key Metrics Strip */}
                {selectedCreatorConfig && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50/80 rounded-2xl border border-slate-200/80">
                    {/* Card 1: Cachê Mensal */}
                    <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/70 flex flex-col justify-between gap-1 shadow-2xs">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Cachê Mensal</span>
                        <DollarSign size={12} className="text-brand-primary stroke-[2.5]" />
                      </div>
                      <div className="flex items-baseline gap-1 pt-0.5">
                        <span className="text-xs sm:text-sm font-black text-slate-900 truncate">
                          {formatCurrency(selectedCreatorConfig.monthlyCache || selectedCreatorConfig.monthlyFee || 0)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">/mês</span>
                      </div>
                    </div>

                    {/* Card 2: Cota do Mês */}
                    <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/70 flex flex-col justify-between gap-1 shadow-2xs">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Meta Mensal</span>
                        <Target size={12} className="text-indigo-600 stroke-[2.5]" />
                      </div>
                      <div className="flex items-baseline gap-1 pt-0.5">
                        <span className="text-xs sm:text-sm font-black text-slate-900">
                          {selectedCreatorSummary?.quotaTotal || 0}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">entregas</span>
                      </div>
                    </div>

                    {/* Card 3: Concluídas */}
                    <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/70 flex flex-col justify-between gap-1 shadow-2xs">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-wider truncate">Concluídas</span>
                        <CheckCircle2 size={12} className="text-emerald-600 stroke-[2.5]" />
                      </div>
                      <div className="flex items-baseline gap-1 pt-0.5">
                        <span className="text-xs sm:text-sm font-black text-emerald-700">
                          {selectedCreatorSummary?.completedCount || 0}
                        </span>
                        <span className="text-[10px] text-emerald-600 font-semibold">
                          ({selectedCreatorSummary?.quotaTotal ? Math.round(((selectedCreatorSummary.completedCount || 0) / selectedCreatorSummary.quotaTotal) * 100) : 0}%)
                        </span>
                      </div>
                    </div>

                    {/* Card 4: Status / Saldo de Entregas */}
                    <div className={cn(
                      "p-2.5 sm:p-3 rounded-xl border flex flex-col justify-between gap-1 shadow-2xs",
                      selectedCreatorSummary?.isOwing 
                        ? "bg-rose-50/70 border-rose-200" 
                        : "bg-white border-slate-200/70"
                    )}>
                      <div className="flex items-center justify-between gap-1">
                        <span className={cn(
                          "text-[9px] font-extrabold uppercase tracking-wider truncate",
                          selectedCreatorSummary?.isOwing ? "text-rose-600" : "text-slate-400"
                        )}>
                          {selectedCreatorSummary?.isOwing ? 'Pendência' : 'Status'}
                        </span>
                        {selectedCreatorSummary?.isOwing ? (
                          <AlertTriangle size={12} className="text-rose-600 stroke-[2.5]" />
                        ) : (
                          <Check size={12} className="text-emerald-600 stroke-[3]" />
                        )}
                      </div>
                      <div className="flex items-baseline gap-1 pt-0.5">
                        <span className={cn(
                          "text-xs sm:text-sm font-black truncate",
                          selectedCreatorSummary?.isOwing ? "text-rose-700" : "text-emerald-700"
                        )}>
                          {selectedCreatorSummary?.isOwing 
                            ? `Faltam ${selectedCreatorSummary.missingToComplete}` 
                            : (selectedCreatorSummary?.quotaTotal || 0) > 0 ? '✓ 100% Entregue' : 'Sem Demanda'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Deliverables List for this Creator */}
                {activeCreatorPautas.length === 0 ? (
                  <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-10 text-center flex flex-col items-center justify-center gap-2">
                    <div className="p-3 bg-white rounded-full text-slate-400 shadow-sm">
                      <FileText size={22} />
                    </div>
                    <h4 className="text-xs font-bold text-slate-700">Nenhuma pauta pendente para {selectedMonth}</h4>
                    <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
                      {completedPautasCount > 0 
                        ? `Todas as ${completedPautasCount} pautas deste mês foram marcadas como concluídas!` 
                        : "Adicione as pautas do mês com briefing detalhado, referências e roteiro para o criador."}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleOpenPautaModal(undefined, selectedCreatorId!)}
                      className="mt-2 px-3.5 py-1.5 bg-brand-primary text-white text-xs font-bold rounded-xl hover:bg-indigo-600 transition-all cursor-pointer border-none"
                    >
                      Adicionar Pauta do Mês
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {activeCreatorPautas.map((pauta) => {
                      const typeConfig = CONTENT_TYPE_CONFIG[pauta.contentType] || CONTENT_TYPE_CONFIG.other;
                      const TypeIcon = typeConfig.icon;
                      const isConcluded = pauta.status === 'published' || pauta.status === 'approved';

                      return (
                        <div 
                          key={pauta.id}
                          className="bg-white rounded-2xl border border-slate-200 hover:border-indigo-200 p-4.5 shadow-sm transition-all flex flex-col gap-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border", typeConfig.bg, typeConfig.text, typeConfig.border)}>
                                <TypeIcon size={18} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                  <span className={cn("text-[9px] font-black uppercase px-2 py-0.5 rounded-full border", typeConfig.bg, typeConfig.text, typeConfig.border)}>
                                    {typeConfig.shortLabel}
                                  </span>
                                  <span className={cn(
                                    "text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border",
                                    pauta.status === 'planned' ? "bg-slate-100 text-slate-700 border-slate-200" :
                                    pauta.status === 'in_production' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                    pauta.status === 'review' ? "bg-amber-50 text-amber-700 border-amber-200" :
                                    pauta.status === 'approved' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                    "bg-indigo-50 text-indigo-700 border-indigo-200"
                                  )}>
                                    {pauta.status === 'planned' ? '⏳ Planejado' :
                                     pauta.status === 'in_production' ? '🎬 Em Produção' :
                                     pauta.status === 'review' ? '👀 Em Revisão' :
                                     pauta.status === 'approved' ? '✓ Aprovado' :
                                     '🚀 Publicado'}
                                  </span>
                                </div>
                                <h4 className="text-sm font-bold text-slate-900">{pauta.title}</h4>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {/* Mark as Concluded / Approved button: once clicked, it hides from list */}
                              <button
                                type="button"
                                onClick={() => handleTogglePautaStatus(pauta, isConcluded ? 'planned' : 'approved')}
                                className={cn(
                                  "px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer border",
                                  isConcluded 
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-300" 
                                    : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                                )}
                                title={isConcluded ? "Reabrir pauta" : "Marcar como concluído (irá ocultar da lista ativa)"}
                              >
                                <Check size={12} /> {isConcluded ? 'Concluído' : 'Concluir'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenPautaModal(pauta)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer border-none"
                                title="Editar pauta e briefing"
                              >
                                <Edit3 size={14} />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeletePauta(pauta.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer border-none"
                                title="Excluir pauta"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Briefing Box */}
                          {(pauta.briefing || pauta.briefingNote || pauta.script || pauta.references) && (
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs flex flex-col gap-2">
                              {pauta.briefing && (
                                <div>
                                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">Briefing / Instruções:</span>
                                  <p className="text-slate-700 whitespace-pre-line leading-relaxed">{pauta.briefing}</p>
                                </div>
                              )}
                              {pauta.script && (
                                <div className="pt-2 border-t border-slate-200/60">
                                  <span className="text-[10px] font-bold text-brand-primary uppercase block mb-0.5">Roteiro Sugerido:</span>
                                  <p className="text-slate-700 font-mono text-[11px] bg-white p-2 rounded-lg border border-slate-200 whitespace-pre-line">
                                    {pauta.script}
                                  </p>
                                </div>
                              )}
                              {pauta.references && (
                                <div className="pt-2 border-t border-slate-200/60 flex items-center gap-1 text-[11px] text-indigo-600">
                                  <ExternalLink size={12} />
                                  <span className="font-bold">Referências:</span> {pauta.references}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Date and Material links */}
                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                            <span className="flex items-center gap-1">
                              <Clock size={12} className="text-slate-400" />
                              Data Limite: {pauta.plannedDate ? new Date(pauta.plannedDate).toLocaleDateString('pt-BR') : 'Sem data definida'}
                            </span>

                            {pauta.submissionUrl && (
                              <a 
                                href={pauta.submissionUrl} 
                                target="_blank" 
                                rel="noreferrer"
                                className="font-bold text-brand-primary hover:underline flex items-center gap-1"
                              >
                                <ExternalLink size={12} /> Ver Material Enviado
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                Selecione um criador ao lado para visualizar e adicionar suas pautas do mês.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main View 2: Calendário do Projeto */}
      {activeView === 'calendar' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CalendarCheck size={18} className="text-brand-primary" /> Calendário de Entregas — {project.title}
              </h3>
              <p className="text-xs text-slate-500">Cronograma de postagens e gravações programadas para o mês {selectedMonth}.</p>
            </div>

            <div className="flex items-center gap-2">
              <input 
                type="month" 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)} 
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none shadow-sm"
              />
            </div>
          </div>

          {/* Monthly Calendar Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((dayNumber) => {
              const dayStr = `${selectedMonth}-${String(dayNumber).padStart(2, '0')}`;
              const dayItems = contentItems.filter(item => item.plannedDate === dayStr);

              return (
                <div 
                  key={dayNumber} 
                  className={cn(
                    "min-h-[110px] p-3 rounded-2xl border transition-all flex flex-col justify-between",
                    dayItems.length > 0 ? "bg-indigo-50/20 border-indigo-200 shadow-sm" : "bg-slate-50/50 border-slate-100"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-slate-800 bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                      Dia {dayNumber}
                    </span>
                    {dayItems.length > 0 && (
                      <span className="text-[10px] font-black text-brand-primary bg-indigo-100 px-1.5 py-0.5 rounded-md">
                        {dayItems.length} entrega{dayItems.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <div className={cn(
                    "flex flex-col gap-1.5 flex-1",
                    dayItems.length > 1 && "max-h-[170px] overflow-y-auto custom-scrollbar pr-0.5"
                  )}>
                    {dayItems.map(item => {
                      const typeConfig = CONTENT_TYPE_CONFIG[item.contentType] || CONTENT_TYPE_CONFIG.other;
                      const cr = creators.find(c => c.id === item.creatorId);

                      return (
                        <div 
                          key={item.id} 
                          className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs text-[11px] flex flex-col gap-1 shrink-0"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-slate-800 truncate">{item.title}</span>
                            <span className={cn("text-[9px] font-extrabold px-1.5 py-0.2 rounded border shrink-0", typeConfig.bg, typeConfig.text, typeConfig.border)}>
                              {typeConfig.shortLabel}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 truncate">
                            👤 {cr?.artisticName || item.creatorName || 'Criador'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal 1: Adicionar / Configurar Criador no Projeto */}
      {isAddCreatorModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Users size={18} className="text-brand-primary" />
                {editingCreatorConfig ? 'Editar Criador no Projeto' : 'Adicionar Criador ao Projeto Recorrente'}
              </h3>
              <button 
                onClick={() => setIsAddCreatorModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer border-none"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCreatorToProject} className="flex flex-col gap-4 mt-4 text-xs font-medium">
              {/* Creator Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-700 font-bold">Selecione o Criador *</label>
                <select
                  value={formCreatorId}
                  onChange={(e) => setFormCreatorId(e.target.value)}
                  disabled={!!editingCreatorConfig}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-brand-primary"
                  required
                >
                  <option value="">Selecione um criador cadastrado</option>
                  {[...creators].sort((a, b) => {
                    const nameA = (a.artisticName || a.fullName || '').trim();
                    const nameB = (b.artisticName || b.fullName || '').trim();
                    return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
                  }).map(c => (
                    <option key={c.id} value={c.id}>
                      {c.artisticName || c.fullName} {c.city ? `(${c.city}/${c.state})` : ''} - {c.metrics?.followers?.toLocaleString() || 0} seguidores
                    </option>
                  ))}
                </select>
              </div>

              {/* Início e Fim do Contrato com o Criador */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-700 font-bold">Início do Contrato *</label>
                  <input
                    type="date"
                    value={formContractStart}
                    onChange={(e) => setFormContractStart(e.target.value)}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-brand-primary"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-700 font-bold">Fim do Contrato</label>
                  <input
                    type="date"
                    value={formContractEnd}
                    onChange={(e) => setFormContractEnd(e.target.value)}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-brand-primary"
                  />
                </div>
              </div>

              {/* Cachê / Valores */}
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-700 font-bold">Cachê Mensal do Criador (R$) *</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-slate-400 font-bold">R$</span>
                  <input
                    type="number"
                    value={formMonthlyCache}
                    onChange={(e) => setFormMonthlyCache(Number(e.target.value))}
                    className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-brand-primary"
                    placeholder="0.00"
                    required
                  />
                </div>

                {/* Live calculation breakdown */}
                {totalMonthlyFee > 0 && (
                  <div className="mt-1.5 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-slate-500 text-[11px]">
                      <span>Investimento Total do Projeto:</span>
                      <span className="font-bold text-slate-800">{formatCurrency(totalMonthlyFee)}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 text-[11px]">
                      <span>Outros Criadores Vinculados:</span>
                      <span className="font-bold text-slate-700">
                        {formatCurrency(
                          (project?.creators || [])
                            .filter(c => c.creatorId !== (editingCreatorConfig?.creatorId || formCreatorId))
                            .reduce((sum, c) => sum + Number(c.monthlyCache || c.monthlyFee || 0), 0)
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 text-[11px]">
                      <span className="font-bold text-slate-700">Saldo Restante Resultante:</span>
                      <span className={cn(
                        "font-black",
                        (totalMonthlyFee - (
                          (project?.creators || [])
                            .filter(c => c.creatorId !== (editingCreatorConfig?.creatorId || formCreatorId))
                            .reduce((sum, c) => sum + Number(c.monthlyCache || c.monthlyFee || 0), 0) + Number(formMonthlyCache || 0)
                        )) >= 0 ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {formatCurrency(
                          totalMonthlyFee - (
                            (project?.creators || [])
                              .filter(c => c.creatorId !== (editingCreatorConfig?.creatorId || formCreatorId))
                              .reduce((sum, c) => sum + Number(c.monthlyCache || c.monthlyFee || 0), 0) + Number(formMonthlyCache || 0)
                          )
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Espaço para os Entregáveis / Cota Mensal */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col gap-3">
                <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider block">
                  Cota de Entregáveis por Mês
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-600 font-bold block mb-1">Reels (Instagram)</label>
                    <input
                      type="number"
                      min="0"
                      value={formDeliverables.reels}
                      onChange={(e) => setFormDeliverables({ ...formDeliverables, reels: Number(e.target.value) })}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 font-bold block mb-1">Stories (Seq.)</label>
                    <input
                      type="number"
                      min="0"
                      value={formDeliverables.stories}
                      onChange={(e) => setFormDeliverables({ ...formDeliverables, stories: Number(e.target.value) })}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 font-bold block mb-1">Feed Posts</label>
                    <input
                      type="number"
                      min="0"
                      value={formDeliverables.posts}
                      onChange={(e) => setFormDeliverables({ ...formDeliverables, posts: Number(e.target.value) })}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 font-bold block mb-1">TikTok</label>
                    <input
                      type="number"
                      min="0"
                      value={formDeliverables.tiktok}
                      onChange={(e) => setFormDeliverables({ ...formDeliverables, tiktok: Number(e.target.value) })}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 font-bold block mb-1">Vídeos UGC</label>
                    <input
                      type="number"
                      min="0"
                      value={formDeliverables.ugc}
                      onChange={(e) => setFormDeliverables({ ...formDeliverables, ugc: Number(e.target.value) })}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 font-bold block mb-1">YouTube</label>
                    <input
                      type="number"
                      min="0"
                      value={formDeliverables.youtube}
                      onChange={(e) => setFormDeliverables({ ...formDeliverables, youtube: Number(e.target.value) })}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs text-center font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Observações */}
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-700 font-bold">Observações / Termos Específicos</label>
                <textarea
                  rows={2}
                  value={formCreatorNotes}
                  onChange={(e) => setFormCreatorNotes(e.target.value)}
                  placeholder="Ex: exclusividade de nicho, envio de produtos todo dia 5..."
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-brand-primary"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddCreatorModalOpen(false)}
                  className="px-4 py-2.5 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-100 transition-colors cursor-pointer border-none"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-brand-primary hover:bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer border-none"
                >
                  {editingCreatorConfig ? 'Salvar Alterações' : 'Adicionar ao Projeto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Adicionar / Editar Pauta com Espaço para Briefing */}
      {isAddPautaModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <FileText size={18} className="text-brand-primary" />
                {editingPauta ? 'Editar Pauta / Briefing' : 'Adicionar Pauta do Mês'}
              </h3>
              <button 
                onClick={() => setIsAddPautaModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer border-none"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePauta} className="flex flex-col gap-4 mt-4 text-xs font-medium">
              {/* Criador Selecionado */}
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-700 font-bold">Criador *</label>
                <select
                  value={selectedCreatorId || ''}
                  onChange={(e) => setSelectedCreatorId(e.target.value)}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-brand-primary"
                  required
                >
                  {[...(project.creators || [])].sort((a, b) => {
                    const crA = creators.find(c => c.id === a.creatorId);
                    const crB = creators.find(c => c.id === b.creatorId);
                    const nameA = (a.creatorName || crA?.artisticName || crA?.fullName || '').trim();
                    const nameB = (b.creatorName || crB?.artisticName || crB?.fullName || '').trim();
                    return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
                  }).map(c => {
                    const cr = creators.find(creator => creator.id === c.creatorId);
                    return (
                      <option key={c.creatorId} value={c.creatorId}>
                        {c.creatorName || cr?.artisticName || cr?.fullName || 'Criador'}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Título & Formato */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-700 font-bold">Título da Pauta / Conteúdo *</label>
                  <input
                    type="text"
                    value={pautaTitle}
                    onChange={(e) => setPautaTitle(e.target.value)}
                    placeholder="Ex: Tutorial 3 Passos com o Produto X"
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-brand-primary"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-700 font-bold">Formato *</label>
                  <select
                    value={pautaContentType}
                    onChange={(e) => setPautaContentType(e.target.value as ContentType)}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-brand-primary"
                  >
                    {Object.entries(CONTENT_TYPE_CONFIG).map(([key, value]) => (
                      <option key={key} value={key}>{value.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Data Limite & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-700 font-bold">Data Limite de Envio *</label>
                  <input
                    type="date"
                    value={pautaPlannedDate}
                    onChange={(e) => setPautaPlannedDate(e.target.value)}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-brand-primary"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-700 font-bold">Status Inicial</label>
                  <select
                    value={pautaStatus}
                    onChange={(e) => setPautaStatus(e.target.value as ContentPlanningStatus)}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-brand-primary"
                  >
                    <option value="planned">⏳ Planejado</option>
                    <option value="in_production">🎬 Em Produção</option>
                    <option value="review">👀 Em Revisão</option>
                    <option value="approved">✓ Aprovado</option>
                    <option value="published">🚀 Publicado</option>
                  </select>
                </div>
              </div>

              {/* Espaço para o Briefing */}
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-700 font-bold flex items-center justify-between">
                  <span>Instruções de Briefing *</span>
                  <span className="text-[10px] text-slate-400 font-normal">Objetivo, gancho e pontos principais</span>
                </label>
                <textarea
                  rows={3}
                  value={pautaBriefing}
                  onChange={(e) => setPautaBriefing(e.target.value)}
                  placeholder="Descreva o que o criador deve abordar no vídeo, tom de voz, do's e dont's..."
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-brand-primary"
                  required
                />
              </div>

              {/* Roteiro Sugerido */}
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-700 font-bold flex items-center justify-between">
                  <span>Roteiro Sugerido (Opcional)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Estrutura de fala ou script</span>
                </label>
                <textarea
                  rows={3}
                  value={pautaScript}
                  onChange={(e) => setPautaScript(e.target.value)}
                  placeholder="0-3s: Gancho&#10;3-15s: Apresentação da dor&#10;15-45s: Solução com o produto..."
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-brand-primary font-mono text-[11px]"
                />
              </div>

              {/* Links de Referências */}
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-700 font-bold">Link de Referência / Inspiração</label>
                <input
                  type="url"
                  value={pautaReferences}
                  onChange={(e) => setPautaReferences(e.target.value)}
                  placeholder="https://instagram.com/p/... ou https://tiktok.com/@..."
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-brand-primary"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 mt-2">
                {editingPauta ? (
                  <button
                    type="button"
                    onClick={() => handleDeletePauta(editingPauta.id, editingPauta.title)}
                    className="px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl transition-colors cursor-pointer border border-rose-200 flex items-center gap-1.5"
                    title="Excluir esta pauta"
                  >
                    <Trash2 size={14} /> Excluir Pauta
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddPautaModalOpen(false)}
                    className="px-4 py-2.5 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-100 transition-colors cursor-pointer border-none"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-brand-primary hover:bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer border-none"
                  >
                    {editingPauta ? 'Salvar Pauta' : 'Criar Pauta'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reusable Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteModalConfig.isOpen}
        onClose={() => setDeleteModalConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmDelete}
        title={
          deleteModalConfig.type === 'project' 
            ? 'Excluir Projeto Recorrente' 
            : deleteModalConfig.type === 'creator' 
              ? 'Remover Criador do Projeto' 
              : 'Excluir Pauta/Entregável'
        }
        description={
          deleteModalConfig.type === 'project'
            ? `Tem certeza que deseja apagar o projeto recorrente "${deleteModalConfig.title}"? Esta ação removerá o projeto e todas as suas pautas e briefings de forma irreversível.`
            : deleteModalConfig.type === 'creator'
              ? `Tem certeza que deseja remover ${deleteModalConfig.title} deste projeto recorrente?`
              : `Deseja realmente apagar a pauta "${deleteModalConfig.title}"?`
        }
        confirmText={deleteModalConfig.type === 'creator' ? 'Sim, Remover' : 'Sim, Excluir Definitivamente'}
        isDeleting={deleteModalConfig.isDeleting}
      />
    </div>
  );
}
