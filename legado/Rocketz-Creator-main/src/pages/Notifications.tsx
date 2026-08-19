import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Bell, 
  Check, 
  Trash2, 
  UserPlus, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  Clock, 
  BellOff,
  ExternalLink,
  Repeat,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { collection, onSnapshot, query, where, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'application' | 'approval' | 'rejection' | 'delivery_review' | 'contract' | 'general' | string;
  targetRole?: 'admin' | 'creator' | 'all';
  creatorId?: string;
  campaignId?: string;
  contractId?: string;
  link?: string;
  createdAt: string;
  read: boolean;
}

export default function Notifications() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<'admin' | 'creator' | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'applications' | 'deliveries' | 'contracts'>('all');
  const [roleFilter, setRoleFilter] = useState<'admin_only' | 'all'>('admin_only');
  const navigate = useNavigate();

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const { isAdminEmail } = await import('../lib/firebase');
        if (isAdminEmail(u.email)) {
          setRole('admin');
        } else {
          const { getDoc, doc: fDoc } = await import('firebase/firestore');
          const creatorSnap = await getDoc(fDoc(db, 'creators', u.uid));
          if (creatorSnap.exists() && creatorSnap.data().role === 'admin') {
            setRole('admin');
          } else {
            setRole('creator');
          }
        }
      } else {
        setRole(null);
      }
    });

    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user || !role) return;

    setLoading(true);
    let q;
    
    if (role === 'admin') {
      q = query(collection(db, 'notifications'));
    } else {
      q = query(
        collection(db, 'notifications'), 
        where('creatorId', '==', user.uid)
      );
    }

    let unsub: (() => void) | undefined;
    let isSubscribed = true;
    let retryCount = 0;

    const startListening = () => {
      if (!isSubscribed) return;

      unsub = onSnapshot(q, (snap) => {
        if (!isSubscribed) return;
        let docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
        
        // Scope filtering based on permissions
        if (role === 'admin') {
          if (roleFilter === 'admin_only') {
            docs = docs.filter(n => n.targetRole === 'admin' || !n.targetRole || n.targetRole === 'all');
          }
        } else {
          docs = docs.filter(n => n.creatorId === user.uid && n.targetRole !== 'admin');
        }

        docs.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });

        setNotifications(docs);
        setLoading(false);
      }, (err) => {
        if (!isSubscribed) return;

        if (err.code === 'permission-denied') {
          if (retryCount < 3) {
            retryCount++;
            console.warn(`Transient permission warning on fetching notifications, retrying (${retryCount}/3)...`);
            setTimeout(() => {
              if (isSubscribed) {
                if (unsub) unsub();
                startListening();
              }
            }, 1000);
            return;
          }
        }
        console.warn("Could not load notifications:", err.message);
        setLoading(false);
      });
    };

    startListening();

    return () => {
      isSubscribed = false;
      if (unsub) unsub();
    };
  }, [user, role, roleFilter]);

  const handleMarkAsRead = async (notifId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notifId), { read: true });
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const handleDelete = async (notifId: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', notifId));
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  const handleMarkAllRead = async () => {
    const unreadNotifs = notifications.filter(n => !n.read);
    if (unreadNotifs.length === 0) return;

    try {
      const batch = writeBatch(db);
      unreadNotifs.forEach(n => {
        batch.update(doc(db, 'notifications', n.id), { read: true });
      });
      await batch.commit();
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    await handleMarkAsRead(notif.id);
    
    let targetLink = notif.link;

    // Normalize legacy or wrong paths
    if (targetLink) {
      targetLink = targetLink
        .replace('/deliveries', '/campaign-deliveries')
        .replace('/recurring-contracts', '/recurring');

      // If user is creator, ensure they land on their own profile page if link targets /creators/:id
      if (role === 'creator' && user?.uid && targetLink.startsWith('/creators/')) {
        targetLink = targetLink.replace(/\/creators\/[^?#]+/, `/creators/${user.uid}`);
      }

      navigate(targetLink);
      return;
    }

    if (notif.type === 'contract' || notif.contractId) {
      if (role === 'creator' && user?.uid) {
        navigate(`/creators/${user.uid}?tab=recurring`);
      } else {
        navigate('/recurring');
      }
      return;
    }

    if (notif.type === 'delivery_review') {
      if (role === 'admin') {
        navigate('/campaign-deliveries');
      } else if (user?.uid) {
        navigate(`/creators/${user.uid}?tab=dashboard`);
      }
      return;
    }

    if (notif.campaignId && role === 'admin') {
      navigate(`/campaigns/${notif.campaignId}`);
    } else if (notif.creatorId && role === 'admin') {
      navigate(`/creators/${notif.creatorId}`);
    } else if (role === 'creator' && user?.uid) {
      navigate(`/creators/${user.uid}?tab=dashboard`);
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'applications') return n.type === 'application';
    if (filter === 'deliveries') return n.type === 'delivery_review' || n.type === 'approval' || n.type === 'rejection';
    if (filter === 'contracts') return n.type === 'contract';
    return true;
  });

  const getNotificationStyles = (type: string) => {
    switch (type) {
      case 'application':
        return {
          label: 'Candidatura',
          icon: UserPlus,
          bg: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        };
      case 'approval':
        return {
          label: 'Aprovação',
          icon: CheckCircle2,
          bg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        };
      case 'rejection':
        return {
          label: 'Ajustes / Feedback',
          icon: XCircle,
          bg: 'bg-rose-50 text-rose-600 border-rose-100',
        };
      case 'delivery_review':
        return {
          label: 'Revisão de Conteúdo',
          icon: FileText,
          bg: 'bg-amber-50 text-amber-600 border-amber-100',
        };
      case 'contract':
        return {
          label: 'Contrato Recorrente',
          icon: Repeat,
          bg: 'bg-purple-50 text-purple-600 border-purple-100',
        };
      default:
        return {
          label: 'Informativo',
          icon: Bell,
          bg: 'bg-slate-50 text-slate-600 border-slate-100',
        };
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const diffMs = new Date().getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Agora mesmo';
      if (diffMins < 60) return `Há ${diffMins} min`;
      if (diffHours < 24) return `Há ${diffHours} h`;
      return `Há ${diffDays} d`;
    } catch {
      return '';
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-[#0F172A] m-0 flex items-center gap-2">
              <Bell className="text-brand-primary" size={24} />
              Central de Notificações
            </h1>
            {unreadCount > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse shadow-md shadow-rose-200">
                {unreadCount} Nova{unreadCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="m-1 mt-1 text-[#64748B] text-xs font-medium">
            Acompanhe solicitações de aprovação, envio de materiais e interações em tempo real.
          </p>
        </div>
        
        {unreadCount > 0 && (
          <button 
            onClick={handleMarkAllRead}
            className="h-9 px-3.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Check size={14} />
            Marcar todas como lidas
          </button>
        )}
      </header>

      {/* Admin Scope Selector */}
      {role === 'admin' && (
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-brand-primary" />
            <span className="text-xs font-extrabold text-slate-800">Filtrar por Permissão / Destino:</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-indigo-100 shadow-xs">
            <button
              onClick={() => setRoleFilter('admin_only')}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                roleFilter === 'admin_only' 
                  ? "bg-brand-primary text-white shadow-xs" 
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Exclusivas da Agência
            </button>
            <button
              onClick={() => setRoleFilter('all')}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                roleFilter === 'all' 
                  ? "bg-brand-primary text-white shadow-xs" 
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              Todas do Sistema (Visão Completa)
            </button>
          </div>
        </div>
      )}

      {/* Tabs / Filters */}
      <div className="flex items-center gap-2 border-b border-[#E2E8F0] overflow-x-auto scrollbar-hide pb-0.5">
        {(['all', 'unread', 'applications', 'deliveries', 'contracts'] as const).map(f => {
          const isActive = filter === f;
          const label = f === 'all' ? 'Todas' :
                        f === 'unread' ? `Não Lidas (${unreadCount})` :
                        f === 'applications' ? 'Candidaturas' :
                        f === 'deliveries' ? 'Entregas & Aprovações' : 'Contratos Recorrentes';
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-3 text-xs font-extrabold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap cursor-pointer",
                isActive 
                  ? "border-brand-primary text-brand-primary" 
                  : "border-transparent text-slate-500 hover:text-slate-900"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-primary mb-3"></div>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Buscando atualizações...</p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-[#E2E8F0] p-8">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-4">
             <BellOff size={28} />
          </div>
          <h3 className="text-base font-bold text-slate-700">Nenhuma notificação por aqui!</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Não foram encontradas notificações com os filtros selecionados. As atualizações de aprovação, novos materiais e convites de campanhas aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {filteredNotifications.map(notif => {
              const style = getNotificationStyles(notif.type);
              const Icon = style.icon;
              return (
                <motion.div 
                  key={notif.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className={cn(
                    "group relative bg-white border rounded-2xl p-5 hover:shadow-lg hover:shadow-indigo-900/5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4",
                    notif.read ? 'border-slate-200 opacity-80 hover:opacity-100' : 'border-indigo-100 shadow-xs shadow-indigo-100/30'
                  )}
                >
                  {/* Left indicator for unread */}
                  {!notif.read && (
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-brand-primary shadow-sm shadow-brand-primary" />
                  )}

                  <div className="flex items-start gap-4 flex-1">
                    <div className={cn("w-10 h-10 rounded-xl shrink-0 border flex items-center justify-center shadow-xs", style.bg)}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border", style.bg)}>
                          {style.label}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                          <Clock size={10} /> {formatTimeAgo(notif.createdAt)}
                        </span>
                        {notif.targetRole && (
                          <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                            {notif.targetRole === 'admin' ? 'Destino: Agência' : 'Destino: Criador'}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mt-1.5 leading-snug">{notif.title}</h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed font-medium">{notif.message}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    <button 
                      onClick={() => handleNotificationClick(notif)}
                      className="h-8 px-3 bg-indigo-50 hover:bg-brand-primary text-brand-primary hover:text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 border border-indigo-100 cursor-pointer shadow-2xs"
                      title="Ir diretamente para a tela da ação"
                    >
                      <span>Ir para Ação</span>
                      <ExternalLink size={11} />
                    </button>

                    {!notif.read && (
                      <button 
                        onClick={() => handleMarkAsRead(notif.id)}
                        className="h-8 w-8 bg-slate-50 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-xl transition-colors flex items-center justify-center border border-slate-200 cursor-pointer"
                        title="Marcar como lida"
                      >
                        <Check size={13} />
                      </button>
                    )}

                    <button 
                      onClick={() => handleDelete(notif.id)}
                      className="h-8 w-8 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-colors flex items-center justify-center border border-slate-200 cursor-pointer"
                      title="Excluir notificação"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
