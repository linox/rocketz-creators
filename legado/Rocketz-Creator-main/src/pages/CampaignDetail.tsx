import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Megaphone, 
  Calendar, 
  Users, 
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
  PieChart, 
  Lock, 
  Handshake, 
  Gift, 
  PenSquare, 
  ThumbsUp, 
  Copy, 
  Image as ImageIcon,
  MessageCircle,
  Filter,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';
import { SubmissionMediaPreview } from '../components/SubmissionMediaPreview';
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
  getDocs,
  getDoc
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { createNotification } from '../lib/notifications';
import { onAuthStateChanged } from 'firebase/auth';
import { cn, formatNumber, formatDeliverablesSummary } from '../lib/utils';
import { usePrivacy } from '../context/PrivacyContext';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { CampaignImageUpload } from '../components/CampaignImageUpload';
import { UserAvatar } from '../components/UserAvatar';
import { 
  Campaign, 
  Company, 
  CampaignCreator, 
  Creator, 
  CampaignStatus, 
  DeliveryStatus 
} from '../types';
import { motion, AnimatePresence } from 'motion/react';

const statusMap: Record<CampaignStatus, { label: string; bg: string; text: string; border: string }> = {
  briefing: { label: 'Briefing', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  selection: { label: 'Seleção de Casting', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  approval: { label: 'Aprovação', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  production: { label: 'Em Produção', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  published: { label: 'Publicado', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  finished: { label: 'Finalizado', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
};

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { formatCurrency } = usePrivacy();

  // Campaign & Company State
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allCreators, setAllCreators] = useState<Creator[]>([]);
  const [campaignCreators, setCampaignCreators] = useState<(CampaignCreator & { isSubcollection?: boolean; sourceCol?: string })[]>([]);
  const [legacyApplications, setLegacyApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab & View state
  const activeTabParam = searchParams.get('tab') || 'entregas';
  const [activeTab, setActiveTab] = useState<'entregas' | 'candidaturas' | 'briefing' | 'financeiro'>(
    activeTabParam === 'candidaturas' ? 'candidaturas' :
    activeTabParam === 'briefing' ? 'briefing' : 
    activeTabParam === 'financeiro' ? 'financeiro' : 'entregas'
  );

  // Candidates Tab Filters & Quick-Edit state
  const [candidateFilter, setCandidateFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [candidateSearch, setCandidateSearch] = useState('');
  const [customApprovedAmounts, setCustomApprovedAmounts] = useState<Record<string, number>>({});
  const [rejectModal, setRejectModal] = useState<{ isOpen: boolean; app: any | null; reason: string }>({
    isOpen: false,
    app: null,
    reason: ''
  });

  // Selection & Filters for Allocated Creators
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  const [expandedCreatorIds, setExpandedCreatorIds] = useState<string[]>([]);
  const [creatorSearchTerm, setCreatorSearchTerm] = useState('');

  // Feedback and updating states
  const [feedbackTexts, setFeedbackTexts] = useState<Record<string, string>>({});
  const [scriptFeedbackTexts, setScriptFeedbackTexts] = useState<Record<string, string>>({});
  const [videoFeedbackTexts, setVideoFeedbackTexts] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [activeVideoCreatorName, setActiveVideoCreatorName] = useState<string>('');

  // Modals
  const [isAddCreatorModalOpen, setIsAddCreatorModalOpen] = useState(false);
  const [isEditCampaignModalOpen, setIsEditCampaignModalOpen] = useState(false);
  const [isCandidatesModalOpen, setIsCandidatesModalOpen] = useState(false);
  const [isChangeImageModalOpen, setIsChangeImageModalOpen] = useState(false);
  const [editImageUrl, setEditImageUrl] = useState<string>('');
  const [editingCC, setEditingCC] = useState<CampaignCreator | null>(null);
  const [modalIsBarter, setModalIsBarter] = useState(false);

  // Delete modal
  const [deleteModalConfig, setDeleteModalConfig] = useState<{
    isOpen: boolean;
    type: 'campaign' | 'creator';
    id: string;
    title: string;
    isDeleting?: boolean;
  }>({
    isOpen: false,
    type: 'campaign',
    id: '',
    title: '',
    isDeleting: false
  });

  // 1. Sync active tab with searchParams
  const handleTabChange = (tab: 'entregas' | 'candidaturas' | 'briefing' | 'financeiro') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // 2. Load Campaign, Company, and Creators
  useEffect(() => {
    if (!id) return;

    const unsubCampaign = onSnapshot(doc(db, 'campaigns', id), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as Campaign;
        setCampaign(data);
        setModalIsBarter(!!data.isBarter);
        setEditImageUrl(data.imageUrl || '');

        // Fetch company
        if (data.companyId) {
          getDoc(doc(db, 'companies', data.companyId)).then(cSnap => {
            if (cSnap.exists()) {
              setCompany({ id: cSnap.id, ...cSnap.data() } as Company);
            }
          });
        }
      } else {
        setCampaign(null);
      }
      setLoading(false);
    }, (err) => {
      console.warn("Error loading campaign:", err.message);
      setLoading(false);
    });

    const unsubCompanies = onSnapshot(collection(db, 'companies'), (snap) => {
      setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() } as Company)));
    });

    const unsubAllCreators = onSnapshot(collection(db, 'creators'), (snap) => {
      setAllCreators(snap.docs.map(d => ({ id: d.id, ...d.data() } as Creator)));
    });

    const unsubCC = onSnapshot(collection(db, `campaigns/${id}/creators`), (snap) => {
      const list = snap.docs.map(d => ({
        id: d.id,
        isSubcollection: true,
        sourceCol: `campaigns/${id}/creators`,
        ...d.data()
      } as CampaignCreator & { isSubcollection: boolean; sourceCol: string }));
      setCampaignCreators(list);

      // Init feedback texts
      const fMap: Record<string, string> = {};
      const sMap: Record<string, string> = {};
      const vMap: Record<string, string> = {};
      list.forEach(cc => {
        fMap[cc.id] = cc.revisionDetails || '';
        sMap[cc.id] = cc.scriptFeedback || '';
        vMap[cc.id] = cc.videoFeedback || '';
      });
      setFeedbackTexts(prev => ({ ...fMap, ...prev }));
      setScriptFeedbackTexts(prev => ({ ...sMap, ...prev }));
      setVideoFeedbackTexts(prev => ({ ...vMap, ...prev }));
    });

    // Root collection query for legacy/root applications
    const qApps = query(
      collection(db, 'campaignCreators'),
      where('campaignId', '==', id)
    );
    const unsubApps = onSnapshot(qApps, (snap) => {
      setLegacyApplications(snap.docs.map(d => ({
        id: d.id,
        isSubcollection: false,
        sourceCol: 'campaignCreators',
        ...d.data()
      })));
    }, (err) => {
      console.warn("Error loading root applications:", err.message);
    });

    return () => {
      unsubCampaign();
      unsubCompanies();
      unsubAllCreators();
      unsubCC();
      unsubApps();
    };
  }, [id]);

  // 3. Combined all applications (both subcollection and root collection)
  const allApplications = useMemo(() => {
    // 1. Subcollection creators/applications
    const subList = campaignCreators.map(cc => ({
      ...cc,
      isSubcollection: true,
      sourceCol: `campaigns/${id}/creators`,
      applicationStatus: cc.applicationStatus || 'approved'
    }));

    // 2. Root collection items that are not duplicated by creatorId
    const rootList = legacyApplications.filter(la => 
      !subList.some(sa => sa.creatorId === la.creatorId)
    ).map(la => ({
      ...la,
      isSubcollection: false,
      sourceCol: 'campaignCreators',
      applicationStatus: la.applicationStatus || 'pending'
    }));

    return [...subList, ...rootList];
  }, [campaignCreators, legacyApplications, id]);

  const pendingApplications = useMemo(() => {
    return allApplications.filter(app => app.applicationStatus === 'pending');
  }, [allApplications]);

  const approvedApplications = useMemo(() => {
    return allApplications.filter(app => app.applicationStatus === 'approved');
  }, [allApplications]);

  const rejectedApplications = useMemo(() => {
    return allApplications.filter(app => app.applicationStatus === 'rejected');
  }, [allApplications]);

  // 4. Approved casting creators for Deliverables workspace
  const approvedCreators = useMemo(() => {
    return campaignCreators.filter(cc => !cc.applicationStatus || cc.applicationStatus === 'approved');
  }, [campaignCreators]);

  // Set default selected creator
  useEffect(() => {
    if (approvedCreators.length > 0 && !selectedCreatorId) {
      setSelectedCreatorId(approvedCreators[0].id);
    } else if (approvedCreators.length === 0) {
      setSelectedCreatorId(null);
    }
  }, [approvedCreators, selectedCreatorId]);

  // Selected Campaign Creator Record
  const selectedCC = useMemo(() => {
    return approvedCreators.find(cc => cc.id === selectedCreatorId) || null;
  }, [approvedCreators, selectedCreatorId]);

  // Selected Creator Profile Info
  const selectedCreatorProfile = useMemo(() => {
    if (!selectedCC) return null;
    return allCreators.find(c => c.id === selectedCC.creatorId) || null;
  }, [selectedCC, allCreators]);

  // Filter state for creator allocation: 'all' | 'owing' | 'delivered' | 'no_demand'
  const [creatorStatusFilter, setCreatorStatusFilter] = useState<'all' | 'owing' | 'delivered' | 'no_demand'>('all');

  // Status counts for allocated creators
  const creatorStatusCounts = useMemo(() => {
    let owing = 0;
    let delivered = 0;
    let no_demand = 0;

    approvedCreators.forEach(cc => {
      const hasNoDemand = !cc.deliveryType || cc.deliveryType.trim() === '' || cc.deliveryType.toLowerCase().includes('sem demanda');
      if (hasNoDemand) {
        no_demand++;
      } else if (cc.deliveryStatus === 'approved' || cc.deliveryStatus === 'published') {
        delivered++;
      } else {
        owing++;
      }
    });

    return {
      all: approvedCreators.length,
      owing,
      delivered,
      no_demand
    };
  }, [approvedCreators]);

  // Filtered Creators in the Left Column
  const filteredApprovedCreators = useMemo(() => {
    return approvedCreators.filter(cc => {
      const creator = allCreators.find(c => c.id === cc.creatorId);
      const nameMatch = creator?.artisticName?.toLowerCase().includes(creatorSearchTerm.toLowerCase()) ||
        creator?.fullName?.toLowerCase().includes(creatorSearchTerm.toLowerCase()) ||
        cc.deliveryType?.toLowerCase().includes(creatorSearchTerm.toLowerCase());
      
      if (!nameMatch) return false;

      const hasNoDemand = !cc.deliveryType || cc.deliveryType.trim() === '' || cc.deliveryType.toLowerCase().includes('sem demanda');

      if (creatorStatusFilter === 'no_demand') {
        return hasNoDemand;
      }
      if (creatorStatusFilter === 'delivered') {
        return !hasNoDemand && (cc.deliveryStatus === 'approved' || cc.deliveryStatus === 'published');
      }
      if (creatorStatusFilter === 'owing') {
        return !hasNoDemand && (cc.deliveryStatus !== 'approved' && cc.deliveryStatus !== 'published');
      }
      return true;
    });
  }, [approvedCreators, allCreators, creatorSearchTerm, creatorStatusFilter]);

  // Financial calculations
  const totalBudget = campaign?.totalBudget || 0;
  const castingCost = approvedCreators.reduce((acc, cc) => acc + (Number(cc.amount) || 0), 0);
  const agencyMargin = totalBudget - castingCost;
  const marginPercent = totalBudget > 0 ? Math.round((agencyMargin / totalBudget) * 100) : 0;

  // Cronograma calculations
  const startDateObj = campaign?.startDate ? new Date(campaign.startDate) : null;
  const endDateObj = campaign?.endDate ? new Date(campaign.endDate) : null;
  const now = new Date();
  const daysRemaining = endDateObj ? Math.ceil((endDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;

  // Toggle Creator Accordion in list
  const toggleExpand = (ccId: string) => {
    setExpandedCreatorIds(prev => 
      prev.includes(ccId) ? prev.filter(i => i !== ccId) : [...prev, ccId]
    );
  };

  // Actions on Deliverables
  const handleUpdateDeliveryStatus = async (ccId: string, status: DeliveryStatus) => {
    if (!id) return;
    setUpdatingId(ccId);
    try {
      const currentFeedback = feedbackTexts[ccId] || '';
      const payload: any = {
        deliveryStatus: status
      };

      if (status === 'revision') {
        payload.revisionDetails = currentFeedback;
      } else if (status === 'approved') {
        payload.revisionDetails = '';
      }

      await updateDoc(doc(db, `campaigns/${id}/creators`, ccId), payload);

      const targetCC = approvedCreators.find(item => item.id === ccId);
      if (targetCC && targetCC.creatorId) {
        await createNotification({
          title: status === 'approved' 
            ? 'Material Aprovado! 🎉' 
            : status === 'revision' 
            ? 'Ajustes Solicitados no Conteúdo 📝' 
            : 'Status da Campanha Atualizado 🔄',
          message: status === 'approved'
            ? `Seu conteúdo para a campanha "${campaign?.name || 'Campanha'}" foi aprovado pela agência!`
            : status === 'revision'
            ? `A agência solicitou ajustes no seu conteúdo da campanha "${campaign?.name || 'Campanha'}"${currentFeedback ? `: "${currentFeedback}"` : '.'}`
            : `O status da sua entrega na campanha "${campaign?.name || 'Campanha'}" foi atualizado para ${status}.`,
          type: status === 'approved' ? 'approval' : 'rejection',
          targetRole: 'creator',
          creatorId: targetCC.creatorId,
          campaignId: id,
          link: `/creators/${targetCC.creatorId}?tab=campaigns`
        });
      }
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Houve um erro ao atualizar o status.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Multi-Stage Actions (Script and Video stages independently)
  const handleUpdateStageStatus = async (
    ccId: string, 
    stage: 'script' | 'video', 
    status: 'approved' | 'revision' | 'pending' | 'submitted',
    feedback?: string
  ) => {
    if (!id) return;
    setUpdatingId(ccId);
    try {
      const payload: any = {};
      if (stage === 'script') {
        payload.scriptStatus = status;
        if (feedback !== undefined) {
          payload.scriptFeedback = feedback;
        }
        // If the flow is script_only and script is approved, also approve deliveryStatus
        if (campaign?.approvalFlow === 'script_only' && status === 'approved') {
          payload.deliveryStatus = 'approved';
        } else if (status === 'revision') {
          payload.deliveryStatus = 'revision';
          payload.revisionDetails = feedback || '';
        }
      } else if (stage === 'video') {
        payload.videoStatus = status;
        if (feedback !== undefined) {
          payload.videoFeedback = feedback;
        }
        if (status === 'approved') {
          payload.deliveryStatus = 'approved';
        } else if (status === 'revision') {
          payload.deliveryStatus = 'revision';
          payload.revisionDetails = feedback || '';
        }
      }

      await updateDoc(doc(db, `campaigns/${id}/creators`, ccId), payload);

      const targetCC = approvedCreators.find(item => item.id === ccId);
      if (targetCC && targetCC.creatorId) {
        const stageName = stage === 'script' ? 'Roteiro' : 'Gravação do Vídeo';
        const notifTitle = status === 'approved' 
          ? `${stageName} Aprovado! 🎉` 
          : status === 'revision' 
            ? `Ajustes Solicitados no ${stageName} 📝` 
            : `Status do ${stageName} Atualizado`;
        const notifMessage = status === 'approved'
          ? `Seu ${stageName.toLowerCase()} para a campanha "${campaign?.name || 'Campanha'}" foi aprovado pela agência!`
          : status === 'revision'
            ? `A agência solicitou ajustes no seu ${stageName.toLowerCase()} da campanha "${campaign?.name || 'Campanha'}": "${feedback || ''}".`
            : `O status do seu ${stageName.toLowerCase()} na campanha "${campaign?.name || 'Campanha'}" foi atualizado.`;

        await createNotification({
          title: notifTitle,
          message: notifMessage,
          type: status === 'approved' ? 'approval' : 'rejection',
          targetRole: 'creator',
          creatorId: targetCC.creatorId,
          campaignId: id,
          link: `/creators/${targetCC.creatorId}?tab=campaigns`
        });
      }
      alert(`Etapa de ${stage === 'script' ? 'Roteiro' : 'Vídeo'} atualizada com sucesso!`);
    } catch (err) {
      console.error("Error updating stage status:", err);
      alert("Erro ao atualizar etapa.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveFeedback = async (ccId: string) => {
    if (!id) return;
    setUpdatingId(ccId);
    try {
      const currentFeedback = feedbackTexts[ccId] || '';
      await updateDoc(doc(db, `campaigns/${id}/creators`, ccId), {
        revisionDetails: currentFeedback
      });

      const targetCC = approvedCreators.find(item => item.id === ccId);
      if (targetCC && targetCC.creatorId) {
        await createNotification({
          title: 'Feedback de Melhoria Recebido 💬',
          message: `A agência enviou observações sobre seu material da campanha "${campaign?.name || 'Campanha'}": "${currentFeedback}".`,
          type: 'rejection',
          targetRole: 'creator',
          creatorId: targetCC.creatorId,
          campaignId: id,
          link: `/creators/${targetCC.creatorId}?tab=campaigns`
        });
      }
      alert("Feedback comercial salvo com sucesso!");
    } catch (err) {
      console.error("Error saving feedback:", err);
      alert("Erro ao salvar feedback.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Approve Candidate Application
  const handleApproveApplication = async (app: any, customAmount?: number) => {
    if (!id) return;
    setUpdatingId(app.id);
    try {
      const creatorDoc = allCreators.find(c => c.id === app.creatorId);
      const targetAmount = customAmount !== undefined && customAmount > 0
        ? Number(customAmount)
        : (customApprovedAmounts[app.id] !== undefined ? customApprovedAmounts[app.id] : (Number(app.amount) || creatorDoc?.pricing?.combo || 250));

      const payload = {
        applicationStatus: 'approved',
        amount: targetAmount,
        deliveryStatus: app.deliveryStatus || 'pending',
        deliveryType: app.deliveryType || campaign?.deliverablesPerCreator?.summary || '1 Reel + 3 Stories',
        deliveryDate: app.deliveryDate || campaign?.endDate || '',
        updatedAt: serverTimestamp()
      };

      if (app.isSubcollection || app.sourceCol === `campaigns/${id}/creators`) {
        await updateDoc(doc(db, `campaigns/${id}/creators`, app.id), payload);
      } else {
        // Update root doc
        await updateDoc(doc(db, 'campaignCreators', app.id), { 
          applicationStatus: 'approved',
          amount: targetAmount 
        });

        // Ensure item exists in subcollection
        const existsInSub = campaignCreators.some(cc => cc.creatorId === app.creatorId);
        if (!existsInSub && creatorDoc) {
          await addDoc(collection(db, `campaigns/${id}/creators`), {
            campaignId: id,
            creatorId: app.creatorId,
            deliveryType: app.deliveryType || campaign?.deliverablesPerCreator?.summary || '1 Reel + 3 Stories',
            amount: targetAmount,
            deliveryDate: campaign?.endDate || '',
            postDate: campaign?.endDate || '',
            deliveryStatus: 'pending',
            paymentStatus: 'pending',
            notes: app.notes || '',
            applicationStatus: 'approved',
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
              metrics: { reach: 0, views: 0, likes: 0, comments: 0, clicks: 0 }
            },
            createdAt: serverTimestamp()
          });
        }
      }

      if (app.creatorId) {
        await createNotification({
          title: 'Candidatura Aprovada! 🎉',
          message: `Parabéns! Sua candidatura para a campanha "${campaign?.name || 'Campanha'}" foi aprovada no casting.`,
          type: 'approval',
          targetRole: 'creator',
          creatorId: app.creatorId,
          campaignId: id,
          link: `/creators/${app.creatorId}?tab=campaigns`
        });
      }
    } catch (err) {
      console.error("Error approving application:", err);
      alert("Erro ao aprovar candidatura.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Reject Candidate Application
  const handleRejectApplication = async (app: any, reason?: string) => {
    if (!id) return;
    setUpdatingId(app.id);
    try {
      const payload = {
        applicationStatus: 'rejected',
        rejectionReason: reason || '',
        updatedAt: serverTimestamp()
      };

      if (app.isSubcollection || app.sourceCol === `campaigns/${id}/creators`) {
        await updateDoc(doc(db, `campaigns/${id}/creators`, app.id), payload);
      } else {
        await updateDoc(doc(db, 'campaignCreators', app.id), payload);
      }

      if (app.creatorId) {
        await createNotification({
          title: 'Atualização de Candidatura',
          message: `Sua candidatura para a campanha "${campaign?.name || 'Campanha'}" não foi selecionada nesta etapa.${reason ? ` Motivo: ${reason}` : ''}`,
          type: 'rejection',
          targetRole: 'creator',
          creatorId: app.creatorId,
          campaignId: id,
          link: `/campaigns/available`
        });
      }

      setRejectModal({ isOpen: false, app: null, reason: '' });
    } catch (err) {
      console.error("Error rejecting application:", err);
      alert("Erro ao recusar candidatura.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Revert Application to Pending
  const handleRevertToPending = async (app: any) => {
    if (!id) return;
    setUpdatingId(app.id);
    try {
      const payload = {
        applicationStatus: 'pending',
        rejectionReason: '',
        updatedAt: serverTimestamp()
      };
      if (app.isSubcollection || app.sourceCol === `campaigns/${id}/creators`) {
        await updateDoc(doc(db, `campaigns/${id}/creators`, app.id), payload);
      } else {
        await updateDoc(doc(db, 'campaignCreators', app.id), payload);
      }
    } catch (err) {
      console.error("Error reverting application:", err);
      alert("Erro ao reverter status da candidatura.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Add Creator to Casting
  const handleAddCreator = async (creator: Creator) => {
    if (!id) return;
    try {
      const defaultAmount = creator.pricing?.combo || creator.pricing?.reel || 0;
      await addDoc(collection(db, `campaigns/${id}/creators`), {
        campaignId: id,
        creatorId: creator.id,
        deliveryType: '1 Reel + 3 Stories',
        amount: defaultAmount,
        deliveryDate: campaign?.endDate || '',
        postDate: campaign?.endDate || '',
        deliveryStatus: 'pending',
        paymentStatus: 'pending',
        notes: '',
        applicationStatus: 'approved',
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
          metrics: {
            reach: 0,
            views: 0,
            likes: 0,
            comments: 0,
            clicks: 0
          }
        },
        createdAt: serverTimestamp()
      });

      setIsAddCreatorModalOpen(false);
    } catch (err) {
      console.error("Error adding creator to campaign:", err);
      alert("Erro ao adicionar criador ao casting.");
    }
  };

  // Remove Creator from Campaign
  const handleDeleteCreator = async (ccId: string) => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, `campaigns/${id}/creators`, ccId));
      if (selectedCreatorId === ccId) {
        setSelectedCreatorId(null);
      }
    } catch (err) {
      console.error("Error deleting creator:", err);
      alert("Erro ao remover criador.");
    }
  };

  // Delete Entire Campaign
  const handleDeleteCampaign = async () => {
    if (!id) return;
    setDeleteModalConfig(prev => ({ ...prev, isDeleting: true }));
    try {
      await deleteDoc(doc(db, 'campaigns', id));
      navigate('/campaign-deliveries');
    } catch (err) {
      console.error("Error deleting campaign:", err);
      alert("Erro ao excluir campanha.");
      setDeleteModalConfig(prev => ({ ...prev, isDeleting: false, isOpen: false }));
    }
  };

  // Update Campaign Status
  const handleUpdateCampaignStatus = async (newStatus: CampaignStatus) => {
    if (!id) return;
    try {
      await updateDoc(doc(db, 'campaigns', id), { status: newStatus });
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto my-12 shadow-sm">
        <Megaphone size={40} className="text-slate-300 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-800">Campanha Não Encontrada</h2>
        <p className="text-xs text-slate-500 mt-1 mb-6">A campanha selecionada pode ter sido removida ou o link é inválido.</p>
        <Link to="/campaign-deliveries" className="px-5 py-2.5 bg-brand-primary text-white text-xs font-bold rounded-xl shadow-md">
          Voltar para Projetos
        </Link>
      </div>
    );
  }

  const currentStatusCfg = statusMap[campaign.status] || statusMap.briefing;

  return (
    <div className="flex flex-col gap-6 animate-fadeIn pb-24">
      {/* 1. TOP HEADER & BREADCRUMB */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4">
        {/* Navigation & Company Info */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <Link
              to="/campaign-deliveries"
              className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-all shadow-xs shrink-0 mt-0.5"
              title="Voltar para Central de Projetos"
            >
              <ArrowLeft size={18} />
            </Link>

            <div className="flex items-center gap-3">
              <UserAvatar
                src={company?.logo || company?.logoUrl}
                name={company?.name || 'Cliente'}
                size="custom"
                shape="rounded-2xl"
                className="w-12 h-12 border border-indigo-100 shadow-xs"
                textClassName="text-sm font-black"
              />

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-extrabold text-brand-primary uppercase tracking-wider">
                    {company?.name || 'Cliente'}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                    <Calendar size={12} />
                    {startDateObj?.toLocaleDateString()} a {endDateObj?.toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap mt-0.5">
                  <h1 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
                    {campaign.name}
                  </h1>

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
                </div>
              </div>
            </div>
          </div>

          {/* Top Actions: Status Selector & Edit Modals */}
          <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
            {/* Status Select */}
            <div className="relative">
              <select
                value={campaign.status}
                onChange={(e) => handleUpdateCampaignStatus(e.target.value as CampaignStatus)}
                className={cn(
                  "pl-3 pr-8 py-2 rounded-xl text-xs font-extrabold border outline-none appearance-none cursor-pointer transition-all shadow-xs",
                  currentStatusCfg.bg, currentStatusCfg.text, currentStatusCfg.border
                )}
              >
                {Object.entries(statusMap).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-current opacity-70" />
            </div>

            {/* Candidates Application Badge button */}
            {pendingApplications.length > 0 && (
              <button
                onClick={() => handleTabChange('candidaturas')}
                className="px-3.5 py-2 bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 animate-pulse cursor-pointer"
                title="Visualizar e aprovar candidaturas de criadores"
              >
                <Users size={14} />
                <span>{pendingApplications.length} Candidatura{pendingApplications.length > 1 ? 's' : ''} Pendente{pendingApplications.length > 1 ? 's' : ''}</span>
              </button>
            )}

            {/* Edit Campaign button */}
            <button
              onClick={() => setIsEditCampaignModalOpen(true)}
              className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-extrabold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 size={14} /> Editar Campanha
            </button>

            {/* Delete Campaign button */}
            <button
              onClick={() => setDeleteModalConfig({
                isOpen: true,
                type: 'campaign',
                id: campaign.id,
                title: campaign.name,
                isDeleting: false
              })}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-xl transition-all cursor-pointer"
              title="Excluir Campanha"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Campaign Objective banner if present */}
        {campaign.objective && (
          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 text-xs text-slate-600 leading-relaxed font-medium">
            <strong className="text-slate-800 font-bold mr-1.5">Objetivo Estratégico:</strong>
            {campaign.objective}
          </div>
        )}

        {/* 16:9 Standard Format Campaign Cover Banner Showcase */}
        <div className="relative w-full aspect-[21/9] sm:aspect-[24/9] md:aspect-[3/1] max-h-56 bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 shadow-sm group">
          {campaign.imageUrl ? (
            <img
              src={campaign.imageUrl}
              alt={campaign.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 flex items-center justify-between p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/80 shrink-0">
                  <ImageIcon size={24} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Nenhuma imagem de capa cadastrada</h3>
                  <p className="text-xs text-slate-400">Adicione uma imagem no formato padrão 16:9 (1200×675 px) para dar identidade visual à campanha.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditImageUrl(campaign.imageUrl || '');
                  setIsChangeImageModalOpen(true);
                }}
                className="px-4 py-2 bg-white text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-black shadow-lg transition-all active:scale-95 flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <ImageIcon size={14} className="text-brand-primary" /> Adicionar Imagem 16:9
              </button>
            </div>
          )}

          {/* Banner Overlays & Quick Change Button */}
          {campaign.imageUrl && (
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end justify-between p-4">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-slate-900/80 backdrop-blur-md border border-white/15 rounded-lg text-[10px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                  <ImageIcon size={11} className="text-brand-primary" /> Formato Padrão: 16:9
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditImageUrl(campaign.imageUrl || '');
                  setIsChangeImageModalOpen(true);
                }}
                className="px-3.5 py-1.5 bg-white/90 hover:bg-white text-slate-900 rounded-xl text-xs font-black backdrop-blur-md shadow-lg transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 size={13} className="text-brand-primary" /> Alterar Imagem da Campanha
              </button>
            </div>
          )}
        </div>

        {/* 2. TOP 2-LINE KEY METRICS STRIP (4 Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Card 1: Investimento Total */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <DollarSign size={15} />
                </div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Investimento Total</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                Verba
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 pt-3">
              <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {campaign.isBarter ? 'Permuta' : campaign.isDirectContract ? 'Contrato Direto' : formatCurrency(totalBudget)}
              </span>
            </div>
          </div>

          {/* Card 2: Custo Casting */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-brand-primary">
                  <Users size={15} />
                </div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Custo Casting</span>
              </div>
              <span className="text-[10px] font-bold text-brand-primary bg-indigo-50 px-2 py-0.5 rounded-full">
                {approvedCreators.length} Criador{approvedCreators.length !== 1 ? 'es' : ''}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 pt-3">
              <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {campaign.isBarter ? 'Permuta' : campaign.isDirectContract ? 'Direto' : formatCurrency(castingCost)}
              </span>
            </div>
          </div>

          {/* Card 3: Saldo / Margem Agência */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                  <TrendingUp size={15} />
                </div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Margem Agência</span>
              </div>
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full",
                agencyMargin >= 0 ? "text-purple-700 bg-purple-50" : "text-rose-700 bg-rose-50"
              )}>
                {campaign.isBarter || campaign.isDirectContract ? 'Parceria' : `${marginPercent}% Fee`}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 pt-3">
              <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {campaign.isBarter ? 'Permuta' : campaign.isDirectContract ? 'Direto' : formatCurrency(agencyMargin)}
              </span>
            </div>
          </div>

          {/* Card 4: Cronograma & Prazos */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                  <CalendarCheck size={15} />
                </div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Cronograma</span>
              </div>
              <span className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded-full",
                daysRemaining > 5 ? "text-emerald-700 bg-emerald-50" :
                daysRemaining >= 0 ? "text-amber-700 bg-amber-50" : "text-rose-700 bg-rose-50"
              )}>
                {daysRemaining >= 0 ? `${daysRemaining} dias restantes` : 'Encerrada'}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 pt-3">
              <span className="text-xs sm:text-sm font-black text-slate-800">
                Fim em {endDateObj?.toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* PENDING CANDIDACIES ALERT BANNER */}
        {pendingApplications.length > 0 && activeTab !== 'candidaturas' && (
          <div className="bg-gradient-to-r from-amber-50 via-rose-50 to-amber-50 border border-amber-200/90 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0 animate-bounce">
                <Users size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900">
                    {pendingApplications.length} {pendingApplications.length === 1 ? 'Candidatura Pendente de Aprovação' : 'Candidaturas Pendentes de Aprovação'}
                  </h4>
                  <span className="px-2 py-0.5 bg-rose-500 text-white rounded-full text-[10px] font-black uppercase">
                    Ação Necessária
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Criadores se candidataram para esta campanha. Avalie os perfis, cachês solicitados e aprove ou recuse para definir o casting.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                type="button"
                onClick={() => handleTabChange('candidaturas')}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <UserCheck size={14} className="text-amber-400" />
                Avaliar Candidaturas
              </button>
            </div>
          </div>
        )}

        {/* Sub-Tab Navigation Bar */}
        <div className="flex items-center gap-2 border-b border-slate-200 pt-3 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => handleTabChange('entregas')}
            className={cn(
              "pb-3 px-5 text-xs font-extrabold transition-all relative flex items-center gap-2 border-b-2 -mb-[2px] cursor-pointer whitespace-nowrap",
              activeTab === 'entregas'
                ? "text-brand-primary border-brand-primary bg-indigo-50/70 rounded-t-xl"
                : "text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-50 rounded-t-xl"
            )}
          >
            <Video size={16} />
            Criadores & Entregas
            <span className="bg-indigo-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
              {approvedCreators.length}
            </span>
          </button>

          <button
            onClick={() => handleTabChange('candidaturas')}
            className={cn(
              "pb-3 px-5 text-xs font-extrabold transition-all relative flex items-center gap-2 border-b-2 -mb-[2px] cursor-pointer whitespace-nowrap",
              activeTab === 'candidaturas'
                ? "text-brand-primary border-brand-primary bg-indigo-50/70 rounded-t-xl"
                : "text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-50 rounded-t-xl"
            )}
          >
            <Users size={16} />
            Candidaturas & Casting
            {pendingApplications.length > 0 ? (
              <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse shadow-xs">
                {pendingApplications.length} pendente{pendingApplications.length > 1 ? 's' : ''}
              </span>
            ) : (
              <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                {allApplications.length}
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabChange('briefing')}
            className={cn(
              "pb-3 px-5 text-xs font-extrabold transition-all relative flex items-center gap-2 border-b-2 -mb-[2px] cursor-pointer whitespace-nowrap",
              activeTab === 'briefing'
                ? "text-brand-primary border-brand-primary bg-indigo-50/70 rounded-t-xl"
                : "text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-50 rounded-t-xl"
            )}
          >
            <FileText size={16} />
            Briefing Criativo & Regras
          </button>

          <button
            onClick={() => handleTabChange('financeiro')}
            className={cn(
              "pb-3 px-5 text-xs font-extrabold transition-all relative flex items-center gap-2 border-b-2 -mb-[2px] cursor-pointer whitespace-nowrap",
              activeTab === 'financeiro'
                ? "text-brand-primary border-brand-primary bg-indigo-50/70 rounded-t-xl"
                : "text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-50 rounded-t-xl"
            )}
          >
            <DollarSign size={16} />
            Financeiro & Contratos
          </button>
        </div>
      </div>

      {/* 3. MAIN WORKSPACE */}
      {activeTab === 'entregas' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: CRIADORES ALOCADOS (lg:col-span-4) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-3.5">
              {/* Header & Add button */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Users size={14} className="text-brand-primary" /> Criadores Alocados
                  </h3>
                  <span className="text-[10px] text-slate-400 font-semibold">{approvedCreators.length} no casting</span>
                </div>

                <button
                  onClick={() => setIsAddCreatorModalOpen(true)}
                  className="px-3 py-1.5 bg-brand-primary hover:bg-indigo-600 text-white font-extrabold text-[11px] rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={13} /> Adicionar Criador
                </button>
              </div>

              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Buscar criador ou formato..."
                  value={creatorSearchTerm}
                  onChange={(e) => setCreatorSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-brand-primary focus:bg-white transition-all font-medium"
                />
              </div>

              {/* Status Filter Chips: Todos, Deve Entregas, Entregou Tudo, Sem Demanda */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide text-xs">
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
                    creatorStatusFilter === 'owing' ? "bg-white/20 text-white" : "bg-rose-50 text-rose-700"
                  )}>
                    {creatorStatusCounts.owing}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCreatorStatusFilter('delivered')}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl font-bold text-[11px] whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border",
                    creatorStatusFilter === 'delivered'
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                      : "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  <span>Entregou Tudo</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-md text-[10px] font-black",
                    creatorStatusFilter === 'delivered' ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-700"
                  )}>
                    {creatorStatusCounts.delivered}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setCreatorStatusFilter('no_demand')}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl font-bold text-[11px] whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border",
                    creatorStatusFilter === 'no_demand'
                      ? "bg-slate-700 text-white border-slate-700 shadow-2xs"
                      : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700"
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

              {/* Creators list */}
              <div className="flex flex-col gap-2.5 max-h-[580px] overflow-y-auto custom-scrollbar pt-1">
                {filteredApprovedCreators.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <Users size={24} className="text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-600">Nenhum criador encontrado</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Adicione criadores ao casting usando o botão acima.</p>
                  </div>
                ) : (
                  filteredApprovedCreators.map(cc => {
                    const creator = allCreators.find(c => c.id === cc.creatorId);
                    const isSelected = cc.id === selectedCreatorId;
                    const isExpanded = expandedCreatorIds.includes(cc.id);

                    return (
                      <div
                        key={cc.id}
                        onClick={() => setSelectedCreatorId(cc.id)}
                        className={cn(
                          "p-3 rounded-xl border transition-all flex flex-col gap-2.5 cursor-pointer",
                          isSelected
                            ? "bg-indigo-50/50 border-brand-primary/60 ring-1 ring-brand-primary/20 shadow-xs"
                            : "bg-white border-slate-200 hover:bg-slate-50"
                        )}
                      >
                        {/* Top row: Avatar & Handle */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <UserAvatar
                              src={creator?.photoUrl}
                              name={creator?.artisticName || creator?.fullName || 'Criador'}
                              size="custom"
                              shape="rounded-xl"
                              className="w-9 h-9 border border-slate-200"
                              textClassName="text-xs"
                            />
                            <div className="min-w-0">
                              <span className="text-xs font-black text-slate-800 truncate block">
                                @{creator?.artisticName || 'criador'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold truncate block">
                                {creator?.fullName || 'Nome'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-indigo-50 text-brand-primary border border-indigo-100">
                              {cc.deliveryType || 'Entrega'}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(cc.id);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded-md transition-colors"
                              title="Ver detalhes de contrato"
                            >
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </div>
                        </div>

                        {/* 2-Line strip: Cachê & Status da Entrega */}
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[10px]">
                          <div className="bg-white/80 p-1.5 rounded-lg border border-slate-200/60 flex flex-col justify-between">
                            <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Cachê Acordado</span>
                            <span className="font-black text-slate-800 truncate mt-0.5">
                              {campaign.isBarter ? 'Permuta' : campaign.isDirectContract ? 'Direto' : formatCurrency(cc.amount || 0)}
                            </span>
                          </div>

                          <div className="bg-white/80 p-1.5 rounded-lg border border-slate-200/60 flex flex-col justify-between">
                            <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Status Entrega</span>
                            <span className={cn(
                              "font-black truncate mt-0.5",
                              cc.deliveryStatus === 'published' ? "text-emerald-700" :
                              cc.deliveryStatus === 'approved' ? "text-indigo-700" :
                              cc.deliveryStatus === 'revision' ? "text-rose-700" :
                              cc.deliveryStatus === 'sent' ? "text-amber-700" : "text-slate-500"
                            )}>
                              {cc.deliveryStatus === 'pending' || !cc.deliveryStatus ? 'Aguardando' :
                               cc.deliveryStatus === 'sent' ? 'Em Revisão' :
                               cc.deliveryStatus === 'revision' ? 'Ajustes' :
                               cc.deliveryStatus === 'approved' ? 'Aprovado' : 'Publicado'}
                            </span>
                          </div>
                        </div>

                        {/* Accordion Expanded Details */}
                        {isExpanded && (
                          <div className="pt-2 border-t border-slate-100 space-y-2 text-[10px]">
                            <div className="flex items-center justify-between text-slate-500">
                              <span>Contrato D4Sign:</span>
                              <span className={cn(
                                "font-bold uppercase",
                                cc.signature?.status === 'signed' ? "text-emerald-600" : "text-amber-600"
                              )}>
                                {cc.signature?.status === 'signed' ? 'Assinado' : 'Pendente'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-slate-500">
                              <span>Pagamento:</span>
                              <span className={cn(
                                "font-bold uppercase",
                                cc.paymentStatus === 'paid' ? "text-emerald-600" : "text-rose-600"
                              )}>
                                {cc.paymentStatus === 'paid' ? 'Pago' : 'Pendente'}
                              </span>
                            </div>

                            <div className="pt-1.5 flex items-center justify-between gap-2 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingCC(cc);
                                }}
                                className="text-brand-primary hover:underline font-extrabold text-[10px]"
                              >
                                Editar Entrega
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteCreator(cc.id);
                                }}
                                className="text-rose-600 hover:underline font-bold text-[10px]"
                              >
                                Remover
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: ENTREGAS & MATERIAIS DO CRIADOR SELECIONADO (lg:col-span-8) */}
          <div className="lg:col-span-8 flex flex-col gap-5">
            {selectedCC && selectedCreatorProfile ? (
              <div className="flex flex-col gap-5">
                {/* Selected Creator Header Banner */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <UserAvatar
                      src={selectedCreatorProfile.photoUrl}
                      name={selectedCreatorProfile.artisticName || selectedCreatorProfile.fullName}
                      size="custom"
                      shape="rounded-2xl"
                      className="w-12 h-12 border border-indigo-100 shadow-xs"
                      textClassName="text-base"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-black text-slate-900">
                          @{selectedCreatorProfile.artisticName}
                        </h2>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-brand-primary border border-indigo-100">
                          {selectedCC.deliveryType}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-semibold">
                        {selectedCreatorProfile.fullName} • {selectedCreatorProfile.city || 'Brasil'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/creators/${selectedCreatorProfile.id}`}
                      target="_blank"
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1"
                    >
                      Portfólio <ExternalLink size={12} />
                    </Link>
                    <button
                      onClick={() => setEditingCC(selectedCC)}
                      className="px-3 py-1.5 bg-brand-primary hover:bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 size={12} /> Editar Detalhes
                    </button>
                  </div>
                </div>

                {/* 4-Card 2-Line Metric Strip for the Selected Creator */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Cachê Acordado</span>
                    <span className="text-sm font-black text-slate-900 mt-1 truncate">
                      {campaign.isBarter ? 'Permuta' : campaign.isDirectContract ? 'Direto' : formatCurrency(selectedCC.amount || 0)}
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Formato de Entrega</span>
                    <span className="text-sm font-black text-slate-800 mt-1 truncate">
                      {selectedCC.deliveryType}
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Contrato D4Sign</span>
                    <span className={cn(
                      "text-xs font-black uppercase mt-1 truncate",
                      selectedCC.signature?.status === 'signed' ? "text-emerald-600" : "text-amber-600"
                    )}>
                      {selectedCC.signature?.status === 'signed' ? 'Assinado' : 'Pendente'}
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Status do Conteúdo</span>
                    <span className={cn(
                      "text-xs font-black uppercase mt-1 truncate",
                      selectedCC.deliveryStatus === 'published' ? "text-emerald-700" :
                      selectedCC.deliveryStatus === 'approved' ? "text-indigo-700" :
                      selectedCC.deliveryStatus === 'revision' ? "text-rose-700" :
                      selectedCC.deliveryStatus === 'sent' ? "text-amber-700" : "text-slate-500"
                    )}>
                      {selectedCC.deliveryStatus === 'pending' || !selectedCC.deliveryStatus ? 'Aguardando' :
                       selectedCC.deliveryStatus === 'sent' ? 'Recebido' :
                       selectedCC.deliveryStatus === 'revision' ? 'Ajustes' :
                       selectedCC.deliveryStatus === 'approved' ? 'Aprovado' : 'Publicado'}
                    </span>
                  </div>
                </div>

                {/* Deliverable Materials & Evaluation Box */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col gap-6">
                  {/* Grid with Roteiro and Video */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    {/* Left side: Roteiro / Script */}
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <FileText size={13} className="text-brand-primary" /> Roteiro / Ideia Central
                        </span>
                        {selectedCC.content?.script && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(selectedCC.content.script);
                              alert("Roteiro copiado!");
                            }}
                            className="text-[10px] text-brand-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Copy size={11} /> Copiar
                          </button>
                        )}
                      </div>

                      {selectedCC.content?.script ? (
                        <div className="text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed font-medium whitespace-pre-wrap max-h-56 overflow-y-auto">
                          {selectedCC.content.script}
                        </div>
                      ) : (
                        <div className="p-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs">
                          Nenhum texto de roteiro submetido pelo criador ainda.
                        </div>
                      )}

                      {selectedCC.notes && (
                        <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-100 text-xs text-amber-900">
                          <strong className="block mb-0.5">Observações do Criador:</strong>
                          {selectedCC.notes}
                        </div>
                      )}
                    </div>

                    {/* Right side: Video / Media Preview */}
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          <Video size={13} className="text-brand-primary" /> Gravação / Mídia Enviada
                        </span>
                      </div>

                      {selectedCC.content?.videoUrl ? (
                        <div className="flex flex-col gap-3">
                          <SubmissionMediaPreview 
                            url={selectedCC.content.videoUrl} 
                            maxHeight="max-h-[380px]"
                          />
                        </div>
                      ) : (
                        <div className="p-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                          <Video size={24} className="text-slate-300" />
                          <span>Aguardando envio da gravação pelo criador</span>
                        </div>
                      )}

                      {/* Official published post link */}
                      {selectedCC.content?.publishedLink && (
                        <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                          <div className="flex items-center gap-2 truncate">
                            <Sparkles size={16} className="text-emerald-600 shrink-0" />
                            <span className="text-xs font-bold text-emerald-900 truncate">Post Publicado Oficial</span>
                          </div>
                          <a
                            href={selectedCC.content.publishedLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
                          >
                            Ver Publicação ↗
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Agency Evaluation & Feedback Decision Bar */}
                  <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 flex flex-col gap-4 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <PenSquare size={13} className="text-brand-primary" />
                        Decisão da Agência & Feedback Comercial
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        O criador receberá notificações automáticas em tempo real
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                        Orientações de Ajustes ou Comentários:
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Descreva observações de melhoria no roteiro, iluminação, dicção, CTA, hashtags ou inserção do produto..."
                        value={feedbackTexts[selectedCC.id] || ''}
                        onChange={(e) => setFeedbackTexts(prev => ({ ...prev, [selectedCC.id]: e.target.value }))}
                        className="w-full p-3 text-xs border border-slate-200 rounded-xl outline-none focus:border-brand-primary bg-white resize-y font-medium"
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <button
                        onClick={() => handleSaveFeedback(selectedCC.id)}
                        disabled={updatingId !== null || !(feedbackTexts[selectedCC.id] || '').trim()}
                        className="px-3.5 py-2 text-[11px] font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition disabled:opacity-50 cursor-pointer"
                      >
                        Salvar Apenas Feedback
                      </button>

                      <div className="flex items-center gap-2">
                        {/* Request changes */}
                        <button
                          onClick={() => handleUpdateDeliveryStatus(selectedCC.id, 'revision')}
                          disabled={updatingId !== null || !(feedbackTexts[selectedCC.id] || '').trim()}
                          className="px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                        >
                          🚨 Solicitar Ajustes
                        </button>

                        {/* Approve deliverable */}
                        <button
                          onClick={() => handleUpdateDeliveryStatus(selectedCC.id, 'approved')}
                          disabled={updatingId !== null}
                          className="px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                        >
                          <ThumbsUp size={12} fill="currentColor" /> Aprovar Material
                        </button>

                        {/* Mark published */}
                        <button
                          onClick={() => handleUpdateDeliveryStatus(selectedCC.id, 'published')}
                          disabled={updatingId !== null}
                          className="px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                        >
                          <Sparkles size={12} /> Marcar Publicado
                        </button>
                      </div>
                    </div>

                    {/* Status callout banner */}
                    {selectedCC.deliveryStatus === 'approved' && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                        O material de @{selectedCreatorProfile.artisticName} foi aprovado! O criador recebeu autorização para postar oficialmente.
                      </div>
                    )}
                    {selectedCC.deliveryStatus === 'revision' && (
                      <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
                        <AlertCircle size={16} className="text-rose-600 shrink-0" />
                        Ajustes foram solicitados! O criador recebeu o feedback para adequar o conteúdo.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white p-16 text-center rounded-2xl border border-slate-200 shadow-xs text-slate-400 flex flex-col items-center justify-center gap-3">
                <Users size={36} className="text-slate-300" />
                <h3 className="text-base font-bold text-slate-800">Selecione um criador no menu lateral</h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  Escolha um dos criadores alocados à esquerda para visualizar suas entregas, roteiros, vídeos e realizar aprovações.
                </p>
                {approvedCreators.length === 0 && (
                  <button
                    onClick={() => setIsAddCreatorModalOpen(true)}
                    className="mt-2 px-4 py-2 bg-brand-primary text-white font-bold rounded-xl text-xs hover:bg-indigo-600 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={14} /> Adicionar Primeiro Criador
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3.5 TAB CANDIDATURAS & CASTING */}
      {activeTab === 'candidaturas' && (
        <div className="flex flex-col gap-6">
          {/* Header & Filter / Search Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Users size={18} className="text-brand-primary" />
                  Candidaturas de Criadores
                </h3>
                <span className="px-2.5 py-0.5 bg-indigo-50 text-brand-primary border border-indigo-200 rounded-full text-xs font-black">
                  {allApplications.length} {allApplications.length === 1 ? 'candidatura' : 'candidaturas'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Gerencie todos os influenciadores que demonstraram interesse em participar desta campanha.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Search input */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por @, nome, cidade..."
                  value={candidateSearch}
                  onChange={(e) => setCandidateSearch(e.target.value)}
                  className="pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition w-full sm:w-60"
                />
                {candidateSearch && (
                  <button
                    onClick={() => setCandidateSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Add Manual Creator button */}
              <button
                onClick={() => setIsAddCreatorModalOpen(true)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus size={14} /> Adicionar Criador Manual
              </button>
            </div>
          </div>

          {/* Candidacy Status Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => setCandidateFilter('all')}
              className={cn(
                "p-4 rounded-2xl border text-left transition-all cursor-pointer shadow-xs",
                candidateFilter === 'all'
                  ? "bg-indigo-50/80 border-brand-primary ring-2 ring-brand-primary/20"
                  : "bg-white border-slate-200 hover:border-slate-300"
              )}
            >
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total de Candidaturas</div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{allApplications.length}</div>
            </button>

            <button
              onClick={() => setCandidateFilter('pending')}
              className={cn(
                "p-4 rounded-2xl border text-left transition-all cursor-pointer shadow-xs",
                candidateFilter === 'pending'
                  ? "bg-amber-50/80 border-amber-400 ring-2 ring-amber-400/20"
                  : "bg-white border-slate-200 hover:border-slate-300"
              )}
            >
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-600 flex items-center justify-between">
                <span>Pendentes</span>
                {pendingApplications.length > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />}
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-700 mt-1">{pendingApplications.length}</div>
            </button>

            <button
              onClick={() => setCandidateFilter('approved')}
              className={cn(
                "p-4 rounded-2xl border text-left transition-all cursor-pointer shadow-xs",
                candidateFilter === 'approved'
                  ? "bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-400/20"
                  : "bg-white border-slate-200 hover:border-slate-300"
              )}
            >
              <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Aprovados no Casting</div>
              <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">{approvedApplications.length}</div>
            </button>

            <button
              onClick={() => setCandidateFilter('rejected')}
              className={cn(
                "p-4 rounded-2xl border text-left transition-all cursor-pointer shadow-xs",
                candidateFilter === 'rejected'
                  ? "bg-rose-50/80 border-rose-400 ring-2 ring-rose-400/20"
                  : "bg-white border-slate-200 hover:border-slate-300"
              )}
            >
              <div className="text-[10px] font-black uppercase tracking-wider text-rose-600">Não Selecionados</div>
              <div className="text-xl sm:text-2xl font-black text-rose-700 mt-1">{rejectedApplications.length}</div>
            </button>
          </div>

          {/* Application List */}
          {(() => {
            const filteredApps = allApplications.filter(app => {
              // Status filter
              if (candidateFilter !== 'all' && app.applicationStatus !== candidateFilter) {
                return false;
              }
              // Search filter
              if (candidateSearch.trim()) {
                const cr = allCreators.find(c => c.id === app.creatorId);
                const q = candidateSearch.toLowerCase();
                const artistic = (cr?.artisticName || '').toLowerCase();
                const full = (cr?.fullName || '').toLowerCase();
                const city = (cr?.city || '').toLowerCase();
                const state = (cr?.state || '').toLowerCase();
                const niche = Array.isArray(cr?.niche) ? cr.niche.join(' ').toLowerCase() : (cr?.niche || '').toLowerCase();
                return artistic.includes(q) || full.includes(q) || city.includes(q) || state.includes(q) || niche.includes(q);
              }
              return true;
            });

            if (filteredApps.length === 0) {
              return (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400">
                    <Users size={28} />
                  </div>
                  <h4 className="text-base font-bold text-slate-800">
                    {candidateFilter === 'pending' ? 'Nenhuma candidatura pendente no momento' :
                     candidateFilter === 'approved' ? 'Nenhum criador aprovado nesta categoria' :
                     candidateFilter === 'rejected' ? 'Nenhuma candidatura recusada' :
                     'Nenhuma candidatura encontrada'}
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md">
                    {candidateSearch
                      ? `Nenhum resultado para a busca "${candidateSearch}". Tente limpar os filtros.`
                      : 'Quando influenciadores se candidatarem a esta campanha pela vitrine pública, seus perfis e propostas aparecerão aqui para sua aprovação.'}
                  </p>
                  {candidateSearch && (
                    <button
                      onClick={() => setCandidateSearch('')}
                      className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Limpar Busca
                    </button>
                  )}
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 gap-4">
                {filteredApps.map(app => {
                  const cr = allCreators.find(c => c.id === app.creatorId);
                  const isUpdating = updatingId === app.id;
                  const currentAmountValue = customApprovedAmounts[app.id] !== undefined
                    ? customApprovedAmounts[app.id]
                    : (Number(app.amount) || cr?.pricing?.combo || cr?.pricing?.reel || 250);

                  const isPending = app.applicationStatus === 'pending';
                  const isApproved = app.applicationStatus === 'approved';
                  const isRejected = app.applicationStatus === 'rejected';

                  // WhatsApp pre-filled url
                  const cleanPhone = (cr?.whatsapp || cr?.phone || '').replace(/\D/g, '');
                  const waUrl = cleanPhone ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(`Olá @${cr?.artisticName || ''}, sobre sua candidatura na campanha "${campaign.name}"...`)}` : null;

                  return (
                    <div
                      key={app.id}
                      className={cn(
                        "bg-white rounded-2xl border p-5 shadow-xs transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-5",
                        isPending ? "border-amber-200/90 hover:border-amber-400 ring-1 ring-amber-100" :
                        isApproved ? "border-emerald-200/90 hover:border-emerald-400 bg-emerald-50/20" :
                        "border-slate-200 opacity-80"
                      )}
                    >
                      {/* Left: Creator Profile info */}
                      <div className="flex items-start sm:items-center gap-4 min-w-0">
                        <Link to={`/creators/${app.creatorId}`} className="shrink-0 group">
                          <UserAvatar
                            src={cr?.photoUrl}
                            name={cr?.artisticName || cr?.fullName || 'Criador'}
                            size="custom"
                            shape="rounded-2xl"
                            className="w-14 h-14 border-2 border-white shadow-sm group-hover:scale-105 transition-transform"
                            textClassName="text-base font-black"
                          />
                        </Link>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              to={`/creators/${app.creatorId}`}
                              className="text-sm font-black text-slate-900 hover:text-brand-primary transition flex items-center gap-1"
                            >
                              @{cr?.artisticName || 'criador'}
                              <ArrowUpRight size={13} className="text-slate-400" />
                            </Link>

                            {/* Status Badge */}
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1",
                              isPending ? "bg-amber-100 text-amber-800 border border-amber-300" :
                              isApproved ? "bg-emerald-100 text-emerald-800 border border-emerald-300" :
                              "bg-rose-100 text-rose-800 border border-rose-300"
                            )}>
                              {isPending && <Clock size={11} />}
                              {isApproved && <CheckCircle2 size={11} />}
                              {isRejected && <AlertCircle size={11} />}
                              {isPending ? 'Pendente de Aprovação' : isApproved ? 'Aprovado no Casting' : 'Recusada'}
                            </span>
                          </div>

                          <div className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>{cr?.fullName || 'Nome não informado'}</span>
                            {(cr?.city || cr?.state) && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span>{cr?.city}{cr?.city && cr?.state ? ', ' : ''}{cr?.state}</span>
                              </>
                            )}
                          </div>

                          {/* Niches / Badges */}
                          <div className="flex items-center gap-1.5 flex-wrap mt-2">
                            {Array.isArray(cr?.niche) ? (
                              cr.niche.slice(0, 3).map((n, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-semibold">
                                  {n}
                                </span>
                              ))
                            ) : cr?.niche ? (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-semibold">
                                {cr.niche}
                              </span>
                            ) : null}

                            {cr?.metrics?.followers ? (
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[10px] font-bold">
                                {formatNumber(cr.metrics.followers)} seguidores
                              </span>
                            ) : null}

                            {cr?.metrics?.engagementRate ? (
                              <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md text-[10px] font-bold">
                                {cr.metrics.engagementRate}% engajamento
                              </span>
                            ) : null}
                          </div>

                          {/* Creator Pitch / Message if provided */}
                          {app.notes && (
                            <div className="mt-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-700 max-w-xl">
                              <strong className="text-[10px] font-bold text-slate-500 uppercase block">Mensagem do Criador:</strong>
                              "{app.notes}"
                            </div>
                          )}

                          {/* Rejection Reason if rejected */}
                          {isRejected && app.rejectionReason && (
                            <div className="mt-2 p-2.5 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-800 max-w-xl">
                              <strong className="text-[10px] font-bold text-rose-600 uppercase block">Motivo da Recusa:</strong>
                              "{app.rejectionReason}"
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Proposal, Pricing & Decision Actions */}
                      <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center lg:items-end xl:items-center gap-4 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
                        {/* Cache / Value Input */}
                        <div className="flex flex-col gap-1 min-w-[140px]">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                            Cachê Acordado
                          </label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={currentAmountValue}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setCustomApprovedAmounts(prev => ({ ...prev, [app.id]: val }));
                              }}
                              disabled={isApproved || campaign.isBarter}
                              className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary disabled:opacity-75 disabled:bg-slate-100"
                            />
                          </div>
                          <span className="text-[9px] text-slate-400 font-medium">
                            {campaign.isBarter ? 'Permuta de Produtos' : 'Ajustável antes da aprovação'}
                          </span>
                        </div>

                        {/* Quick Action Buttons */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Direct WhatsApp Contact */}
                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1"
                              title="Conversar com o criador no WhatsApp"
                            >
                              <MessageCircle size={15} />
                            </a>
                          )}

                          {/* Profile link button */}
                          <Link
                            to={`/creators/${app.creatorId}`}
                            className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1 shadow-xs"
                            title="Ver Perfil Completo"
                          >
                            <Eye size={13} />
                            <span className="hidden sm:inline">Perfil</span>
                          </Link>

                          {/* Pending Actions: Approve / Reject */}
                          {isPending && (
                            <>
                              <button
                                onClick={() => setRejectModal({ isOpen: true, app, reason: '' })}
                                disabled={isUpdating}
                                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <X size={13} />
                                Recusar
                              </button>

                              <button
                                onClick={() => handleApproveApplication(app, currentAmountValue)}
                                disabled={isUpdating}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                              >
                                {isUpdating ? (
                                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Check size={14} />
                                )}
                                Aprovar no Casting
                              </button>
                            </>
                          )}

                          {/* Approved Actions */}
                          {isApproved && (
                            <>
                              <button
                                onClick={() => {
                                  handleTabChange('entregas');
                                  setSelectedCreatorId(app.id);
                                }}
                                className="px-3.5 py-2 bg-brand-primary hover:bg-indigo-600 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                              >
                                <Video size={13} />
                                Ver Entregas
                              </button>

                              <button
                                onClick={() => handleRevertToPending(app)}
                                disabled={isUpdating}
                                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                                title="Reverter para Pendente"
                              >
                                <Edit3 size={14} />
                              </button>
                            </>
                          )}

                          {/* Rejected Actions */}
                          {isRejected && (
                            <button
                              onClick={() => handleApproveApplication(app, currentAmountValue)}
                              disabled={isUpdating}
                              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-brand-primary border border-indigo-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle2 size={13} />
                              Reavaliar e Aprovar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* 4. TAB BRIEFING CRIATIVO & REGRAS */}
      {activeTab === 'briefing' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">Briefing & Entregas da Campanha</h2>
              <p className="text-xs text-slate-500">Entregas exigidas para cada criador e diretrizes de produção de conteúdo</p>
            </div>
            <button
              onClick={() => setIsEditCampaignModalOpen(true)}
              className="px-4 py-2 bg-brand-primary hover:bg-indigo-600 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 size={14} /> Editar Briefing e Entregas
            </button>
          </div>

          {/* Pacote de Entregas por Criador */}
          <div className="p-5 bg-indigo-50/40 rounded-2xl border border-indigo-100 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                  <Package size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Entregas Exigidas por Criador</h3>
                  <p className="text-xs text-slate-500">Volume e formato de materiais obrigatórios que cada criador deve produzir</p>
                </div>
              </div>
              {campaign.deliverablesPerCreator?.deadlineDays && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-indigo-900 shadow-xs">
                  <Clock size={13} className="text-indigo-600" />
                  Prazo: {campaign.deliverablesPerCreator.deadlineDays} dias úteis
                </div>
              )}
            </div>

            {/* Deliverable pills */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clapperboard size={16} className="text-indigo-600" />
                  <span className="text-xs font-bold text-slate-700">Reels</span>
                </div>
                <span className="text-sm font-black text-slate-900 bg-indigo-50 px-2 py-0.5 rounded-md">
                  {campaign.deliverablesPerCreator?.reels ?? 0}
                </span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Instagram size={16} className="text-amber-600" />
                  <span className="text-xs font-bold text-slate-700">Stories</span>
                </div>
                <span className="text-sm font-black text-slate-900 bg-amber-50 px-2 py-0.5 rounded-md">
                  {campaign.deliverablesPerCreator?.stories ?? 0}
                </span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clapperboard size={16} className="text-rose-600" />
                  <span className="text-xs font-bold text-slate-700">TikTok</span>
                </div>
                <span className="text-sm font-black text-slate-900 bg-rose-50 px-2 py-0.5 rounded-md">
                  {campaign.deliverablesPerCreator?.tiktok ?? 0}
                </span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera size={16} className="text-teal-600" />
                  <span className="text-xs font-bold text-slate-700">UGC</span>
                </div>
                <span className="text-sm font-black text-slate-900 bg-teal-50 px-2 py-0.5 rounded-md">
                  {campaign.deliverablesPerCreator?.ugc ?? 0}
                </span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-emerald-600" />
                  <span className="text-xs font-bold text-slate-700">Posts</span>
                </div>
                <span className="text-sm font-black text-slate-900 bg-emerald-50 px-2 py-0.5 rounded-md">
                  {campaign.deliverablesPerCreator?.posts ?? 0}
                </span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Video size={16} className="text-red-600" />
                  <span className="text-xs font-bold text-slate-700">YouTube</span>
                </div>
                <span className="text-sm font-black text-slate-900 bg-red-50 px-2 py-0.5 rounded-md">
                  {campaign.deliverablesPerCreator?.youtube ?? 0}
                </span>
              </div>
            </div>

            {/* Summary & guidelines */}
            <div className="bg-white p-3.5 rounded-xl border border-indigo-100 flex flex-col gap-2">
              <div className="text-xs text-slate-800">
                <span className="font-bold text-slate-500">Resumo: </span>
                <span className="font-black text-brand-primary">
                  {campaign.deliverablesPerCreator?.summary || formatDeliverablesSummary(campaign.deliverablesPerCreator) || 'Entregas a combinar'}
                </span>
              </div>
              {campaign.deliverablesPerCreator?.guidelines && (
                <div className="text-xs text-slate-600 pt-2 border-t border-slate-100">
                  <span className="font-bold text-slate-500 block mb-0.5">Requisitos Técnicos:</span>
                  <p className="whitespace-pre-wrap">{campaign.deliverablesPerCreator.guidelines}</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Produto / Serviço */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Produto / Foco da Campanha</span>
              <p className="text-xs text-slate-800 font-medium whitespace-pre-wrap">
                {campaign.briefing?.product || 'Não informado'}
              </p>
            </div>

            {/* Mensagem Principal */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Mensagem Principal / Key Message</span>
              <p className="text-xs text-slate-800 font-medium whitespace-pre-wrap">
                {campaign.briefing?.keyMessage || 'Não informado'}
              </p>
            </div>

            {/* Must Haves */}
            <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-1.5">
              <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider block">O Que DEVE Ter (Must Haves)</span>
              <p className="text-xs text-slate-800 font-medium whitespace-pre-wrap">
                {campaign.briefing?.mustHave || 'Nenhum item obrigatório especificado'}
              </p>
            </div>

            {/* Don'ts */}
            <div className="p-4 bg-rose-50/50 rounded-xl border border-rose-200 space-y-1.5">
              <span className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider block">O Que NÃO Pode (Don'ts)</span>
              <p className="text-xs text-slate-800 font-medium whitespace-pre-wrap">
                {campaign.briefing?.donts || 'Nenhuma restrição informada'}
              </p>
            </div>

            {/* CTA e Links */}
            <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-200 space-y-1.5">
              <span className="text-[10px] font-extrabold text-brand-primary uppercase tracking-wider block">Chamada para Ação (CTA)</span>
              <p className="text-xs text-slate-800 font-medium whitespace-pre-wrap">
                {campaign.briefing?.cta || 'Não informado'}
              </p>
            </div>

            {/* Cupons e Hashtags */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Cupom de Desconto</span>
                <span className="text-xs font-bold text-slate-800">{campaign.briefing?.coupon || 'Nenhum'}</span>
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Hashtags Oficiais</span>
                <span className="text-xs font-bold text-brand-primary">{campaign.briefing?.hashtags || 'Nenhuma'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB FINANCEIRO & CONTRATOS */}
      {activeTab === 'financeiro' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">Financeiro & Contratos do Casting</h2>
              <p className="text-xs text-slate-500">Controle de pagamentos, contratos assinados e cachês por criador</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                  <th className="px-4 py-3">Criador</th>
                  <th className="px-4 py-3">Formato</th>
                  <th className="px-4 py-3">Cachê Acordado</th>
                  <th className="px-4 py-3">Contrato</th>
                  <th className="px-4 py-3">Pagamento</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {approvedCreators.map(cc => {
                  const cr = allCreators.find(c => c.id === cc.creatorId);
                  return (
                    <tr key={cc.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <UserAvatar
                            src={cr?.photoUrl}
                            name={cr?.artisticName || cr?.fullName || 'Criador'}
                            size="custom"
                            shape="rounded-lg"
                            className="w-7 h-7 border border-slate-200"
                            textClassName="text-[10px]"
                          />
                          <span>@{cr?.artisticName || 'criador'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 font-medium">{cc.deliveryType}</td>
                      <td className="px-4 py-3.5 font-black text-slate-900">
                        {campaign.isBarter ? 'Permuta' : campaign.isDirectContract ? 'Direto' : formatCurrency(cc.amount || 0)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-black uppercase",
                          cc.signature?.status === 'signed' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                        )}>
                          {cc.signature?.status === 'signed' ? 'Assinado' : 'Pendente'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-black uppercase",
                          cc.paymentStatus === 'paid' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                        )}>
                          {cc.paymentStatus === 'paid' ? 'Pago' : 'Pendente'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => setEditingCC(cc)}
                          className="text-brand-primary font-bold hover:underline"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADICIONAR CRIADOR AO CASTING */}
      <AnimatePresence>
        {isAddCreatorModalOpen && (
          <div className="fixed inset-0 z-[100] overflow-y-auto p-3 sm:p-4 flex items-center justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsAddCreatorModalOpen(false)} />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative w-full max-w-2xl bg-white rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto z-10">
              <div className="p-5 sm:p-6 border-b border-[#E2E8F0] flex items-center justify-between shrink-0 bg-white">
                <div>
                  <h2 className="text-xl font-bold text-[#0F172A]">Adicionar Criador ao Casting</h2>
                  <p className="text-xs text-slate-500">Selecione influenciadores cadastrados no banco para esta campanha</p>
                </div>
                <button onClick={() => setIsAddCreatorModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer border-none bg-transparent">✕</button>
              </div>

              <div className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-3 custom-scrollbar">
                {allCreators.map(c => {
                  const isAlreadySelected = approvedCreators.some(cc => cc.creatorId === c.id);
                  return (
                    <div key={c.id} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200 hover:border-brand-primary transition-all">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          src={c.photoUrl}
                          name={c.artisticName || c.fullName}
                          size="custom"
                          shape="rounded-xl"
                          className="w-11 h-11 border border-slate-200"
                          textClassName="text-sm"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-900">@{c.artisticName}</p>
                          <span className="text-[11px] text-slate-500">{c.fullName} • {formatNumber(c.metrics?.followers || 0)} seguidores</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isAlreadySelected ? (
                          <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 size={15} /> No Casting
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAddCreator(c)}
                            className="px-3.5 py-1.5 bg-brand-primary hover:bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-xs transition"
                          >
                            Selecionar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: EDITAR ENTREGA DO CRIADOR */}
      <AnimatePresence>
        {editingCC && (
          <div className="fixed inset-0 z-[100] overflow-y-auto p-3 sm:p-4 flex items-center justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setEditingCC(null)} />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative w-full max-w-xl bg-white rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto z-10">
              <div className="p-5 sm:p-6 border-b border-[#E2E8F0] flex items-center justify-between shrink-0 bg-white">
                <h2 className="text-xl font-bold text-[#0F172A]">Editar Entrega do Criador</h2>
                <button onClick={() => setEditingCC(null)} className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer border-none bg-transparent">✕</button>
              </div>

              <form
                className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-4 custom-scrollbar"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!id || !editingCC) return;
                  const formData = new FormData(e.currentTarget);
                  await updateDoc(doc(db, `campaigns/${id}/creators`, editingCC.id), {
                    deliveryType: formData.get('deliveryType'),
                    amount: Number(formData.get('amount')) || 0,
                    deliveryStatus: formData.get('deliveryStatus'),
                    paymentStatus: formData.get('paymentStatus'),
                    'signature.status': formData.get('signatureStatus'),
                    'content.script': formData.get('script') || '',
                    'content.videoUrl': formData.get('videoUrl') || '',
                    'content.publishedLink': formData.get('publishedLink') || ''
                  });
                  setEditingCC(null);
                }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Formato Contratado</label>
                    <input name="deliveryType" defaultValue={editingCC.deliveryType} required className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Cachê (R$)</label>
                    <input name="amount" type="number" step="0.01" defaultValue={editingCC.amount} required className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Status Entrega</label>
                    <select name="deliveryStatus" defaultValue={editingCC.deliveryStatus || 'pending'} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white">
                      <option value="pending">Aguardando</option>
                      <option value="sent">Recebido (Revisar)</option>
                      <option value="revision">Ajustes Solicitados</option>
                      <option value="approved">Aprovado</option>
                      <option value="published">Publicado</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Status Pagamento</label>
                    <select name="paymentStatus" defaultValue={editingCC.paymentStatus || 'pending'} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white">
                      <option value="pending">Pendente</option>
                      <option value="paid">Pago</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Status Contrato</label>
                    <select name="signatureStatus" defaultValue={editingCC.signature?.status || 'pending'} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white">
                      <option value="pending">Pendente</option>
                      <option value="signed">Assinado</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Roteiro / Legenda</label>
                  <textarea name="script" defaultValue={editingCC.content?.script || ''} rows={4} className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium resize-none" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Link do Vídeo (Gravação)</label>
                  <input name="videoUrl" defaultValue={editingCC.content?.videoUrl || ''} placeholder="https://..." className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Link do Post Publicado</label>
                  <input name="publishedLink" defaultValue={editingCC.content?.publishedLink || ''} placeholder="https://instagram.com/p/..." className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium" />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button type="button" onClick={() => setEditingCC(null)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Cancelar</button>
                  <button type="submit" className="px-5 py-2 bg-brand-primary hover:bg-indigo-600 text-white font-extrabold text-xs rounded-xl shadow-md">Salvar Alterações</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: QUICK ALTERAR IMAGEM DA CAMPANHA (16:9) */}
      <AnimatePresence>
        {isChangeImageModalOpen && (
          <div className="fixed inset-0 z-[100] overflow-y-auto p-3 sm:p-4 flex items-center justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsChangeImageModalOpen(false)} />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative w-full max-w-xl bg-white rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto z-10">
              <div className="p-5 sm:p-6 border-b border-[#E2E8F0] flex items-center justify-between shrink-0 bg-white">
                <div>
                  <h2 className="text-xl font-bold text-[#0F172A]">Alterar Imagem da Campanha</h2>
                  <p className="text-xs text-slate-500">Defina ou troque a imagem de capa em formato padrão 16:9</p>
                </div>
                <button onClick={() => setIsChangeImageModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer border-none bg-transparent">✕</button>
              </div>

              <div className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-4">
                <CampaignImageUpload
                  value={editImageUrl}
                  onChange={setEditImageUrl}
                  label="Imagem de Capa da Campanha"
                />

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEditImageUrl(campaign?.imageUrl || '');
                      setIsChangeImageModalOpen(false);
                    }}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!id) return;
                      await updateDoc(doc(db, 'campaigns', id), {
                        imageUrl: editImageUrl || ''
                      });
                      setIsChangeImageModalOpen(false);
                    }}
                    className="px-5 py-2 bg-brand-primary hover:bg-indigo-600 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={14} /> Salvar Imagem
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: EDITAR CAMPANHA & BRIEFING */}
      <AnimatePresence>
        {isEditCampaignModalOpen && (
          <div className="fixed inset-0 z-[100] overflow-y-auto p-3 sm:p-4 flex items-center justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsEditCampaignModalOpen(false)} />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative w-full max-w-2xl bg-white rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto z-10">
              <div className="p-5 sm:p-6 border-b border-[#E2E8F0] flex items-center justify-between shrink-0 bg-white">
                <h2 className="text-xl font-bold text-[#0F172A]">Editar Informações da Campanha</h2>
                <button onClick={() => setIsEditCampaignModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer border-none bg-transparent">✕</button>
              </div>

              <form
                className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-4 custom-scrollbar"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!id) return;
                  const formData = new FormData(e.currentTarget);
                  await updateDoc(doc(db, 'campaigns', id), {
                    name: formData.get('name'),
                    companyId: formData.get('companyId'),
                    status: formData.get('status'),
                    startDate: formData.get('startDate'),
                    endDate: formData.get('endDate'),
                    totalBudget: Number(formData.get('totalBudget')) || 0,
                    imageUrl: editImageUrl || '',
                    objective: formData.get('objective') || '',
                    isSecret: formData.get('isSecret') === 'on',
                    isDirectContract: formData.get('isDirectContract') === 'on',
                    isBarter: modalIsBarter,
                    barterDetails: modalIsBarter ? (formData.get('barterDetails') as string) || '' : '',
                    'deliverablesPerCreator.reels': Number(formData.get('delReels')) || 0,
                    'deliverablesPerCreator.stories': Number(formData.get('delStories')) || 0,
                    'deliverablesPerCreator.tiktok': Number(formData.get('delTikTok')) || 0,
                    'deliverablesPerCreator.ugc': Number(formData.get('delUgc')) || 0,
                    'deliverablesPerCreator.posts': Number(formData.get('delPosts')) || 0,
                    'deliverablesPerCreator.youtube': Number(formData.get('delYoutube')) || 0,
                    'deliverablesPerCreator.deadlineDays': Number(formData.get('delDeadlineDays')) || 5,
                    'deliverablesPerCreator.summary': (formData.get('delSummary') as string) || '',
                    'deliverablesPerCreator.guidelines': (formData.get('delGuidelines') as string) || '',
                    'briefing.product': formData.get('briefingProduct') || '',
                    'briefing.keyMessage': formData.get('briefingKeyMessage') || '',
                    'briefing.mustHave': formData.get('briefingMustHave') || '',
                    'briefing.donts': formData.get('briefingDonts') || '',
                    'briefing.cta': formData.get('briefingCta') || '',
                    'briefing.coupon': formData.get('briefingCoupon') || '',
                    'briefing.hashtags': formData.get('briefingHashtags') || ''
                  });
                  setIsEditCampaignModalOpen(false);
                }}
              >
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Nome da Campanha</label>
                  <input name="name" defaultValue={campaign.name} required className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold" />
                </div>

                {/* Campaign Image Standard Form Field */}
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                  <CampaignImageUpload
                    value={editImageUrl}
                    onChange={setEditImageUrl}
                    label="Imagem de Capa da Campanha (Formato Padrão 16:9)"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Cliente/Empresa</label>
                    <select name="companyId" defaultValue={campaign.companyId} required className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-medium">
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Status</label>
                    <select name="status" defaultValue={campaign.status} required className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white">
                      {Object.entries(statusMap).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Verba Total (R$)</label>
                    <input name="totalBudget" type="number" step="0.01" defaultValue={campaign.totalBudget} disabled={modalIsBarter} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold disabled:bg-slate-100" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Data Início</label>
                    <input name="startDate" type="date" defaultValue={campaign.startDate} required className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Data Fim</label>
                    <input name="endDate" type="date" defaultValue={campaign.endDate} required className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs" />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Objetivo</label>
                  <textarea name="objective" defaultValue={campaign.objective} rows={2} className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium resize-none" />
                </div>

                {/* Deliverables per creator fields */}
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <div className="flex items-center gap-2">
                    <Package size={14} className="text-brand-primary" />
                    <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Entregas Exigidas por Criador</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Reels</label>
                      <input name="delReels" type="number" min="0" defaultValue={campaign.deliverablesPerCreator?.reels ?? 0} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-800" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Stories</label>
                      <input name="delStories" type="number" min="0" defaultValue={campaign.deliverablesPerCreator?.stories ?? 0} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-800" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">TikTok</label>
                      <input name="delTikTok" type="number" min="0" defaultValue={campaign.deliverablesPerCreator?.tiktok ?? 0} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-800" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">UGC</label>
                      <input name="delUgc" type="number" min="0" defaultValue={campaign.deliverablesPerCreator?.ugc ?? 0} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-800" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Posts</label>
                      <input name="delPosts" type="number" min="0" defaultValue={campaign.deliverablesPerCreator?.posts ?? 0} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-800" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">YouTube</label>
                      <input name="delYoutube" type="number" min="0" defaultValue={campaign.deliverablesPerCreator?.youtube ?? 0} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-800" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Resumo das Entregas</label>
                      <input name="delSummary" defaultValue={campaign.deliverablesPerCreator?.summary || ''} placeholder="Ex: 1 Reel + 3 Stories" className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Prazo de Entrega (Dias Úteis)</label>
                      <input name="delDeadlineDays" type="number" min="1" defaultValue={campaign.deliverablesPerCreator?.deadlineDays ?? 5} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-800" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Diretrizes & Requisitos Técnicos</label>
                    <textarea name="delGuidelines" defaultValue={campaign.deliverablesPerCreator?.guidelines || ''} rows={2} placeholder="Ex: Gravação vertical 9:16, boa iluminação, etc." className="w-full p-2 rounded-lg border border-slate-200 text-xs" />
                  </div>
                </div>

                {/* Briefing fields */}
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider block">Briefing Criativo</span>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Produto / Foco</label>
                      <input name="briefingProduct" defaultValue={campaign.briefing?.product} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Key Message</label>
                      <input name="briefingKeyMessage" defaultValue={campaign.briefing?.keyMessage} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-emerald-700 uppercase">Must Haves</label>
                      <textarea name="briefingMustHave" defaultValue={campaign.briefing?.mustHave} rows={2} className="w-full p-2 rounded-lg border border-slate-200 text-xs" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-rose-700 uppercase">Don'ts</label>
                      <textarea name="briefingDonts" defaultValue={campaign.briefing?.donts} rows={2} className="w-full p-2 rounded-lg border border-slate-200 text-xs" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">CTA</label>
                      <input name="briefingCta" defaultValue={campaign.briefing?.cta} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Cupom</label>
                      <input name="briefingCoupon" defaultValue={campaign.briefing?.coupon} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Hashtags</label>
                      <input name="briefingHashtags" defaultValue={campaign.briefing?.hashtags} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs" />
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button type="button" onClick={() => setIsEditCampaignModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Cancelar</button>
                  <button type="submit" className="px-5 py-2 bg-brand-primary hover:bg-indigo-600 text-white font-extrabold text-xs rounded-xl shadow-md">Salvar Alterações</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CANDIDATOS PENDENTES */}
      <AnimatePresence>
        {isCandidatesModalOpen && (
          <div className="fixed inset-0 z-[100] overflow-y-auto p-3 sm:p-4 flex items-center justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsCandidatesModalOpen(false)} />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative w-full max-w-xl bg-white rounded-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto z-10">
              <div className="p-5 sm:p-6 border-b border-[#E2E8F0] flex items-center justify-between shrink-0 bg-white">
                <div>
                  <h2 className="text-xl font-bold text-[#0F172A]">Candidaturas de Criadores</h2>
                  <p className="text-xs text-slate-500">Avalie e aprove os criadores que se candidataram para esta campanha</p>
                </div>
                <button onClick={() => setIsCandidatesModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer border-none bg-transparent">✕</button>
              </div>

              <div className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-3 custom-scrollbar">
                {pendingApplications.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Nenhuma candidatura pendente no momento.
                  </div>
                ) : (
                  pendingApplications.map(app => {
                    const cr = allCreators.find(c => c.id === app.creatorId);
                    return (
                      <div key={app.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            src={cr?.photoUrl}
                            name={cr?.artisticName || cr?.fullName || 'Criador'}
                            size="custom"
                            shape="rounded-xl"
                            className="w-10 h-10 border border-slate-200"
                            textClassName="text-sm"
                          />
                          <div>
                            <p className="text-xs font-bold text-slate-900">@{cr?.artisticName}</p>
                            <span className="text-[11px] text-slate-500">{cr?.fullName} • {formatNumber(cr?.metrics?.followers || 0)} seguidores</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setIsCandidatesModalOpen(false);
                              setRejectModal({ isOpen: true, app, reason: '' });
                            }}
                            className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-lg text-xs font-bold cursor-pointer"
                          >
                            Recusar
                          </button>
                          <button
                            onClick={async () => {
                              await handleApproveApplication(app);
                            }}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1 shadow-xs"
                          >
                            <Check size={13} />
                            Aprovar
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => {
                    setIsCandidatesModalOpen(false);
                    handleTabChange('candidaturas');
                  }}
                  className="text-xs font-bold text-brand-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Users size={13} />
                  Abrir Painel Completo de Candidaturas ↗
                </button>

                <button
                  onClick={() => setIsCandidatesModalOpen(false)}
                  className="px-4 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: RECUSAR CANDIDATURA COM MOTIVO */}
      <AnimatePresence>
        {rejectModal.isOpen && rejectModal.app && (
          <div className="fixed inset-0 z-[110] overflow-y-auto p-3 sm:p-4 flex items-center justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setRejectModal({ isOpen: false, app: null, reason: '' })} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 overflow-hidden flex flex-col gap-4 my-auto z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                    <AlertCircle size={18} />
                  </div>
                  <h3 className="text-base font-black text-slate-900">Recusar Candidatura</h3>
                </div>
                <button onClick={() => setRejectModal({ isOpen: false, app: null, reason: '' })} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">✕</button>
              </div>

              <p className="text-xs text-slate-600">
                Deseja recusar a candidatura do influenciador para a campanha "{campaign.name}"?
              </p>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Motivo da recusa (opcional para feedback do criador)
                </label>
                <textarea
                  value={rejectModal.reason}
                  onChange={(e) => setRejectModal(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Ex: Perfil fora do nicho desejado, cota de casting preenchida, etc."
                  rows={3}
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium resize-none focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectModal({ isOpen: false, app: null, reason: '' })}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleRejectApplication(rejectModal.app, rejectModal.reason)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer transition active:scale-95 flex items-center gap-1.5"
                >
                  <X size={14} /> Confirmar Recusa
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FULLSCREEN VIDEO PLAYER MODAL */}
      <AnimatePresence>
        {activeVideoUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh] my-auto z-10"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-800 text-white shrink-0">
                <div className="flex items-center gap-2">
                  <Video className="text-brand-primary" size={18} />
                  <span className="text-sm font-bold">Rascunho de Vídeo de @{activeVideoCreatorName}</span>
                </div>
                <button
                  onClick={() => {
                    setActiveVideoUrl(null);
                    setActiveVideoCreatorName('');
                  }}
                  className="p-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 min-h-0 bg-black flex items-center justify-center p-2 overflow-hidden">
                <SubmissionMediaPreview 
                  url={activeVideoUrl} 
                  maxHeight="max-h-[65vh]"
                  className="w-full"
                />
              </div>

              <div className="p-4 bg-slate-800/50 flex justify-end gap-3 shrink-0 border-t border-slate-800">
                <button
                  onClick={() => {
                    setActiveVideoUrl(null);
                    setActiveVideoCreatorName('');
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-slate-700 hover:bg-slate-600 rounded-xl transition cursor-pointer"
                >
                  Fechar Player
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CONFIRM DELETE MODAL */}
      <ConfirmDeleteModal
        isOpen={deleteModalConfig.isOpen}
        onClose={() => setDeleteModalConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleDeleteCampaign}
        title="Excluir Campanha"
        itemName={deleteModalConfig.title}
        itemType="esta campanha"
        isDeleting={deleteModalConfig.isDeleting}
      />
    </div>
  );
}
