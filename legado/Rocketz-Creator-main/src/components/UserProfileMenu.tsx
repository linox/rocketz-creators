import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  User, 
  Settings, 
  LogOut, 
  ChevronDown, 
  ShieldCheck, 
  Sparkles, 
  Building2, 
  Edit3, 
  Mail, 
  Smartphone, 
  Instagram, 
  MapPin, 
  Layers, 
  Users, 
  CreditCard,
  ExternalLink,
  Shield,
  Video,
  Megaphone,
  FileText,
  Scale
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { logout } from '../lib/firebase';
import { cn } from '../lib/utils';
import { UserAvatar } from './UserAvatar';

interface UserProfileMenuProps {
  user: any;
  role?: 'admin' | 'creator' | 'company' | null;
  userData?: any;
  onOpenEditProfile: () => void;
  onOpenLgpdModal: () => void;
  onOpenContractModal?: () => void;
  variant?: 'header' | 'sidebar';
}

export function UserProfileMenu({
  user,
  role,
  userData,
  onOpenEditProfile,
  onOpenLgpdModal,
  onOpenContractModal,
  variant = 'header'
}: UserProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!user) return null;

  const displayName = userData?.fullName || userData?.name || user.displayName || 'Usuário';
  const artisticName = userData?.artisticName;
  const photoURL = userData?.photoUrl || userData?.logoUrl || user.photoURL;
  const email = user.email || userData?.email || '';
  const phone = userData?.whatsapp || '';
  const instagram = userData?.socials?.instagram || '';
  const locationText = [userData?.city, userData?.state].filter(Boolean).join(' - ');

  const getRoleBadge = () => {
    if (role === 'admin') {
      return {
        label: 'Administrador',
        sublabel: 'Gestão da Agência',
        bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        sidebarBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
        dot: 'bg-indigo-500'
      };
    }
    if (role === 'company') {
      return {
        label: 'Empresa',
        sublabel: userData?.companyName || 'Empresa Parceira',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        sidebarBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        dot: 'bg-emerald-500'
      };
    }
    return {
      label: 'Criador',
      sublabel: 'Creator Verificado',
      bg: 'bg-purple-50 text-purple-700 border-purple-200',
      sidebarBg: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      dot: 'bg-purple-500'
    };
  };

  const roleInfo = getRoleBadge();

  if (variant === 'sidebar') {
    return (
      <div className="relative" ref={menuRef}>
        <div className="p-2 bg-[#1e293b]/70 border border-[#334155] rounded-2xl">
          {/* User Info Header in Sidebar */}
          <div className="flex items-center gap-2.5 p-1.5">
            <div className="relative shrink-0">
              <UserAvatar
                src={photoURL}
                name={displayName}
                size="custom"
                className="w-9 h-9 border border-slate-600 shadow-xs"
                textClassName="text-xs"
              />
              <span className={cn("absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#1e293b]", roleInfo.dot)} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-white truncate">{displayName}</p>
              <p className="text-[10px] text-slate-400 truncate">{email}</p>
            </div>
          </div>

          {/* Action buttons inside Sidebar User Card */}
          <div className="mt-2 pt-2 border-t border-[#334155]/60 flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenEditProfile}
              className="flex-1 py-1.5 px-2 bg-white/10 hover:bg-brand-primary text-white text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              title="Editar Informações do Perfil"
            >
              <Edit3 size={13} />
              <span>Editar Perfil</span>
            </button>

            <button
              type="button"
              onClick={logout}
              className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-500/20 rounded-lg transition-colors cursor-pointer"
              title="Sair da Conta"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Header Dropdown Variant
  return (
    <div className="relative" ref={menuRef}>
      {/* Header Button Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "h-10 pl-1.5 pr-3 bg-white border border-slate-200 hover:border-slate-300 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-xs group",
          isOpen && "ring-2 ring-brand-primary/20 border-brand-primary"
        )}
        title="Menu e Informações do Usuário"
      >
        <div className="relative shrink-0">
          <UserAvatar
            src={photoURL}
            name={displayName}
            size="custom"
            shape="rounded-lg"
            className="w-7 h-7 border border-slate-200"
            textClassName="text-[10px]"
          />
          <span className={cn("absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white", roleInfo.dot)} />
        </div>

        <div className="hidden sm:flex flex-col text-left">
          <span className="text-xs font-bold text-slate-800 truncate max-w-[120px] leading-tight">
            {displayName.split(' ')[0]}
          </span>
          <span className="text-[10px] text-slate-400 font-medium leading-tight">
            {roleInfo.label}
          </span>
        </div>

        <ChevronDown 
          size={14} 
          className={cn("text-slate-400 group-hover:text-slate-700 transition-transform duration-200", isOpen && "rotate-180")} 
        />
      </button>

      {/* Popover Card */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 mt-2 w-80 sm:w-88 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 flex flex-col"
          >
            {/* Top Banner & Profile Overview */}
            <div className="p-4 bg-gradient-to-br from-slate-50 to-indigo-50/40 border-b border-slate-100">
              <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                  <UserAvatar
                    src={photoURL}
                    name={displayName}
                    size="custom"
                    shape="rounded-2xl"
                    className="w-13 h-13 border-2 border-white shadow-md"
                    textClassName="text-base"
                  />
                  <span className={cn("absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-xs", roleInfo.dot)} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-black border uppercase tracking-wider", roleInfo.bg)}>
                      {roleInfo.label}
                    </span>
                    {artisticName && (
                      <span className="text-[10px] text-slate-500 font-medium">
                        ({artisticName})
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-black text-slate-900 truncate" title={displayName}>
                    {displayName}
                  </h3>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate mt-0.5">
                    <Mail size={12} className="shrink-0 text-slate-400" />
                    <span className="truncate">{email}</span>
                  </div>
                </div>
              </div>

              {/* Extra Details Chips */}
              {(phone || instagram || locationText) && (
                <div className="mt-3 pt-3 border-t border-slate-200/60 flex flex-wrap gap-2 text-[11px] text-slate-600">
                  {phone && (
                    <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200/80 shadow-2xs">
                      <Smartphone size={11} className="text-slate-400" />
                      <span>{phone}</span>
                    </div>
                  )}
                  {instagram && (
                    <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200/80 shadow-2xs">
                      <Instagram size={11} className="text-pink-500" />
                      <span>@{instagram.replace(/^@/, '')}</span>
                    </div>
                  )}
                  {locationText && (
                    <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200/80 shadow-2xs">
                      <MapPin size={11} className="text-emerald-500" />
                      <span>{locationText}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Action Button: Edit Profile */}
            <div className="p-3 bg-white border-b border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenEditProfile();
                }}
                className="w-full py-2.5 px-4 bg-brand-primary hover:bg-indigo-600 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Edit3 size={15} />
                <span>Editar Meu Perfil</span>
              </button>
            </div>

            {/* Navigation & Contextual Links */}
            <div className="p-2 space-y-1">
              {role === 'creator' && (
                <>
                  <Link
                    to={`/creators/${user.uid}?tab=about_me`}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-brand-primary rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Sparkles size={15} className="text-brand-primary" />
                      <span>Meu Perfil & Mídia Kit</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Público</span>
                  </Link>

                  <Link
                    to={`/creators/${user.uid}?tab=campaigns`}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-brand-primary rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Megaphone size={15} className="text-amber-500" />
                      <span>Minhas Campanhas</span>
                    </div>
                  </Link>

                  <Link
                    to={`/creators/${user.uid}?tab=portfolio`}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-brand-primary rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Video size={15} className="text-teal-500" />
                      <span>Portfólio & Vídeos</span>
                    </div>
                  </Link>
                </>
              )}

              {role === 'admin' && (
                <Link
                  to="/admin-users"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-brand-primary rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Users size={15} className="text-indigo-600" />
                    <span>Gestão de Equipe & Usuários</span>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">Admin</span>
                </Link>
              )}

              {role === 'company' && (
                <Link
                  to="/company-dashboard"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-brand-primary rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Building2 size={15} className="text-emerald-600" />
                    <span>Painel da Empresa</span>
                  </div>
                </Link>
              )}

              {onOpenContractModal && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenContractModal();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-xl transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <FileText size={15} className="text-purple-600" />
                    <span>Termo de Adesão & Uso de Imagem</span>
                  </div>
                  <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">Oficial</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenLgpdModal();
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck size={15} className="text-emerald-600" />
                  <span>Privacidade e Proteção LGPD</span>
                </div>
              </button>
            </div>

            {/* Footer / Logout */}
            <div className="p-2 border-t border-slate-100 bg-slate-50/60">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
              >
                <LogOut size={15} className="text-rose-500" />
                <span>Sair da Conta</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
