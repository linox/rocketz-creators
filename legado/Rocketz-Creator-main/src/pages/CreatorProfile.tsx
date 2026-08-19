import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Video, 
  Trash2, 
  UploadCloud, 
  Eye, 
  Check, 
  Instagram, 
  Users, 
  Plus, 
  Play, 
  Clock, 
  Globe, 
  Tv, 
  FolderPlus, 
  Sparkles, 
  UserCheck, 
  Smartphone,
  Info,
  Briefcase,
  DollarSign,
  FileText,
  CheckCircle2,
  AlertCircle,
  Send,
  ExternalLink,
  MessageSquare,
  TrendingUp,
  ArrowRight,
  CreditCard,
  X,
  Home,
  User,
  Heart,
  Compass,
  Building2,
  Repeat,
  Film,
  Layers,
  Clapperboard,
  Radio,
  Pin,
  Newspaper,
  Mic,
  Package,
  Camera,
  Calendar,
  Key,
  ChevronDown,
  ChevronUp,
  Megaphone,
  BookOpen,
  Edit,
  Scale,
  ShieldCheck,
  KeyRound
} from 'lucide-react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { UserAvatar } from '../components/UserAvatar';
import { db, auth } from '../lib/firebase';
import { createNotification } from '../lib/notifications';
import { Creator, PortfolioVideo, Campaign, CampaignCreator, Company, RecurringContract, ContentPlanningItem } from '../types';
import { formatNumber, cn } from '../lib/utils';
import { usePrivacy } from '../context/PrivacyContext';
import { motion, AnimatePresence } from 'motion/react';
import { CONTENT_TYPE_CONFIG } from './RecurringContracts';
import { prepareMediaForStorage } from '../utils/mediaStorage';
import { uploadFileInChunks } from '../utils/fileUpload';
import { SubmissionMediaPreview } from '../components/SubmissionMediaPreview';
import { CreatorSwitcher } from '../components/CreatorSwitcher';
import { RecurringContractDetailsModal } from '../components/RecurringContractDetailsModal';
import { CreatorContractModal } from '../components/CreatorContractModal';
import { ChangeCreatorPasswordModal } from '../components/ChangeCreatorPasswordModal';
import { formatCPF, isValidCPF } from '../lib/cpfValidation';

function CreatorRecurringContractsSection({
  recurringContracts,
  creatorId,
  contentPlanningItems,
  companies
}: {
  recurringContracts: RecurringContract[];
  creatorId: string;
  contentPlanningItems: ContentPlanningItem[];
  companies: Company[];
}) {
  const { formatCurrency } = usePrivacy();
  const [selectedItemForSubmit, setSelectedItemForSubmit] = useState<ContentPlanningItem | null>(null);
  const [selectedItemForBriefing, setSelectedItemForBriefing] = useState<ContentPlanningItem | null>(null);
  const [submissionUrl, setSubmissionUrl] = useState('');
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [caption, setCaption] = useState('');
  const [uploadMode, setUploadMode] = useState<'file' | 'link'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [selectedContractForModal, setSelectedContractForModal] = useState<RecurringContract | null>(null);

  const handleOpenSubmitModal = (item: ContentPlanningItem) => {
    setSelectedItemForSubmit(item);
    setSubmissionUrl(item.submissionUrl || item.mediaUrl || '');
    setSubmissionNotes(item.submissionNotes || '');
    setCaption(item.caption || '');
    setSelectedFile(null);
    setSelectedFileName('');
    setUploadProgress(0);
    setUploadMode(item.submissionUrl && !item.submissionUrl.startsWith('/uploads') ? 'link' : 'file');
    setSubmitSuccess(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 150 * 1024 * 1024) {
      alert('Aviso: O arquivo excede 150MB. Para arquivos muito grandes, utilize um link do Google Drive ou WeTransfer.');
      return;
    }

    setSelectedFile(file);
    setSelectedFileName(file.name);
  };

  const handleConfirmSubmission = async () => {
    if (!selectedItemForSubmit) return;
    
    if (uploadMode === 'file' && !selectedFile && !submissionUrl.trim()) {
      alert('Por favor, selecione um arquivo de vídeo ou informe o link.');
      return;
    }

    if (uploadMode === 'link' && !submissionUrl.trim()) {
      alert('Por favor, informe o link do material (Google Drive, Loom, YouTube, etc).');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(5);

    try {
      let finalSubmissionUrl = submissionUrl.trim();

      // If user selected a new file, upload it in chunks to backend with automated MP4 transcoding
      if (uploadMode === 'file' && selectedFile) {
        const uploadResult = await uploadFileInChunks(selectedFile, setUploadProgress);
        finalSubmissionUrl = uploadResult.url;
      }

      await updateDoc(doc(db, 'contentPlanning', selectedItemForSubmit.id), {
        status: 'review',
        submissionUrl: finalSubmissionUrl,
        submissionNotes: submissionNotes.trim(),
        caption: caption.trim(),
        submittedAt: new Date().toISOString(),
        feedbackNote: ''
      });

      try {
        await createNotification({
          title: 'Novo Conteúdo Recorrente Enviado 📹',
          message: `O conteúdo "${selectedItemForSubmit.title}" foi enviado para aprovação na aba de contratos recorrentes.`,
          type: 'contract',
          targetRole: 'admin',
          creatorId: creatorId,
          contractId: (selectedItemForSubmit as any).recurringContractId || (selectedItemForSubmit as any).contractId,
          link: '/recurring'
        });
      } catch (notifErr) {
        console.error("Error creating notification for recurring content submission:", notifErr);
      }

      setSubmitSuccess(true);
      setTimeout(() => {
        setSelectedItemForSubmit(null);
        setSubmitSuccess(false);
      }, 1500);
    } catch (err: any) {
      console.error('Erro ao enviar conteúdo para aprovação:', err);
      alert(err.message || 'Ocorreu um erro ao enviar o conteúdo. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const myContracts = recurringContracts.filter(c => 
    c.creators?.some(cr => cr.creatorId === creatorId)
  );

  if (myContracts.length === 0) {
    return (
      <div className="bg-white p-8 rounded-[20px] border border-slate-200/80 shadow-sm flex flex-col items-center justify-center text-center gap-3">
        <div className="p-3.5 bg-purple-50 text-purple-600 rounded-full">
          <Repeat size={24} />
        </div>
        <h4 className="text-base font-bold text-slate-800 m-0">Nenhum Contrato Recorrente Ativo</h4>
        <p className="text-xs text-slate-500 max-w-md leading-relaxed m-0">
          Este criador ainda não possui contratos recorrentes vinculados a nenhuma empresa. Trabalhos de demandas contínuas por empresa aparecem aqui automaticamente quando configurados no módulo de Contratos Recorrentes.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
            <Repeat size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 m-0">Trabalhos Recorrentes por Empresa ({myContracts.length})</h3>
            <p className="text-xs text-slate-500 m-0">Consulte o cachê, a cota mensal e envie os materiais de cada cliente</p>
          </div>
        </div>
      </div>

      {/* Lista de Contratos Recorrentes: Cada empresa com cabeçalho (cachê + cota) e tabela de entregáveis abaixo */}
      <div className="grid grid-cols-1 gap-6">
        {myContracts.map((contract) => {
          const cConfig = contract.creators?.find(cr => cr.creatorId === creatorId);
          if (!cConfig) return null;

          const company = companies.find(comp => comp.id === contract.companyId);
          const deliv = cConfig.monthlyDeliverables || {};
          
          const totalDeliverables = 
            (deliv.stories || 0) + (deliv.reels || 0) + (deliv.posts || 0) + 
            (deliv.tiktok || 0) + (deliv.youtube || 0) + (deliv.live || 0) + 
            (deliv.pinterest || 0) + (deliv.blog || 0) + (deliv.podcast || 0) + 
            (deliv.unboxing || 0) + (deliv.ugc || 0);

          const myPlanningItems = contentPlanningItems.filter(item => 
            item.recurringContractId === contract.id && item.creatorId === creatorId
          );

          return (
            <div 
              key={contract.id} 
              className="bg-white rounded-[24px] border border-slate-200 shadow-sm hover:border-purple-300 transition-all flex flex-col overflow-hidden"
            >
              {/* CABEÇALHO DA EMPRESA: Cachê e Cota do Mês */}
              <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col gap-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Identificação da Empresa */}
                  <div className="flex items-center gap-3.5">
                    <UserAvatar
                      src={company?.logo}
                      name={contract.companyName || company?.name}
                      size="custom"
                      shape="rounded-2xl"
                      className="w-14 h-14 border border-white/20 shadow-inner"
                      textClassName="text-lg"
                    />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-extrabold text-lg text-white m-0 tracking-tight">
                          {contract.companyName || company?.name || 'Empresa Parceira'}
                        </h4>
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border",
                          contract.status === 'active' 
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/30" 
                            : contract.status === 'paused' 
                            ? "bg-amber-500/20 text-amber-300 border-amber-400/30" 
                            : "bg-slate-500/20 text-slate-300 border-slate-400/30"
                        )}>
                          {contract.status === 'active' ? '● Contrato Ativo' : contract.status === 'paused' ? 'Pausado' : 'Finalizado'}
                        </span>
                      </div>
                      <span className="text-xs text-slate-300 block mt-1">
                        {contract.title} • Início em {new Date(contract.startDate).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  {/* Informações de Contrato: Cachê do Mês & Ações */}
                  <div className="flex items-center gap-3 flex-wrap lg:justify-end">
                    {/* Cachê do Mês */}
                    <div className="bg-white/10 backdrop-blur-md border border-white/15 px-4 py-2.5 rounded-2xl flex flex-col items-start lg:items-end">
                      <span className="text-[9px] font-extrabold uppercase text-purple-200 tracking-wider">Cachê do Mês</span>
                      <span className="text-xl font-black text-emerald-400">
                        {formatCurrency(cConfig.monthlyCache || cConfig.monthlyFee || 0)}<span className="text-xs font-semibold text-slate-300">/mês</span>
                      </span>
                    </div>

                    <button
                      onClick={() => setSelectedContractForModal(contract)}
                      className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                    >
                      <ExternalLink size={13} /> Detalhes do Contrato
                    </button>
                  </div>
                </div>

                {/* Cota do Mês: Badges dos formatos contratados */}
                <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-extrabold uppercase text-purple-200 tracking-wider">
                      Cota do Mês ({totalDeliverables} entregas contratadas/mês):
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(deliv.reels || 0) > 0 && (
                      <span className="bg-white/15 text-indigo-200 border border-white/20 px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1">
                        <Film size={13} className="text-indigo-300" /> {deliv.reels} Reels
                      </span>
                    )}
                    {(deliv.stories || 0) > 0 && (
                      <span className="bg-white/15 text-amber-200 border border-white/20 px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1">
                        <Instagram size={13} className="text-amber-300" /> {deliv.stories} Stories
                      </span>
                    )}
                    {(deliv.posts || 0) > 0 && (
                      <span className="bg-white/15 text-emerald-200 border border-white/20 px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1">
                        <Layers size={13} className="text-emerald-300" /> {deliv.posts} Feed Posts
                      </span>
                    )}
                    {(deliv.tiktok || 0) > 0 && (
                      <span className="bg-white/15 text-rose-200 border border-white/20 px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1">
                        <Clapperboard size={13} className="text-rose-300" /> {deliv.tiktok} TikToks
                      </span>
                    )}
                    {(deliv.youtube || 0) > 0 && (
                      <span className="bg-white/15 text-red-200 border border-white/20 px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1">
                        <Video size={13} className="text-red-300" /> {deliv.youtube} YouTube
                      </span>
                    )}
                    {(deliv.live || 0) > 0 && (
                      <span className="bg-white/15 text-purple-200 border border-white/20 px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1">
                        <Radio size={13} className="text-purple-300" /> {deliv.live} Lives
                      </span>
                    )}
                    {(deliv.pinterest || 0) > 0 && (
                      <span className="bg-white/15 text-pink-200 border border-white/20 px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1">
                        <Pin size={13} className="text-pink-300" /> {deliv.pinterest} Pins
                      </span>
                    )}
                    {(deliv.blog || 0) > 0 && (
                      <span className="bg-white/15 text-sky-200 border border-white/20 px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1">
                        <Newspaper size={13} className="text-sky-300" /> {deliv.blog} Artigos
                      </span>
                    )}
                    {(deliv.podcast || 0) > 0 && (
                      <span className="bg-white/15 text-violet-200 border border-white/20 px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1">
                        <Mic size={13} className="text-violet-300" /> {deliv.podcast} Podcasts
                      </span>
                    )}
                    {(deliv.unboxing || 0) > 0 && (
                      <span className="bg-white/15 text-fuchsia-200 border border-white/20 px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1">
                        <Package size={13} className="text-fuchsia-300" /> {deliv.unboxing} Unboxings
                      </span>
                    )}
                    {(deliv.ugc || 0) > 0 && (
                      <span className="bg-white/15 text-teal-200 border border-white/20 px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1">
                        <Camera size={13} className="text-teal-300" /> {deliv.ugc} UGCs
                      </span>
                    )}
                    {totalDeliverables === 0 && (
                      <span className="text-xs text-slate-300 italic">Cota livre / sob demanda</span>
                    )}
                  </div>
                </div>
              </div>

              {/* LISTA DE ENTREGÁVEIS: Tabela com Material, Formato, Data Limite, Briefing e Botão de Enviar */}
              <div className="p-5 sm:p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-purple-600" />
                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-900 m-0">
                      Lista de Entregáveis do Cronograma ({myPlanningItems.length})
                    </h5>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-bold text-slate-500">
                      {myPlanningItems.filter(i => i.status === 'published' || i.status === 'approved').length} de {myPlanningItems.length} concluídos
                    </span>
                  </div>
                </div>

                {myPlanningItems.length === 0 ? (
                  <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-8 text-center flex flex-col items-center justify-center gap-2">
                    <div className="p-2.5 bg-purple-50 text-purple-600 rounded-full">
                      <FileText size={20} />
                    </div>
                    <p className="text-xs font-bold text-slate-700 m-0">Nenhum entregável cadastrado no cronograma desta empresa ainda</p>
                    <span className="text-[11px] text-slate-500 max-w-sm leading-relaxed">
                      Assim que a agência adicionar os temas das pautas deste mês, os materiais aparecerão nesta tabela para você visualizar o briefing e enviar a gravação.
                    </span>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200/90 shadow-sm">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50/90 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200/80">
                          <th className="p-3.5 pl-5">Material</th>
                          <th className="p-3.5">Formato</th>
                          <th className="p-3.5">Data Limite</th>
                          <th className="p-3.5">Status</th>
                          <th className="p-3.5 text-center">Briefing</th>
                          <th className="p-3.5 text-right pr-5">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {myPlanningItems.map(item => {
                          const cfg = CONTENT_TYPE_CONFIG[item.contentType] || CONTENT_TYPE_CONFIG.other;
                          const IconC = cfg.icon;

                          return (
                            <tr key={item.id} className="hover:bg-purple-50/20 transition-colors">
                              {/* Coluna 1: Material */}
                              <td className="p-3.5 pl-5">
                                <div className="flex flex-col max-w-xs sm:max-w-sm">
                                  <span className="font-bold text-slate-900 text-sm leading-snug">{item.title}</span>
                                  {item.description && (
                                    <span className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{item.description}</span>
                                  )}
                                  {item.feedbackNote && (
                                    <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 w-fit">
                                      <AlertCircle size={10} /> Ajuste Solicitado
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Coluna 2: Formato */}
                              <td className="p-3.5">
                                <span className={cn("text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-md border flex items-center gap-1.5 w-fit whitespace-nowrap", cfg.bg, cfg.text, cfg.border)}>
                                  <IconC size={13} />
                                  {cfg.shortLabel}
                                </span>
                              </td>

                              {/* Coluna 3: Data Limite */}
                              <td className="p-3.5 text-slate-700 whitespace-nowrap">
                                <div className="flex items-center gap-1.5 font-semibold">
                                  <Calendar size={13} className="text-slate-400" />
                                  <span>{item.plannedDate ? new Date(item.plannedDate).toLocaleDateString('pt-BR') : 'A definir'}</span>
                                </div>
                              </td>

                              {/* Status */}
                              <td className="p-3.5 whitespace-nowrap">
                                <span className={cn(
                                  "px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border",
                                  item.status === 'published' ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                                  item.status === 'approved' ? "bg-indigo-100 text-indigo-800 border-indigo-200" :
                                  item.status === 'review' ? "bg-purple-100 text-purple-900 border-purple-200" :
                                  item.status === 'rejected' ? "bg-rose-100 text-rose-800 border-rose-200" :
                                  item.status === 'in_production' ? "bg-sky-100 text-sky-800 border-sky-200" :
                                  "bg-amber-50 text-amber-800 border-amber-200"
                                )}>
                                  {item.status === 'published' ? '🚀 Publicado' :
                                   item.status === 'approved' ? '✅ Aprovado' :
                                   item.status === 'review' ? '⏳ Em Aprovação' :
                                   item.status === 'rejected' ? '⚠️ Ajuste' :
                                   item.status === 'in_production' ? '🎬 Em Produção' : '📋 Planejado'}
                                </span>
                              </td>

                              {/* Coluna 4: Briefing (Botão Visualizar Briefing) */}
                              <td className="p-3.5 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => setSelectedItemForBriefing(item)}
                                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer border-none shadow-sm"
                                  title="Visualizar briefing e orientações criativas do material"
                                >
                                  <FileText size={13} className="text-purple-600" />
                                  <span>Briefing</span>
                                </button>
                              </td>

                              {/* Coluna 5: Botão de Enviar */}
                              <td className="p-3.5 text-right pr-5 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleOpenSubmitModal(item)}
                                  className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all inline-flex items-center gap-1.5 ml-auto cursor-pointer border-none"
                                >
                                  <UploadCloud size={13} />
                                  <span>{item.submissionUrl ? 'Reenviar' : 'Enviar'}</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Visualizar Briefing do Entregável Recorrente */}
      <AnimatePresence>
        {selectedItemForBriefing && (
          <div className="fixed inset-0 z-[1100] overflow-y-auto p-3 sm:p-4 flex items-center justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
              onClick={() => setSelectedItemForBriefing(null)}
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] my-auto z-10"
            >
              {/* Modal Header */}
              <div className="p-5 sm:p-6 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white flex items-start justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-purple-300 shrink-0">
                    <FileText size={24} />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
                      Briefing do Entregável Recorrente
                    </span>
                    <h3 className="text-lg font-bold text-white mt-1 m-0">{selectedItemForBriefing.title}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-300 flex-wrap">
                      <span className="flex items-center gap-1 font-semibold">
                        <Calendar size={12} className="text-purple-300" />
                        Prazo: {selectedItemForBriefing.plannedDate ? new Date(selectedItemForBriefing.plannedDate).toLocaleDateString('pt-BR') : 'A definir'}
                      </span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedItemForBriefing(null)}
                  className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 font-bold transition-all text-sm border-none cursor-pointer shrink-0"
                >
                  ✕
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 flex flex-col gap-5 overflow-y-auto flex-1 custom-scrollbar text-slate-700">
                {/* Description */}
                {selectedItemForBriefing.description && (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                    <span className="text-[10px] font-extrabold uppercase text-slate-900 tracking-wider block mb-1.5">
                      Objetivo / Descrição do Material:
                    </span>
                    <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed m-0">
                      {selectedItemForBriefing.description}
                    </p>
                  </div>
                )}

                {/* Briefing / Regras */}
                {selectedItemForBriefing.briefing && (
                  <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-100">
                    <span className="text-[10px] font-extrabold uppercase text-purple-950 tracking-wider flex items-center gap-1.5 mb-1.5">
                      <FileText size={13} className="text-purple-600" /> Briefing & Regras da Marca:
                    </span>
                    <p className="text-xs text-slate-800 whitespace-pre-line leading-relaxed m-0">
                      {selectedItemForBriefing.briefing}
                    </p>
                  </div>
                )}

                {/* Script / Roteiro */}
                {selectedItemForBriefing.script && (
                  <div className="bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100">
                    <span className="text-[10px] font-extrabold uppercase text-indigo-950 tracking-wider flex items-center gap-1.5 mb-1.5">
                      <BookOpen size={13} className="text-indigo-600" /> Roteiro Sugerido & Falas:
                    </span>
                    <p className="text-xs text-slate-800 whitespace-pre-line leading-relaxed m-0 font-mono text-[11px]">
                      {selectedItemForBriefing.script}
                    </p>
                  </div>
                )}

                {/* References */}
                {selectedItemForBriefing.references && (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <span className="text-[10px] font-extrabold uppercase text-slate-900 tracking-wider block mb-1.5">
                      Referências Visuais & Links de Inspiração:
                    </span>
                    <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed m-0">
                      {selectedItemForBriefing.references}
                    </p>
                  </div>
                )}

                {!selectedItemForBriefing.description && !selectedItemForBriefing.briefing && !selectedItemForBriefing.script && !selectedItemForBriefing.references && (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    Nenhuma instrução adicional detalhada foi cadastrada nesta pauta. Siga a cota contratada e seu estilo criativo.
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedItemForBriefing(null)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-300 transition-all border-none cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const itm = selectedItemForBriefing;
                    setSelectedItemForBriefing(null);
                    handleOpenSubmitModal(itm);
                  }}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all border-none cursor-pointer flex items-center gap-1.5 shadow-md shadow-purple-100"
                >
                  <UploadCloud size={14} /> Enviar Gravação Deste Material
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Submit Content for Approval */}
      <AnimatePresence>
        {selectedItemForSubmit && (
          <div className="fixed inset-0 z-[1100] overflow-y-auto p-3 sm:p-4 flex items-center justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
              onClick={() => setSelectedItemForSubmit(null)}
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] my-auto z-10"
            >
              {/* Header */}
              <div className="p-5 sm:p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 bg-purple-100 px-2.5 py-1 rounded-md">
                    Subir Conteúdo Recorrente para Aprovação
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-2 m-0">{selectedItemForSubmit.title}</h3>
                </div>
                <button 
                  onClick={() => setSelectedItemForSubmit(null)}
                  className="w-8 h-8 rounded-full bg-slate-200/60 text-slate-600 flex items-center justify-center hover:bg-slate-200 font-bold transition-all text-sm border-none cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="p-5 sm:p-6 flex flex-col gap-4 overflow-y-auto flex-1 custom-scrollbar">
                {submitSuccess ? (
                  <div className="py-8 flex flex-col items-center text-center gap-3">
                    <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                      <CheckCircle2 size={32} />
                    </div>
                    <h4 className="text-base font-bold text-slate-900 m-0">Conteúdo Enviado com Sucesso!</h4>
                    <p className="text-xs text-slate-500 max-w-xs m-0">
                      Seu material foi registrado com o status <strong>Em Aprovação</strong>. A agência e a empresa responsável serão notificadas para análise.
                    </p>
                  </div>
                ) : (
                  <>
                    {selectedItemForSubmit.feedbackNote && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-rose-700">Ajuste Solicitado Anteriormente:</span>
                        <p className="text-xs text-rose-900 m-0">{selectedItemForSubmit.feedbackNote}</p>
                      </div>
                    )}

                    {/* Briefing / Roteiro details for Creator reference */}
                    {(selectedItemForSubmit.briefing || selectedItemForSubmit.description || selectedItemForSubmit.script || selectedItemForSubmit.references) && (
                      <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-100 flex flex-col gap-2.5">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                          <BookOpen size={13} className="text-purple-600" /> Detalhes & Roteiro da Pauta
                        </span>

                        {selectedItemForSubmit.description && (
                          <div className="text-xs text-slate-700 leading-relaxed">
                            <strong className="text-slate-900 block text-[11px] mb-0.5">Descrição:</strong>
                            <p className="m-0 bg-white p-2.5 rounded-xl border border-purple-100/80 whitespace-pre-line">{selectedItemForSubmit.description}</p>
                          </div>
                        )}

                        {selectedItemForSubmit.briefing && (
                          <div className="text-xs text-slate-700 leading-relaxed">
                            <strong className="text-slate-900 block text-[11px] mb-0.5">Briefing / Regras da Marca:</strong>
                            <p className="m-0 bg-white p-2.5 rounded-xl border border-purple-100/80 whitespace-pre-line">{selectedItemForSubmit.briefing}</p>
                          </div>
                        )}

                        {selectedItemForSubmit.script && (
                          <div className="text-xs text-slate-700 leading-relaxed">
                            <strong className="text-slate-900 block text-[11px] mb-0.5">Roteiro Sugerido / Falas:</strong>
                            <p className="m-0 bg-white p-2.5 rounded-xl border border-purple-100/80 whitespace-pre-line">{selectedItemForSubmit.script}</p>
                          </div>
                        )}

                        {selectedItemForSubmit.references && (
                          <div className="text-xs text-slate-700 leading-relaxed">
                            <strong className="text-slate-900 block text-[11px] mb-0.5">Referências & Links de Inspiração:</strong>
                            <p className="m-0 bg-white p-2.5 rounded-xl border border-purple-100/80 whitespace-pre-line">{selectedItemForSubmit.references}</p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <UploadCloud size={14} className="text-purple-600" /> Forma de Envio da Mídia *
                        </span>
                      </label>

                      {/* Tab selector: Upload File vs Link */}
                      <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setUploadMode('file')}
                          className={cn(
                            "py-2 px-3 rounded-lg text-xs font-bold transition-all border-none cursor-pointer flex items-center justify-center gap-1.5",
                            uploadMode === 'file' 
                              ? "bg-white text-purple-900 shadow-sm" 
                              : "text-slate-600 hover:text-slate-900"
                          )}
                        >
                          <UploadCloud size={14} /> Upload de Vídeo/Arquivo
                        </button>
                        <button
                          type="button"
                          onClick={() => setUploadMode('link')}
                          className={cn(
                            "py-2 px-3 rounded-lg text-xs font-bold transition-all border-none cursor-pointer flex items-center justify-center gap-1.5",
                            uploadMode === 'link' 
                              ? "bg-white text-purple-900 shadow-sm" 
                              : "text-slate-600 hover:text-slate-900"
                          )}
                        >
                          <ExternalLink size={14} /> Link Externo (Drive/WeTransfer)
                        </button>
                      </div>

                      {uploadMode === 'file' ? (
                        <div className="flex flex-col gap-2 mt-1">
                          <label className="border-2 border-dashed border-purple-200 hover:border-purple-400 bg-purple-50/50 hover:bg-purple-50 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center">
                            <input 
                              type="file" 
                              accept="video/*,image/*"
                              onChange={handleFileUpload}
                              className="hidden"
                            />
                            <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                              <UploadCloud size={20} />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-purple-900 block">Clique para Selecionar o Vídeo / Mídia</span>
                              <span className="text-[10px] text-slate-500">Aceita vídeos (MP4, MOV, WebM) ou imagens</span>
                            </div>
                            {selectedFileName && (
                              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 mt-1">
                                📄 Arquivo selecionado: {selectedFileName}
                              </span>
                            )}
                          </label>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5 mt-1">
                          <input 
                            type="url"
                            placeholder="https://drive.google.com/... ou https://wetransfer.com/..."
                            value={submissionUrl}
                            onChange={(e) => setSubmissionUrl(e.target.value)}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-purple-600 focus:bg-white transition-all"
                          />
                          <span className="text-[10px] text-slate-400">
                            Insira o link do vídeo no Google Drive, Dropbox, Canva ou WeTransfer.
                          </span>
                        </div>
                      )}

                      {/* Video Player Preview if media url is present */}
                      {submissionUrl && (
                        <div className="mt-2 p-3 bg-slate-900 rounded-2xl flex flex-col gap-2">
                          <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1">
                            🎬 Pré-visualização da Mídia Enviada:
                          </span>
                          <SubmissionMediaPreview url={submissionUrl} maxHeight="max-h-[220px]" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1">
                        <FileText size={14} className="text-slate-500" /> Legenda Proposta (Opcional)
                      </label>
                      <textarea 
                        rows={3}
                        placeholder="Escreva aqui a legenda final sugerida para a publicação..."
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-purple-600 focus:bg-white transition-all resize-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1">
                        <MessageSquare size={14} className="text-slate-500" /> Observações / Comentários do Criador (Opcional)
                      </label>
                      <textarea 
                        rows={3}
                        placeholder="Deixe comentários adicionais para a agência/empresa (ex: sugestão de áudio, tags...)"
                        value={submissionNotes}
                        onChange={(e) => setSubmissionNotes(e.target.value)}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-purple-600 focus:bg-white transition-all resize-none"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              {!submitSuccess && (
                <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedItemForSubmit(null)}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-300 transition-all border-none cursor-pointer"
                  >
                    Cancelar
                  </button>
                  {isSubmitting && uploadProgress > 0 && (
                    <div className="w-full bg-purple-50 p-3 rounded-xl border border-purple-200 flex flex-col gap-1.5">
                      <div className="flex justify-between text-[11px] font-bold text-purple-900">
                        <span>{uploadProgress >= 95 ? 'Codificando e otimizando vídeo no servidor...' : 'Enviando arquivo em partes...'}</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-purple-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleConfirmSubmission}
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all border-none cursor-pointer flex items-center gap-1.5 shadow-md shadow-purple-100 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                        {uploadProgress > 0 ? `${uploadProgress}% Enviando...` : 'Enviando...'}
                      </>
                    ) : (
                      <>
                        <Send size={13} /> Enviar para Aprovação
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <RecurringContractDetailsModal
        contract={selectedContractForModal}
        isOpen={!!selectedContractForModal}
        onClose={() => setSelectedContractForModal(null)}
        companies={companies}
        planningItems={contentPlanningItems}
        onOpenSubmitModal={handleOpenSubmitModal}
        userRole="creator"
        creatorId={creatorId}
      />
    </div>
  );
}

export default function CreatorProfile() {
  const { formatCurrency, maskPII } = usePrivacy();
  const { id } = useParams<{ id: string }>();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'creator' | null>(null);
  const [checkingPermission, setCheckingPermission] = useState(true);

  // Active view simulation role: 'agency' (Agency Dashboard) / 'creator' (Creator Self Service)
  const [userRole, setUserRole] = useState<'agency' | 'creator'>('agency');

  // Creator Portal specific state variables
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'recurring' | 'campaigns' | 'portfolio' | 'about_me' | 'finance'>('dashboard');

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      if (tabParam === 'dashboard' || tabParam === 'overview' || tabParam === 'inicio') {
        setActiveTab('dashboard');
      } else if (tabParam === 'available_campaigns' || tabParam === 'available' || tabParam === 'disponiveis') {
        setActiveTab('campaigns');
        setCampaignSubTab('available');
      } else if (tabParam === 'campaigns' || tabParam === 'campanhas') {
        setActiveTab('campaigns');
      } else if (tabParam === 'recurring' || tabParam === 'contracts' || tabParam === 'recorrentes') {
        setActiveTab('recurring');
      } else if (tabParam === 'portfolio' || tabParam === 'midias') {
        setActiveTab('portfolio');
      } else if (tabParam === 'about_me' || tabParam === 'about' || tabParam === 'sobre') {
        setActiveTab('about_me');
      }
    }
  }, [searchParams]);

  const handleTabClick = (tab: 'dashboard' | 'recurring' | 'campaigns' | 'portfolio' | 'about_me') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };
  const [creatorCampaigns, setCreatorCampaigns] = useState<{ campaign: Campaign; participation: CampaignCreator }[]>([]);
  const [recurringContracts, setRecurringContracts] = useState<RecurringContract[]>([]);
  const [contentPlanningItems, setContentPlanningItems] = useState<ContentPlanningItem[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [selectedCampaignIndex, setSelectedCampaignIndex] = useState<number | null>(null);

  // Campaign material submission states
  const [scriptText, setScriptText] = useState('');
  const [publishedUrl, setPublishedUrl] = useState('');
  const [submittingFile, setSubmittingFile] = useState<File | null>(null);
  const [isSubmittingMaterial, setIsSubmittingMaterial] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState(0);

  const triggerReload = () => setReloadTrigger(prev => prev + 1);

  // Video uploading state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Active playing video url
  const [activePlayVideo, setActivePlayVideo] = useState<PortfolioVideo | null>(null);

  // Campaign quick-select
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [campaignSubTab, setCampaignSubTab] = useState<'my_campaigns' | 'available' | 'applications'>('my_campaigns');
  const [isApplyingModalOpen, setIsApplyingModalOpen] = useState(false);
  const [applyingCampaign, setApplyingCampaign] = useState<Campaign | null>(null);
  const [viewingBriefingCampaign, setViewingBriefingCampaign] = useState<Campaign | null>(null);
  const [isBriefingModalOpen, setIsBriefingModalOpen] = useState(false);
  const [applyingNotes, setApplyingNotes] = useState('');
  const [applyingAmount, setApplyingAmount] = useState<number>(0);
  const [isApplyingSubmit, setIsApplyingSubmit] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [quickAddStatus, setQuickAddStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  // Edit profile info states
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editArtisticName, setEditArtisticName] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [editWhatsApp, setEditWhatsApp] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editDocument, setEditDocument] = useState('');
  const [editPixKey, setEditPixKey] = useState('');
  const [editBankDetails, setEditBankDetails] = useState('');
  const [editInstagram, setEditInstagram] = useState('');
  const [editTikTok, setEditTikTok] = useState('');
  const [editYouTube, setEditYouTube] = useState('');
  const [editPriceStory, setEditPriceStory] = useState(0);
  const [editPriceReel, setEditPriceReel] = useState(0);
  const [editPricePost, setEditPricePost] = useState(0);
  const [editPriceCombo, setEditPriceCombo] = useState(0);
  const [editFollowers, setEditFollowers] = useState(0);
  const [editAvgViews, setEditAvgViews] = useState(0);
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [editAcceptsExchange, setEditAcceptsExchange] = useState<boolean>(true);
  const [editAcceptsPaidTraffic, setEditAcceptsPaidTraffic] = useState<boolean>(true);
  const [editAcceptsExclusivity, setEditAcceptsExclusivity] = useState<boolean>(false);
  const [editWorkAffinities, setEditWorkAffinities] = useState<string[]>([]);
  const [editBio, setEditBio] = useState<string>('');
  const [isContractModalOpen, setIsContractModalOpen] = useState<boolean>(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Autodetect if current logged user is this creator and fetch their role
  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const { isAdminEmail } = await import('../lib/firebase');
          if (isAdminEmail(user.email)) {
            setCurrentUserRole('admin');
            setCheckingPermission(false);
          } else {
            const { doc, getDoc } = await import('firebase/firestore');
            const creatorSnap = await getDoc(doc(db, 'creators', user.uid));
            if (creatorSnap.exists()) {
              const data = creatorSnap.data();
              const userRealRole = data.role === 'admin' ? 'admin' : 'creator';
              setCurrentUserRole(userRealRole);
              
              if (userRealRole === 'creator') {
                setUserRole('creator'); // Lock to creator view!
              }
            } else {
              setCurrentUserRole('creator');
              setUserRole('creator'); // Lock to creator view!
            }
            setCheckingPermission(false);
          }
        } catch (err) {
          console.error("Error getting user role in profile:", err);
          setCurrentUserRole('creator');
          setUserRole('creator');
          setCheckingPermission(false);
        }
      } else {
        setCurrentUserRole(null);
        setCheckingPermission(false);
      }
    });
  }, [id]);

  // Fetch creator data from firestore
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const unsub = onSnapshot(doc(db, 'creators', id), (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as Creator;
        setCreator(data);
        setError(null);

        // Pre-fill creator details for editing
        setEditFullName(data.fullName || '');
        setEditArtisticName(data.artisticName || '');
        setEditPhotoUrl(data.photoUrl || '');
        setEditWhatsApp(data.whatsapp || '');
        setEditCity(data.city || '');
        setEditState(data.state || '');
        setEditDocument(data.cpf ? formatCPF(data.cpf) : (data.document ? formatCPF(data.document) : ''));
        setEditPixKey(data.pixKey || '');
        setEditBankDetails(data.bankDetails || '');
        setEditInstagram(data.socials?.instagram || '');
        setEditTikTok(data.socials?.tiktok || '');
        setEditYouTube(data.socials?.youtube || '');
        setEditPriceStory(data.pricing?.story || 0);
        setEditPriceReel(data.pricing?.reel || 0);
        setEditPricePost(data.pricing?.post || 0);
        setEditPriceCombo(data.pricing?.combo || 0);
        setEditFollowers(data.metrics?.followers || 0);
        setEditAvgViews(data.metrics?.avgViews || 0);
        setEditCategories(data.categories || []);
        setEditAcceptsExchange(data.acceptsExchange !== undefined ? data.acceptsExchange : true);
        setEditAcceptsPaidTraffic(data.acceptsPaidTraffic !== undefined ? data.acceptsPaidTraffic : true);
        setEditAcceptsExclusivity(data.acceptsExclusivity !== undefined ? data.acceptsExclusivity : false);
        setEditWorkAffinities(data.workAffinities || []);
        setEditBio(data.bio || '');
        setLoading(false);
      } else {
        setError('O perfil do criador não foi encontrado no casting.');
        setLoading(false);
      }
    }, (err) => {
      console.error(err);
      setError('Ocorreu um erro ao carregar o perfil do criador.');
      setLoading(false);
    });

    return () => unsub();
  }, [id]);

  // Fetch active campaigns, companies, recurring contracts and content planning
  useEffect(() => {
    getDocs(collection(db, 'campaigns')).then(snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Campaign));
      // filter out finished campaigns
      setCampaigns(list.filter(c => c.status !== 'finished'));
    }).catch(err => console.error("Error loading campaigns", err));

    getDocs(collection(db, 'companies')).then(snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Company));
      setCompanies(list);
    }).catch(err => console.error("Error loading companies", err));

    const unsubRecurring = onSnapshot(collection(db, 'recurringContracts'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as RecurringContract));
      setRecurringContracts(list);
    }, (err) => console.warn("recurringContracts snapshot warning:", err));

    const unsubPlanning = onSnapshot(collection(db, 'contentPlanning'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ContentPlanningItem));
      setContentPlanningItems(list);
    }, (err) => console.warn("contentPlanning snapshot warning:", err));

    return () => {
      unsubRecurring();
      unsubPlanning();
    };
  }, []);

  // Fetch active participations of this creator in campaigns
  useEffect(() => {
    if (!id || !creator) return;
    setLoadingCampaigns(true);
    
    const fetchParticipations = async () => {
      try {
        const campaignsSnap = await getDocs(collection(db, 'campaigns'));
        const campaignsList = campaignsSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Campaign));
        
        const participations: { campaign: Campaign; participation: CampaignCreator }[] = [];
        
        for (const camp of campaignsList) {
          const creatorsSnap = await getDocs(collection(db, `campaigns/${camp.id}/creators`));
          const match = creatorsSnap.docs.find(d => d.data().creatorId === id);
          if (match) {
            participations.push({
              campaign: camp,
              participation: { id: match.id, ...match.data() } as CampaignCreator
            });
          }
        }
        
        setCreatorCampaigns(participations);
      } catch (err) {
        console.error("Erro ao buscar participações do criador:", err);
      } finally {
        setLoadingCampaigns(false);
      }
    };

    fetchParticipations();
  }, [id, creator, reloadTrigger]);

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const isVideoFile = (file: File) => {
    if (file.type && file.type.startsWith('video/')) return true;
    const ext = file.name.split('.').pop()?.toLowerCase();
    return ['mp4', 'mov', 'webm', 'mkv', 'avi', '3gp', 'm4v', 'ogv'].includes(ext || '');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (isVideoFile(file)) {
        if (file.size > 150 * 1024 * 1024) {
          alert('O arquivo de vídeo excede o limite máximo permitido de 150MB para upload.');
          return;
        }
        setUploadFile(file);
      } else {
        alert('Por favor, selecione apenas arquivos de vídeo (MP4, MOV, WEBM, etc).');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (isVideoFile(file)) {
        if (file.size > 150 * 1024 * 1024) {
          alert('O arquivo de vídeo excede o limite máximo permitido de 150MB para upload.');
          return;
        }
        setUploadFile(file);
      } else {
        alert('Por favor, selecione apenas arquivos de vídeo (MP4, MOV, WEBM, etc).');
      }
    }
  };

  // Helper function to upload file in chunks (with optional server-side auto-compression to MP4)
  const uploadFileInChunks = async (
    file: File, 
    onProgress: (percent: number) => void
  ): Promise<{ url: string; filename: string }> => {
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks to easily pass under any Cloud Run body limits
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId = Date.now() + "-" + Math.round(Math.random() * 1e9);

    for (let index = 0; index < totalChunks; index++) {
      const start = index * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const formData = new FormData();
      formData.append("chunk", chunk);
      formData.append("chunkIndex", index.toString());
      formData.append("totalChunks", totalChunks.toString());
      formData.append("uploadId", uploadId);
      formData.append("filename", file.name);

      const response = await fetch("/api/upload-chunk", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errMsg = `Falha no envio da parte ${index + 1} de ${totalChunks}.`;
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errMsg = errData.error;
          }
        } catch (_) {}
        throw new Error(errMsg);
      }

      const progressPercent = Math.round(((index + 1) / totalChunks) * 100);
      
      // Since server side video encoding takes a bit on the last chunk, we hold the progress at 95%
      if (index === totalChunks - 1) {
        onProgress(95);
      } else {
        onProgress(Math.min(progressPercent, 90));
      }

      if (index === totalChunks - 1) {
        const result = await response.json();
        onProgress(100);
        return result;
      }
    }

    throw new Error("Falha ao concluir o upload em partes.");
  };

  // Upload video file & save to creator portfolio array
  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creator || !uploadFile || !videoTitle.trim()) return;

    setIsUploading(true);
    setUploadProgress(5);

    try {
      const result = await uploadFileInChunks(uploadFile, setUploadProgress);
      
      // Update creator portfolio inside Firebase database
      const newVideo: PortfolioVideo = {
        id: crypto.randomUUID(),
        title: videoTitle,
        description: videoDescription,
        url: result.url,
        uploadedAt: new Date().toISOString()
      };

      const updatedPortfolio = [
        ...(creator.portfolio || []),
        newVideo
      ];

      await updateDoc(doc(db, 'creators', creator.id), {
        portfolio: updatedPortfolio
      });

      setUploadProgress(100);
      
      setTimeout(() => {
        // Reset state on completion
        setIsUploading(false);
        setUploadFile(null);
        setVideoTitle('');
        setVideoDescription('');
        setUploadProgress(0);
      }, 500);

    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Houve um erro no upload do vídeo do portfólio.');
      setIsUploading(false);
    }
  };

  // Remove video from list
  const handleRemoveVideo = async (videoId: string) => {
    if (!creator) return;
    if (!confirm('Deseja realmente remover este vídeo do portfólio?')) return;

    try {
      const updatedPortfolio = (creator.portfolio || []).filter(v => v.id !== videoId);
      await updateDoc(doc(db, 'creators', creator.id), {
        portfolio: updatedPortfolio
      });
    } catch (err) {
      console.error(err);
      alert('Falha ao deletar vídeo do portfólio.');
    }
  };

  // Save creator's complete professional profile details
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creator) return;

    const formattedCpf = editDocument.trim() ? formatCPF(editDocument) : '';
    if (editDocument.trim() && !isValidCPF(editDocument)) {
      alert('Por favor, informe um CPF válido no formato 000.000.000-00.');
      return;
    }

    const cleanArtisticName = editArtisticName.replace(/^@+/, '').trim() || creator.artisticName || creator.fullName;

    try {
      await updateDoc(doc(db, 'creators', creator.id), {
        fullName: editFullName.trim(),
        artisticName: cleanArtisticName,
        photoUrl: editPhotoUrl,
        whatsapp: editWhatsApp,
        city: editCity,
        state: editState,
        cpf: formattedCpf,
        document: formattedCpf,
        pixKey: editPixKey,
        bankDetails: editBankDetails,
        socials: {
          instagram: editInstagram,
          tiktok: editTikTok,
          youtube: editYouTube,
        },
        pricing: {
          story: Number(editPriceStory),
          reel: Number(editPriceReel),
          post: Number(editPricePost),
          combo: Number(editPriceCombo),
        },
        metrics: {
          followers: Number(editFollowers),
          avgViews: Number(editAvgViews),
          avgEngagement: creator.metrics?.avgEngagement || 4.5,
        },
        categories: editCategories,
        acceptsExchange: editAcceptsExchange,
        acceptsPaidTraffic: editAcceptsPaidTraffic,
        acceptsExclusivity: editAcceptsExclusivity,
        workAffinities: editWorkAffinities,
        bio: editBio
      });
      setIsEditingProfile(false);
      alert('Seu perfil comercial foi atualizado e consolidado com sucesso!');
    } catch (err: any) {
      console.error(err);
      alert('Falha ao atualizar dados de seu perfil no banco.');
    }
  };

  // Quick select campaign registration
  const handleQuickAddCreatorToCampaign = async () => {
    if (!creator || !selectedCampaignId) return;
    setQuickAddStatus('loading');

    try {
      // Find the selection campaign creators collection to register
      const targetCol = collection(db, 'campaigns', selectedCampaignId, 'creators');
      const docData = {
        campaignId: selectedCampaignId,
        creatorId: creator.id,
        deliveryType: 'Reels + Stories Combo',
        amount: creator.pricing?.combo || 1000,
        deliveryStatus: 'pending',
        paymentStatus: 'pending',
        notes: 'Adicionado diretamente pelo portfólio do criador.',
        signature: {
          status: 'pending'
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

      // Add as Document inside sub-collection
      // Wait, let's verify if addDoc is available
      const { addDoc: fAddDoc } = await import('firebase/firestore');
      await fAddDoc(targetCol, docData);

      setQuickAddStatus('success');
      setTimeout(() => {
        setQuickAddStatus('idle');
        setSelectedCampaignId('');
      }, 3000);

    } catch (err) {
      console.error(err);
      alert('Erro ao selecionar criador para a campanha.');
      setQuickAddStatus('idle');
    }
  };

  // Submit Campaign Materials (Script, Video, publishedLink)
  const handleSubmitCampaignMaterial = async (campaignId: string, participationId: string, submissionType?: 'script' | 'video' | 'published' | 'all') => {
    if (!creator) return;
    setIsSubmittingMaterial(true);
    setSubmissionProgress(15);
    try {
      let finalVideoUrl = '';
      if (submittingFile && (submissionType === 'video' || submissionType === 'all' || !submissionType)) {
        setSubmissionProgress(5);
        const resData = await uploadFileInChunks(submittingFile, setSubmissionProgress);
        finalVideoUrl = resData.url;
      }

      setSubmissionProgress(90);

      // We need to update the campaigns/${campaignId}/creators/${participationId} doc in firebase
      const { updateDoc: fUpdateDoc, doc: fDoc } = await import('firebase/firestore');
      const docRef = fDoc(db, 'campaigns', campaignId, 'creators', participationId);

      const updatePayload: any = {};
      const nowIso = new Date().toISOString();
      
      if (scriptText && (submissionType === 'script' || submissionType === 'all' || !submissionType)) {
        updatePayload['content.script'] = scriptText;
        updatePayload['scriptStatus'] = 'submitted';
        updatePayload['scriptSubmittedAt'] = nowIso;
        updatePayload['deliveryStatus'] = 'sent';
      }
      
      if (finalVideoUrl && (submissionType === 'video' || submissionType === 'all' || !submissionType)) {
        updatePayload['content.videoUrl'] = finalVideoUrl;
        updatePayload['videoStatus'] = 'submitted';
        updatePayload['videoSubmittedAt'] = nowIso;
        updatePayload['deliveryStatus'] = 'sent';
      }

      if (publishedUrl && (submissionType === 'published' || submissionType === 'all' || !submissionType)) {
        updatePayload['content.publishedLink'] = publishedUrl;
        updatePayload['deliveryStatus'] = 'published'; // Once published link is sent, mark as published
      }

      await fUpdateDoc(docRef, updatePayload);
      
      try {
        const compCampaign = campaigns.find(c => c.id === campaignId);
        const campName = compCampaign ? compCampaign.name : 'Campanha';
        const notifTitle = submissionType === 'script' 
          ? 'Roteiro Enviado para Aprovação ✍️' 
          : submissionType === 'video' 
            ? 'Vídeo Enviado para Aprovação 📹' 
            : 'Material Enviado para Revisão 📹';

        await createNotification({
          title: notifTitle,
          message: `@${creator.artisticName} enviou ${submissionType === 'script' ? 'o roteiro' : submissionType === 'video' ? 'a gravação do vídeo' : 'o material'} para avaliação na campanha "${campName}".`,
          type: 'delivery_review',
          targetRole: 'admin',
          creatorId: id,
          campaignId: campaignId,
          link: '/campaign-deliveries'
        });
      } catch (notifErr) {
        console.error("Error writing notification for material submission:", notifErr);
      }

      setSubmissionProgress(100);
      alert('Material enviado com sucesso para a análise da equipe!');
      
      // Reset states
      setSubmittingFile(null);
      setScriptText('');
      setPublishedUrl('');
      setIsSubmittingMaterial(false);
      setSubmissionProgress(0);
      triggerReload(); // reload campaigns list!
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao enviar material.');
      setIsSubmittingMaterial(false);
      setSubmissionProgress(0);
    }
  };

  // Handle creator application for a campaign
  const handleApplyCampaign = async () => {
    if (!id || !applyingCampaign || !creator) return;
    setIsApplyingSubmit(true);
    try {
      const { addDoc: fAddDoc, collection: fCollection } = await import('firebase/firestore');
      
      const campaignCreatorData = {
        campaignId: applyingCampaign.id,
        creatorId: id,
        deliveryType: 'Post + 3 Stories',
        amount: Number((applyingCampaign as any).creatorCache || creator.pricing?.combo || 250),
        deliveryDate: '',
        postDate: '',
        deliveryStatus: 'pending',
        paymentStatus: 'pending',
        notes: applyingNotes || '',
        applicationStatus: 'pending', // Pending approval from agency!
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

      await fAddDoc(fCollection(db, 'campaigns', applyingCampaign.id, 'creators'), campaignCreatorData);
      
      try {
        await createNotification({
          title: 'Nova Candidatura Recebida 👤',
          message: `@${creator.artisticName} se candidatou para a campanha "${applyingCampaign.name}" solicitando cachê de R$ ${campaignCreatorData.amount}.`,
          type: 'application',
          targetRole: 'admin',
          creatorId: id,
          campaignId: applyingCampaign.id,
          link: `/campaigns/${applyingCampaign.id}`
        });
      } catch (notifErr) {
        console.error("Error creating application notification:", notifErr);
      }
      
      setIsApplyingModalOpen(false);
      setApplyingCampaign(null);
      setApplyingNotes('');
      alert('Sua candidatura foi registrada com sucesso e aguarda aprovação da equipe de casting da agência.');
      triggerReload();
    } catch (err: any) {
      console.error("Error applying to campaign:", err);
      alert('Erro ao enviar candidatura.');
    } finally {
      setIsApplyingSubmit(false);
    }
  };

  if (loading || checkingPermission) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  if (currentUserRole === 'creator' && id !== currentUser?.uid) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-[#E2E8F0] shadow-sm text-center flex flex-col gap-4">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Acesso Restrito</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Como criador, você só tem permissão para acessar e gerenciar o seu próprio perfil profissional.
          </p>
          <Link
            to={`/creators/${currentUser?.uid}`}
            className="mt-2 w-full py-3 px-4 bg-brand-primary text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-600 transition-all text-center"
          >
            Ir para Meu Perfil
          </Link>
        </div>
      </div>
    );
  }

  if (error || !creator) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-[#E2E8F0] text-center max-w-lg mx-auto mt-12">
        <div className="text-red-500 bg-red-50 p-3 rounded-full mb-4">
          <Info size={28} />
        </div>
        <p className="font-bold text-[#0F172A] mb-2">Erro de Carregamento</p>
        <p className="text-sm text-[#64748B] mb-6">{error || 'Criador não localizado.'}</p>
        <Link to="/creators" className="bg-brand-primary text-white h-10 px-6 rounded-lg text-sm font-bold shadow-lg hover:bg-indigo-600 transition-all flex items-center gap-2">
          <ArrowLeft size={16} /> Voltar para Casting
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-24">
      
      {/* Simulation Banner Switch */}
      {currentUserRole === 'admin' && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg border border-indigo-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-400/30 shrink-0">
              <Key size={20} className="animate-pulse text-indigo-200" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-white m-0">Painel Admin • Chave de Troca de Usuário</h4>
                <span className="bg-indigo-500/30 text-indigo-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-indigo-400/30 uppercase tracking-wider">
                  VISUALIZANDO: @{creator?.artisticName || 'Criador'}
                </span>
              </div>
              <p className="text-xs text-slate-300 m-0 mt-0.5">
                Alterne entre qualquer criador do casting ou troque a visão entre o Painel Interno da Agência e o Portal do Criador.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full md:w-auto justify-end">
            {/* Quick Creator Switcher Dropdown */}
            <CreatorSwitcher currentCreatorId={creator?.id} variant="banner" />

            {/* Mode Toggle Buttons */}
            <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700">
              <button 
                onClick={() => setUserRole('agency')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all",
                  userRole === 'agency' ? "bg-purple-600 text-white shadow-md font-extrabold" : "text-slate-300 hover:text-white"
                )}
              >
                Painel Agência
              </button>
              <button 
                onClick={() => {
                  setUserRole('creator');
                  setActivePlayVideo(null);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all",
                  userRole === 'creator' ? "bg-purple-600 text-white shadow-md font-extrabold" : "text-slate-300 hover:text-white"
                )}
              >
                Visão Criador
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Status Banner if in review */}
      {creator.status === 'review' && (
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 border-2 border-amber-400/60 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-pulse">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Clock size={22} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-950 m-0">
                {(currentUserRole === 'admin' || userRole === 'agency') ? 'Criador Aguardando Aprovação de Cadastro' : 'Cadastro Sob Análise da Curadoria'}
              </h4>
              <p className="text-xs text-amber-800 m-0 mt-0.5 max-w-xl">
                {(currentUserRole === 'admin' || userRole === 'agency') 
                  ? 'Este influenciador se cadastrou pelo site e necessita da aprovação do administrador para ter seu perfil e candidaturas ativadas.' 
                  : 'Seu perfil foi recebido e está aguardando a aprovação do administrador para ficar 100% liberado para campanhas e marcas.'}
              </p>
            </div>
          </div>

          {(currentUserRole === 'admin' || userRole === 'agency') && (
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <button
                onClick={async () => {
                  try {
                    const { doc, updateDoc } = await import('firebase/firestore');
                    await updateDoc(doc(db, 'creators', creator.id), {
                      status: 'active'
                    });

                    try {
                      const { createNotification } = await import('../lib/notifications');
                      await createNotification({
                        title: 'Cadastro Aprovado! 🎉',
                        message: `Parabéns @${creator.artisticName || creator.fullName}! Seu perfil no Rocketz Creators foi aprovado. Você agora pode participar de campanhas e receber propostas de marcas.`,
                        type: 'approval',
                        targetRole: 'creator',
                        creatorId: creator.id,
                        link: `/creators/${creator.id}`
                      });
                    } catch (notifErr) {
                      console.warn("Could not create approval notification:", notifErr);
                    }

                    alert(`Criador @${creator.artisticName} aprovado com sucesso!`);
                  } catch (err: any) {
                    console.error(err);
                    alert("Erro ao aprovar criador.");
                  }
                }}
                className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Check size={16} />
                Aprovar Criador
              </button>
              <button
                onClick={async () => {
                  if (!confirm("Tem certeza que deseja recusar o cadastro deste criador?")) return;
                  try {
                    const { doc, updateDoc } = await import('firebase/firestore');
                    await updateDoc(doc(db, 'creators', creator.id), {
                      status: 'rejected'
                    });
                    alert("Criador recusado.");
                  } catch (err: any) {
                    console.error(err);
                    alert("Erro ao recusar criador.");
                  }
                }}
                className="px-3 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-bold rounded-xl transition-all border border-rose-200 cursor-pointer"
              >
                Recusar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Header Profile Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-4">
          {currentUserRole === 'admin' && (
            <Link to="/creators" className="text-[12px] font-bold text-[#64748B] hover:text-brand-primary flex items-center gap-2 transition-colors uppercase tracking-wider">
              <ArrowLeft size={14} /> Voltar para Casting
            </Link>
          )}
          <div className="flex items-center gap-4">
            <div className="relative group w-16 h-16 rounded-[16px] overflow-hidden shadow-sm shrink-0">
              <UserAvatar
                src={creator.photoUrl}
                name={creator.artisticName || creator.fullName}
                size="custom"
                shape="rounded-2xl"
                className="w-16 h-16 border border-[#E2E8F0]"
                textClassName="text-xl"
              />
              {userRole === 'creator' && (
                <label className="absolute inset-x-0 bottom-0 bg-black/70 py-1 cursor-pointer flex flex-col items-center justify-center text-[8px] font-bold text-white uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Alterar</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={async (e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        const formData = new FormData();
                        formData.append('photo', file);
                        try {
                          const res = await fetch('/api/upload', {
                            method: 'POST',
                            body: formData
                          });
                          if (!res.ok) {
                            let errMsg = 'Upload falhou';
                            try {
                              const errData = await res.json();
                              if (errData && errData.error) {
                                errMsg = errData.error;
                              }
                            } catch (_) {}
                            throw new Error(errMsg);
                          }
                          const uploadData = await res.json();
                          const { doc, updateDoc } = await import('firebase/firestore');
                          await updateDoc(doc(db, 'creators', creator.id), {
                            photoUrl: uploadData.url
                          });
                          alert('Foto de perfil atualizada com sucesso!');
                        } catch (err: any) {
                          console.error(err);
                          alert(err.message || 'Erro ao carregar a foto de perfil.');
                        }
                      }
                    }}
                  />
                </label>
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[26px] font-bold text-[#0F172A] m-0">@{creator.artisticName}</h1>
                
                {/* Status Badge */}
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider shrink-0 border",
                  creator.status === 'active' ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                  creator.status === 'review' ? "bg-amber-100 text-amber-800 border-amber-200" :
                  creator.status === 'paused' ? "bg-slate-100 text-slate-800 border-slate-200" :
                  "bg-red-100 text-red-800 border-red-200"
                )}>
                  {creator.status === 'active' ? 'ATIVO' : 
                   creator.status === 'review' ? 'ANÁLISE' : 
                   creator.status === 'paused' ? 'PAUSADO' : 'RECUSADO'}
                </span>

                {/* Role Badge */}
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider shrink-0 border",
                  creator.role === 'admin' ? "bg-purple-100 text-purple-800 border-purple-200" : "bg-blue-100 text-blue-800 border-blue-200"
                )}>
                  {creator.role === 'admin' ? 'ADMIN' : 'INFLUENCIADOR'}
                </span>
              </div>
              <p className="text-[14px] text-[#64748B] font-medium m-0 mt-0.5">{creator.fullName} • {creator.city}, {creator.state}</p>
            </div>
          </div>
        </div>

        {userRole === 'agency' ? (
          /* Agency Option Panel (Campaign Add + Access Control) */
          <div className="flex flex-col md:flex-row gap-4 items-stretch">
            {/* Quick Add Campaign */}
            <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col gap-2 min-w-[260px] justify-center">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1">
                <FolderPlus size={11} className="text-brand-primary" /> Selecionar para Campanha
              </span>
              <div className="flex gap-2">
                <select 
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                  disabled={quickAddStatus === 'loading' || quickAddStatus === 'success'}
                  className="flex-1 bg-white border border-[#E2E8F0] text-xs font-bold rounded-lg px-2 py-2 outline-none"
                >
                  <option value="">Selecione...</option>
                  {campaigns.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button 
                  onClick={handleQuickAddCreatorToCampaign}
                  disabled={!selectedCampaignId || quickAddStatus === 'loading' || quickAddStatus === 'success'}
                  className={cn(
                    "h-9 px-3 rounded-lg text-xs font-bold text-white transition-all shrink-0 flex items-center justify-center gap-1.5",
                    quickAddStatus === 'success' 
                      ? "bg-emerald-600 shadow-emerald-100" 
                      : "bg-brand-primary shadow-indigo-100 hover:bg-indigo-600 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                  )}
                >
                  {quickAddStatus === 'loading' && <span className="w-4 h-4 rounded-full border-t border-b border-white animate-spin" />}
                  {quickAddStatus === 'success' && <Check size={14} />}
                  {quickAddStatus === 'idle' && 'Adicionar'}
                </button>
              </div>
              {quickAddStatus === 'success' && (
                <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider text-center block animate-pulse">
                  Criador adicionado com sucesso!
                </span>
              )}
            </div>

            {/* Access and Status Control Panel */}
            <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col gap-2 min-w-[320px] justify-center">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1">
                <UserCheck size={11} className="text-purple-600" /> Controle de Acesso & Status (Admin)
              </span>
              <div className="grid grid-cols-2 gap-2">
                {/* Role Switcher */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-[#64748B] font-bold uppercase tracking-wide">Função / Permissão</label>
                  <select
                    value={creator.role || 'creator'}
                    onChange={async (e) => {
                      const newRole = e.target.value;
                      try {
                        const { doc, updateDoc } = await import('firebase/firestore');
                        await updateDoc(doc(db, 'creators', creator.id), {
                          role: newRole
                        });
                      } catch (err) {
                        console.error("Error updating role:", err);
                        alert("Não foi possível alterar a função.");
                      }
                    }}
                    className="bg-white border border-[#E2E8F0] text-xs font-semibold rounded-lg px-2 py-1.5 outline-none cursor-pointer"
                  >
                    <option value="creator">Influenciador</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                {/* Status Switcher */}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-[#64748B] font-bold uppercase tracking-wide">Status de Casting</label>
                  <select
                    value={creator.status || 'review'}
                    onChange={async (e) => {
                      const newStatus = e.target.value;
                      try {
                        const { doc, updateDoc } = await import('firebase/firestore');
                        await updateDoc(doc(db, 'creators', creator.id), {
                          status: newStatus
                        });
                      } catch (err) {
                        console.error("Error updating status:", err);
                        alert("Não foi possível alterar o status.");
                      }
                    }}
                    className="bg-white border border-[#E2E8F0] text-xs font-semibold rounded-lg px-2 py-1.5 outline-none cursor-pointer"
                  >
                    <option value="active">Ativo</option>
                    <option value="review">Em Revisão</option>
                    <option value="paused">Pausado</option>
                    <option value="rejected">Recusado</option>
                  </select>
                </div>
              </div>

              {/* Admin Actions: Password & Edit Profile */}
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setIsChangePasswordModalOpen(true)}
                  className="py-1.5 px-3 bg-purple-50 hover:bg-purple-100 text-brand-primary border border-purple-200 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <KeyRound size={13} />
                  Alterar Senha
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(!isEditingProfile)}
                  className={cn(
                    "py-1.5 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer",
                    isEditingProfile 
                      ? "bg-slate-900 text-white shadow-xs" 
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                  )}
                >
                  <UserCheck size={13} />
                  {isEditingProfile ? 'Ver Portfolio' : 'Editar Perfil'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="py-2 px-4 bg-brand-primary/5 border border-brand-primary/10 rounded-xl text-brand-primary text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <Smartphone size={16} /> Você está logado como @{creator.artisticName}
            </div>
            <button
              type="button"
              onClick={() => setIsChangePasswordModalOpen(true)}
              className="py-2 px-3 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <KeyRound size={14} className="text-brand-primary" /> Alterar Minha Senha
            </button>
            <button
              onClick={() => setIsEditingProfile(!isEditingProfile)}
              className="py-2 px-4 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-slate-800 transition-all shadow-md cursor-pointer active:scale-95"
            >
              <UserCheck size={16} /> {isEditingProfile ? 'Ver Portfolio & Vídeos' : 'Completar Perfil Profissional'}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Sidebar Info Section */}
        {userRole === 'agency' && (
          <div className="lg:col-span-1 flex flex-col gap-6">
            
            {/* Main Info Card */}
            <div className="bg-white p-6 rounded-[16px] border border-[#E2E8F0] shadow-sm flex flex-col gap-6">
              <h3 className="text-[14px] font-bold text-[#0F172A] border-b border-[#F1F5F9] pb-3 uppercase tracking-wider">Métricas Sociais</h3>
              
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Instagram size={16} className="text-pink-600" />
                    <span className="text-[13px] text-[#64748B]">Seguidores</span>
                  </div>
                  <span className="text-[14px] font-bold text-[#0F172A]">{formatNumber(editFollowers || creator.metrics?.followers || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Play size={16} className="text-indigo-600" />
                    <span className="text-[13px] text-[#64748B]">Média de Views</span>
                  </div>
                  <span className="text-[14px] font-bold text-[#0F172A]">{formatNumber(editAvgViews || creator.metrics?.avgViews || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tv size={16} className="text-emerald-600" />
                    <span className="text-[13px] text-[#64748B]">Engajamento</span>
                  </div>
                  <span className="text-[14px] font-bold text-brand-primary">{creator.metrics?.avgEngagement || 4.5}%</span>
                </div>
              </div>

              <h3 className="text-[14px] font-bold text-[#0F172A] border-b border-[#F1F5F9] pt-3 pb-3 uppercase tracking-wider">Tabelas de Cache</h3>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#64748B]">Story</span>
                  <span className="text-[14px] font-semibold text-[#0F172A]">{formatCurrency(editPriceStory || creator.pricing?.story || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#64748B]">Reels</span>
                  <span className="text-[14px] font-semibold text-[#0F172A]">{formatCurrency(editPriceReel || creator.pricing?.reel || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#64748B]">Feed Post</span>
                  <span className="text-[14px] font-semibold text-[#0F172A]">{formatCurrency(editPricePost || creator.pricing?.post || 0)}</span>
                </div>
                <div className="pt-3 border-t border-[#F1F5F9] flex items-center justify-between">
                  <span className="text-[13px] font-bold text-brand-primary">Combo Comercial</span>
                  <span className="text-[18px] font-bold text-brand-primary">{formatCurrency(editPriceCombo || creator.pricing?.combo || 0)}</span>
                </div>
              </div>

              <h3 className="text-[14px] font-bold text-[#0F172A] border-b border-[#F1F5F9] pt-3 pb-3 uppercase tracking-wider">Contato & Info</h3>
              <div className="flex flex-col gap-3 text-xs leading-relaxed text-[#475569]">
                <div>
                  <span className="font-bold text-[#64748B] block text-[9px] uppercase tracking-wide">Email</span>
                  <span>{maskPII(creator.email, 'email')}</span>
                </div>
                <div>
                  <span className="font-bold text-[#64748B] block text-[9px] uppercase tracking-wide">WhatsApp</span>
                  <span>{maskPII(editWhatsApp || creator.whatsapp, 'phone') || 'Não informado'}</span>
                </div>
                {creator.categories && creator.categories.length > 0 && (
                  <div>
                    <span className="font-bold text-[#64748B] block text-[9px] uppercase tracking-wide">Nicho / Categorias</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {creator.categories.map(c => (
                        <span key={c} className="text-[10px] uppercase font-bold text-[#0F172A] bg-slate-100 px-2 py-0.5 rounded">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="pt-2.5 border-t border-[#F1F5F9] mt-1.5">
                  <span className="font-bold text-[#64748B] block text-[9px] uppercase tracking-wide mb-1.5">Afinidades & Preferências</span>
                  <div className="flex flex-wrap gap-1">
                    {creator.acceptsExchange && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                        ✓ Permuta
                      </span>
                    )}
                    {creator.acceptsPaidTraffic && (
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                        ✓ Tráfego Pago
                      </span>
                    )}
                    {creator.acceptsExclusivity && (
                      <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-full">
                        ✓ Exclusividade
                      </span>
                    )}
                    {creator.workAffinities && creator.workAffinities.map(aff => (
                      <span key={aff} className="text-[10px] font-bold text-slate-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                        ✓ {aff}
                      </span>
                    ))}
                    {!creator.acceptsExchange && !creator.acceptsPaidTraffic && !creator.acceptsExclusivity && (!creator.workAffinities || creator.workAffinities.length === 0) && (
                      <span className="text-slate-400 italic text-[11px]">Nenhuma preferência comercial cadastrada</span>
                    )}
                  </div>
                </div>

                {/* Termo & Conformidade Jurídica */}
                <div className="pt-3 border-t border-[#F1F5F9] mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[#64748B] text-[9px] uppercase tracking-wide flex items-center gap-1">
                      <Scale size={12} className="text-purple-600" />
                      Termo Oficial de Adesão & Imagem
                    </span>
                    {creator.contractAcceptance ? (
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 size={10} /> Assinado
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        Pendente
                      </span>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col gap-2">
                    <div className="flex items-start justify-between text-xs">
                      <span className="text-slate-500 font-medium">Contrato Digital Rocket:</span>
                      <span className="font-bold text-slate-800">
                        {creator.contractAcceptance ? `Versão ${creator.contractAcceptance.version}` : 'Versão 2.4 (Padrão)'}
                      </span>
                    </div>

                    {creator.contractAcceptance && (
                      <div className="text-[11px] text-slate-500 flex flex-col gap-1 border-t border-slate-200/60 pt-2">
                        <div className="flex justify-between">
                          <span>Data do Aceite:</span>
                          <span className="font-semibold text-slate-700">
                            {creator.contractAcceptance.formattedDate || new Date(creator.contractAcceptance.acceptedAt).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        {creator.contractAcceptance.document && (
                          <div className="flex justify-between">
                            <span>Documento:</span>
                            <span className="font-mono text-slate-700">{creator.contractAcceptance.document}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-[10px]">
                          <span>ID de Auditoria:</span>
                          <span className="font-mono text-purple-700">{creator.contractAcceptance.termId}</span>
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setIsContractModalOpen(true)}
                      className="w-full mt-1 py-2 px-3 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-purple-700 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <FileText size={13} />
                      {creator.contractAcceptance ? 'Ver Termo Completo & Auditoria' : 'Assinar Termo Oficial'}
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* Portfolio Content Tabs & Layout */}
        <div className={cn("flex flex-col gap-8", userRole === 'agency' ? "lg:col-span-2" : "lg:col-span-3")}>
          
          {isEditingProfile ? (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-8 rounded-[16px] border border-[#E2E8F0] shadow-sm flex flex-col gap-8"
            >
              <div>
                <h3 className="text-[20px] font-bold text-[#0F172A] flex items-center gap-2">
                  <UserCheck size={22} className="text-brand-primary" /> Dados do Perfil Profissional
                </h3>
                <p className="text-[12px] text-[#64748B] mt-1">Complete seus dados, canais sociais, precificação comercial e informações de faturamento na agência para se destacar para as marcas parceiras.</p>
              </div>

              <form onSubmit={handleSaveProfile} className="flex flex-col gap-6">
                
                {/* Secao 1: Dados Pessoais */}
                <div className="flex flex-col gap-4">
                  <h4 className="text-sm font-bold text-[#0F172A] border-b border-[#F1F5F9] pb-2 uppercase tracking-wider text-[11px] text-brand-primary">1. Informações Básicas & Arroba (@)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Nome Completo</label>
                      <input 
                        required
                        type="text" 
                        value={editFullName}
                        onChange={(e) => setEditFullName(e.target.value)}
                        className="w-full h-11 px-4 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                        Nome Artístico / @ (Arroba do Criador)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">@</span>
                        <input 
                          required
                          type="text" 
                          placeholder="ex: juliana.fit"
                          value={editArtisticName}
                          onChange={(e) => setEditArtisticName(e.target.value.replace(/^@+/, ''))}
                          className="w-full h-11 pl-8 pr-4 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm font-semibold"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">WhatsApp de Contato</label>
                      <input 
                        required
                        type="text" 
                        value={editWhatsApp}
                        onChange={(e) => setEditWhatsApp(e.target.value)}
                        className="w-full h-11 px-4 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Cidade</label>
                      <input 
                        required
                        type="text" 
                        value={editCity}
                        onChange={(e) => setEditCity(e.target.value)}
                        className="w-full h-11 px-4 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Estado (UF)</label>
                      <input 
                        required
                        maxLength={2}
                        type="text" 
                        placeholder="Ex: SP"
                        value={editState}
                        onChange={(e) => setEditState(e.target.value.toUpperCase())}
                        className="w-full h-11 px-4 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">CPF do Criador</label>
                        {editDocument && (
                          <span className={`text-[10px] font-bold ${isValidCPF(editDocument) ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {isValidCPF(editDocument) ? '✓ CPF Válido' : '000.000.000-00'}
                          </span>
                        )}
                      </div>
                      <input 
                        type="text" 
                        maxLength={14}
                        placeholder="000.000.000-00"
                        value={editDocument}
                        onChange={(e) => setEditDocument(formatCPF(e.target.value))}
                        className={`w-full h-11 px-4 rounded-lg border outline-none text-sm transition-all ${
                          editDocument && !isValidCPF(editDocument) && editDocument.length === 14
                            ? 'border-rose-400 bg-rose-50/20 focus:border-rose-600'
                            : 'border-[#E2E8F0] focus:border-brand-primary'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 mt-2">
                    <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Foto de Perfil</label>
                    <div className="flex gap-3">
                      <input 
                        type="text" 
                        value={editPhotoUrl}
                        onChange={(e) => setEditPhotoUrl(e.target.value)}
                        placeholder="Cole a URL da foto ou faça o upload..."
                        className="flex-1 h-11 px-4 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = async (event: any) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              const formData = new FormData();
                              formData.append('photo', file);
                              try {
                                const res = await fetch('/api/upload', { method: 'POST', body: formData });
                                if (!res.ok) throw new Error('Upload falhou');
                                const resData = await res.json();
                                setEditPhotoUrl(resData.url);
                                alert('Foto de perfil carregada com sucesso!');
                              } catch (err) {
                                alert('Erro ao enviar imagem');
                              }
                            }
                          };
                          input.click();
                        }}
                        className="h-11 px-5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase rounded-lg transition shrink-0"
                      >
                        Enviar Imagem
                      </button>
                    </div>
                  </div>
                </div>

                {/* Secao 2: Redes Sociais e Metricas */}
                <div className="flex flex-col gap-4">
                  <h4 className="text-sm font-bold text-[#0F172A] border-b border-[#F1F5F9] pb-2 uppercase tracking-wider text-[11px] text-brand-primary">2. Conexões e Métricas de Audiência</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Instagram (@usuario)</label>
                      <input 
                        type="text" 
                        placeholder="Ex: @joaosilva"
                        value={editInstagram}
                        onChange={(e) => setEditInstagram(e.target.value)}
                        className="w-full h-11 px-4 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">TikTok (@usuario)</label>
                      <input 
                        type="text" 
                        placeholder="Ex: @joaosilva"
                        value={editTikTok}
                        onChange={(e) => setEditTikTok(e.target.value)}
                        className="w-full h-11 px-4 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">YouTube (Canal)</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Joao Silva Tech"
                        value={editYouTube}
                        onChange={(e) => setEditYouTube(e.target.value)}
                        className="w-full h-11 px-4 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Total de Seguidores</label>
                      <input 
                        type="number" 
                        value={editFollowers}
                        onChange={(e) => setEditFollowers(Number(e.target.value))}
                        className="w-full h-11 px-4 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Média de Views p/ Vídeo</label>
                      <input 
                        type="number" 
                        value={editAvgViews}
                        onChange={(e) => setEditAvgViews(Number(e.target.value))}
                        className="w-full h-11 px-4 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Secao 3: Precos de Tabela */}
                <div className="flex flex-col gap-4">
                  <h4 className="text-sm font-bold text-[#0F172A] border-b border-[#F1F5F9] pb-2 uppercase tracking-wider text-[11px] text-brand-primary">3. Valores Comerciais (Tabela de Cache)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Valor Story (R$)</label>
                      <input 
                        type="number" 
                        value={editPriceStory}
                        onChange={(e) => setEditPriceStory(Number(e.target.value))}
                        className="w-full h-11 px-3 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Valor Reels (R$)</label>
                      <input 
                        type="number" 
                        value={editPriceReel}
                        onChange={(e) => setEditPriceReel(Number(e.target.value))}
                        className="w-full h-11 px-3 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Valor Post (R$)</label>
                      <input 
                        type="number" 
                        value={editPricePost}
                        onChange={(e) => setEditPricePost(Number(e.target.value))}
                        className="w-full h-11 px-3 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Valor Combo (R$)</label>
                      <input 
                        type="number" 
                        value={editPriceCombo}
                        onChange={(e) => setEditPriceCombo(Number(e.target.value))}
                        className="w-full h-11 px-3 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Secao 4: Dados Financeiros (PIX / Banco) */}
                <div className="flex flex-col gap-4">
                  <h4 className="text-sm font-bold text-[#0F172A] border-b border-[#F1F5F9] pb-2 uppercase tracking-wider text-[11px] text-brand-primary">4. Dados para Pagamento</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Chave PIX</label>
                      <input 
                        type="text" 
                        placeholder="E-mail, CPF, Celular ou Chave Aleatória"
                        value={editPixKey}
                        onChange={(e) => setEditPixKey(e.target.value)}
                        className="w-full h-11 px-4 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Dados Bancários Completos</label>
                      <input 
                        type="text" 
                        placeholder="Banco, Agência, Conta Corrente e Tipo"
                        value={editBankDetails}
                        onChange={(e) => setEditBankDetails(e.target.value)}
                        className="w-full h-11 px-4 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Secao 5: Categorias, Bio e Afinidades Comerciais */}
                <div className="flex flex-col gap-6">
                  <h4 className="text-sm font-bold text-[#0F172A] border-b border-[#F1F5F9] pb-2 uppercase tracking-wider text-[11px] text-brand-primary">5. Apresentação, Nichos e Afinidades de Trabalho</h4>
                  
                  {/* Bio Area */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Biografia / Apresentação Profissional</label>
                    <textarea 
                      rows={3}
                      placeholder="Fale brevemente sobre quem você é, seu estilo de conteúdo e o público que você atinge..."
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      className="w-full p-4 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm font-medium resize-none leading-relaxed"
                    />
                  </div>

                  {/* Categories Multiselect Grid */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Nicho / Categorias de Trabalho (Selecione as que combinam com seu perfil)</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {[
                        'Beleza', 'Moda', 'Fitness & Saúde', 'Lifestyle', 'UGC Content', 
                        'Tecnologia', 'Finanças', 'Gastronomia', 'Viagem', 'Maternidade', 
                        'Decoração', 'Humor'
                      ].map((category) => {
                        const isSelected = editCategories.includes(category);
                        return (
                          <button
                            key={category}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setEditCategories(editCategories.filter(c => c !== category));
                              } else {
                                setEditCategories([...editCategories, category]);
                              }
                            }}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-xs font-semibold transition-all border cursor-pointer",
                              isSelected 
                                ? "bg-[#4F46E5] text-white border-[#4F46E5] shadow-sm" 
                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                            )}
                          >
                            {isSelected ? '✓ ' : '+ '} {category}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Core Switch / Checkboxes for commercial permissions */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Afinidades e Condições Básicas</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-1">
                      
                      {/* Permuta checkbox */}
                      <label className="flex items-center gap-3 p-3.5 rounded-xl border border-[#E2E8F0] bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={editAcceptsExchange}
                          onChange={(e) => setEditAcceptsExchange(e.target.checked)}
                          className="h-4 w-4 text-[#4F46E5] focus:ring-[#4F46E5] border-slate-300 rounded cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-[#0F172A]">Aceita Permuta</span>
                          <span className="text-[10px] text-[#64748B] font-medium leading-tight">Receber produtos como cachê</span>
                        </div>
                      </label>

                      {/* Tráfego Pago checkbox */}
                      <label className="flex items-center gap-3 p-3.5 rounded-xl border border-[#E2E8F0] bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={editAcceptsPaidTraffic}
                          onChange={(e) => setEditAcceptsPaidTraffic(e.target.checked)}
                          className="h-4 w-4 text-[#4F46E5] focus:ring-[#4F46E5] border-slate-300 rounded cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-[#0F172A]">Tráfego Pago Autorizado</span>
                          <span className="text-[10px] text-[#64748B] font-medium leading-tight">Uso de imagem em anúncios patrocinados</span>
                        </div>
                      </label>

                      {/* Exclusividade checkbox */}
                      <label className="flex items-center gap-3 p-3.5 rounded-xl border border-[#E2E8F0] bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={editAcceptsExclusivity}
                          onChange={(e) => setEditAcceptsExclusivity(e.target.checked)}
                          className="h-4 w-4 text-[#4F46E5] focus:ring-[#4F46E5] border-slate-300 rounded cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-[#0F172A]">Disposto a Exclusividade</span>
                          <span className="text-[10px] text-[#64748B] font-medium leading-tight">Fidelidade exclusiva ao mesmo segmento</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Additional Work Affinities */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Outras Afinidades e Formatos de Trabalho</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {[
                        'Contratos de Longo Prazo', 'Presença VIP', 'Publipost / Feed', 
                        'Stories com Link', 'Embaixador de Marca', 'Produção de Vídeo UGC', 
                        'Provador de Moda', 'Resenha / Review de Produto'
                      ].map((affinity) => {
                        const isSelected = editWorkAffinities.includes(affinity);
                        return (
                          <button
                            key={affinity}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setEditWorkAffinities(editWorkAffinities.filter(a => a !== affinity));
                              } else {
                                setEditWorkAffinities([...editWorkAffinities, affinity]);
                              }
                            }}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-xs font-semibold transition-all border cursor-pointer",
                              isSelected 
                                ? "bg-[#4F46E5] text-white border-[#4F46E5] shadow-sm" 
                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                            )}
                          >
                            {isSelected ? '✓ ' : '+ '} {affinity}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[#F1F5F9]">
                  <button 
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="h-11 px-6 rounded-lg text-xs font-bold uppercase tracking-wider text-[#64748B] bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer border-none"
                  >
                    Voltar / Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="h-11 px-8 rounded-lg text-xs font-bold uppercase tracking-wider text-white bg-brand-primary hover:bg-indigo-600 transition-all shadow-md shadow-indigo-100 cursor-pointer border-none"
                  >
                    Salvar e Enviar Dados
                  </button>
                </div>

              </form>
            </motion.div>
          ) : (
            <>
              {/* Tab navigation for simulated Creator role */}
              {userRole === 'creator' && (
                <div className="flex bg-slate-100 p-1 rounded-xl mb-6 border border-slate-200/60 max-w-3xl overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => handleTabClick('dashboard')}
                    className={cn(
                      "flex-1 min-w-[120px] py-2 px-3 rounded-lg text-[11px] font-bold uppercase transition-all tracking-wider flex items-center justify-center gap-1.5 border-none cursor-pointer whitespace-nowrap",
                      activeTab === 'dashboard' ? "bg-white text-indigo-600 shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"
                    )}
                  >
                    <Home size={14} /> Início / Central
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabClick('recurring')}
                    className={cn(
                      "flex-1 min-w-[110px] py-2 px-3 rounded-lg text-[11px] font-bold uppercase transition-all tracking-wider flex items-center justify-center gap-1.5 border-none cursor-pointer whitespace-nowrap",
                      activeTab === 'recurring' ? "bg-white text-purple-600 shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"
                    )}
                  >
                    <Repeat size={14} /> Recorrentes
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabClick('campaigns')}
                    className={cn(
                      "flex-1 min-w-[110px] py-2 px-3 rounded-lg text-[11px] font-bold uppercase transition-all tracking-wider flex items-center justify-center gap-1.5 border-none cursor-pointer whitespace-nowrap",
                      activeTab === 'campaigns' ? "bg-white text-indigo-600 shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"
                    )}
                  >
                    <Megaphone size={14} /> Campanhas
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabClick('portfolio')}
                    className={cn(
                      "flex-1 min-w-[130px] py-2 px-3 rounded-lg text-[11px] font-bold uppercase transition-all tracking-wider flex items-center justify-center gap-1.5 border-none cursor-pointer whitespace-nowrap",
                      activeTab === 'portfolio' ? "bg-white text-indigo-600 shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"
                    )}
                  >
                    <Video size={14} /> Portfólio & Mídias
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabClick('about_me')}
                    className={cn(
                      "flex-1 min-w-[110px] py-2 px-3 rounded-lg text-[11px] font-bold uppercase transition-all tracking-wider flex items-center justify-center gap-1.5 border-none cursor-pointer whitespace-nowrap",
                      activeTab === 'about_me' ? "bg-white text-indigo-600 shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"
                    )}
                  >
                    <User size={14} /> Sobre Mim
                  </button>
                </div>
              )}

              {/* Tab Content 1: Portfolio (only shows if activeTab === 'portfolio' or role is agency) */}
              {(activeTab === 'portfolio' || userRole === 'agency') && (
                <div className="flex flex-col gap-8">
                  {/* Creator Upload Panel if portal simulation is active */}
                  <AnimatePresence>
                    {userRole === 'creator' && (
                      <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="bg-white p-8 rounded-[16px] border border-[#E2E8F0] shadow-sm flex flex-col gap-6"
                      >
                        <div>
                          <h3 className="text-[18px] font-bold text-[#0F172A] flex items-center gap-2">
                            <UploadCloud size={20} className="text-brand-primary" /> Enviar Novo Vídeo de Portfólio
                          </h3>
                          <p className="text-[12px] text-[#64748B] mt-1">Os vídeos do seu portfólio serão hospedados na rocketz creators e apresentados diretamente para os diretores de casting da agência.</p>
                        </div>

                        <form onSubmit={handleAddVideo} className="flex flex-col gap-5">
                          
                          {/* Drag and drop panel */}
                          <div 
                            onDragEnter={handleDrag}
                            onDragOver={handleDrag}
                            onDragLeave={handleDrag}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={cn(
                              "border-2 border-dashed rounded-[12px] p-6 text-center cursor-pointer flex flex-col items-center justify-center gap-3 transition-all",
                              dragActive ? "border-brand-primary bg-indigo-50/25" : "border-[#E2E8F0] hover:border-brand-primary",
                              uploadFile ? "bg-emerald-50/10 border-emerald-300" : ""
                            )}
                          >
                            <input 
                              ref={fileInputRef}
                              type="file" 
                              accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/avi,video/*,.mp4,.mov,.webm,.mkv,.avi"
                              className="hidden"
                              onChange={handleFileChange}
                              disabled={isUploading}
                            />
                            
                            <div className={cn(
                              "p-3 rounded-xl bg-slate-50 text-slate-400",
                              uploadFile ? "bg-emerald-100/50 text-emerald-600" : ""
                            )}>
                              <Video size={24} />
                            </div>

                            {uploadFile ? (
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-emerald-700">Arquivo Selecionado:</span>
                                <span className="text-xs text-slate-500 font-mono mt-0.5">{uploadFile.name} ({(uploadFile.size / (1024 * 1024)).toFixed(2)} MB)</span>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <span className="text-xs font-bold text-[#0F172A]">Arraste seu vídeo de portfólio aqui ou clique para buscar</span>
                                <span className="text-[10px] text-[#64748B] uppercase tracking-wider">Suporta arquivos de vídeo MP4, WEBM ou MOV (Máx: 150MB)</span>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Título da Campanha / Conteúdo</label>
                              <input 
                                required
                                type="text" 
                                placeholder="Ex: Unboxing Tech 2026, Provador Fitness..."
                                value={videoTitle}
                                onChange={(e) => setVideoTitle(e.target.value)}
                                disabled={isUploading}
                                className="w-full h-11 px-4 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm"
                              />
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Descrição / Nicho de Campanha</label>
                              <input 
                                type="text" 
                                placeholder="Ex: Conteúdo orgânico focado em conversão..."
                                value={videoDescription}
                                onChange={(e) => setVideoDescription(e.target.value)}
                                disabled={isUploading}
                                className="w-full h-11 px-4 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm"
                              />
                            </div>
                          </div>

                          {isUploading && (
                            <div className="flex flex-col gap-2">
                              <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider">
                                <span className="text-[#64748B] flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full border border-indigo-500 border-t-transparent animate-spin inline-block" />
                                  Hospedando vídeo na plataforma...
                                </span>
                                <span className="text-brand-primary">{uploadProgress}%</span>
                              </div>
                              <div className="w-full h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                                <div className="h-full bg-brand-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                              </div>
                            </div>
                          )}

                          {!isUploading && (
                            <button 
                              type="submit" 
                              disabled={!uploadFile || !videoTitle.trim()}
                              className="h-11 w-full bg-brand-primary text-white font-bold rounded-lg hover:bg-indigo-600 transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2 uppercase text-xs tracking-wider disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed"
                            >
                              <UploadCloud size={16} /> Enviar e Hospedar Vídeo
                            </button>
                          )}

                        </form>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Videos Portfolio Feed */}
                  <div className="bg-white p-8 rounded-[16px] border border-[#E2E8F0] shadow-sm flex flex-col gap-6">
                    <div>
                      <h3 className="text-[18px] font-bold text-[#0F172A] flex items-center gap-2">
                        <Video size={20} className="text-brand-primary" /> Portfólio de Vídeos ({creator.portfolio?.length || 0})
                      </h3>
                      <p className="text-[12px] text-[#64748B] mt-1">Assista aos conteúdos publicados para avaliar a qualidade técnica, oratória e estética dos materiais.</p>
                    </div>

                    {(!creator.portfolio || creator.portfolio.length === 0) ? (
                      <div className="border border-dashed border-[#E2E8F0] rounded-xl p-12 text-center flex flex-col items-center justify-center gap-3">
                        <div className="p-3 bg-slate-50 rounded-full text-slate-400">
                          <Play size={24} />
                        </div>
                        <h4 className="text-sm font-bold text-slate-800">Portfólio vazio</h4>
                        <p className="text-xs text-[#64748B] max-w-sm leading-relaxed">
                          {userRole === 'creator' 
                            ? "Suba seu primeiro vídeo acima para que a agência possa assistir ao seu trabalho!" 
                            : "Nenhum portfólio de vídeo hospedado ainda. Mude para o 'Portal do Criador' no simulador acima para realizar o upload."}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {creator.portfolio.map((video) => (
                          <motion.div 
                            layout
                            key={video.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="group bg-slate-50 border border-[#F1F5F9] rounded-xl overflow-hidden flex flex-col hover:border-brand-primary hover:shadow-md transition-all relative h-full"
                          >
                            
                            {/* Simulated thumbnail container */}
                            <div 
                              onClick={() => setActivePlayVideo(video)}
                              className="aspect-[9/16] max-h-[320px] bg-slate-900 flex items-center justify-center relative group cursor-pointer overflow-hidden"
                            >
                              {/* Real video preview embedded inside thumbnail */}
                              <video 
                                muted 
                                playsInline
                                src={video.url}
                                className="w-full h-full object-cover opacity-70 group-hover:scale-105 transition-all"
                              />

                              {/* Overlays Play Button */}
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center transition-all group-hover:bg-black/45">
                                <div className="h-14 w-14 bg-white/20 backdrop-blur-md rounded-full border border-white/40 flex items-center justify-center text-white scale-100 group-hover:scale-110 shadow-lg transition-all">
                                  <Play size={24} fill="currentColor" className="translate-x-0.5" />
                                </div>
                              </div>

                              {/* Header Tag inside thumbnail */}
                              <div className="absolute top-3 left-3 bg-black/55 backdrop-blur-sm shadow px-2 py-0.5 rounded text-[10px] text-white font-mono font-medium tracking-tight">
                                MP4 HOSPEDADO
                              </div>
                            </div>

                            <div className="p-4 flex-1 flex flex-col justify-between">
                              <div>
                                <h4 className="font-bold text-sm text-[#0F172A] truncate group-hover:text-brand-primary transition-all pr-4">{video.title}</h4>
                                <p className="text-xs text-[#64748B] mt-1 line-clamp-2 leading-relaxed">{video.description || 'Sem descrição cadastrada.'}</p>
                              </div>

                              <div className="flex items-center justify-between pt-3 border-t border-[#F1F5F9] mt-4">
                                <span className="text-[9px] text-slate-400 uppercase font-mono tracking-wider flex items-center gap-1">
                                  <Clock size={10} /> {new Date(video.uploadedAt).toLocaleDateString()}
                                </span>
                                
                                {/* Option to delete video */}
                                {userRole === 'creator' && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveVideo(video.id);
                                    }}
                                    className="p-1.5 text-slate-300 hover:text-red-600 transition-all rounded-lg hover:bg-red-50 border-none bg-transparent cursor-pointer"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                                
                                {/* Real direct watch preview trigger */}
                                {userRole === 'agency' && (
                                  <button 
                                    onClick={() => setActivePlayVideo(video)}
                                    className="text-[10px] font-bold text-brand-primary uppercase tracking-wider flex items-center gap-1 border-none bg-transparent cursor-pointer"
                                  >
                                    <Eye size={12} /> Assistir
                                  </button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recurring Contracts Section for Agency view or dedicated Recurring Tab */}
              {(activeTab === 'recurring' || userRole === 'agency') && creator && (
                <div className="mt-2">
                  <CreatorRecurringContractsSection
                    recurringContracts={recurringContracts}
                    creatorId={creator.id}
                    contentPlanningItems={contentPlanningItems}
                    companies={companies}
                  />
                </div>
              )}

              {/* Tab Content: Sobre Mim */}
              {activeTab === 'about_me' && (
                <div className="flex flex-col gap-8 animate-fadeIn">
                  
                  {/* Bio and Overview Card */}
                  <div className="bg-white p-8 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row gap-6 items-start">
                    <UserAvatar
                      src={creator.photoUrl}
                      name={creator.artisticName || creator.fullName}
                      size="custom"
                      shape="circle"
                      className="w-24 h-24 border-2 border-brand-primary/20 shrink-0 shadow-sm"
                      textClassName="text-3xl"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-xl font-bold text-slate-900">{creator.fullName}</h3>
                        <span className="text-xs font-semibold text-[#4F46E5] bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                          @{creator.artisticName}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{creator.city}, {creator.state} • Membro desde {creator.createdAt ? new Date(creator.createdAt).toLocaleDateString('pt-BR') : 'N/A'}</p>
                      
                      <div className="mt-4">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Apresentação</h4>
                        <p className="text-sm text-slate-600 leading-relaxed font-medium">
                          {creator.bio || "Nenhuma biografia comercial foi preenchida ainda. Clique em 'Editar Dados' abaixo para se descrever e atrair mais marcas parceiras!"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Categories and Affinities Bento Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Categories Card */}
                    <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col gap-4">
                      <div className="flex items-center gap-2 border-b border-[#F1F5F9] pb-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                          <Compass size={18} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">Nichos & Segmentação</h4>
                          <p className="text-[11px] text-slate-400">Temas principais do conteúdo do criador</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-1">
                        {creator.categories && creator.categories.length > 0 ? (
                          creator.categories.map((cat) => (
                            <span 
                              key={cat} 
                              className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-[#0F172A] text-xs font-semibold rounded-full"
                            >
                              {cat}
                            </span>
                          ))
                        ) : (
                          <p className="text-xs text-slate-400 italic">Nenhum nicho ou categoria foi selecionado ainda.</p>
                        )}
                      </div>
                    </div>

                    {/* Commercial Conditions/Affinities Card */}
                    <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col gap-4">
                      <div className="flex items-center gap-2 border-b border-[#F1F5F9] pb-3">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                          <CheckCircle2 size={18} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">Condições Comerciais</h4>
                          <p className="text-[11px] text-slate-400">Preferências básicas para contratação</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2.5 mt-1">
                        
                        {/* Permuta status */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 border border-slate-100">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700">Aceita Permuta de Produtos</span>
                            <span className="text-[10px] text-slate-400 font-medium">Permite receber recebidos de valor equivalente</span>
                          </div>
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase",
                            creator.acceptsExchange ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                          )}>
                            {creator.acceptsExchange ? "Sim" : "Não"}
                          </span>
                        </div>

                        {/* Tráfego Pago status */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 border border-slate-100">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700">Tráfego Pago Autorizado</span>
                            <span className="text-[10px] text-slate-400 font-medium">Permite impulsionar publicação com sua conta</span>
                          </div>
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase",
                            creator.acceptsPaidTraffic ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                          )}>
                            {creator.acceptsPaidTraffic ? "Sim" : "Não"}
                          </span>
                        </div>

                        {/* Exclusividade status */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 border border-slate-100">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-700">Contrato de Exclusividade</span>
                            <span className="text-[10px] text-slate-400 font-medium">Fidelidade exclusiva ao mesmo segmento</span>
                          </div>
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase",
                            creator.acceptsExclusivity ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                          )}>
                            {creator.acceptsExclusivity ? "Sim" : "Não"}
                          </span>
                        </div>

                      </div>
                    </div>

                  </div>

                  {/* Format Affinities Section */}
                  <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm flex flex-col gap-4">
                    <div className="flex items-center gap-2 border-b border-[#F1F5F9] pb-3">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                        <Heart size={18} className="text-brand-primary" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">Afinidades & Formatos Preferidos</h4>
                        <p className="text-[11px] text-slate-400">Atividades e modelos comerciais onde o criador tem melhor desempenho</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-1">
                      {creator.workAffinities && creator.workAffinities.length > 0 ? (
                        creator.workAffinities.map((aff) => (
                          <span 
                            key={aff} 
                            className="px-3.5 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-bold rounded-full flex items-center gap-1.5"
                          >
                            ✓ {aff}
                          </span>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 italic">Nenhum formato ou afinidade específica cadastrada. Edite seu perfil para preencher!</p>
                      )}
                    </div>
                  </div>

                  {/* Direct Edit Trigger */}
                  <div className="flex justify-end mt-2">
                    <button 
                      onClick={() => setIsEditingProfile(true)}
                      className="h-11 px-5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl border-none cursor-pointer flex items-center gap-2 transition-all shadow-md active:scale-95"
                    >
                      <UserCheck size={14} /> Editar Perfil Profissional
                    </button>
                  </div>

                </div>
              )}

              {/* Tab Content 2: Central Dashboard & Dedicated Campaigns View */}
              {userRole === 'creator' && (activeTab === 'dashboard' || activeTab === 'campaigns') && (() => {
                const approvedCampaigns = creatorCampaigns.filter(c => !c.participation.applicationStatus || c.participation.applicationStatus === 'approved');
                const pendingApplications = creatorCampaigns.filter(c => c.participation.applicationStatus === 'pending');
                const rejectedApplications = creatorCampaigns.filter(c => c.participation.applicationStatus === 'rejected');

                const availableCampaigns = campaigns.filter(camp => 
                  !creatorCampaigns.some(cc => cc.campaign.id === camp.id) &&
                  (camp.status === 'briefing' || camp.status === 'selection') &&
                  !camp.isSecret
                );

                const totalReceived = creatorCampaigns
                  .filter(item => item.participation.paymentStatus === 'paid')
                  .reduce((sum, item) => sum + (item.participation.amount || 0), 0);

                const totalToReceive = creatorCampaigns
                  .filter(item => item.participation.paymentStatus !== 'paid' && item.participation.deliveryStatus === 'approved')
                  .reduce((sum, item) => sum + (item.participation.amount || 0), 0);

                const totalPending = creatorCampaigns
                  .filter(item => item.participation.paymentStatus !== 'paid' && item.participation.deliveryStatus !== 'approved')
                  .reduce((sum, item) => sum + (item.participation.amount || 0), 0);

                return (
                  <div className="flex flex-col gap-8 animate-fadeIn">
                    
                    {/* Header for Dedicated Campaigns View */}
                    {activeTab === 'campaigns' && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-indigo-50 text-brand-primary rounded-2xl">
                            <Megaphone size={22} />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-slate-900 m-0">Minhas Campanhas ({approvedCampaigns.length})</h3>
                            <p className="text-xs text-slate-500 m-0">Acompanhe seus briefings, entregue materiais para revisão e gerencie o histórico de candidaturas</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <Link
                            to="/available-campaigns"
                            className="h-10 px-4 bg-brand-primary hover:bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm shadow-indigo-600/20 no-underline"
                          >
                            <Sparkles size={14} /> Campanhas Disponíveis
                          </Link>
                        </div>
                      </div>
                    )}

                    {/* Sub-tabs for Dedicated Campaigns View (Ativas vs Candidaturas) */}
                    {activeTab === 'campaigns' && (
                      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2">
                        <button
                          type="button"
                          onClick={() => setCampaignSubTab('my_campaigns')}
                          className={cn(
                            "px-4 py-2 rounded-xl text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-2",
                            campaignSubTab === 'my_campaigns' || campaignSubTab === 'available'
                              ? "bg-slate-900 text-white shadow-sm"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          )}
                        >
                          <Briefcase size={14} /> Campanhas Ativas ({approvedCampaigns.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setCampaignSubTab('applications')}
                          className={cn(
                            "px-4 py-2 rounded-xl text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-2",
                            campaignSubTab === 'applications'
                              ? "bg-slate-900 text-white shadow-sm"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          )}
                        >
                          <Send size={14} /> Minhas Candidaturas ({pendingApplications.length + rejectedApplications.length})
                        </button>
                      </div>
                    )}

                    {/* Welcome banner & total earnings (Only on Dashboard) */}
                    {activeTab === 'dashboard' && (
                      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-8 rounded-[24px] text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-white/5">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-extrabold text-indigo-300 uppercase tracking-widest bg-white/10 px-2.5 py-1 rounded-md w-fit">
                            Painel do Criador
                          </span>
                          <h2 className="text-2xl font-bold mt-3">Olá, {creator?.artisticName || creator?.fullName}! 👋</h2>
                          <p className="text-slate-300 text-xs mt-1 max-w-md leading-relaxed">
                            Acompanhe o andamento das suas campanhas, candidate-se às novas vitrines disponíveis e gerencie seus faturamentos.
                          </p>
                        </div>

                        {/* Small Quick Earnings Summary */}
                        <div className="flex items-center gap-6 bg-white/5 backdrop-blur-sm border border-white/10 p-4 rounded-2xl shrink-0 font-medium">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider">Total de Ganhos</span>
                            <span className="text-xl font-black text-emerald-400 mt-1">
                              {formatCurrency(totalReceived + totalToReceive)}
                            </span>
                          </div>
                          <div className="h-10 w-px bg-white/10" />
                          <div className="flex flex-col">
                            <span className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider">Pago</span>
                            <span className="text-sm font-bold text-slate-200 mt-1">
                              {formatCurrency(totalReceived)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Section 1: Earnings (Ganhos) Cards (Only on Dashboard) - Sem Dinheiro Pendente */}
                    {activeTab === 'dashboard' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-medium">
                        {/* Total Recebido */}
                        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Recebido (Pago)</span>
                            <h3 className="text-xl font-bold text-emerald-600 mt-1">
                              {formatCurrency(totalReceived)}
                            </h3>
                          </div>
                          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                            <CheckCircle2 size={18} />
                          </div>
                        </div>

                        {/* A Receber */}
                        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-sm flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">A Receber (Aprovado)</span>
                            <h3 className="text-xl font-bold text-brand-primary mt-1">
                              {formatCurrency(totalToReceive)}
                            </h3>
                          </div>
                          <div className="p-3 bg-indigo-50 text-brand-primary rounded-xl">
                            <DollarSign size={18} />
                          </div>
                        </div>
                      </div>
                    )}

                    {loadingCampaigns ? (
                      <div className="flex items-center justify-center p-12 bg-white rounded-[16px] border border-[#E2E8F0]">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-primary"></div>
                      </div>
                    ) : (
                      <>
                        {/* Section: Active Campaigns */}
                        <div className="flex flex-col gap-4">
                          <h3 className="text-xs font-extrabold text-[#0F172A] uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-100 pb-2">
                            <Briefcase size={16} className="text-brand-primary" /> Minhas Campanhas Ativas ({approvedCampaigns.length})
                          </h3>

                          {approvedCampaigns.length === 0 ? (
                            <div className="bg-white border border-dashed border-[#E2E8F0] rounded-[16px] p-12 text-center flex flex-col items-center justify-center gap-3">
                              <div className="p-3 bg-slate-50 rounded-full text-slate-400">
                                <Briefcase size={24} />
                              </div>
                              <h4 className="text-sm font-bold text-slate-800">Sem campanhas ativas</h4>
                              <p className="text-xs text-[#64748B] max-w-sm leading-relaxed">
                                Você ainda não está participando de nenhuma campanha ativa. Vá para a aba <strong>Disponíveis</strong> e se candidate para as marcas parceiras de interesse!
                              </p>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-6 font-medium">
                              {/* Work Table for Campaign Deliverables with Inline Accordion */}
                              <div className="bg-white rounded-[20px] border border-indigo-200/90 shadow-sm overflow-hidden">
                                <div className="p-4 bg-indigo-50/70 border-b border-indigo-100 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Briefcase size={16} className="text-brand-primary" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                                      Tabela de Trabalhos de Campanhas
                                    </span>
                                  </div>
                                  <span className="text-xs font-extrabold text-brand-primary bg-indigo-100 px-3 py-1 rounded-full border border-indigo-200">
                                    {approvedCampaigns.length} campanhas em andamento
                                  </span>
                                </div>

                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="bg-slate-50/80 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200/80">
                                        <th className="p-3.5 pl-5">Campanha & Empresa</th>
                                        <th className="p-3.5">Cachê (R$)</th>
                                        <th className="p-3.5">Prazo de Entrega</th>
                                        <th className="p-3.5">Status Candidatura</th>
                                        <th className="p-3.5">Status Entrega</th>
                                        <th className="p-3.5 text-right pr-5">Ações</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium">
                                      {approvedCampaigns.map((item) => {
                                        const { campaign, participation } = item;
                                        const originalIndex = creatorCampaigns.findIndex(c => c.participation.id === participation.id);
                                        const isExpanded = selectedCampaignIndex === originalIndex;

                                        return (
                                          <React.Fragment key={`campaign-row-${participation.id}`}>
                                            {/* Main Table Row */}
                                            <tr className={cn("hover:bg-indigo-50/30 transition-colors", isExpanded && "bg-indigo-50/50")}>
                                              <td className="p-3.5 pl-5">
                                                <div className="flex flex-col">
                                                  <span className="font-bold text-slate-900 text-sm">{campaign.name}</span>
                                                  <span className="text-[10px] text-slate-400">{campaign.companyName || 'Empresa Parceira'}</span>
                                                </div>
                                              </td>
                                              <td className="p-3.5">
                                                <span className="font-extrabold text-brand-primary text-sm">{formatCurrency(participation.amount)}</span>
                                              </td>
                                              <td className="p-3.5 text-slate-700">
                                                <div className="flex items-center gap-1 font-semibold">
                                                  <Calendar size={13} className="text-slate-400" />
                                                  <span>{participation.deliveryDate ? new Date(participation.deliveryDate).toLocaleDateString('pt-BR') : 'A definir'}</span>
                                                </div>
                                              </td>
                                              <td className="p-3.5">
                                                <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                  ✓ Aprovado
                                                </span>
                                              </td>
                                              <td className="p-3.5">
                                                <span className={cn(
                                                  "px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border",
                                                  participation.deliveryStatus === 'pending' ? "bg-slate-100 text-slate-700 border-slate-200" :
                                                  participation.deliveryStatus === 'revision' ? "bg-amber-100 text-amber-800 border border-amber-200" :
                                                  participation.deliveryStatus === 'approved' ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
                                                  "bg-indigo-100 text-indigo-800 border border-indigo-200"
                                                )}>
                                                  {participation.deliveryStatus === 'pending' ? '⏳ Pendente' :
                                                   participation.deliveryStatus === 'revision' ? '⚠️ Em Ajuste' :
                                                   participation.deliveryStatus === 'approved' ? '✅ Aprovado' :
                                                   participation.deliveryStatus === 'published' ? '🚀 Publicado' : participation.deliveryStatus}
                                                </span>
                                              </td>
                                              <td className="p-3.5 text-right pr-5 whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-2">
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setViewingBriefingCampaign(campaign);
                                                      setIsBriefingModalOpen(true);
                                                    }}
                                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer border-none shadow-sm"
                                                    title="Visualizar briefing completo da campanha"
                                                  >
                                                    <Eye size={13} className="text-brand-primary" />
                                                    <span>Visualizar Briefing</span>
                                                  </button>

                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      if (isExpanded) {
                                                        setSelectedCampaignIndex(null);
                                                      } else {
                                                        setSelectedCampaignIndex(originalIndex);
                                                        setScriptText(participation.content?.script || '');
                                                        setPublishedUrl(participation.content?.publishedLink || '');
                                                        setSubmittingFile(null);
                                                      }
                                                    }}
                                                    className={cn(
                                                      "px-3.5 py-1.5 font-bold text-xs rounded-xl shadow-sm transition-all inline-flex items-center gap-1.5 cursor-pointer border-none",
                                                      isExpanded
                                                        ? "bg-slate-800 hover:bg-slate-900 text-white"
                                                        : "bg-brand-primary hover:bg-indigo-600 text-white"
                                                    )}
                                                  >
                                                    {isExpanded ? (
                                                      <>
                                                        <ChevronUp size={13} />
                                                        <span>Fechar Envio</span>
                                                      </>
                                                    ) : (
                                                      <>
                                                        <Send size={13} />
                                                        <span>Enviar</span>
                                                      </>
                                                    )}
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>

                                            {/* Inline Accordion Detail Row: expands right below the clicked row */}
                                            {isExpanded && (
                                              <tr key={`expanded-${participation.id}`} className="bg-slate-50/70">
                                                <td colSpan={6} className="p-0 border-b border-indigo-100">
                                                  <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    transition={{ duration: 0.25, ease: "easeInOut" }}
                                                    className="overflow-hidden"
                                                  >
                                                    <div className="p-5 sm:p-6 flex flex-col gap-5 border-l-4 border-l-brand-primary bg-indigo-50/20">
                                                      {/* Briefing Card inside expanded row */}
                                                      <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm flex flex-col gap-4">
                                                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                                          <h5 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                                            <FileText size={16} className="text-brand-primary" /> Briefing Criativo — <span className="text-brand-primary">{campaign.name}</span>
                                                          </h5>
                                                          <button
                                                            type="button"
                                                            onClick={() => setSelectedCampaignIndex(null)}
                                                            className="text-xs text-slate-500 hover:text-slate-800 font-bold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer flex items-center gap-1"
                                                          >
                                                            <ChevronUp size={13} /> Fechar
                                                          </button>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
                                                          <div>
                                                            <span className="font-bold text-[#64748B] block uppercase text-[9px] tracking-wide mb-1">Produto / Serviço</span>
                                                            <p className="text-slate-800 font-medium">{campaign.briefing?.product || 'Não especificado'}</p>
                                                          </div>
                                                          <div>
                                                            <span className="font-bold text-[#64748B] block uppercase text-[9px] tracking-wide mb-1">Mensagem Chave</span>
                                                            <p className="text-slate-800 font-medium">{campaign.briefing?.keyMessage || 'Não especificado'}</p>
                                                          </div>
                                                          <div className="md:col-span-2">
                                                            <span className="font-bold text-emerald-600 block uppercase text-[9px] tracking-wide mb-1">O que DEVE ter (Must Haves)</span>
                                                            <p className="text-slate-800 whitespace-pre-line leading-relaxed bg-emerald-50/40 p-3.5 rounded-xl border border-emerald-100/60">{campaign.briefing?.mustHave || 'Sem especificações.'}</p>
                                                          </div>
                                                          <div className="md:col-span-2">
                                                            <span className="font-bold text-rose-500 block uppercase text-[9px] tracking-wide mb-1">O que NÃO DEVE ter (Dont's)</span>
                                                            <p className="text-slate-800 whitespace-pre-line leading-relaxed bg-rose-50/40 p-3.5 rounded-xl border border-rose-100/60">{campaign.briefing?.donts || 'Sem especificações.'}</p>
                                                          </div>
                                                          <div>
                                                            <span className="font-bold text-brand-primary block uppercase text-[9px] tracking-wide mb-1">Chamada para Ação (CTA)</span>
                                                            <p className="text-slate-800 font-medium">{campaign.briefing?.cta || 'Sem CTA específica.'}</p>
                                                          </div>
                                                          <div>
                                                            <span className="font-bold text-indigo-600 block uppercase text-[9px] tracking-wide mb-1">Hashtags</span>
                                                            <p className="text-slate-800 font-mono">{campaign.briefing?.hashtags || 'Nenhuma hashtag cadastrada.'}</p>
                                                          </div>
                                                          <div>
                                                            <span className="font-bold text-[#64748B] block uppercase text-[9px] tracking-wide mb-1">Cupom de Desconto</span>
                                                            <p className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded inline-block">{campaign.briefing?.coupon || 'Nenhum'}</p>
                                                          </div>
                                                          <div>
                                                            <span className="font-bold text-[#64748B] block uppercase text-[9px] tracking-wide mb-1">Link de Apoio</span>
                                                            {campaign.briefing?.link ? (
                                                              <a href={campaign.briefing.link} target="_blank" rel="noopener noreferrer" className="text-brand-primary font-bold flex items-center gap-1 hover:underline">
                                                                Link de Apoio <ExternalLink size={11} />
                                                              </a>
                                                            ) : (
                                                              <p className="text-slate-500">Nenhum</p>
                                                            )}
                                                          </div>
                                                        </div>
                                                      </div>

                                                      {/* Material Submission Form / Feedback */}
                                                      <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm flex flex-col gap-4">
                                                        <h5 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                                                          <Send size={15} className="text-brand-primary" /> Envio de Material
                                                        </h5>

                                                        {participation.deliveryStatus === 'revision' && participation.revisionDetails && (
                                                          <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex flex-col gap-1.5">
                                                            <span className="text-[10px] font-extrabold uppercase text-rose-700 tracking-wider flex items-center gap-1">
                                                              ⚠️ Ajustes Solicitados pela Agência / Marca
                                                            </span>
                                                            <p className="text-xs text-rose-800 font-semibold leading-relaxed m-0 whitespace-pre-wrap">
                                                              {participation.revisionDetails}
                                                            </p>
                                                          </div>
                                                        )}

                                                        <div className="flex flex-col gap-4">
                                                          {/* Script Text */}
                                                          <div className="flex flex-col gap-1.5">
                                                            <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Escreva ou cole seu Roteiro / Rascunho de Script:</label>
                                                            <textarea
                                                              rows={4}
                                                              placeholder="Cole aqui seu roteiro ou ideias para o Reels/Story..."
                                                              value={scriptText}
                                                              onChange={(e) => setScriptText(e.target.value)}
                                                              className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-brand-primary text-xs font-medium resize-y bg-slate-50/50 focus:bg-white transition-all"
                                                            />
                                                          </div>

                                                          {/* Video submission file upload */}
                                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                                                            <div className="flex flex-col gap-1.5">
                                                              <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Selecione o vídeo draft/roteiro:</label>
                                                              <div className="flex gap-2">
                                                                <input
                                                                  type="file"
                                                                  accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/avi,video/*,.mp4,.mov,.webm,.mkv,.avi"
                                                                  id={`material-video-${participation.id}`}
                                                                  className="hidden"
                                                                  onChange={(e) => {
                                                                    if (e.target.files && e.target.files[0]) {
                                                                      const file = e.target.files[0];
                                                                      if (!isVideoFile(file)) {
                                                                        alert('Por favor, selecione apenas arquivos de vídeo (MP4, MOV, WEBM, etc).');
                                                                        e.target.value = '';
                                                                        return;
                                                                      }
                                                                      if (file.size > 150 * 1024 * 1024) {
                                                                        alert('O arquivo de vídeo excede o limite máximo permitido de 150MB para upload.');
                                                                        e.target.value = '';
                                                                        return;
                                                                      }
                                                                      setSubmittingFile(file);
                                                                    }
                                                                  }}
                                                                />
                                                                <button
                                                                  type="button"
                                                                  onClick={() => document.getElementById(`material-video-${participation.id}`)?.click()}
                                                                  className="h-9 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold uppercase tracking-wider rounded-xl border-none cursor-pointer flex items-center gap-1.5 shrink-0 transition-colors"
                                                                >
                                                                  <UploadCloud size={14} /> Escolher Arquivo
                                                                </button>
                                                                {submittingFile && (
                                                                  <span className="text-xs text-slate-700 truncate flex items-center font-mono bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                                                                    {submittingFile.name}
                                                                  </span>
                                                                )}
                                                              </div>
                                                            </div>

                                                            {/* Current uploaded video preview if exists */}
                                                            {participation.content?.videoUrl && (
                                                              <div className="flex items-center gap-3 p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl">
                                                                <div className="p-2 bg-brand-primary/10 text-brand-primary rounded-xl shrink-0">
                                                                  <Video size={16} />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                  <p className="text-[11px] font-bold text-[#0F172A] truncate">Vídeo Atual Enviado</p>
                                                                  <button
                                                                    type="button"
                                                                    onClick={() => setActivePlayVideo({ id: participation.id, title: campaign.name, url: participation.content.videoUrl, description: 'Vídeo da Campanha', uploadedAt: '' })}
                                                                    className="text-[10px] text-brand-primary hover:underline font-bold uppercase tracking-wider flex items-center gap-1 mt-0.5 border-none bg-transparent cursor-pointer"
                                                                  >
                                                                    <Play size={10} fill="currentColor" /> Assistir Rascunho
                                                                  </button>
                                                                </div>
                                                              </div>
                                                            )}
                                                          </div>

                                                          {/* Uploading progress bar */}
                                                          {isSubmittingMaterial && (
                                                            <div className="flex flex-col gap-1.5 mt-2">
                                                              <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-brand-primary animate-pulse">
                                                                <span>Enviando arquivos...</span>
                                                                <span>{submissionProgress}%</span>
                                                              </div>
                                                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                                <div className="h-full bg-brand-primary transition-all duration-300" style={{ width: `${submissionProgress}%` }} />
                                                              </div>
                                                            </div>
                                                          )}

                                                          {/* Live/Published Link */}
                                                          {participation.deliveryStatus === 'approved' && (
                                                            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex flex-col gap-3">
                                                              <p className="text-[11px] text-emerald-800 font-medium m-0">🎉 <strong>Seu vídeo foi aprovado!</strong> Agora publique em suas redes sociais e cole o link final abaixo:</p>
                                                              <div className="flex flex-col gap-1.5">
                                                                <label className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Link Final Publicado:</label>
                                                                <input
                                                                  type="url"
                                                                  placeholder="Ex: https://www.instagram.com/reel/C..."
                                                                  value={publishedUrl}
                                                                  onChange={(e) => setPublishedUrl(e.target.value)}
                                                                  className="w-full h-10 px-3.5 rounded-xl border border-slate-200 outline-none focus:border-brand-primary text-xs bg-white"
                                                                />
                                                              </div>
                                                            </div>
                                                          )}

                                                          {/* Action Buttons */}
                                                          <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-2">
                                                            <button
                                                              type="button"
                                                              onClick={() => setSelectedCampaignIndex(null)}
                                                              className="px-3.5 py-2 text-slate-600 hover:text-slate-900 text-xs font-bold rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
                                                            >
                                                              Recolher Briefing
                                                            </button>
                                                            <button
                                                              type="button"
                                                              onClick={() => handleSubmitCampaignMaterial(campaign.id, participation.id)}
                                                              disabled={isSubmittingMaterial || (!scriptText && !submittingFile && !publishedUrl)}
                                                              className="h-10 px-5 bg-brand-primary hover:bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl border-none cursor-pointer flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-600/20 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed"
                                                            >
                                                              <CheckCircle2 size={15} /> {participation.deliveryStatus === 'approved' ? 'Enviar Link de Publicação' : 'Enviar Material p/ Revisão'}
                                                            </button>
                                                          </div>
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
                            </div>
                          )}
                        </div>

                        {/* CANDIDACIES / APPLICATIONS SUB-TAB (Shown only when activeTab is campaigns and campaignSubTab is applications) */}
                        {activeTab === 'campaigns' && campaignSubTab === 'applications' && (
                          (pendingApplications.length + rejectedApplications.length) === 0 ? (
                            <div className="bg-white border border-dashed border-[#E2E8F0] rounded-[20px] p-12 text-center flex flex-col items-center justify-center gap-4">
                              <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 border border-slate-100">
                                <Send size={24} />
                              </div>
                              <div className="flex flex-col gap-1 max-w-sm">
                                <h4 className="text-sm font-bold text-slate-900">Sem candidaturas recentes</h4>
                                <p className="text-xs text-[#64748B] leading-relaxed m-0">
                                  Você não realizou nenhuma candidatura a campanhas ultimamente. Veja as campanhas abertas em <strong>Campanhas Disponíveis</strong>!
                                </p>
                              </div>
                              <Link
                                to="/available-campaigns"
                                className="mt-1 h-9 px-5 bg-brand-primary hover:bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm no-underline"
                              >
                                <Sparkles size={13} /> Explorar Campanhas Disponíveis
                              </Link>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-4 font-medium">
                              {/* Pending list */}
                              {pendingApplications.map((item) => {
                                const { campaign, participation } = item;
                                const companyName = companies.find(co => co.id === campaign.companyId)?.name || 'Marca Parceira';
                                return (
                                  <div key={participation.id} className="bg-white rounded-2xl border border-amber-200 p-5 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-amber-50/5">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100/70 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                          <Clock size={10} /> Em Análise da Agência
                                        </span>
                                        <span className="text-[9px] text-[#64748B] font-bold uppercase">
                                          {companyName}
                                        </span>
                                      </div>
                                      <h4 className="text-base font-bold text-slate-900">{campaign.name}</h4>
                                      <p className="text-xs text-slate-500 mt-1">
                                        Cachê solicitado: <strong>{formatCurrency(participation.amount)}</strong> • Aplicado em: {participation.createdAt ? new Date(participation.createdAt).toLocaleDateString() : 'Recentemente'}
                                      </p>
                                      {participation.notes && (
                                        <div className="mt-2.5 p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-600">
                                          <strong className="text-slate-700">Sua mensagem:</strong> "{participation.notes}"
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Rejected list */}
                              {rejectedApplications.map((item) => {
                                const { campaign, participation } = item;
                                const companyName = companies.find(co => co.id === campaign.companyId)?.name || 'Marca Parceira';
                                return (
                                  <div key={participation.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col gap-3 bg-slate-50/10">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                        <X size={10} /> Não Selecionado
                                      </span>
                                      <span className="text-[9px] text-[#64748B] font-bold uppercase">
                                        {companyName}
                                      </span>
                                    </div>
                                    <div>
                                      <h4 className="text-base font-bold text-slate-700 line-through decoration-slate-300">{campaign.name}</h4>
                                      <p className="text-xs text-slate-400 mt-1">
                                        Candidatura finalizada • Cachê proposto: {formatCurrency(participation.amount)}
                                      </p>
                                    </div>
                                    
                                    <div className="p-4 bg-indigo-50/40 border border-indigo-100/60 rounded-xl flex gap-2.5 items-start mt-1">
                                      <Info size={14} className="text-indigo-600 shrink-0 mt-0.5" />
                                      <div className="flex-1">
                                        <span className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider block mb-1">Feedback Gentil do Casting</span>
                                        <p className="text-xs text-slate-700 italic leading-relaxed m-0">
                                          "{participation.rejectionReason || "No momento, o perfil não se enquadra nos requisitos específicos de nicho de audiência ou cronograma definidos pelo cliente para esta ação. Mas adoramos seu portfólio e entraremos em contato para futuras oportunidades!"}"
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )
                        )}
                      </>
                    )}

                    {/* Recurring Contracts Section in Creator Dashboard */}
                    {activeTab === 'dashboard' && creator && (
                      <div className="pt-6 border-t border-slate-100">
                        <CreatorRecurringContractsSection
                          recurringContracts={recurringContracts}
                          creatorId={creator.id}
                          contentPlanningItems={contentPlanningItems}
                          companies={companies}
                        />
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Tab Content 3: Financial Earnings Dashboard */}
              {userRole === 'creator' && activeTab === 'finance' && (
                <div className="flex flex-col gap-8 animate-fadeIn">
                  
                  {/* Cards Dashboard row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Card 1: Recebido */}
                    <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Total Recebido (Pago)</span>
                        <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                          {formatCurrency(
                            creatorCampaigns
                              .filter(item => item.participation.paymentStatus === 'paid')
                              .reduce((sum, item) => sum + (item.participation.amount || 0), 0)
                          )}
                        </h3>
                      </div>
                      <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                        <CheckCircle2 size={24} />
                      </div>
                    </div>

                    {/* Card 2: A Receber */}
                    <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">A Receber (Aprovado)</span>
                        <h3 className="text-2xl font-bold text-brand-primary mt-1">
                          {formatCurrency(
                            creatorCampaigns
                              .filter(item => item.participation.paymentStatus !== 'paid' && item.participation.deliveryStatus === 'approved')
                              .reduce((sum, item) => sum + (item.participation.amount || 0), 0)
                          )}
                        </h3>
                      </div>
                      <div className="p-3 bg-indigo-50 text-brand-primary rounded-xl">
                        <DollarSign size={24} />
                      </div>
                    </div>

                    {/* Card 3: Em Negociação/Pendente */}
                    <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-sm flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Pendente (Em Produção)</span>
                        <h3 className="text-2xl font-bold text-slate-800 mt-1">
                          {formatCurrency(
                            creatorCampaigns
                              .filter(item => item.participation.paymentStatus !== 'paid' && item.participation.deliveryStatus !== 'approved')
                              .reduce((sum, item) => sum + (item.participation.amount || 0), 0)
                          )}
                        </h3>
                      </div>
                      <div className="p-3 bg-slate-50 text-slate-600 rounded-xl">
                        <Clock size={24} />
                      </div>
                    </div>
                  </div>

                  {/* Payment Details info with editable fields directly */}
                  <div className="bg-white p-6 rounded-[16px] border border-[#E2E8F0] shadow-sm flex flex-col gap-4">
                    <h4 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2 border-b border-[#F1F5F9] pb-3">
                      <CreditCard size={18} className="text-brand-primary" /> Informações para Pagamento
                    </h4>
                    <p className="text-xs text-[#64748B]">Mantenha seus dados bancários sempre atualizados. A agência efetua os pagamentos em até 15 dias úteis após a publicação aprovada.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Chave PIX Ativa</span>
                        <span className="text-sm font-semibold text-[#0f172a] font-mono">{creator.pixKey ? maskPII(creator.pixKey, 'pix') : 'Não cadastrada'}</span>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Conta Bancária</span>
                        <span className="text-sm font-semibold text-[#0f172a]">{creator.bankDetails ? maskPII(creator.bankDetails, 'text') : 'Não informada'}</span>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button 
                        onClick={() => setIsEditingProfile(true)}
                        className="h-10 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider rounded-lg border-none cursor-pointer flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                      >
                        <UserCheck size={14} /> Editar Chave / Conta
                      </button>
                    </div>
                  </div>

                  {/* Financial items list */}
                  <div className="bg-white rounded-[16px] border border-[#E2E8F0] shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-[#F1F5F9]">
                      <h4 className="text-base font-bold text-[#0F172A] m-0">Histórico de Lançamentos & Recebimentos</h4>
                      <p className="text-xs text-[#64748B] mt-1 m-0">Lista unificada de todas as suas participações comerciais em campanhas da agência.</p>
                    </div>

                    {creatorCampaigns.length === 0 ? (
                      <div className="p-12 text-center text-xs text-slate-400">
                        Nenhuma campanha ou faturamento localizado ainda.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-[#E2E8F0] text-[#64748B] uppercase tracking-wider text-[10px] font-bold">
                              <th className="p-4">Campanha</th>
                              <th className="p-4">Tipo Entrega</th>
                              <th className="p-4">Status Material</th>
                              <th className="p-4">Valor Cache</th>
                              <th className="p-4 text-right">Status Pagamento</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {creatorCampaigns.map((item) => (
                              <tr key={item.participation.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-4">
                                  <span className="font-bold text-[#0F172A] block">{item.campaign.name}</span>
                                  <span className="text-[10px] text-slate-400 font-mono block mt-0.5">Ref: {item.participation.id.slice(0, 8)}</span>
                                </td>
                                <td className="p-4 text-slate-600">{item.participation.deliveryType || 'N/A'}</td>
                                <td className="p-4">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider inline-block",
                                    item.participation.deliveryStatus === 'approved' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                                    item.participation.deliveryStatus === 'revision' ? "bg-amber-50 text-amber-700 border border-amber-100" :
                                    "bg-slate-50 text-slate-600 border border-slate-100"
                                  )}>
                                    {item.participation.deliveryStatus === 'pending' ? 'Pendente' :
                                     item.participation.deliveryStatus === 'revision' ? 'Revisão' :
                                     item.participation.deliveryStatus === 'approved' ? 'Aprovado' :
                                     item.participation.deliveryStatus === 'published' ? 'Publicado' : item.participation.deliveryStatus}
                                  </span>
                                </td>
                                <td className="p-4 font-bold text-[#0F172A]">{formatCurrency(item.participation.amount)}</td>
                                <td className="p-4 text-right">
                                  <span className={cn(
                                    "px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider inline-block",
                                    item.participation.paymentStatus === 'paid' 
                                      ? "bg-emerald-100 text-emerald-800" 
                                      : "bg-amber-100 text-amber-800"
                                  )}>
                                    {item.participation.paymentStatus === 'paid' ? 'PAGO' : 'AGUARDANDO'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
    </div>
  </div>

      {/* Video Lightbox Player Modal */}
      <AnimatePresence>
        {activePlayVideo && (
          <div className="fixed inset-0 z-[1000] overflow-y-auto p-3 sm:p-4 flex items-center justify-center">
            {/* Backdrop filter */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
              onClick={() => setActivePlayVideo(null)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-[#0F172A] rounded-[24px] shadow-2xl overflow-hidden flex flex-col border border-white/10 max-h-[90vh] my-auto z-10"
            >
              <div className="p-4 bg-slate-900 border-b border-white/5 flex items-center justify-between shrink-0">
                <div>
                  <h4 className="text-sm font-bold text-white pr-4 truncate max-w-[200px]">{activePlayVideo.title}</h4>
                  <span className="text-[10px] text-brand-primary uppercase font-bold tracking-wider">@{creator.artisticName}</span>
                </div>
                <button 
                  onClick={() => setActivePlayVideo(null)}
                  className="h-8 w-8 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 font-bold transition-all text-sm cursor-pointer border-none"
                >
                  ✕
                </button>
              </div>

              {/* Submission Media Preview with full controls and range streaming */}
              <div className="bg-black relative flex items-center justify-center flex-1 min-h-0 p-2 overflow-hidden">
                <SubmissionMediaPreview 
                  url={activePlayVideo.url} 
                  maxHeight="max-h-[60vh]"
                  className="w-full"
                />
              </div>

              {activePlayVideo.description && (
                <div className="p-4 sm:p-5 bg-slate-900 text-white border-t border-white/5 shrink-0">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#64748B]">Comentários Criativos / Objetivo</span>
                  <p className="text-xs text-white/95 mt-1 leading-relaxed">{activePlayVideo.description}</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Campaign Application Modal */}
      <AnimatePresence>
        {isApplyingModalOpen && applyingCampaign && (
          <div className="fixed inset-0 z-[1000] overflow-y-auto p-3 sm:p-4 flex items-center justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
              onClick={() => {
                setIsApplyingModalOpen(false);
                setApplyingCampaign(null);
                setApplyingNotes('');
              }}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-white rounded-[24px] shadow-2xl overflow-hidden flex flex-col border border-slate-100 max-h-[90vh] my-auto z-10"
            >
              {/* Header */}
              <div className="p-5 sm:p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                    Candidatura de Campanha
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-2">{applyingCampaign.name}</h3>
                </div>
                <button 
                  onClick={() => {
                    setIsApplyingModalOpen(false);
                    setApplyingCampaign(null);
                    setApplyingNotes('');
                  }}
                  className="h-8 w-8 rounded-full bg-slate-200/50 text-slate-500 flex items-center justify-center hover:bg-slate-200 font-bold transition-all text-sm border-none cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="p-5 sm:p-6 flex flex-col gap-5 overflow-y-auto flex-1 custom-scrollbar">
                <div className="bg-indigo-50/40 border border-indigo-100/60 p-4 rounded-xl flex items-start gap-3">
                  <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs text-indigo-900 leading-relaxed">
                    Sua candidatura passará por aprovação prévia pelo nosso casting de diretores da agência. Caso aprovado, você receberá o briefing completo e o contrato de participação.
                  </div>
                </div>

                {/* Pre-defined Campaign Cache */}
                <div className="flex items-center justify-between p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Cachê Definido pela Campanha</span>
                    <span className="text-xs text-slate-500 mt-0.5">O valor já está previamente estabelecido para esta ação.</span>
                  </div>
                  <span className="text-xl font-black text-emerald-600 shrink-0">
                    {formatCurrency((applyingCampaign as any).creatorCache || creator?.pricing?.combo || 250)}
                  </span>
                </div>

                {/* Message / pitch notes */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Apresentação / Por que você se enquadra nesta campanha? (Opcional)</label>
                  <textarea 
                    rows={4}
                    value={applyingNotes}
                    onChange={(e) => setApplyingNotes(e.target.value)}
                    className="w-full p-4 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 text-xs leading-relaxed font-medium resize-none"
                    placeholder="Conte à marca e ao casting por que você é perfeito para este briefing. Cite nichos, ideias de criação, etc..."
                  />
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
                <button 
                  type="button"
                  onClick={() => {
                    setIsApplyingModalOpen(false);
                    setApplyingCampaign(null);
                    setApplyingNotes('');
                  }}
                  className="h-10 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors border-none cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  disabled={isApplyingSubmit}
                  onClick={handleApplyCampaign}
                  className="h-10 px-6 bg-brand-primary hover:bg-indigo-600 disabled:bg-slate-300 disabled:text-slate-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all shadow-md shadow-indigo-100 flex items-center gap-1.5 border-none cursor-pointer"
                >
                  {isApplyingSubmit ? (
                    <>
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-b-2 border-white mr-1"></div>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send size={13} /> Confirmar Candidatura
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Campaign Briefing Details Modal */}
      <AnimatePresence>
        {isBriefingModalOpen && viewingBriefingCampaign && (
          <div className="fixed inset-0 z-[1000] overflow-y-auto p-3 sm:p-4 flex items-center justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
              onClick={() => {
                setIsBriefingModalOpen(false);
                setViewingBriefingCampaign(null);
              }}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-2xl bg-white rounded-[24px] shadow-2xl overflow-hidden flex flex-col border border-slate-100 max-h-[90vh] my-auto z-10"
            >
              {/* Header */}
              <div className="p-5 sm:p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-primary bg-indigo-50 px-2.5 py-1 rounded-md">
                    Briefing Criativo da Campanha
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-2">{viewingBriefingCampaign.name}</h3>
                </div>
                <button 
                  onClick={() => {
                    setIsBriefingModalOpen(false);
                    setViewingBriefingCampaign(null);
                  }}
                  className="h-8 w-8 rounded-full bg-slate-200/50 text-slate-500 flex items-center justify-center hover:bg-slate-200 font-bold transition-all text-sm border-none cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="p-5 sm:p-6 flex flex-col gap-6 overflow-y-auto flex-1 font-medium text-xs custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="font-bold text-[#64748B] block uppercase text-[10px] tracking-wide mb-1">Produto / Serviço</span>
                    <p className="text-slate-800 font-semibold text-sm">{viewingBriefingCampaign.briefing?.product || 'Não especificado'}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="font-bold text-[#64748B] block uppercase text-[10px] tracking-wide mb-1">Mensagem Chave</span>
                    <p className="text-slate-800 font-semibold text-sm">{viewingBriefingCampaign.briefing?.keyMessage || 'Não especificado'}</p>
                  </div>
                  
                  <div className="md:col-span-2 border-t border-slate-100 pt-4">
                    <span className="font-bold text-emerald-600 block uppercase text-[10px] tracking-wide mb-1.5">O que DEVE ter (Must Haves)</span>
                    <div className="text-slate-800 bg-emerald-50/40 p-4 rounded-xl border border-emerald-100/40 whitespace-pre-line leading-relaxed">
                      {viewingBriefingCampaign.briefing?.mustHave || 'Sem especificações.'}
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <span className="font-bold text-rose-500 block uppercase text-[10px] tracking-wide mb-1.5">O que NÃO DEVE ter (Don'ts)</span>
                    <div className="text-slate-800 bg-rose-50/40 p-4 rounded-xl border border-rose-100/40 whitespace-pre-line leading-relaxed">
                      {viewingBriefingCampaign.briefing?.donts || 'Sem especificações.'}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="font-bold text-brand-primary block uppercase text-[10px] tracking-wide mb-1">Chamada para Ação (CTA)</span>
                    <p className="text-slate-800 font-semibold">{viewingBriefingCampaign.briefing?.cta || 'Sem CTA específica.'}</p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="font-bold text-indigo-600 block uppercase text-[10px] tracking-wide mb-1">Hashtags da Campanha</span>
                    <p className="text-slate-800 font-mono font-semibold">{viewingBriefingCampaign.briefing?.hashtags || 'Nenhuma hashtag cadastrada.'}</p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="font-bold text-[#64748B] block uppercase text-[10px] tracking-wide mb-1">Cupom de Desconto</span>
                    <p className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-100 px-3 py-1 rounded inline-block mt-1">
                      {viewingBriefingCampaign.briefing?.coupon || 'Nenhum'}
                    </p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="font-bold text-[#64748B] block uppercase text-[10px] tracking-wide mb-1">Link de Apoio</span>
                    <div className="mt-1">
                      {viewingBriefingCampaign.briefing?.link ? (
                        <a 
                          href={viewingBriefingCampaign.briefing.link} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-brand-primary font-bold inline-flex items-center gap-1.5 hover:underline"
                        >
                          Acessar Link de Apoio <ExternalLink size={12} />
                        </a>
                      ) : (
                        <p className="text-slate-500 m-0">Nenhum link fornecido</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex flex-col">
                  <span className="text-[9px] text-[#64748B] font-bold uppercase tracking-wider">Cachê Estimado</span>
                  <span className="text-base font-black text-emerald-600">
                    {formatCurrency(viewingBriefingCampaign.creatorCache || creator?.pricing?.combo || 250)}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsBriefingModalOpen(false);
                      setViewingBriefingCampaign(null);
                    }}
                    className="h-9 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors border-none cursor-pointer"
                  >
                    Fechar
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      const camp = viewingBriefingCampaign;
                      setIsBriefingModalOpen(false);
                      setViewingBriefingCampaign(null);
                      
                      setTimeout(() => {
                        setApplyingCampaign(camp);
                        setApplyingAmount(camp.creatorCache || creator?.pricing?.combo || 250);
                        setIsApplyingModalOpen(true);
                      }, 200);
                    }}
                    className="h-9 px-5 bg-brand-primary hover:bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all shadow-md shadow-indigo-100 flex items-center gap-1.5 border-none cursor-pointer"
                  >
                    <Send size={12} /> Candidatar-se Agora
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Official Legal Contract Modal */}
      {creator && (
        <CreatorContractModal
          isOpen={isContractModalOpen}
          onClose={() => setIsContractModalOpen(false)}
          existingAudit={creator.contractAcceptance || null}
          prefilledName={creator.fullName || ''}
          prefilledEmail={creator.email || ''}
          prefilledDocument={creator.document || ''}
          onAccept={async (audit) => {
            try {
              const formattedDoc = audit.document || creator.document || '';
              await updateDoc(doc(db, 'creators', creator.id), {
                contractAcceptance: audit,
                document: formattedDoc,
                cpf: formattedDoc
              });
              setCreator((prev: any) => prev ? {
                ...prev,
                contractAcceptance: audit,
                document: formattedDoc,
                cpf: formattedDoc
              } : null);
              setIsContractModalOpen(false);
              alert('Termo de Adesão & Uso de Imagem formalizado com sucesso!');
            } catch (err) {
              console.error(err);
              alert('Erro ao salvar aceitação do termo.');
            }
          }}
        />
      )}

      {/* Change Password Modal */}
      {creator && (
        <ChangeCreatorPasswordModal
          isOpen={isChangePasswordModalOpen}
          onClose={() => setIsChangePasswordModalOpen(false)}
          creator={creator}
        />
      )}

    </div>
  );
}
