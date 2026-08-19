import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  BarChart3, 
  Users, 
  Building2, 
  Megaphone, 
  Menu, 
  X, 
  LogOut,
  LayoutDashboard,
  Home,
  CheckSquare,
  Globe,
  Sparkles,
  Bell,
  Video,
  Repeat,
  Eye,
  EyeOff,
  ShieldCheck
} from 'lucide-react';
import { cn } from '../lib/utils';
import { usePrivacy } from '../context/PrivacyContext';
import { LgpdPrivacyModal } from './LgpdPrivacyModal';
import { LgpdBanner } from './LgpdBanner';
import { auth, logout, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

import { CreatorSwitcher } from './CreatorSwitcher';
import { RocketzLogo } from './RocketzLogo';
import { UserProfileMenu } from './UserProfileMenu';
import { EditProfileModal } from './EditProfileModal';
import { CreatorContractModal } from './CreatorContractModal';
import { doc, getDoc } from 'firebase/firestore';

interface SidebarItemProps {
  to: string;
  icon: any;
  label: string;
  active?: boolean;
  onClick?: () => void;
  key?: any;
  badgeCount?: number;
}

function SidebarItem({ to, icon: Icon, label, active, onClick, badgeCount }: SidebarItemProps) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium w-full",
        active 
          ? "bg-[#1F2937] text-[#F8FAFC]" 
          : "text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/5"
      )}
    >
      <div className="flex items-center gap-3">
        <Icon size={18} />
        <span>{label}</span>
      </div>
      {badgeCount !== undefined && badgeCount > 0 && (
        <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[16px] text-center shrink-0">
          {badgeCount}
        </span>
      )}
    </Link>
  );
}

export default function AppLayout({ children, role }: { children: React.ReactNode; role?: 'admin' | 'creator' | 'company' | null }) {
  const { hideValues, toggleHideValues, openLgpdModal } = usePrivacy();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingSelectionCount, setPendingSelectionCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleAdvancedFilters = () => {
    if (location.pathname === '/creators') {
      const isFiltersActive = searchParams.get('filters') === 'true';
      if (isFiltersActive) {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('filters');
        setSearchParams(newParams);
      } else {
        const newParams = new URLSearchParams(searchParams);
        newParams.set('filters', 'true');
        setSearchParams(newParams);
      }
    } else {
      navigate('/creators?filters=true');
    }
  };

  const handleNewCampaign = () => {
    if (location.pathname === '/campaigns') {
      const isNewCampaignActive = searchParams.get('new') === 'true';
      if (isNewCampaignActive) {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('new');
        setSearchParams(newParams);
      } else {
        const newParams = new URLSearchParams(searchParams);
        newParams.set('new', 'true');
        setSearchParams(newParams);
      }
    } else {
      navigate('/campaigns?new=true');
    }
  };

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setUserData(null);
      }
    });
  }, []);

  // Fetch / listen to real-time user document data from Firestore
  useEffect(() => {
    if (!user) {
      setUserData(null);
      return;
    }

    // Default fallback
    setUserData({
      fullName: user.displayName,
      email: user.email,
      photoUrl: user.photoURL
    });

    const colName = role === 'company' ? 'companyUsers' : 'creators';
    const unsub = onSnapshot(doc(db, colName, user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserData((prev: any) => ({
          ...prev,
          ...data,
          fullName: data.fullName || data.name || user.displayName,
          email: data.email || user.email,
          photoUrl: data.photoUrl || data.logoUrl || user.photoURL
        }));
      }
    }, (err) => {
      console.warn("Could not load real-time user profile data:", err.message);
    });

    return () => unsub();
  }, [user, role]);

  useEffect(() => {
    if (!user || !role) {
      setUnreadCount(0);
      return;
    }

    let q;
    if (role === 'admin') {
      q = query(collection(db, 'notifications'), where('read', '==', false));
    } else {
      q = query(collection(db, 'notifications'), where('creatorId', '==', user.uid));
    }

    let unsub: (() => void) | undefined;
    let isSubscribed = true;
    let retryCount = 0;

    const startListening = () => {
      if (!isSubscribed) return;

      unsub = onSnapshot(q, (snap) => {
        if (!isSubscribed) return;
        const unreadDocs = snap.docs.filter(d => {
          const data = d.data();
          if (data.read) return false;
          if (role === 'admin') {
            // Admin sees notifications targeted to admin or general/legacy notifications
            return data.targetRole === 'admin' || !data.targetRole || data.targetRole === 'all';
          } else {
            // Creator sees notifications targeted to them or general
            return data.creatorId === user.uid && (data.targetRole === 'creator' || !data.targetRole || data.targetRole === 'all');
          }
        });
        setUnreadCount(unreadDocs.length);
      }, (err) => {
        if (!isSubscribed) return;
        
        if (err.code === 'permission-denied') {
          if (retryCount < 3) {
            retryCount++;
            console.warn(`Transient permission warning on notifications count, retrying (${retryCount}/3)...`);
            setTimeout(() => {
              if (isSubscribed) {
                if (unsub) unsub();
                startListening();
              }
            }, 1000);
            return;
          }
        }
        console.warn("Could not load notifications count:", err.message);
      });
    };

    startListening();

    return () => {
      isSubscribed = false;
      if (unsub) unsub();
    };
  }, [user, role]);

  useEffect(() => {
    if (!user || role !== 'admin') {
      setPendingSelectionCount(0);
      return;
    }

    const q = query(
      collection(db, 'campaignCreators'),
      where('applicationStatus', '==', 'pending')
    );

    const unsub = onSnapshot(q, (snap) => {
      setPendingSelectionCount(snap.docs.length);
    }, (err) => {
      console.warn("Could not load pending selection count:", err.message);
    });

    return () => unsub();
  }, [user, role]);

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/creators', icon: Users, label: 'Criadores' },
    { to: '/companies', icon: Building2, label: 'Empresas' },
    { to: '/campaigns', icon: Megaphone, label: 'Campanhas' },
  ];

  const isPublicRoute = location.pathname === '/' || location.pathname === '/join' || location.pathname === '/landing' || location.pathname === '/login';

  if (!user) {
    if (isPublicRoute) {
      return <div className="min-h-screen bg-[#0F172A] w-full">{children}</div>;
    }
    return <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB] p-4">{children}</div>;
  }

  // If logged in, but visiting custom landing url, render raw for previewing
  if (isPublicRoute && location.pathname !== '/') {
    return <div className="min-h-screen bg-[#0F172A] w-full">{children}</div>;
  }

  return (
    <div className="h-screen h-[100dvh] w-full bg-[#F9FAFB] flex font-sans overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-[240px] bg-[#111827] text-[#94A3B8] z-50 transition-transform lg:translate-x-0 lg:static lg:block h-full shrink-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full p-6">
          <div className="mb-8 flex items-center justify-center w-full py-1">
            <RocketzLogo variant="dark" size="md" to="/" className="items-center text-center mx-auto" />
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto">
            {role === 'admin' ? (
              <>
                <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2 px-3">Painel Agência</div>
                {navItems.map((item) => (
                  <SidebarItem
                    key={item.to}
                    to={item.to}
                    icon={item.icon}
                    label={item.label}
                    active={location.pathname === item.to}
                    onClick={() => setIsSidebarOpen(false)}
                    badgeCount={item.to === '/campaigns' ? pendingSelectionCount : undefined}
                  />
                ))}

                <SidebarItem
                  to="/campaign-deliveries?tab=campaigns"
                  icon={Video}
                  label="Entregas & Vídeos"
                  active={location.pathname === '/campaign-deliveries' && (searchParams.get('tab') === 'campaigns' || !searchParams.get('tab'))}
                  onClick={() => setIsSidebarOpen(false)}
                />

                <SidebarItem
                  to="/campaign-deliveries?tab=recurring"
                  icon={Repeat}
                  label="Trabalhos Recorrentes"
                  active={location.pathname === '/recurring' || (location.pathname === '/campaign-deliveries' && searchParams.get('tab') === 'recurring')}
                  onClick={() => setIsSidebarOpen(false)}
                />

                <SidebarItem
                  to="/notifications"
                  icon={Bell}
                  label="Notificações"
                  active={location.pathname === '/notifications'}
                  onClick={() => setIsSidebarOpen(false)}
                  badgeCount={unreadCount}
                />

                <SidebarItem
                  to="/admin-users"
                  icon={ShieldCheck}
                  label="Usuários Admin"
                  active={location.pathname === '/admin-users'}
                  onClick={() => setIsSidebarOpen(false)}
                />

                {user && (
                  <div className="pt-6 mt-6 border-t border-[#1E293B]">
                    <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2 px-3">Atalhos Rápidos</div>
                    <SidebarItem
                      to={`/creators/${user.uid}`}
                      icon={Sparkles}
                      label="Visão como Criador"
                      active={location.pathname === `/creators/${user.uid}`}
                      onClick={() => setIsSidebarOpen(false)}
                    />
                    <SidebarItem
                      to="/available-campaigns"
                      icon={Sparkles}
                      label="Campanhas Disponíveis"
                      active={location.pathname === '/available-campaigns'}
                      onClick={() => setIsSidebarOpen(false)}
                    />
                    <SidebarItem
                      to="/company-dashboard"
                      icon={Building2}
                      label="Portal da Empresa"
                      active={location.pathname === '/company-dashboard'}
                      onClick={() => setIsSidebarOpen(false)}
                    />
                    <SidebarItem
                      to="/join"
                      icon={Globe}
                      label="Landing Page"
                      active={location.pathname === '/join'}
                      onClick={() => setIsSidebarOpen(false)}
                    />
                  </div>
                )}
              </>
            ) : role === 'company' ? (
              <>
                <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2 px-3">Painel da Empresa</div>
                <SidebarItem
                  to="/company-dashboard"
                  icon={Building2}
                  label="Painel de Campanhas"
                  active={location.pathname === '/company-dashboard'}
                  onClick={() => setIsSidebarOpen(false)}
                />
                <SidebarItem
                  to="/available-campaigns"
                  icon={Sparkles}
                  label="Campanhas Disponíveis"
                  active={location.pathname === '/available-campaigns'}
                  onClick={() => setIsSidebarOpen(false)}
                />
                <SidebarItem
                  to="/campaign-deliveries?tab=recurring"
                  icon={Repeat}
                  label="Trabalhos Recorrentes"
                  active={location.pathname === '/recurring' || (location.pathname === '/campaign-deliveries' && searchParams.get('tab') === 'recurring')}
                  onClick={() => setIsSidebarOpen(false)}
                />
                <SidebarItem
                  to="/campaign-deliveries?tab=campaigns"
                  icon={Video}
                  label="Entregas & Vídeos"
                  active={location.pathname === '/campaign-deliveries' && (searchParams.get('tab') === 'campaigns' || !searchParams.get('tab'))}
                  onClick={() => setIsSidebarOpen(false)}
                />
                <SidebarItem
                  to="/notifications"
                  icon={Bell}
                  label="Notificações"
                  active={location.pathname === '/notifications'}
                  onClick={() => setIsSidebarOpen(false)}
                  badgeCount={unreadCount}
                />
                <SidebarItem
                  to="/join"
                  icon={Globe}
                  label="Ver Landing Page"
                  active={location.pathname === '/join'}
                  onClick={() => setIsSidebarOpen(false)}
                />
              </>
            ) : (
              user && (
                <>
                  <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2 px-3">Portal do Criador</div>
                  <SidebarItem
                    to={`/creators/${user.uid}?tab=dashboard`}
                    icon={Home}
                    label="Início / Central"
                    active={location.pathname === `/creators/${user.uid}` && (searchParams.get('tab') === 'dashboard' || !searchParams.get('tab'))}
                    onClick={() => setIsSidebarOpen(false)}
                  />
                  <SidebarItem
                    to="/available-campaigns"
                    icon={Sparkles}
                    label="Campanhas Disponíveis"
                    active={location.pathname === '/available-campaigns'}
                    onClick={() => setIsSidebarOpen(false)}
                  />
                  <SidebarItem
                    to={`/creators/${user.uid}?tab=campaigns`}
                    icon={Megaphone}
                    label="Minhas Campanhas"
                    active={location.pathname === `/creators/${user.uid}` && searchParams.get('tab') === 'campaigns'}
                    onClick={() => setIsSidebarOpen(false)}
                  />
                  <SidebarItem
                    to={`/creators/${user.uid}?tab=recurring`}
                    icon={Repeat}
                    label="Trabalhos Recorrentes"
                    active={location.pathname === '/recurring' || (location.pathname === `/creators/${user.uid}` && searchParams.get('tab') === 'recurring')}
                    onClick={() => setIsSidebarOpen(false)}
                  />
                  <SidebarItem
                    to={`/creators/${user.uid}?tab=portfolio`}
                    icon={Video}
                    label="Portfólio & Mídias"
                    active={location.pathname === `/creators/${user.uid}` && searchParams.get('tab') === 'portfolio'}
                    onClick={() => setIsSidebarOpen(false)}
                  />
                  <SidebarItem
                    to={`/creators/${user.uid}?tab=about_me`}
                    icon={Sparkles}
                    label="Meu Perfil & Mídia Kit"
                    active={location.pathname === `/creators/${user.uid}` && searchParams.get('tab') === 'about_me'}
                    onClick={() => setIsSidebarOpen(false)}
                  />
                  <SidebarItem
                    to="/notifications"
                    icon={Bell}
                    label="Notificações"
                    active={location.pathname === '/notifications'}
                    onClick={() => setIsSidebarOpen(false)}
                    badgeCount={unreadCount}
                  />
                  <SidebarItem
                    to="/join"
                    icon={Globe}
                    label="Página Inicial / Landing"
                    active={location.pathname === '/join'}
                    onClick={() => setIsSidebarOpen(false)}
                  />
                </>
              )
            )}
          </nav>

          <div className="mt-auto pt-4 border-t border-[#334155] space-y-2">
            <button
              onClick={openLgpdModal}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors text-xs font-bold uppercase tracking-wider cursor-pointer"
              title="Central de Privacidade e Proteção de Dados LGPD"
            >
              <ShieldCheck size={16} className="shrink-0 text-emerald-400" />
              <span>Privacidade LGPD</span>
            </button>

            {/* Sidebar User Card with User Info and Edit Profile Shortcut */}
            <UserProfileMenu
              user={user}
              role={role}
              userData={userData}
              onOpenEditProfile={() => setIsEditProfileModalOpen(true)}
              onOpenLgpdModal={openLgpdModal}
              onOpenContractModal={() => setIsContractModalOpen(true)}
              variant="sidebar"
            />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="h-16 sm:h-20 border-b border-[#E2E8F0] relative flex items-center justify-between px-3 sm:px-6 lg:px-10 shrink-0 bg-white z-10 gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button 
              className="lg:hidden p-2 text-[#64748B] hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu size={24} />
            </button>
            {/* Logo inline for mobile & tablet (no absolute overlay collision) */}
            <div className="lg:hidden flex items-center shrink-0">
              <RocketzLogo variant="light" size="sm" to="/" className="items-start text-left" />
            </div>
          </div>
          
          <div className="flex-1 flex items-center justify-end gap-1.5 sm:gap-2.5 lg:gap-3 min-w-0">
             {/* Dynamic Creator Simulation and Landing Page quick buttons */}
             <Link 
               to="/join"
               className="hidden xl:flex items-center gap-1.5 h-10 px-3 text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors uppercase tracking-wider shrink-0"
             >
               <Globe size={14} className="shrink-0" />
               Ver Landing Page
             </Link>
             
             {user && role === 'admin' && (
               <>
                 <div className="hidden xl:block shrink-0">
                   <CreatorSwitcher currentCreatorId={location.pathname.startsWith('/creators/') ? location.pathname.split('/creators/')[1] : user.uid} />
                 </div>
                 <Link 
                   to={`/creators/${user.uid}`}
                   className="hidden xl:flex items-center gap-1.5 h-10 px-3 text-xs font-bold text-indigo-600 hover:text-white border border-indigo-200 hover:border-indigo-600 rounded-lg bg-indigo-50 hover:bg-brand-primary transition-all uppercase tracking-wider shadow-sm shadow-indigo-100/50 shrink-0"
                 >
                   <Sparkles size={14} className="shrink-0" />
                   Portal do Criador
                 </Link>
               </>
             )}

             {user && (
               <Link 
                 to="/notifications"
                 className="relative h-10 w-10 flex items-center justify-center text-slate-600 hover:text-brand-primary hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg transition-all shrink-0"
                 title="Notificações"
               >
                 <Bell size={18} />
                 {unreadCount > 0 && (
                   <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-extrabold text-[9px] h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center animate-pulse">
                     {unreadCount}
                   </span>
                 )}
               </Link>
             )}

             {/* Financial Privacy Toggle Button */}
             <button
               type="button"
               onClick={toggleHideValues}
               className={cn(
                 "h-10 px-2.5 sm:px-3 flex items-center gap-1.5 rounded-lg border text-xs font-extrabold transition-all cursor-pointer shadow-xs shrink-0",
                 hideValues
                   ? "bg-amber-500/10 text-amber-700 border-amber-300 hover:bg-amber-500/20"
                   : "bg-white text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-50"
               )}
               title={hideValues ? "Mostrar valores monetários" : "Ocultar valores monetários"}
             >
               {hideValues ? (
                 <>
                   <EyeOff size={16} className="text-amber-600 shrink-0" />
                   <span className="hidden md:inline">Valores Ocultos</span>
                 </>
               ) : (
                 <>
                   <Eye size={16} className="text-slate-500 shrink-0" />
                   <span className="hidden md:inline">Ocultar Valores</span>
                 </>
               )}
             </button>

             {/* LGPD Center Header Button */}
              <button
                type="button"
                onClick={openLgpdModal}
                className="h-10 px-2.5 sm:px-3 flex items-center gap-1.5 rounded-lg border text-xs font-extrabold bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 transition-all cursor-pointer shadow-xs shrink-0"
                title="Central de Privacidade e Proteção de Dados LGPD"
              >
                <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                <span className="hidden md:inline">LGPD</span>
              </button>

              {role === 'admin' && <div className="h-5 w-px bg-slate-200 hidden lg:block shrink-0" />}

             {role === 'admin' && (
               <>
                 <button 
                   onClick={handleAdvancedFilters}
                   className="hidden lg:inline-flex bg-white border border-[#E2E8F0] px-3.5 py-2 rounded-lg text-xs font-semibold text-[#0F172A] hover:bg-slate-50 transition-colors shrink-0"
                 >
                   Filtros Avançados
                 </button>
                 <button 
                   onClick={handleNewCampaign}
                   className="hidden lg:inline-flex bg-brand-primary text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-md shadow-indigo-200 hover:bg-indigo-600 transition-all active:scale-95 shrink-0"
                 >
                   + Nova Campanha
                 </button>
               </>
             )}

             {/* Header User Profile Menu Button with Popover */}
             {user && (
               <UserProfileMenu
                 user={user}
                 role={role}
                 userData={userData}
                 onOpenEditProfile={() => setIsEditProfileModalOpen(true)}
                 onOpenLgpdModal={openLgpdModal}
                 onOpenContractModal={() => setIsContractModalOpen(true)}
                 variant="header"
               />
             )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10 pb-28 sm:pb-36">
          {children}
        </main>
      </div>

      {/* Edit User Profile Modal */}
      <EditProfileModal
        isOpen={isEditProfileModalOpen}
        onClose={() => setIsEditProfileModalOpen(false)}
        role={role}
        onProfileUpdated={(newData) => {
          setUserData((prev: any) => ({
            ...prev,
            ...newData
          }));
        }}
      />

      {/* Creator Contract Modal (Termo de Adesão & Uso de Imagem) */}
      <CreatorContractModal
        isOpen={isContractModalOpen}
        onClose={() => setIsContractModalOpen(false)}
        readOnly={role !== 'creator' || !!userData?.contractAcceptance}
        existingAuditRecord={userData?.contractAcceptance || null}
        creatorName={userData?.fullName || user?.displayName || ''}
        creatorEmail={userData?.email || user?.email || ''}
        creatorDocument={userData?.document || ''}
      />

      {/* LGPD Modals & Banners */}
      <LgpdPrivacyModal />
      <LgpdBanner />
    </div>
  );
}
