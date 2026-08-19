import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Repeat, 
  Calendar, 
  Users, 
  Building2, 
  Plus, 
  Search, 
  Filter, 
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
  X,
  Instagram,
  Clapperboard,
  Film,
  CalendarCheck,
  DollarSign,
  Copy,
  Check,
  Eye,
  Link2,
  UploadCloud,
  UserCheck,
  AlignLeft,
  MessageSquare,
  AlertCircle,
  Radio,
  Pin,
  Newspaper,
  Mic,
  Package,
  Camera,
  Globe,
  Share2,
  Play
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
import { SubmissionMediaPreview } from '../components/SubmissionMediaPreview';
import { RecurringContractDetailsModal } from '../components/RecurringContractDetailsModal';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { DatabaseResetModal } from '../components/DatabaseResetModal';
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

export default function RecurringContracts() {
  const { formatCurrency } = usePrivacy();
  const [activeTab, setActiveTab] = useState<'contracts' | 'planning' | 'calendar' | 'creator_calendar'>('contracts');
  const [contracts, setContracts] = useState<RecurringContract[]>([]);
  const [contentItems, setContentItems] = useState<ContentPlanningItem[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'admin' | 'company' | 'creator' | null>(null);

  // Filters
  const [searchCompany, setSearchCompany] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all');
  const [selectedCreatorFilter, setSelectedCreatorFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');

  // Modals & Drawers
  const [selectedContractForDetails, setSelectedContractForDetails] = useState<RecurringContract | null>(null);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<RecurringContract | null>(null);
  
  const [isContentModalOpen, setIsContentModalOpen] = useState(false);
  const [editingContentItem, setEditingContentItem] = useState<ContentPlanningItem | null>(null);
  const [prefilledContractId, setPrefilledContractId] = useState<string>('');
  const [prefilledCreatorId, setPrefilledCreatorId] = useState<string>('');
  const [prefilledPlannedDate, setPrefilledPlannedDate] = useState<string>('');

  // View Detail Drawer/Modal
  const [viewingDetailItem, setViewingDetailItem] = useState<ContentPlanningItem | null>(null);
  const [copiedCaption, setCopiedCaption] = useState(false);

  // Delete Confirmation Modal State
  const [deleteModalConfig, setDeleteModalConfig] = useState<{
    isOpen: boolean;
    type: 'contract' | 'content';
    id: string;
    title: string;
    isDeleting?: boolean;
  }>({
    isOpen: false,
    type: 'contract',
    id: '',
    title: '',
    isDeleting: false
  });

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Form states for contract modal
  const [contractFormCompanyId, setContractFormCompanyId] = useState('');
  const [contractFormTitle, setContractFormTitle] = useState('');
  const [contractFormObjective, setContractFormObjective] = useState('');
  const [contractFormStartDate, setContractFormStartDate] = useState('');
  const [contractFormEndDate, setContractFormEndDate] = useState('');
  const [contractFormMonthlyFee, setContractFormMonthlyFee] = useState<number>(0);
  const [contractFormStatus, setContractFormStatus] = useState<'active' | 'paused' | 'finished'>('active');
  const [contractFormCreators, setContractFormCreators] = useState<RecurringCreatorConfig[]>([]);

  // Auth & role listening
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const { isAdminEmail } = await import('../lib/firebase');
          if (isAdminEmail(u.email)) {
            setUserRole('admin');
          } else {
            const companySnap = await getDocs(query(collection(db, 'companyUsers'), where('email', '==', u.email)));
            if (!companySnap.empty) {
              setUserRole('company');
            } else {
              setUserRole('admin');
            }
          }
        } catch (e) {
          setUserRole('admin');
        }
      } else {
        setUserRole('admin');
      }
    });
    return () => unsubAuth();
  }, []);

  // Fetch Companies & Creators
  useEffect(() => {
    const unsubComp = onSnapshot(collection(db, 'companies'), (snap) => {
      setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() } as Company)));
    }, (err) => {
      console.warn("Error loading companies:", err.message);
    });
    const unsubCreat = onSnapshot(collection(db, 'creators'), (snap) => {
      setCreators(snap.docs.map(d => ({ id: d.id, ...d.data() } as Creator)));
    }, (err) => {
      console.warn("Error loading creators:", err.message);
    });
    return () => {
      unsubComp();
      unsubCreat();
    };
  }, []);

  // Fetch Recurring Contracts
  useEffect(() => {
    const unsubContracts = onSnapshot(collection(db, 'recurringContracts'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as RecurringContract));
      setContracts(list);
    }, (err) => {
      console.warn("Error loading recurring contracts:", err.message);
    });
    return () => unsubContracts();
  }, []);

  // Fetch Content Planning Items
  useEffect(() => {
    const unsubItems = onSnapshot(collection(db, 'contentPlanning'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ContentPlanningItem));
      setContentItems(list);
    }, (err) => {
      console.warn("Error loading content planning items:", err.message);
    });
    return () => unsubItems();
  }, []);

  // Open Contract Modal (Create or Edit)
  const handleOpenContractModal = (contract?: RecurringContract) => {
    if (contract) {
      setEditingContract(contract);
      setContractFormCompanyId(contract.companyId);
      setContractFormTitle(contract.title);
      setContractFormObjective(contract.objective || '');
      setContractFormStartDate(contract.startDate);
      setContractFormEndDate(contract.endDate || '');
      setContractFormMonthlyFee(contract.monthlyFee || 0);
      setContractFormStatus(contract.status);
      setContractFormCreators(contract.creators || []);
    } else {
      setEditingContract(null);
      setContractFormCompanyId(companies[0]?.id || '');
      setContractFormTitle('');
      setContractFormObjective('');
      setContractFormStartDate(new Date().toISOString().split('T')[0]);
      setContractFormEndDate('');
      setContractFormMonthlyFee(0);
      setContractFormStatus('active');
      setContractFormCreators([]);
    }
    setIsContractModalOpen(true);
  };

  // Add Creator to Contract Form
  const handleAddCreatorToContract = (creatorId: string) => {
    if (!creatorId) return;
    if (contractFormCreators.some(c => c.creatorId === creatorId)) return;
    
    const cr = creators.find(c => c.id === creatorId);
    const newConfig: RecurringCreatorConfig = {
      creatorId,
      creatorName: cr?.artisticName || cr?.fullName || 'Criador',
      monthlyCache: 0,
      monthlyDeliverables: {
        reels: 4,
        stories: 8,
        posts: 0,
        tiktok: 0,
        youtube: 0
      },
      notes: ''
    };
    setContractFormCreators([...contractFormCreators, newConfig]);
  };

  // Remove Creator from Contract Form
  const handleRemoveCreatorFromContract = (creatorId: string) => {
    setContractFormCreators(contractFormCreators.filter(c => c.creatorId !== creatorId));
  };

  // Update Creator Config in Contract Form
  const handleUpdateCreatorConfig = (creatorId: string, updates: Partial<RecurringCreatorConfig>) => {
    setContractFormCreators(contractFormCreators.map(c => {
      if (c.creatorId === creatorId) {
        return {
          ...c,
          ...updates,
          monthlyDeliverables: updates.monthlyDeliverables 
            ? { ...c.monthlyDeliverables, ...updates.monthlyDeliverables } 
            : c.monthlyDeliverables
        };
      }
      return c;
    }));
  };

  // Save Contract (Create/Update)
  const handleSaveContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractFormCompanyId || !contractFormTitle) return;

    const comp = companies.find(c => c.id === contractFormCompanyId);
    const contractData = {
      companyId: contractFormCompanyId,
      companyName: comp?.name || 'Empresa',
      title: contractFormTitle,
      objective: contractFormObjective,
      startDate: contractFormStartDate,
      endDate: contractFormEndDate,
      status: contractFormStatus,
      monthlyFee: contractFormMonthlyFee,
      creators: contractFormCreators,
      createdAt: serverTimestamp()
    };

    try {
      if (editingContract) {
        await updateDoc(doc(db, 'recurringContracts', editingContract.id), contractData);
      } else {
        await addDoc(collection(db, 'recurringContracts'), contractData);
      }
      setIsContractModalOpen(false);
    } catch (err) {
      console.error("Erro ao salvar contrato recorrente:", err);
    }
  };

  // Delete Contract Trigger (Opens Confirmation Modal)
  const handleDeleteContract = (id: string, title?: string) => {
    const c = contracts.find(item => item.id === id);
    setDeleteModalConfig({
      isOpen: true,
      type: 'contract',
      id,
      title: title || c?.title || c?.companyName || 'Contrato Recorrente',
      isDeleting: false
    });
  };

  // Delete Content Item Trigger (Opens Confirmation Modal)
  const handleDeleteContentItem = (id: string, title?: string) => {
    const item = contentItems.find(i => i.id === id);
    setDeleteModalConfig({
      isOpen: true,
      type: 'content',
      id,
      title: title || item?.title || 'Entrega do Cronograma',
      isDeleting: false
    });
  };

  // Perform Definite Deletion
  const handleConfirmDelete = async () => {
    if (!deleteModalConfig.id) return;
    setDeleteModalConfig(prev => ({ ...prev, isDeleting: true }));

    try {
      if (deleteModalConfig.type === 'contract') {
        const contractId = deleteModalConfig.id;

        // 1. Delete associated contentPlanning items
        try {
          const planningSnap = await getDocs(
            query(collection(db, 'contentPlanning'), where('recurringContractId', '==', contractId))
          );
          const deletePromises = planningSnap.docs.map(d => deleteDoc(doc(db, 'contentPlanning', d.id)));
          await Promise.all(deletePromises);
        } catch (subErr) {
          console.warn("Aviso ao limpar pautas vinculadas:", subErr);
        }

        // 2. Delete the recurringContract document
        await deleteDoc(doc(db, 'recurringContracts', contractId));

        if (editingContract?.id === contractId) {
          setIsContractModalOpen(false);
          setEditingContract(null);
        }
        if (selectedContractForDetails?.id === contractId) {
          setSelectedContractForDetails(null);
        }
      } else {
        // Content Planning Item deletion
        const itemId = deleteModalConfig.id;
        await deleteDoc(doc(db, 'contentPlanning', itemId));

        if (viewingDetailItem?.id === itemId) {
          setViewingDetailItem(null);
        }
        if (editingContentItem?.id === itemId) {
          setIsContentModalOpen(false);
          setEditingContentItem(null);
        }
      }

      setDeleteModalConfig({ isOpen: false, type: 'contract', id: '', title: '', isDeleting: false });
    } catch (err: any) {
      console.error("Erro ao apagar item:", err);
      alert(`Erro ao apagar: ${err.message || 'Tente novamente.'}`);
      setDeleteModalConfig(prev => ({ ...prev, isDeleting: false }));
    }
  };

  // Content Item Modal Handlers
  const handleOpenContentModal = (contractId?: string, creatorId?: string, item?: ContentPlanningItem, defaultDate?: string) => {
    if (item) {
      setEditingContentItem(item);
      setPrefilledContractId(item.recurringContractId);
      setPrefilledCreatorId(item.creatorId);
      setPrefilledPlannedDate(item.plannedDate || '');
    } else {
      setEditingContentItem(null);
      setPrefilledContractId(contractId || contracts[0]?.id || '');
      setPrefilledCreatorId(creatorId || '');
      setPrefilledPlannedDate(defaultDate || '');
    }
    setIsContentModalOpen(true);
  };

  // Save Content Planning Item
  const handleSaveContentItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const contractId = formData.get('recurringContractId') as string;
    const creatorId = formData.get('creatorId') as string;
    const contentType = formData.get('contentType') as any;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const briefingNote = formData.get('briefingNote') as string;
    const briefing = formData.get('briefing') as string;
    const script = formData.get('script') as string;
    const references = formData.get('references') as string;
    const caption = formData.get('caption') as string;
    const plannedDate = formData.get('plannedDate') as string;
    const month = formData.get('month') as string;
    const status = formData.get('status') as ContentPlanningStatus;
    const publishedUrl = formData.get('publishedUrl') as string;
    const mediaUrl = formData.get('mediaUrl') as string;

    const contract = contracts.find(c => c.id === contractId);
    const creator = creators.find(cr => cr.id === creatorId);

    const itemData = {
      recurringContractId: contractId,
      companyId: contract?.companyId || '',
      creatorId,
      creatorName: creator?.artisticName || creator?.fullName || 'Criador',
      month: month || (plannedDate ? plannedDate.substring(0, 7) : selectedMonth),
      contentType,
      title,
      description: description || '',
      briefingNote: briefingNote || '',
      briefing: briefing || '',
      script: script || '',
      references: references || '',
      caption: caption || '',
      plannedDate: plannedDate || '',
      status,
      publishedUrl: publishedUrl || '',
      mediaUrl: mediaUrl || '',
      createdAt: serverTimestamp()
    };

    try {
      if (editingContentItem) {
        await updateDoc(doc(db, 'contentPlanning', editingContentItem.id), itemData);
      } else {
        await addDoc(collection(db, 'contentPlanning'), itemData);
      }
      setIsContentModalOpen(false);
    } catch (err) {
      console.error("Erro ao salvar planejamento:", err);
    }
  };

  // Quick Status Update for Content Item
  const handleQuickStatusChange = async (itemId: string, newStatus: ContentPlanningStatus) => {
    try {
      await updateDoc(doc(db, 'contentPlanning', itemId), { status: newStatus });
      if (viewingDetailItem && viewingDetailItem.id === itemId) {
        setViewingDetailItem({ ...viewingDetailItem, status: newStatus });
      }
    } catch (err) {
      console.error("Erro ao atualizar status do conteúdo:", err);
    }
  };

  // Copy Caption to Clipboard
  const handleCopyCaption = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  // Date Navigation Helpers
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    setSelectedMonth(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    setSelectedMonth(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`);
  };

  // Calculate Calendar Days for Selected Month
  const getCalendarDays = () => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthStr, 10) - 1; // 0-indexed

    const firstDayOfMonth = new Date(year, monthIndex, 1);
    const lastDayOfMonth = new Date(year, monthIndex + 1, 0);

    // Day of week index (Monday = 0, Sunday = 6)
    const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7; 

    const daysInMonth = lastDayOfMonth.getDate();
    
    // Grid days array
    const calendarGrid: { dateStr: string; dayNumber: number; isCurrentMonth: boolean }[] = [];

    // Previous month padding
    const prevMonthLastDay = new Date(year, monthIndex, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const pDay = prevMonthLastDay - i;
      const prevM = monthIndex === 0 ? 12 : monthIndex;
      const prevY = monthIndex === 0 ? year - 1 : year;
      const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(pDay).padStart(2, '0')}`;
      calendarGrid.push({ dateStr, dayNumber: pDay, isCurrentMonth: false });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      calendarGrid.push({ dateStr, dayNumber: day, isCurrentMonth: true });
    }

    // Next month padding to complete 35 or 42 cells
    const remainingCells = 35 - calendarGrid.length > 0 ? 35 - calendarGrid.length : 42 - calendarGrid.length;
    for (let day = 1; day <= remainingCells; day++) {
      const nextM = monthIndex === 11 ? 1 : monthIndex + 2;
      const nextY = monthIndex === 11 ? year + 1 : year;
      const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      calendarGrid.push({ dateStr, dayNumber: day, isCurrentMonth: false });
    }

    return calendarGrid;
  };

  // Helper to calculate contract duration in months
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

  // Filtered Contracts
  const filteredContracts = contracts.filter(c => {
    const matchesSearch = c.companyName?.toLowerCase().includes(searchCompany.toLowerCase()) || 
                          c.title.toLowerCase().includes(searchCompany.toLowerCase());
    const matchesCompany = selectedCompanyFilter === 'all' || c.companyId === selectedCompanyFilter;
    return matchesSearch && matchesCompany;
  });

  // Filtered Content Items
  const filteredContentItems = contentItems.filter(item => {
    const matchesMonth = item.month === selectedMonth || (item.plannedDate && item.plannedDate.startsWith(selectedMonth));
    const matchesCompany = selectedCompanyFilter === 'all' || item.companyId === selectedCompanyFilter;
    const matchesCreator = selectedCreatorFilter === 'all' || item.creatorId === selectedCreatorFilter;
    const matchesStatus = selectedStatusFilter === 'all' || item.status === selectedStatusFilter;
    const matchesType = selectedTypeFilter === 'all' || item.contentType === selectedTypeFilter;
    return matchesMonth && matchesCompany && matchesCreator && matchesStatus && matchesType;
  });

  // Active metrics
  const activeContractsCount = contracts.filter(c => c.status === 'active').length;
  const totalMonthlyFee = contracts.filter(c => c.status === 'active').reduce((acc, c) => acc + (c.monthlyFee || 0), 0);
  const totalCreatorsInRecurring = contracts.reduce((acc, c) => acc + (c.creators?.length || 0), 0);
  const currentMonthItems = contentItems.filter(ci => ci.month === selectedMonth || (ci.plannedDate && ci.plannedDate.startsWith(selectedMonth)));
  const publishedMonthItems = currentMonthItems.filter(ci => ci.status === 'published').length;

  const currentCreatorObj = creators.find(cr => cr.id === selectedCreatorFilter) || creators[0];

  return (
    <div className="space-y-8 pb-16">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-brand-primary text-xs font-bold uppercase tracking-wider mb-1">
            <Repeat size={14} /> Contratos Contínuos & Planejamento
          </div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">Trabalhos Recorrentes</h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestão de contratos mensais por empresa, cronograma de publicações e calendários gerais e por criador.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {userRole === 'admin' && (
            <button
              onClick={() => setIsResetModalOpen(true)}
              className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-rose-100 transition-colors shadow-xs cursor-pointer"
              title="Limpar todos os trabalhos recorrentes e planejamentos"
            >
              <Trash2 size={15} className="text-rose-600" />
              Zerar Recorrência
            </button>
          )}

          <button
            onClick={() => handleOpenContentModal()}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Plus size={16} className="text-slate-500" />
            Adicionar Conteúdo
          </button>
          
          {(userRole === 'admin' || userRole === 'company') && (
            <button
              onClick={() => handleOpenContractModal()}
              className="flex items-center gap-2 bg-brand-primary text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-indigo-600 transition-all shadow-md shadow-indigo-100"
            >
              <Plus size={16} />
              Novo Contrato Recorrente
            </button>
          )}
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Contratos Ativos</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">{activeContractsCount}</span>
            <span className="text-[10px] font-semibold text-emerald-600 mt-0.5 block">Parcerias mensais ativas</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-brand-primary shrink-0">
            <Repeat size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Criadores Recorrentes</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">{totalCreatorsInRecurring}</span>
            <span className="text-[10px] font-semibold text-slate-500 mt-0.5 block">Em contratos fixos</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <Users size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Entregas do Mês</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">
              {publishedMonthItems} <span className="text-xs font-semibold text-slate-400">/ {currentMonthItems.length}</span>
            </span>
            <span className="text-[10px] font-semibold text-indigo-600 mt-0.5 block">
              {currentMonthItems.length > 0 ? `${Math.round((publishedMonthItems / currentMonthItems.length) * 100)}% concluídos` : 'Sem entregas'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <CalendarCheck size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Faturamento Recorrente</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">{formatCurrency(totalMonthlyFee)}</span>
            <span className="text-[10px] font-semibold text-slate-400 mt-0.5 block">Verba global mensal</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600 shrink-0">
            <DollarSign size={22} />
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-4 lg:gap-8">
          <button
            onClick={() => setActiveTab('contracts')}
            className={cn(
              "pb-4 text-sm font-bold transition-all relative flex items-center gap-2",
              activeTab === 'contracts' 
                ? "text-brand-primary border-b-2 border-brand-primary" 
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <Building2 size={16} />
            Contratos por Empresa
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-extrabold">
              {contracts.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('planning')}
            className={cn(
              "pb-4 text-sm font-bold transition-all relative flex items-center gap-2",
              activeTab === 'planning' 
                ? "text-brand-primary border-b-2 border-brand-primary" 
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <Layers size={16} />
            Grade de Conteúdo
            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-extrabold">
              {contentItems.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={cn(
              "pb-4 text-sm font-bold transition-all relative flex items-center gap-2",
              activeTab === 'calendar' 
                ? "text-brand-primary border-b-2 border-brand-primary" 
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <Calendar size={16} />
            Calendário Geral
          </button>

          <button
            onClick={() => setActiveTab('creator_calendar')}
            className={cn(
              "pb-4 text-sm font-bold transition-all relative flex items-center gap-2",
              activeTab === 'creator_calendar' 
                ? "text-brand-primary border-b-2 border-brand-primary" 
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <UserCheck size={16} />
            Calendário do Criador
          </button>
        </div>

        {/* Global Month Picker */}
        <div className="flex items-center gap-2 pb-3 shrink-0">
          <button 
            onClick={handlePrevMonth}
            className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
            title="Mês Anterior"
          >
            <ChevronLeft size={16} />
          </button>

          <input 
            type="month" 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-brand-primary shadow-sm"
          />

          <button 
            onClick={handleNextMonth}
            className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
            title="Próximo Mês"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* TAB 1: CONTRATOS POR EMPRESA */}
      {activeTab === 'contracts' && (
        <div className="space-y-6">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Buscar contrato por empresa ou nome do projeto..."
                value={searchCompany}
                onChange={(e) => setSearchCompany(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-brand-primary transition-all"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={selectedCompanyFilter}
                onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-brand-primary"
              >
                <option value="all">Todas as Empresas</option>
                {companies.map(comp => (
                  <option key={comp.id} value={comp.id}>{comp.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Contracts List */}
          {filteredContracts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                <Repeat size={24} />
              </div>
              <h3 className="text-base font-bold text-slate-800">Nenhum contrato recorrente encontrado</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Crie um contrato fixo mensal para vincular criadores de conteúdo com demandas recorrentes de publicações.
              </p>
              {(userRole === 'admin' || userRole === 'company') && (
                <button
                  onClick={() => handleOpenContractModal()}
                  className="mt-2 inline-flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-600 transition-colors"
                >
                  <Plus size={14} /> Novo Contrato Recorrente
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredContracts.map((contract) => {
                const totalReels = contract.creators?.reduce((a, c) => a + (c.monthlyDeliverables?.reels || 0), 0) || 0;
                const totalStories = contract.creators?.reduce((a, c) => a + (c.monthlyDeliverables?.stories || 0), 0) || 0;
                const totalPosts = contract.creators?.reduce((a, c) => a + (c.monthlyDeliverables?.posts || 0), 0) || 0;
                const totalTiktok = contract.creators?.reduce((a, c) => a + (c.monthlyDeliverables?.tiktok || 0), 0) || 0;
                const totalYoutube = contract.creators?.reduce((a, c) => a + (c.monthlyDeliverables?.youtube || 0), 0) || 0;
                const totalLive = contract.creators?.reduce((a, c) => a + (c.monthlyDeliverables?.live || 0), 0) || 0;
                const totalPinterest = contract.creators?.reduce((a, c) => a + (c.monthlyDeliverables?.pinterest || 0), 0) || 0;
                const totalBlog = contract.creators?.reduce((a, c) => a + (c.monthlyDeliverables?.blog || 0), 0) || 0;
                const totalPodcast = contract.creators?.reduce((a, c) => a + (c.monthlyDeliverables?.podcast || 0), 0) || 0;
                const totalUnboxing = contract.creators?.reduce((a, c) => a + (c.monthlyDeliverables?.unboxing || 0), 0) || 0;
                const totalUgc = contract.creators?.reduce((a, c) => a + (c.monthlyDeliverables?.ugc || 0), 0) || 0;

                const contractMonthlyFee = Number(contract.monthlyFee || 0);
                const contractCreatorsCost = (contract.creators || []).reduce((sum, c) => sum + Number(c.monthlyCache || c.monthlyFee || 0), 0);
                const contractRemainingBudget = contractMonthlyFee - contractCreatorsCost;
                const contractMarginPercent = contractMonthlyFee > 0 ? Math.round((contractRemainingBudget / contractMonthlyFee) * 100) : 0;
                const durationMonths = calculateContractMonths(contract.startDate, contract.endDate);
                const contractTotalPeriodValue = contractMonthlyFee * durationMonths;

                return (
                  <div 
                    key={contract.id} 
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-xs font-black uppercase tracking-wider text-brand-primary bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                              {contract.companyName || 'Empresa'}
                            </span>
                            <span className={cn(
                              "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border",
                              contract.status === 'active' 
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : contract.status === 'paused'
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            )}>
                              {contract.status === 'active' ? '● Ativo' : contract.status === 'paused' ? 'Pausado' : 'Finalizado'}
                            </span>
                            {contract.monthlyFee ? (
                              <span className="text-[10px] font-extrabold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                Mensal: {formatCurrency(contractMonthlyFee)}
                              </span>
                            ) : null}
                            {contract.endDate && durationMonths > 1 && contract.monthlyFee ? (
                              <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                                Total Período: {formatCurrency(contractTotalPeriodValue)} ({durationMonths}m)
                              </span>
                            ) : null}
                            {contract.monthlyFee ? (
                              <span className={cn(
                                "text-[10px] font-black px-2 py-0.5 rounded-full border",
                                contractRemainingBudget >= 0 
                                  ? "text-emerald-700 bg-emerald-50 border-emerald-200" 
                                  : "text-rose-700 bg-rose-50 border-rose-200"
                              )}>
                                Saldo: {formatCurrency(contractRemainingBudget)}/mês
                              </span>
                            ) : null}
                          </div>

                          <h3 className="text-lg font-bold text-slate-900 mt-1 hover:text-brand-primary transition-colors">
                            <Link to={`/recurring/${contract.id}`}>{contract.title}</Link>
                          </h3>
                          {contract.objective && (
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{contract.objective}</p>
                          )}

                          {/* Financial Summary Strip */}
                          {contractMonthlyFee > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 text-[11px] bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/70">
                              <div className="bg-white/80 p-2 rounded-lg border border-slate-200/60 flex flex-col justify-between">
                                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Orçamento Mensal</span>
                                <div className="flex flex-col mt-0.5">
                                  <div className="flex items-baseline gap-1">
                                    <span className="font-black text-slate-900 text-xs sm:text-sm">{formatCurrency(contractMonthlyFee)}</span>
                                    <span className="text-[9px] text-slate-400">/mês</span>
                                  </div>
                                  {contract.endDate && durationMonths > 1 && (
                                    <span className="text-[9px] font-bold text-indigo-700 mt-0.5">
                                      Total ({durationMonths}m): {formatCurrency(contractTotalPeriodValue)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="bg-white/80 p-2 rounded-lg border border-slate-200/60 flex flex-col justify-between">
                                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block truncate">
                                  Criadores ({contract.creators?.length || 0})
                                </span>
                                <div className="flex flex-col mt-0.5">
                                  <div className="flex items-baseline gap-1">
                                    <span className="font-black text-slate-700 text-xs sm:text-sm">{formatCurrency(contractCreatorsCost)}</span>
                                    <span className="text-[9px] text-slate-400">/mês</span>
                                  </div>
                                  {contract.endDate && durationMonths > 1 && (
                                    <span className="text-[9px] font-medium text-slate-500 mt-0.5">
                                      Total ({durationMonths}m): {formatCurrency(contractCreatorsCost * durationMonths)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className={cn(
                                "p-2 rounded-lg border flex flex-col justify-between",
                                contractRemainingBudget >= 0 ? "bg-emerald-50/70 border-emerald-200/70" : "bg-rose-50/70 border-rose-200/70"
                              )}>
                                <span className={cn(
                                  "text-[9px] font-extrabold uppercase tracking-wider block truncate",
                                  contractRemainingBudget >= 0 ? "text-emerald-700" : "text-rose-700"
                                )}>
                                  Saldo Restante
                                </span>
                                <div className="flex flex-col mt-0.5">
                                  <div className="flex items-baseline gap-1">
                                    <span className={cn(
                                      "font-black text-xs sm:text-sm block",
                                      contractRemainingBudget >= 0 ? "text-emerald-700" : "text-rose-700"
                                    )}>
                                      {formatCurrency(contractRemainingBudget)}
                                    </span>
                                    <span className="text-[9px] font-semibold text-slate-400">
                                      ({contractRemainingBudget >= 0 ? `+${contractMarginPercent}%` : 'déficit'})
                                    </span>
                                  </div>
                                  {contract.endDate && durationMonths > 1 && (
                                    <span className={cn("text-[9px] font-bold mt-0.5", contractRemainingBudget >= 0 ? "text-emerald-700" : "text-rose-700")}>
                                      Total ({durationMonths}m): {formatCurrency(contractRemainingBudget * durationMonths)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {(userRole !== 'creator') && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenContractModal(contract)}
                              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="Editar contrato"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteContract(contract.id, contract.title)}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Excluir contrato"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Card Body - Content Deliverables Summary */}
                      <div className="p-6 bg-slate-50/40">
                        {/* Monthly Deliverables Total Badges */}
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                            Cota Mensal de Conteúdos
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {totalReels > 0 && (
                              <span className="bg-indigo-50 text-brand-primary border border-indigo-100 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5">
                                <Film size={13} /> {totalReels} Reels
                              </span>
                            )}
                            {totalStories > 0 && (
                              <span className="bg-amber-50 text-amber-700 border border-amber-100 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5">
                                <Instagram size={13} /> {totalStories} Stories
                              </span>
                            )}
                            {totalPosts > 0 && (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5">
                                <Layers size={13} /> {totalPosts} Feed
                              </span>
                            )}
                            {totalTiktok > 0 && (
                              <span className="bg-rose-50 text-rose-700 border border-rose-100 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5">
                                <Clapperboard size={13} /> {totalTiktok} TikToks
                              </span>
                            )}
                            {totalYoutube > 0 && (
                              <span className="bg-red-50 text-red-700 border border-red-100 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5">
                                <Video size={13} /> {totalYoutube} YouTube
                              </span>
                            )}
                            {totalLive > 0 && (
                              <span className="bg-purple-50 text-purple-700 border border-purple-100 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5">
                                <Radio size={13} /> {totalLive} Lives
                              </span>
                            )}
                            {totalPinterest > 0 && (
                              <span className="bg-pink-50 text-pink-700 border border-pink-100 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5">
                                <Pin size={13} /> {totalPinterest} Pins
                              </span>
                            )}
                            {totalBlog > 0 && (
                              <span className="bg-sky-50 text-sky-700 border border-sky-100 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5">
                                <Newspaper size={13} /> {totalBlog} Artigos
                              </span>
                            )}
                            {totalPodcast > 0 && (
                              <span className="bg-violet-50 text-violet-700 border border-violet-100 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5">
                                <Mic size={13} /> {totalPodcast} Podcasts
                              </span>
                            )}
                            {totalUnboxing > 0 && (
                              <span className="bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-100 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5">
                                <Package size={13} /> {totalUnboxing} Unboxings
                              </span>
                            )}
                            {totalUgc > 0 && (
                              <span className="bg-teal-50 text-teal-700 border border-teal-100 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5">
                                <Camera size={13} /> {totalUgc} UGCs
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer: Creator Profile Avatars & Actions */}
                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs flex-wrap gap-3">
                      {/* Left: Influencers avatar stack (up to 10) & creator count + date */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {contract.creators && contract.creators.length > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center -space-x-2 overflow-hidden py-0.5">
                              {contract.creators.slice(0, 10).map((cConfig, idx) => {
                                const cr = creators.find(c => c.id === cConfig.creatorId);
                                const displayName = cConfig.creatorName || cr?.artisticName || 'Criador';
                                return (
                                  <div 
                                    key={cConfig.creatorId || idx}
                                    className="inline-block rounded-full ring-2 ring-white shadow-xs shrink-0 relative cursor-pointer hover:z-10 hover:scale-110 transition-transform"
                                    title={displayName}
                                  >
                                    <UserAvatar
                                      src={cr?.photoUrl}
                                      name={displayName}
                                      size="custom"
                                      shape="circle"
                                      className="w-8 h-8"
                                      textClassName="text-xs"
                                    />
                                  </div>
                                );
                              })}
                              {contract.creators.length > 10 && (
                                <div 
                                  className="inline-flex w-8 h-8 rounded-full ring-2 ring-white bg-slate-800 text-white font-black text-[10px] items-center justify-center shrink-0 shadow-xs cursor-pointer hover:z-10"
                                  title={`+${contract.creators.length - 10} outros criadores vinculados`}
                                >
                                  +{contract.creators.length - 10}
                                </div>
                              )}
                            </div>
                            <span className="text-xs font-bold text-slate-700 bg-white px-2 py-1 rounded-lg border border-slate-200/80 shadow-2xs">
                              {contract.creators.length} {contract.creators.length === 1 ? 'criador' : 'criadores'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs italic text-slate-400 flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200/60">
                            <Users size={13} className="text-slate-400" /> 0 criadores
                          </span>
                        )}

                        <div className="h-4 w-px bg-slate-200 hidden sm:block" />

                        <div className="flex items-center gap-1.5 text-slate-500 font-medium text-[11px]">
                          <Calendar size={13} className="text-slate-400" />
                          <span>Início: {new Date(contract.startDate).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/recurring/${contract.id}`}
                          className="px-3.5 py-1.5 bg-brand-primary hover:bg-indigo-600 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm shadow-indigo-100"
                        >
                          <ExternalLink size={13} /> Gerenciar Projeto
                        </Link>

                        <button
                          onClick={() => setSelectedContractForDetails(contract)}
                          className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          Detalhes
                        </button>

                        <button
                          onClick={() => {
                            setActiveTab('planning');
                            setSelectedCompanyFilter(contract.companyId);
                          }}
                          className="text-brand-primary font-bold hover:underline flex items-center gap-1 text-xs"
                        >
                          Ver Grade <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: GRADE DE CONTEÚDO MENSAL */}
      {activeTab === 'planning' && (
        <div className="space-y-6">
          {/* Subheader & Month Filter */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Grade de Entregas — {new Date(`${selectedMonth}-02`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Acompanhe o cronograma de publicações mensais dos criadores por projeto recorrente.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <select
                value={selectedCompanyFilter}
                onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-brand-primary"
              >
                <option value="all">Todas as Empresas</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select
                value={selectedCreatorFilter}
                onChange={(e) => setSelectedCreatorFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-brand-primary"
              >
                <option value="all">Todos os Criadores</option>
                {creators.map(cr => (
                  <option key={cr.id} value={cr.id}>{cr.artisticName || cr.fullName}</option>
                ))}
              </select>

              <button
                onClick={() => handleOpenContentModal()}
                className="bg-brand-primary text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-600 transition-all shadow-sm flex items-center gap-1.5"
              >
                <Plus size={14} /> Novo Conteúdo
              </button>
            </div>
          </div>

          {/* Contracts Breakdown */}
          {contracts.map(contract => {
            if (selectedCompanyFilter !== 'all' && contract.companyId !== selectedCompanyFilter) return null;

            return (
              <div key={contract.id} className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-2">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-primary bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                      {contract.companyName || 'Empresa'}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-1">{contract.title}</h3>
                  </div>

                  <button
                    onClick={() => handleOpenContentModal(contract.id)}
                    className="text-xs font-bold text-brand-primary hover:bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 self-start md:self-auto"
                  >
                    <Plus size={14} /> Adicionar Item ao Mês
                  </button>
                </div>

                {/* Creator Breakdown Grid */}
                <div className="space-y-6">
                  {contract.creators?.map(cConfig => {
                    if (selectedCreatorFilter !== 'all' && cConfig.creatorId !== selectedCreatorFilter) return null;

                    const cr = creators.find(c => c.id === cConfig.creatorId);
                    const creatorItems = contentItems.filter(
                      ci => ci.recurringContractId === contract.id && 
                            ci.creatorId === cConfig.creatorId && 
                            (ci.month === selectedMonth || (ci.plannedDate && ci.plannedDate.startsWith(selectedMonth)))
                    );

                    const publishedCount = creatorItems.filter(i => i.status === 'published').length;

                    const totalQuota = (cConfig.monthlyDeliverables?.reels || 0) +
                                       (cConfig.monthlyDeliverables?.stories || 0) +
                                       (cConfig.monthlyDeliverables?.posts || 0) +
                                       (cConfig.monthlyDeliverables?.tiktok || 0) +
                                       (cConfig.monthlyDeliverables?.youtube || 0) +
                                       (cConfig.monthlyDeliverables?.live || 0) +
                                       (cConfig.monthlyDeliverables?.pinterest || 0) +
                                       (cConfig.monthlyDeliverables?.blog || 0) +
                                       (cConfig.monthlyDeliverables?.podcast || 0) +
                                       (cConfig.monthlyDeliverables?.unboxing || 0) +
                                       (cConfig.monthlyDeliverables?.ugc || 0);

                    return (
                      <div key={cConfig.creatorId} className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/70 space-y-4">
                        {/* Creator Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              src={cr?.photoUrl}
                              name={cConfig.creatorName || cr?.artisticName || 'Criador'}
                              size="custom"
                              shape="circle"
                              className="w-10 h-10 border border-slate-200"
                              textClassName="text-sm font-bold"
                            />
                            <div>
                              <h4 className="text-sm font-bold text-slate-900">{cConfig.creatorName || cr?.artisticName}</h4>
                              <p className="text-[11px] text-slate-500">
                                Meta mensal do contrato: <strong className="text-slate-800">{totalQuota} peças</strong>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <span className="text-xs font-extrabold text-slate-800 block">
                                {creatorItems.length} de {totalQuota} cadastrados
                              </span>
                              <span className="text-[10px] text-emerald-600 font-bold block">
                                {publishedCount} publicados
                              </span>
                            </div>

                            <button
                              onClick={() => handleOpenContentModal(contract.id, cConfig.creatorId)}
                              className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                            >
                              <Plus size={13} /> Conteúdo
                            </button>
                          </div>
                        </div>

                        {/* Content Cards */}
                        {creatorItems.length === 0 ? (
                          <div className="bg-white p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                            Nenhum conteúdo planejado para este criador neste mês ({selectedMonth}).
                            <button 
                              onClick={() => handleOpenContentModal(contract.id, cConfig.creatorId)}
                              className="text-brand-primary font-bold ml-2 underline"
                            >
                              + Criar primeiro tema
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {creatorItems.map(item => (
                              <div 
                                key={item.id} 
                                className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm space-y-3 flex flex-col justify-between hover:border-indigo-200 transition-all group"
                              >
                                <div>
                                  {/* Type & Status */}
                                  <div className="flex items-center justify-between gap-2">
                                    {(() => {
                                      const config = CONTENT_TYPE_CONFIG[item.contentType] || CONTENT_TYPE_CONFIG.other;
                                      const IconComp = config.icon;
                                      return (
                                        <span className={cn(
                                          "text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border flex items-center gap-1",
                                          config.bg, config.text, config.border
                                        )}>
                                          <IconComp size={11} />
                                          {config.shortLabel}
                                        </span>
                                      );
                                    })()}

                                    <select
                                      value={item.status}
                                      onChange={(e) => handleQuickStatusChange(item.id, e.target.value as ContentPlanningStatus)}
                                      className={cn(
                                        "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border outline-none cursor-pointer",
                                        item.status === 'published' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                        item.status === 'approved' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                        item.status === 'review' ? "bg-amber-50 text-amber-700 border-amber-200" :
                                        item.status === 'in_production' ? "bg-purple-50 text-purple-700 border-purple-200" :
                                        "bg-slate-100 text-slate-600 border-slate-200"
                                      )}
                                    >
                                      <option value="planned">Planejado</option>
                                      <option value="in_production">Em Produção</option>
                                      <option value="review">Em Revisão</option>
                                      <option value="approved">Aprovado</option>
                                      <option value="published">Publicado</option>
                                    </select>
                                  </div>

                                  <h5 
                                    onClick={() => setViewingDetailItem(item)}
                                    className="text-xs font-bold text-slate-900 mt-2.5 line-clamp-2 cursor-pointer hover:text-brand-primary"
                                  >
                                    {item.title}
                                  </h5>

                                  {item.description && (
                                    <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">
                                      {item.description}
                                    </p>
                                  )}

                                  {item.briefingNote && (
                                    <p className="text-[10px] text-slate-500 mt-1.5 italic bg-slate-50 p-2 rounded-lg border border-slate-100 line-clamp-2">
                                      "{item.briefingNote}"
                                    </p>
                                  )}
                                </div>

                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                                  <span className="font-semibold text-slate-600">
                                    {item.plannedDate ? `Data: ${new Date(item.plannedDate + 'T00:00:00').toLocaleDateString()}` : 'Sem data definida'}
                                  </span>

                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => setViewingDetailItem(item)}
                                      className="p-1 text-slate-400 hover:text-brand-primary hover:bg-indigo-50 rounded"
                                      title="Ver detalhes e briefing completo"
                                    >
                                      <Eye size={13} />
                                    </button>
                                    <button
                                      onClick={() => handleOpenContentModal(contract.id, cConfig.creatorId, item)}
                                      className="p-1 text-slate-400 hover:text-slate-700 rounded"
                                      title="Editar item"
                                    >
                                      <Edit3 size={13} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteContentItem(item.id)}
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                      title="Remover item"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: CALENDÁRIO GERAL DE CONTEÚDO */}
      {activeTab === 'calendar' && (
        <div className="space-y-6">
          {/* Calendar Header Filters */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Calendário Mensal Geral — {new Date(`${selectedMonth}-02`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Visão unificada em calendário de todas as postagens agendadas por dia.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedCompanyFilter}
                onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none"
              >
                <option value="all">Empresa: Todas</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select
                value={selectedCreatorFilter}
                onChange={(e) => setSelectedCreatorFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none"
              >
                <option value="all">Criador: Todos</option>
                {creators.map(cr => (
                  <option key={cr.id} value={cr.id}>{cr.artisticName || cr.fullName}</option>
                ))}
              </select>

              <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none"
              >
                <option value="all">Formato: Todos</option>
                <option value="reel">Reels</option>
                <option value="story">Stories</option>
                <option value="post">Feed Post</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
                <option value="live">Live / Transmissão</option>
                <option value="pinterest">Pinterest Pin</option>
                <option value="blog">Artigo / Blog</option>
                <option value="podcast">Podcast</option>
                <option value="unboxing">Unboxing</option>
                <option value="ugc">Vídeo UGC</option>
                <option value="event">Evento</option>
                <option value="other">Outro Formato</option>
              </select>

              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none"
              >
                <option value="all">Status: Todos</option>
                <option value="planned">Planejado</option>
                <option value="in_production">Em Produção</option>
                <option value="review">Em Revisão</option>
                <option value="approved">Aprovado</option>
                <option value="published">Publicado</option>
              </select>
            </div>
          </div>

          {/* Calendar Grid Component */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/70 text-center text-xs font-extrabold text-slate-500 uppercase tracking-wider py-3">
              <div>Seg</div>
              <div>Ter</div>
              <div>Qua</div>
              <div>Qui</div>
              <div>Sex</div>
              <div>Sáb</div>
              <div>Dom</div>
            </div>

            {/* Calendar Cells */}
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
              {getCalendarDays().map((cell, idx) => {
                const dayItems = filteredContentItems.filter(item => item.plannedDate === cell.dateStr);
                const isToday = cell.dateStr === new Date().toISOString().split('T')[0];

                return (
                  <div 
                    key={idx} 
                    className={cn(
                      "min-h-[120px] p-2 transition-all flex flex-col justify-between group",
                      cell.isCurrentMonth ? "bg-white" : "bg-slate-50/40 text-slate-300"
                    )}
                  >
                    <div>
                      {/* Date number header */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={cn(
                          "text-xs font-extrabold w-6 h-6 rounded-full flex items-center justify-center",
                          isToday ? "bg-brand-primary text-white" : cell.isCurrentMonth ? "text-slate-700" : "text-slate-300"
                        )}>
                          {cell.dayNumber}
                        </span>

                        {cell.isCurrentMonth && (
                          <button
                            onClick={() => handleOpenContentModal(undefined, undefined, undefined, cell.dateStr)}
                            className="opacity-0 group-hover:opacity-100 text-[10px] text-brand-primary font-bold p-1 hover:bg-indigo-50 rounded transition-all"
                            title="Agendar neste dia"
                          >
                            + Add
                          </button>
                        )}
                      </div>

                      {/* Day's Content Badges */}
                      <div className="space-y-1.5">
                        {dayItems.map(item => (
                          <div 
                            key={item.id}
                            onClick={() => setViewingDetailItem(item)}
                            className={cn(
                              "p-1.5 rounded-lg border text-[10px] font-bold cursor-pointer transition-all shadow-2xs hover:scale-[1.02]",
                              item.status === 'published' ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
                              item.status === 'approved' ? "bg-blue-50 text-blue-800 border-blue-200" :
                              item.status === 'review' ? "bg-amber-50 text-amber-800 border-amber-200" :
                              item.status === 'in_production' ? "bg-purple-50 text-purple-800 border-purple-200" :
                              "bg-slate-100 text-slate-800 border-slate-200"
                            )}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="uppercase text-[9px] font-black opacity-80">
                                {CONTENT_TYPE_CONFIG[item.contentType]?.shortLabel || item.contentType}
                              </span>
                              <span className="truncate text-[9px] font-semibold">{item.creatorName}</span>
                            </div>
                            <p className="truncate font-bold mt-0.5">{item.title}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CALENDÁRIO DO CRIADOR */}
      {activeTab === 'creator_calendar' && (
        <div className="space-y-6">
          {/* Creator Selection Banner */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <UserAvatar
                src={currentCreatorObj?.photoUrl}
                name={currentCreatorObj?.artisticName || currentCreatorObj?.fullName || 'Criador'}
                size="custom"
                shape="rounded-2xl"
                className="w-12 h-12 border border-slate-200 shadow-xs"
                textClassName="text-lg font-bold"
              />
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Agenda do Criador: {currentCreatorObj?.artisticName || currentCreatorObj?.fullName || 'Criador'}
                </h3>
                <p className="text-xs text-slate-500">
                  Visualização focada nas demandas, prazos e briefs do influenciador selecionado.
                </p>
              </div>
            </div>

            {/* Creator Selector */}
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Selecionar Criador:</label>
              <select
                value={selectedCreatorFilter === 'all' ? (creators[0]?.id || 'all') : selectedCreatorFilter}
                onChange={(e) => setSelectedCreatorFilter(e.target.value)}
                className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-brand-primary shadow-sm"
              >
                {creators.map(cr => (
                  <option key={cr.id} value={cr.id}>{cr.artisticName || cr.fullName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Individual Creator Schedule Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Timeline Column */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900">Prazos & Postagens Agendadas ({selectedMonth})</h4>
                <button
                  onClick={() => handleOpenContentModal(undefined, selectedCreatorFilter === 'all' ? creators[0]?.id : selectedCreatorFilter)}
                  className="bg-brand-primary text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-600 transition-all flex items-center gap-1"
                >
                  <Plus size={13} /> Agendar Conteúdo
                </button>
              </div>

              {filteredContentItems.filter(i => selectedCreatorFilter === 'all' || i.creatorId === selectedCreatorFilter).length === 0 ? (
                <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-2">
                  <Calendar size={28} className="text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">Nenhum post agendado para este criador neste mês</p>
                  <p className="text-[11px] text-slate-400">Clique em "Agendar Conteúdo" para planejar entregas.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredContentItems
                    .filter(i => selectedCreatorFilter === 'all' || i.creatorId === selectedCreatorFilter)
                    .sort((a, b) => (a.plannedDate || '').localeCompare(b.plannedDate || ''))
                    .map(item => {
                      const comp = companies.find(c => c.id === item.companyId);

                      return (
                        <div 
                          key={item.id} 
                          className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:border-indigo-200 transition-all space-y-3"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-50 text-brand-primary border border-indigo-100">
                                  {comp?.name || 'Projeto Recorrente'}
                                </span>
                                {(() => {
                                  const config = CONTENT_TYPE_CONFIG[item.contentType] || CONTENT_TYPE_CONFIG.other;
                                  const IconComp = config.icon;
                                  return (
                                    <span className={cn(
                                      "text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border flex items-center gap-1",
                                      config.bg, config.text, config.border
                                    )}>
                                      <IconComp size={11} />
                                      {config.shortLabel}
                                    </span>
                                  );
                                })()}
                              </div>

                              <h4 className="text-sm font-bold text-slate-900 mt-1">{item.title}</h4>
                            </div>

                            <select
                              value={item.status}
                              onChange={(e) => handleQuickStatusChange(item.id, e.target.value as ContentPlanningStatus)}
                              className={cn(
                                "text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border outline-none cursor-pointer",
                                item.status === 'published' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                item.status === 'approved' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                item.status === 'review' ? "bg-amber-50 text-amber-700 border-amber-200" :
                                item.status === 'in_production' ? "bg-purple-50 text-purple-700 border-purple-200" :
                                "bg-slate-100 text-slate-600 border-slate-200"
                              )}
                            >
                              <option value="planned">Planejado</option>
                              <option value="in_production">Em Produção</option>
                              <option value="review">Em Revisão</option>
                              <option value="approved">Aprovado</option>
                              <option value="published">Publicado</option>
                            </select>
                          </div>

                          {/* Briefing note or description */}
                          {item.description && (
                            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                              {item.description}
                            </p>
                          )}

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-700 flex items-center gap-1.5">
                              <Calendar size={13} className="text-slate-400" />
                              {item.plannedDate ? `Publicação em: ${new Date(item.plannedDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}` : 'Data não definida'}
                            </span>

                            <button
                              onClick={() => setViewingDetailItem(item)}
                              className="text-brand-primary font-bold hover:underline flex items-center gap-1 text-xs"
                            >
                              <Eye size={13} /> Briefing Completo
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Creator Deliverables Sidebar Card */}
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
                <h4 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100">
                  Resumo de Entregas ({selectedMonth})
                </h4>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 bg-slate-50 p-3 rounded-xl">
                    <span>Total de Itens Planejados:</span>
                    <strong className="text-slate-900 font-extrabold text-sm">
                      {filteredContentItems.filter(i => selectedCreatorFilter === 'all' || i.creatorId === selectedCreatorFilter).length}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 bg-emerald-50/60 p-3 rounded-xl text-emerald-900 border border-emerald-100">
                    <span>Publicados e Concluídos:</span>
                    <strong className="font-extrabold text-sm">
                      {filteredContentItems.filter(i => (selectedCreatorFilter === 'all' || i.creatorId === selectedCreatorFilter) && i.status === 'published').length}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 bg-purple-50/60 p-3 rounded-xl text-purple-900 border border-purple-100">
                    <span>Em Produção / Revisão:</span>
                    <strong className="font-extrabold text-sm">
                      {filteredContentItems.filter(i => (selectedCreatorFilter === 'all' || i.creatorId === selectedCreatorFilter) && (i.status === 'in_production' || i.status === 'review')).length}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER / MODAL: VIEW DETAILED CONTENT & BRIEFING */}
      {viewingDetailItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl my-auto max-h-[90vh] flex flex-col overflow-hidden relative z-10">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 p-5 sm:p-6 shrink-0 bg-white">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-50 text-brand-primary border border-indigo-100">
                    {companies.find(c => c.id === viewingDetailItem.companyId)?.name || 'Empresa'}
                  </span>
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {viewingDetailItem.contentType}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900">{viewingDetailItem.title}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Criador responsável: <strong className="text-slate-800">{viewingDetailItem.creatorName}</strong>
                </p>
              </div>

              <button 
                onClick={() => setViewingDetailItem(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content Sections */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5 text-xs text-slate-700">
              {/* Scheduled Date and Status */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Data Prevista</span>
                  <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">
                    {viewingDetailItem.plannedDate ? new Date(viewingDetailItem.plannedDate + 'T00:00:00').toLocaleDateString('pt-BR', { dateStyle: 'long' }) : 'A definir'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Status Atual</span>
                  <select
                    value={viewingDetailItem.status}
                    onChange={(e) => handleQuickStatusChange(viewingDetailItem.id, e.target.value as ContentPlanningStatus)}
                    className={cn(
                      "text-xs font-bold uppercase px-3 py-1 rounded-full border outline-none cursor-pointer",
                      viewingDetailItem.status === 'published' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      viewingDetailItem.status === 'approved' ? "bg-blue-50 text-blue-700 border-blue-200" :
                      viewingDetailItem.status === 'review' ? "bg-amber-50 text-amber-700 border-amber-200" :
                      viewingDetailItem.status === 'in_production' ? "bg-purple-50 text-purple-700 border-purple-200" :
                      "bg-slate-100 text-slate-600 border-slate-200"
                    )}
                  >
                    <option value="planned">Planejado</option>
                    <option value="in_production">Em Produção</option>
                    <option value="review">Em Revisão</option>
                    <option value="approved">Aprovado</option>
                    <option value="published">Publicado</option>
                  </select>
                </div>
              </div>

              {/* Briefing Note / Direction */}
              {viewingDetailItem.briefingNote && (
                <div className="space-y-1.5">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={14} className="text-amber-500" />
                    Orientação Curta / Briefing Express
                  </h4>
                  <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200/70 text-slate-800 font-medium leading-relaxed">
                    "{viewingDetailItem.briefingNote}"
                  </div>
                </div>
              )}

              {/* Full Project Briefing */}
              {viewingDetailItem.briefing && (
                <div className="space-y-1.5">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={14} className="text-brand-primary" />
                    Briefing Completo do Projeto
                  </h4>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 whitespace-pre-wrap leading-relaxed">
                    {viewingDetailItem.briefing}
                  </div>
                </div>
              )}

              {/* Content Description / Script Structure */}
              {viewingDetailItem.description && (
                <div className="space-y-1.5">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <AlignLeft size={14} className="text-indigo-600" />
                    Descrição do Conteúdo
                  </h4>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 whitespace-pre-wrap leading-relaxed">
                    {viewingDetailItem.description}
                  </div>
                </div>
              )}

              {/* Script / Talking Points */}
              {viewingDetailItem.script && (
                <div className="space-y-1.5">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={14} className="text-purple-600" />
                    Roteiro / Falas Sugeridas
                  </h4>
                  <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-100 whitespace-pre-wrap leading-relaxed text-purple-950 font-medium">
                    {viewingDetailItem.script}
                  </div>
                </div>
              )}

              {/* References & Links */}
              {viewingDetailItem.references && (
                <div className="space-y-1.5">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Link2 size={14} className="text-sky-600" />
                    Referências & Links de Inspiração
                  </h4>
                  <div className="p-3 bg-sky-50/50 rounded-xl border border-sky-100 text-sky-950 text-xs break-all">
                    {viewingDetailItem.references}
                  </div>
                </div>
              )}

              {/* Caption / Copy */}
              {viewingDetailItem.caption && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare size={14} className="text-emerald-600" />
                      Legenda Recomendada / Copy
                    </h4>

                    <button
                      onClick={() => handleCopyCaption(viewingDetailItem.caption || '')}
                      className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-1"
                    >
                      {copiedCaption ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      {copiedCaption ? 'Copiado!' : 'Copiar Legenda'}
                    </button>
                  </div>
                  <div className="p-4 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                    {viewingDetailItem.caption}
                  </div>
                </div>
              )}

              {/* Submission Material from Creator */}
              {viewingDetailItem.submissionUrl && (
                <div className="p-4 bg-purple-50 rounded-2xl border border-purple-200 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
                      <UploadCloud size={14} /> Conteúdo Enviado pelo Criador
                    </span>
                    {viewingDetailItem.submittedAt && (
                      <span className="text-[10px] font-semibold text-purple-600">
                        {new Date(viewingDetailItem.submittedAt).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>

                  {/* Video / File Player preview */}
                  <SubmissionMediaPreview url={viewingDetailItem.submissionUrl} />

                  {viewingDetailItem.submissionNotes && (
                    <div className="pt-2 border-t border-purple-100 text-xs text-purple-950">
                      <span className="font-bold uppercase text-[10px] text-purple-700 block">Observação do Criador:</span>
                      <p className="m-0 mt-0.5 whitespace-pre-wrap leading-relaxed">{viewingDetailItem.submissionNotes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Feedback Note from Company/Agency */}
              {viewingDetailItem.feedbackNote && (
                <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-950">
                  <span className="font-bold uppercase text-[10px] text-rose-700 block">Feedback / Ajustes Solicitados:</span>
                  <p className="m-0 mt-0.5 whitespace-pre-wrap">{viewingDetailItem.feedbackNote}</p>
                </div>
              )}

              {/* Approval Actions bar for Agência/Empresa */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Ações de Aprovação:</span>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      const item = viewingDetailItem;
                      updateDoc(doc(db, 'contentPlanning', item.id), {
                        status: 'approved',
                        reviewedAt: new Date().toISOString(),
                        feedbackNote: ''
                      }).then(() => {
                        setViewingDetailItem(prev => prev ? { ...prev, status: 'approved', feedbackNote: '' } : null);
                        if (item.creatorId) {
                          createNotification({
                            title: 'Conteúdo Aprovado! 🎉',
                            message: `Seu conteúdo "${item.title}" no contrato recorrente foi aprovado pela agência!`,
                            type: 'approval',
                            targetRole: 'creator',
                            creatorId: item.creatorId,
                            contractId: item.contractId,
                            link: `/creators/${item.creatorId}?tab=recurring`
                          });
                        }
                      });
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-1 shadow-sm",
                      viewingDetailItem.status === 'approved' ? "bg-emerald-100 text-emerald-800" : "bg-emerald-600 text-white hover:bg-emerald-700"
                    )}
                  >
                    <CheckCircle2 size={13} /> {viewingDetailItem.status === 'approved' ? 'Aprovado' : 'Aprovar'}
                  </button>

                  <button
                    onClick={() => {
                      const item = viewingDetailItem;
                      const reason = prompt('Informe o motivo da reprovação do conteúdo:');
                      if (!reason || !reason.trim()) return;
                      updateDoc(doc(db, 'contentPlanning', item.id), {
                        status: 'rejected',
                        feedbackNote: `[REPROVADO]: ${reason.trim()}`,
                        reviewedAt: new Date().toISOString()
                      }).then(() => {
                        setViewingDetailItem(prev => prev ? { ...prev, status: 'rejected', feedbackNote: `[REPROVADO]: ${reason.trim()}` } : null);
                        if (item.creatorId) {
                          createNotification({
                            title: 'Conteúdo Reprovado ❌',
                            message: `Seu conteúdo "${item.title}" no contrato recorrente precisa de alteração: ${reason.trim()}`,
                            type: 'rejection',
                            targetRole: 'creator',
                            creatorId: item.creatorId,
                            contractId: item.contractId,
                            link: `/creators/${item.creatorId}?tab=recurring`
                          });
                        }
                      });
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border border-rose-200",
                      viewingDetailItem.status === 'rejected' ? "bg-rose-100 text-rose-800" : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                    )}
                  >
                    <X size={13} /> {viewingDetailItem.status === 'rejected' ? 'Reprovado' : 'Reprovar'}
                  </button>

                  <button
                    onClick={() => {
                      const item = viewingDetailItem;
                      const notes = prompt('Descreva os ajustes necessários no conteúdo:');
                      if (!notes || !notes.trim()) return;
                      updateDoc(doc(db, 'contentPlanning', item.id), {
                        status: 'in_production',
                        feedbackNote: notes.trim(),
                        reviewedAt: new Date().toISOString()
                      }).then(() => {
                        setViewingDetailItem(prev => prev ? { ...prev, status: 'in_production', feedbackNote: notes.trim() } : null);
                        if (item.creatorId) {
                          createNotification({
                            title: 'Ajustes Solicitados no Conteúdo 📝',
                            message: `A agência solicitou ajustes no conteúdo "${item.title}": "${notes.trim()}".`,
                            type: 'rejection',
                            targetRole: 'creator',
                            creatorId: item.creatorId,
                            contractId: item.contractId,
                            link: `/creators/${item.creatorId}?tab=recurring`
                          });
                        }
                      });
                    }}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                  >
                    <AlertCircle size={13} /> Pedir Alteração
                  </button>
                </div>
              </div>

              {/* Published or Media Link */}
              {viewingDetailItem.publishedUrl && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                  <span className="font-bold text-emerald-900 flex items-center gap-2">
                    <Link2 size={16} /> Link do Conteúdo Publicado
                  </span>
                  <a 
                    href={viewingDetailItem.publishedUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-emerald-700 flex items-center gap-1"
                  >
                    Ver Post <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 sm:p-6 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <button
                onClick={() => handleDeleteContentItem(viewingDetailItem.id)}
                className="text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={15} /> Excluir
              </button>

              <button
                onClick={() => {
                  const item = viewingDetailItem;
                  setViewingDetailItem(null);
                  handleOpenContentModal(item.recurringContractId, item.creatorId, item);
                }}
                className="bg-brand-primary text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-indigo-600 shadow-md shadow-indigo-100 flex items-center gap-2 cursor-pointer"
              >
                <Edit3 size={15} /> Editar Conteúdo & Briefing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR/EDITAR CONTRATO RECORRENTE */}
      {isContractModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl my-auto max-h-[90vh] flex flex-col overflow-hidden relative z-10">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-brand-primary flex items-center justify-center">
                  <Repeat size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingContract ? 'Editar Contrato Recorrente' : 'Novo Contrato Recorrente por Empresa'}
                  </h3>
                  <p className="text-xs text-slate-500">Defina os criadores e a cota de entregas mensais do projeto</p>
                </div>
              </div>

              <button 
                onClick={() => setIsContractModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveContract} className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Empresa Contratante</label>
                  <select
                    value={contractFormCompanyId}
                    onChange={(e) => setContractFormCompanyId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand-primary text-xs font-bold text-slate-800"
                  >
                    <option value="" disabled>Selecione a empresa...</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Título do Projeto Recorrente</label>
                  <input
                    type="text"
                    required
                    value={contractFormTitle}
                    onChange={(e) => setContractFormTitle(e.target.value)}
                    placeholder="Ex: Embaixadores de Marca - Instagram & TikTok 2026"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand-primary text-xs text-slate-800 font-medium"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Objetivo do Projeto Recorrente</label>
                <textarea
                  value={contractFormObjective}
                  onChange={(e) => setContractFormObjective(e.target.value)}
                  placeholder="Ex: Manter presença de marca constante com vídeos de unboxing e uso diário dos produtos..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand-primary text-xs text-slate-800 h-20 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Data Início</label>
                  <input
                    type="date"
                    required
                    value={contractFormStartDate}
                    onChange={(e) => setContractFormStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand-primary text-xs font-bold text-slate-800"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Verba Mensal Global (R$)</label>
                  <input
                    type="number"
                    value={contractFormMonthlyFee}
                    onChange={(e) => setContractFormMonthlyFee(Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand-primary text-xs font-bold text-slate-800"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status do Contrato</label>
                  <select
                    value={contractFormStatus}
                    onChange={(e) => setContractFormStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand-primary text-xs font-bold text-slate-800"
                  >
                    <option value="active">Ativo</option>
                    <option value="paused">Pausado</option>
                    <option value="finished">Finalizado</option>
                  </select>
                </div>
              </div>

              {/* Financial Balance in Modal when editing */}
              {editingContract && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-slate-500 text-[11px]">
                    <span>Verba Mensal do Projeto:</span>
                    <span className="font-bold text-slate-800">{formatCurrency(contractFormMonthlyFee || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500 text-[11px]">
                    <span>Custo Total com Criadores ({contractFormCreators.length}):</span>
                    <span className="font-bold text-slate-700">
                      {formatCurrency(contractFormCreators.reduce((sum, c) => sum + Number(c.monthlyCache || c.monthlyFee || 0), 0))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 text-[11px]">
                    <span className="font-bold text-slate-700">Saldo Restante:</span>
                    <span className={cn(
                      "font-black",
                      (Number(contractFormMonthlyFee || 0) - contractFormCreators.reduce((sum, c) => sum + Number(c.monthlyCache || c.monthlyFee || 0), 0)) >= 0 
                        ? "text-emerald-600" 
                        : "text-rose-600"
                    )}>
                      {formatCurrency(
                        Number(contractFormMonthlyFee || 0) - contractFormCreators.reduce((sum, c) => sum + Number(c.monthlyCache || c.monthlyFee || 0), 0)
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* Creators Config Section: Decoupled for creation */}
              {!editingContract ? (
                <div className="pt-4 border-t border-slate-100 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/60 text-xs">
                  <div className="flex items-start gap-2.5">
                    <div className="p-2 bg-brand-primary text-white rounded-xl shrink-0">
                      <Users size={16} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-xs">Alocação de Criadores em Etapa Separada</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Crie o projeto com as configurações e verba global acima. Assim que criado, você poderá adicionar os criadores com início/fim de contrato, cachês individuais e cotas de entregáveis na página do projeto.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="pt-4 border-t border-slate-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">Criadores Alocados ({contractFormCreators.length})</label>
                    <Link
                      to={`/recurring/${editingContract.id}`}
                      className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-1"
                    >
                      <ExternalLink size={12} /> Gerenciar na Página do Projeto
                    </Link>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center gap-3 shrink-0 bg-white">
                {editingContract && (
                  <button
                    type="button"
                    onClick={() => handleDeleteContract(editingContract.id, editingContract.title)}
                    className="py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs transition-colors cursor-pointer border border-rose-200 flex items-center gap-1.5"
                    title="Excluir este contrato"
                  >
                    <Trash2 size={14} /> Excluir
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsContractModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-brand-primary text-white font-bold text-xs hover:bg-indigo-600 shadow-md shadow-indigo-100 transition-colors cursor-pointer"
                >
                  {editingContract ? 'Salvar Alterações' : 'Criar Contrato Recorrente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADICIONAR / EDITAR ITEM DE CONTEÚDO */}
      {isContentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl my-auto max-h-[90vh] flex flex-col overflow-hidden relative z-10">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingContentItem ? 'Editar Item de Conteúdo' : 'Novo Conteúdo Recorrente'}
                </h3>
                <p className="text-xs text-slate-500">Agende e descreva a publicação do criador</p>
              </div>

              <button 
                onClick={() => setIsContentModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveContentItem} className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Projeto / Contrato Recorrente</label>
                <select
                  name="recurringContractId"
                  defaultValue={editingContentItem?.recurringContractId || prefilledContractId}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand-primary text-xs font-bold text-slate-800"
                >
                  <option value="" disabled>Selecione o projeto...</option>
                  {contracts.map(c => (
                    <option key={c.id} value={c.id}>{c.companyName} — {c.title}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Criador Responsável</label>
                  <select
                    name="creatorId"
                    defaultValue={editingContentItem?.creatorId || prefilledCreatorId}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand-primary text-xs font-bold text-slate-800"
                  >
                    <option value="" disabled>Selecione o criador...</option>
                    {creators.map(cr => (
                      <option key={cr.id} value={cr.id}>{cr.artisticName || cr.fullName}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Previsão de Postagem</label>
                  <input
                    type="date"
                    name="plannedDate"
                    defaultValue={editingContentItem?.plannedDate || prefilledPlannedDate || ''}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand-primary text-xs font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Formato do Conteúdo</label>
                  <select
                    name="contentType"
                    defaultValue={editingContentItem?.contentType || 'reel'}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand-primary text-xs font-bold text-slate-800"
                  >
                    <option value="reel">Reel / Instagram</option>
                    <option value="story">Sequência de Stories</option>
                    <option value="post">Feed Post / Carrossel</option>
                    <option value="tiktok">TikTok Video</option>
                    <option value="youtube">YouTube Short / Vídeo</option>
                    <option value="live">Live / Transmissão Ao Vivo</option>
                    <option value="pinterest">Pinterest Pin / Pasta</option>
                    <option value="blog">Artigo de Blog / Review</option>
                    <option value="podcast">Podcast / Áudio</option>
                    <option value="unboxing">Unboxing / Recebidos</option>
                    <option value="ugc">Vídeo UGC (Anúncios)</option>
                    <option value="event">Evento / Presença VIP</option>
                    <option value="other">Outro Formato</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</label>
                  <select
                    name="status"
                    defaultValue={editingContentItem?.status || 'planned'}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand-primary text-xs font-bold text-slate-800"
                  >
                    <option value="planned">Planejado</option>
                    <option value="in_production">Em Produção</option>
                    <option value="review">Em Revisão</option>
                    <option value="approved">Aprovado</option>
                    <option value="published">Publicado</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Título / Tema do Conteúdo</label>
                <input
                  type="text"
                  name="title"
                  required
                  defaultValue={editingContentItem?.title || ''}
                  placeholder="Ex: Vídeo 1 - Rotina de cuidados diários com produto X"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand-primary text-xs text-slate-800 font-medium"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Descrição / Roteiro do Conteúdo</label>
                <textarea
                  name="description"
                  defaultValue={editingContentItem?.description || ''}
                  placeholder="Detalhes sobre a estrutura do vídeo, cenários, ganchos e chamadas..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 outline-none focus:border-brand-primary text-xs text-slate-800 h-20 resize-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Briefing Completo / Regras do Projeto</label>
                <textarea
                  name="briefing"
                  defaultValue={editingContentItem?.briefing || editingContentItem?.briefingNote || ''}
                  placeholder="Instruções gerais da marca, tom de voz, o que pode e não pode ser dito..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 outline-none focus:border-brand-primary text-xs text-slate-800 h-20 resize-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Roteiro / Falas Sugeridas</label>
                <textarea
                  name="script"
                  defaultValue={editingContentItem?.script || ''}
                  placeholder="Roteiro detalhado, falas sugeridas e ganchos de abertura..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 outline-none focus:border-brand-primary text-xs text-slate-800 h-20 resize-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Referências & Links de Inspiração</label>
                <input
                  type="text"
                  name="references"
                  defaultValue={editingContentItem?.references || ''}
                  placeholder="Links de referências do TikTok/Instagram/Pinterest..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand-primary text-xs text-slate-800"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Legenda / Copy Recomendada</label>
                <textarea
                  name="caption"
                  defaultValue={editingContentItem?.caption || ''}
                  placeholder="Texto sugerido para a legenda da publicação..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 outline-none focus:border-brand-primary text-xs text-slate-800 h-16 resize-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Link Publicado (Se Concluído)</label>
                <input
                  type="url"
                  name="publishedUrl"
                  defaultValue={editingContentItem?.publishedUrl || ''}
                  placeholder="https://instagram.com/p/..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-brand-primary text-xs text-slate-800"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center gap-3 shrink-0 bg-white">
                {editingContentItem && (
                  <button
                    type="button"
                    onClick={() => handleDeleteContentItem(editingContentItem.id, editingContentItem.title)}
                    className="py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs transition-colors cursor-pointer border border-rose-200 flex items-center gap-1.5"
                    title="Excluir esta entrega"
                  >
                    <Trash2 size={14} /> Excluir
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsContentModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-brand-primary text-white font-bold text-xs hover:bg-indigo-600 shadow-md shadow-indigo-100 transition-colors cursor-pointer"
                >
                  Salvar no Planejamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contract Details Modal */}
      <RecurringContractDetailsModal
        contract={selectedContractForDetails}
        isOpen={!!selectedContractForDetails}
        onClose={() => setSelectedContractForDetails(null)}
        companies={companies}
        creators={creators}
        planningItems={contentItems}
        onOpenSubmitModal={(item) => setViewingDetailItem(item)}
        userRole={userRole}
      />

      {/* Reusable Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteModalConfig.isOpen}
        onClose={() => setDeleteModalConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmDelete}
        title={deleteModalConfig.type === 'contract' ? 'Excluir Trabalho Recorrente' : 'Excluir Entrega do Cronograma'}
        description={
          deleteModalConfig.type === 'contract'
            ? `Tem certeza que deseja apagar o contrato de trabalho recorrente "${deleteModalConfig.title}"? Esta ação removerá o contrato e todas as suas pautas e entregas vinculadas.`
            : `Deseja realmente apagar o item "${deleteModalConfig.title}" do planejamento?`
        }
        confirmText="Sim, Excluir Definitivamente"
        isDeleting={deleteModalConfig.isDeleting}
      />

      {/* Database Reset Modal for Recurring Contracts */}
      <DatabaseResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        initialScope="recurring"
      />
    </div>
  );
}
