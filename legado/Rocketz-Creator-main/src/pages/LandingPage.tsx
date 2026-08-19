import React, { useState } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  Check, 
  CheckCircle2, 
  Instagram, 
  Youtube, 
  Linkedin, 
  Building2, 
  Users, 
  Calendar, 
  Layers, 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Video, 
  ShieldCheck, 
  X, 
  Menu,
  ChevronRight, 
  Tv, 
  Camera, 
  CheckCheck, 
  Smartphone,
  ExternalLink,
  Flame,
  Award,
  Globe2,
  Lock,
  Mail,
  User,
  Phone,
  MapPin,
  Clock
} from 'lucide-react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { RocketzLogo } from '../components/RocketzLogo';
import { CreatorContractStep } from '../components/CreatorContractStep';
import { CompanyLogoUpload } from '../components/CompanyLogoUpload';
import { CONTRACT_DECLARATIONS, CONTRACT_METADATA, CreatorContractAuditRecord } from '../data/creatorContractTerms';
import { formatCPF, isValidCPF, cleanCPF } from '../lib/cpfValidation';

export default function LandingPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);

  React.useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  // Modal States
  const [isCreatorModalOpen, setIsCreatorModalOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Creator Multi-Step Form
  const [creatorStep, setCreatorStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [artisticName, setArtisticName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [instagram, setInstagram] = useState('');
  const [category, setCategory] = useState('UGC Content');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [creatorSubmitting, setCreatorSubmitting] = useState(false);
  const [creatorSuccess, setCreatorSuccess] = useState(false);
  const [creatorError, setCreatorError] = useState<string | null>(null);

  // Company Lead/Registration Form
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState('');
  const [companyContactPerson, setCompanyContactPerson] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyWhatsapp, setCompanyWhatsapp] = useState('');
  const [companySegment, setCompanySegment] = useState('');
  const [companyNeed, setCompanyNeed] = useState('both');
  const [companySubmitting, setCompanySubmitting] = useState(false);
  const [companySuccess, setCompanySuccess] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);

  // Login Form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Mobile Navigation Menu State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Lock body scroll on modal open
  React.useEffect(() => {
    if (isCreatorModalOpen || isCompanyModalOpen || isLoginModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isCreatorModalOpen, isCompanyModalOpen, isLoginModalOpen]);

  const scrollTo = (id: string) => {
    setIsMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Handle Creator Register
  const handleCreatorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatorError(null);

    if (!fullName || !artisticName || !email || !whatsapp || !city || !state || !instagram || !password) {
      setCreatorError('Por favor, preencha todos os campos obrigatórios nas etapas anteriores.');
      return;
    }
    if (password !== confirmPassword) {
      setCreatorError('As senhas digitadas não coincidem.');
      return;
    }
    if (!lgpdAccepted) {
      setCreatorError('Você precisa autorizar o uso de dados de acordo com a LGPD para continuar.');
      return;
    }

    setCreatorSubmitting(true);

    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const userId = credential.user.uid;
      const cleanArtistic = artisticName.replace('@', '').trim();

      const newCreatorDoc = {
        id: userId,
        fullName: fullName.trim(),
        artisticName: cleanArtistic,
        cpf: '',
        document: '',
        contractAcceptance: null,
        whatsapp,
        email: email.trim().toLowerCase(),
        city,
        state,
        birthDate: '',
        pixKey: '',
        bankDetails: '',
        socials: {
          instagram: `https://instagram.com/${cleanArtistic}`,
          tiktok: '',
          youtube: '',
        },
        metrics: {
          followers: 0,
          avgViews: 0,
          avgEngagement: 0
        },
        categories: [category],
        pricing: {
          story: 0,
          reel: 0,
          post: 0,
          combo: 0
        },
        acceptsExchange: true,
        acceptsPaidTraffic: true,
        acceptsExclusivity: false,
        internalNotes: 'Auto-cadastrado via Landing Page.',
        status: 'review',
        portfolio: [],
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'creators', userId), newCreatorDoc);
      setCreatorSuccess(true);
      setCreatorSubmitting(false);

      setTimeout(() => {
        window.location.href = `/creators/${userId}`;
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setCreatorSubmitting(false);
      if (err.code === 'auth/email-already-in-use') {
        setCreatorError('O e-mail inserido já possui conta ativa. Faça login.');
      } else if (err.code === 'auth/weak-password') {
        setCreatorError('A senha cadastrada é fraca. Utilize pelo menos 6 caracteres.');
      } else {
        setCreatorError(err.message || 'Falha ao processar o cadastro.');
      }
    }
  };

  // Handle Company Registration
  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompanyError(null);

    if (!companyName || !companyEmail || !companyWhatsapp) {
      setCompanyError('Por favor, preencha o nome da empresa, e-mail e WhatsApp.');
      return;
    }

    setCompanySubmitting(true);

    try {
      await addDoc(collection(db, 'companies'), {
        name: companyName,
        logo: companyLogo.trim(),
        logoUrl: companyLogo.trim(),
        contactPerson: companyContactPerson,
        email: companyEmail,
        whatsapp: companyWhatsapp,
        segment: companySegment || 'Geral',
        needType: companyNeed,
        source: 'Landing Page Lead',
        status: 'pending', // Requires admin approval
        createdAt: serverTimestamp(),
        contacts: companyContactPerson ? [{
          id: String(Date.now()),
          name: companyContactPerson,
          email: companyEmail,
          phone: companyWhatsapp,
          role: 'Responsável Comercial'
        }] : []
      });

      setCompanySuccess(true);
      setCompanySubmitting(false);
    } catch (err: any) {
      console.error(err);
      setCompanySubmitting(false);
      setCompanyError('Não foi possível registrar seu contato. Tente novamente.');
    }
  };

  // Handle Fast Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!loginEmail || !loginPassword) {
      setLoginError('Por favor, informe seu e-mail e senha.');
      return;
    }

    setLoginSubmitting(true);

    try {
      const credential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const userId = credential.user.uid;
      const creatorSnap = await getDoc(doc(db, 'creators', userId));
      setLoginSubmitting(false);

      if (creatorSnap.exists()) {
        window.location.href = `/creators/${userId}`;
      } else {
        window.location.href = '/';
      }
    } catch (err: any) {
      console.error(err);
      setLoginSubmitting(false);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setLoginError('E-mail ou senha incorretos.');
      } else {
        setLoginError('Erro ao realizar login. Verifique suas credenciais.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFE] text-slate-900 flex flex-col font-sans w-full selection:bg-purple-600 selection:text-white relative overflow-x-hidden antialiased">
      
      {/* 1. NAVBAR / HEADER */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          
          {/* Brand Logo on the Left */}
          <div className="flex items-center shrink-0">
            <RocketzLogo variant="light" size="md" to="/" />
          </div>

          {/* Desktop Navigation Links (Visible on Large Screens lg+) */}
          <nav className="hidden lg:flex items-center gap-6 xl:gap-8 text-[14px] font-medium text-slate-600">
            <button 
              onClick={() => scrollTo('para-empresas')}
              className="hover:text-purple-600 transition-colors cursor-pointer"
            >
              Para empresas
            </button>
            <button 
              onClick={() => scrollTo('para-criadores')}
              className="hover:text-purple-600 transition-colors cursor-pointer"
            >
              Para criadores
            </button>
            <button 
              onClick={() => scrollTo('como-funciona')}
              className="hover:text-purple-600 transition-colors cursor-pointer"
            >
              Como funciona
            </button>
            <button 
              onClick={() => scrollTo('recursos')}
              className="hover:text-purple-600 transition-colors cursor-pointer"
            >
              Recursos
            </button>
          </nav>

          {/* Action Buttons on the Right + Tablet/Mobile Hamburger */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {currentUser ? (
              <Link
                to="/"
                className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-purple-600 text-white text-xs sm:text-sm font-semibold hover:bg-purple-700 transition-all shadow-sm shadow-purple-200"
              >
                Acessar Plataforma
              </Link>
            ) : (
              <>
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="hidden sm:inline-block px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:text-purple-600 transition-colors cursor-pointer"
                >
                  Entrar
                </button>
                <button
                  onClick={() => setIsCreatorModalOpen(true)}
                  className="px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm font-bold transition-all shadow-sm shadow-purple-300/50 flex items-center gap-1.5 cursor-pointer active:scale-98"
                >
                  <span>Cadastre-se</span>
                  <ArrowRight size={14} className="hidden sm:inline" />
                </button>
              </>
            )}

            {/* Mobile & Tablet Hamburger Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-slate-700 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors lg:hidden cursor-pointer"
              aria-label={isMobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile & Tablet Drawer / Dropdown Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden bg-white border-b border-slate-200 overflow-hidden shadow-xl"
            >
              <div className="px-4 py-5 space-y-3 max-w-7xl mx-auto flex flex-col">
                <button 
                  onClick={() => scrollTo('para-empresas')}
                  className="text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-700 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                >
                  Para empresas
                </button>
                <button 
                  onClick={() => scrollTo('para-criadores')}
                  className="text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-700 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                >
                  Para criadores
                </button>
                <button 
                  onClick={() => scrollTo('como-funciona')}
                  className="text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-700 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                >
                  Como funciona
                </button>
                <button 
                  onClick={() => scrollTo('recursos')}
                  className="text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-700 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                >
                  Recursos
                </button>

                {!currentUser && (
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:hidden gap-2">
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        setIsLoginModalOpen(true);
                      }}
                      className="w-full py-2.5 text-center text-sm font-semibold text-slate-700 hover:text-purple-600 border border-slate-200 rounded-xl"
                    >
                      Entrar
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative pt-12 pb-20 md:pt-16 md:pb-28 overflow-hidden bg-gradient-to-b from-purple-50/30 via-white to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Content Column */}
            <div className="lg:col-span-6 flex flex-col justify-center text-left">
              
              <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-black text-slate-950 tracking-tight leading-[1.12]">
                Conectamos marcas <br />
                a quem <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700">cria, influencia <br className="hidden sm:inline" />e gera resultados.</span>
              </h1>

              <p className="mt-6 text-base sm:text-lg text-slate-600 leading-relaxed font-normal max-w-xl">
                Encontre <strong className="font-semibold text-slate-900">influenciadores, UGC Creators e atores</strong> para campanhas pontuais ou trabalhos recorrentes. Tudo em um só lugar.
              </p>

              {/* Action Buttons with specific labels */}
              <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 max-w-md">
                <div className="flex-1 flex flex-col">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-1">
                    Para empresas
                  </span>
                  <button
                    onClick={() => setIsCompanyModalOpen(true)}
                    className="w-full py-3.5 px-6 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-md shadow-purple-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <span>Sou uma empresa</span>
                    <ArrowRight size={16} />
                  </button>
                </div>

                <div className="flex-1 flex flex-col">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 pl-1">
                    Para criadores
                  </span>
                  <button
                    onClick={() => setIsCreatorModalOpen(true)}
                    className="w-full py-3.5 px-6 rounded-xl bg-white hover:bg-purple-50/50 text-purple-700 border border-purple-200 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-98"
                  >
                    <span>Quero ser Creator</span>
                    <ArrowRight size={16} className="text-purple-600" />
                  </button>
                </div>
              </div>

              {/* 3 Badges under Hero CTA */}
              <div className="mt-12 pt-8 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0 mt-0.5">
                    <Calendar size={16} />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-slate-900 leading-tight">Campanhas</h2>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">pontuais ou recorrentes</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0 mt-0.5">
                    <Users size={16} />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-slate-900 leading-tight">Diversos perfis</h2>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">para cada objetivo e orçamento</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0 mt-0.5">
                    <BarChart3 size={16} />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-slate-900 leading-tight">Mais conteúdo</h2>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">menos custo e melhores resultados</p>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Visual Composition (Matching reference image) */}
            <div className="lg:col-span-6 relative flex items-center justify-center">
              <div className="relative w-full max-w-[540px] aspect-[4/3.8] rounded-3xl overflow-hidden shadow-2xl border border-slate-100 bg-slate-100">
                
                {/* Background image of creator producing content with smartphone */}
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=85"
                  alt="Criador de conteúdo gravando com smartphone"
                  className="w-full h-full object-cover object-center"
                  referrerPolicy="no-referrer"
                />
                
                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-slate-950/10 pointer-events-none" />

                {/* Floating Card Top-Right: Campaign Live Tracking */}
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="absolute top-4 right-4 bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-slate-100 max-w-[240px] w-full"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Campanha</p>
                      <h2 className="text-xs font-black text-slate-900">Novo lançamento</h2>
                    </div>
                    <span className="text-[9px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                      Em andamento
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-700 bg-slate-50/80 px-2.5 py-1.5 rounded-lg">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Layers size={13} className="text-purple-600" />
                        Briefing
                      </span>
                      <Check size={14} className="text-emerald-500 stroke-[3]" />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-700 bg-slate-50/80 px-2.5 py-1.5 rounded-lg">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Users size={13} className="text-purple-600" />
                        32 creators encontrados
                      </span>
                      <Check size={14} className="text-emerald-500 stroke-[3]" />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-700 bg-slate-50/80 px-2.5 py-1.5 rounded-lg">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Award size={13} className="text-purple-600" />
                        8 selecionados
                      </span>
                      <Check size={14} className="text-emerald-500 stroke-[3]" />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-700 bg-slate-50/80 px-2.5 py-1.5 rounded-lg">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Video size={13} className="text-purple-600" />
                        14 conteúdos entregues
                      </span>
                      <Check size={14} className="text-emerald-500 stroke-[3]" />
                    </div>
                  </div>
                </motion.div>

                {/* Floating Card Bottom-Left/Center: Approved UGC Content */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-xl border border-slate-100 max-w-[210px] w-full"
                >
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Conteúdo aprovado
                  </p>
                  
                  <div className="relative rounded-xl overflow-hidden aspect-video bg-slate-900 mb-2 group">
                    <img 
                      src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80"
                      alt="UGC Preview"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-slate-900/20 flex items-center justify-center">
                      <div className="w-7 h-7 rounded-full bg-white/90 shadow-md flex items-center justify-center text-purple-600">
                        <Video size={14} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    <span>Pronto para uso</span>
                  </div>
                </motion.div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 3. BENEFÍCIOS DE USAR A PLATAFORMA */}
      <section id="recursos" className="py-20 md:py-28 bg-[#FAFAFC]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              Benefícios de usar a plataforma
            </h2>
            <p className="mt-3 text-base sm:text-lg text-slate-600">
              Mais eficiência para suas campanhas com creators.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Card 1 */}
            <div className="bg-white p-7 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col group">
              <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <DollarSign size={26} />
              </div>
              <h3 className="text-lg font-bold text-slate-950 mb-2">
                Otimize investimentos
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Reduza desperdícios e direcione o orçamento para o que realmente gera resultado.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-white p-7 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col group">
              <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <Video size={26} />
              </div>
              <h3 className="text-lg font-bold text-slate-950 mb-2">
                Mais conteúdo, menos custo
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Produza diferentes conteúdos sem depender de grandes estruturas de gravação.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-white p-7 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col group">
              <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <TrendingUp size={26} />
              </div>
              <h3 className="text-lg font-bold text-slate-950 mb-2">
                Amplie seus resultados
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Testes, dados e diferentes perfis para descobrir o que funciona com o seu público.
              </p>
            </div>

            {/* Card 4 */}
            <div className="bg-white p-7 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col group">
              <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <Users size={26} />
              </div>
              <h3 className="text-lg font-bold text-slate-950 mb-2">
                Escala inteligente
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Transforme campanhas em parcerias recorrentes e tenha resultados consistentes.
              </p>
            </div>

          </div>

          {/* Perfis de Profissionais (Influenciadores, UGC, Atores) */}
          <div className="mt-16 bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-10 shadow-xs">
            <div className="max-w-2xl mb-8">
              <h2 className="text-2xl font-bold text-slate-950">
                Uma plataforma. Diferentes formas de criar resultados.
              </h2>
              <p className="text-slate-600 text-sm mt-2">
                Nem toda campanha precisa de um grande influenciador. Na Rocketz Creators, empresas encontram diferentes perfis de acordo com cada objetivo:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 text-purple-700 font-bold text-base mb-2">
                  <Users size={18} />
                  <span>Influenciadores</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Para gerar alcance, autoridade e conexão direta com comunidades engajadas.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 text-purple-700 font-bold text-base mb-2">
                  <Smartphone size={18} />
                  <span>UGC Creators</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Para produzir conteúdos naturais e autênticos para redes da marca e anúncios de alta conversão.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 text-purple-700 font-bold text-base mb-2">
                  <Tv size={18} />
                  <span>Atores e Apresentadores</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Para vídeos institucionais, demonstrações, tutoriais de produto e campanhas comerciais.
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 5. CAMPANHAS PONTUAIS OU TRABALHOS RECORRENTES */}
      <section id="como-funciona" className="py-20 md:py-28 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              Campanhas pontuais ou trabalhos recorrentes
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Bloco 1: Campanhas Pontuais */}
            <div className="bg-gradient-to-br from-purple-50/50 via-white to-slate-50 p-8 sm:p-10 rounded-3xl border border-purple-100/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-200">
                    <Calendar size={22} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-950">Campanhas pontuais</h3>
                    <p className="text-xs text-purple-600 font-semibold">Ações de começo, meio e fim</p>
                  </div>
                </div>

                <p className="text-slate-600 text-sm leading-relaxed mb-6">
                  Precisa divulgar um lançamento, promoção, evento ou produto específico? Encontre creators para ações sob medida com entregas pontuais.
                </p>

                <div className="flex flex-wrap gap-2 pt-2">
                  <span className="px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
                    Lançamentos
                  </span>
                  <span className="px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
                    Datas comemorativas
                  </span>
                  <span className="px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
                    Eventos
                  </span>
                  <span className="px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
                    Reviews
                  </span>
                  <span className="px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
                    Unboxing
                  </span>
                  <span className="px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
                    Demonstrações
                  </span>
                </div>
              </div>
            </div>

            {/* Bloco 2: Trabalhos Recorrentes */}
            <div className="bg-gradient-to-br from-indigo-50/50 via-white to-slate-50 p-8 sm:p-10 rounded-3xl border border-indigo-100/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
                    <Layers size={22} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-950">Trabalhos recorrentes</h3>
                    <p className="text-xs text-indigo-600 font-semibold">Parcerias e produção mensal contínua</p>
                  </div>
                </div>

                <p className="text-slate-600 text-sm leading-relaxed mb-6">
                  Crie uma rede de profissionais que passa a conhecer seus produtos, comunicação e público — reduzindo o tempo de produção e aumentando a consistência dos conteúdos.
                </p>

                <div className="flex flex-wrap gap-2 pt-2">
                  <span className="px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
                    Conteúdo mensal
                  </span>
                  <span className="px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
                    UGC recorrente
                  </span>
                  <span className="px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
                    Embaixadores
                  </span>
                  <span className="px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
                    Apresentadores
                  </span>
                  <span className="px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
                    Reviews contínuos
                  </span>
                  <span className="px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
                    E muito mais
                  </span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 6. IMPACTO REAL PARA O SEU NEGÓCIO & NÚMEROS */}
      <section className="py-20 md:py-28 bg-[#FAFAFC] border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              Impacto real para o seu negócio
            </h2>
            <p className="mt-3 text-base sm:text-lg text-slate-600">
              Usando a Rocketz Creators, sua marca consegue:
            </p>
          </div>

          {/* 4 Pillars with Arrows */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-1 text-purple-600 font-extrabold text-sm mb-2">
                <span>↓</span>
                <span>Reduzir</span>
              </div>
              <h3 className="text-2xl font-black text-slate-950 mb-2">custos</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Menor custo de produção e mais eficiência no uso do orçamento.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-1 text-purple-600 font-extrabold text-sm mb-2">
                <span>↑</span>
                <span>Aumentar</span>
              </div>
              <h3 className="text-2xl font-black text-slate-950 mb-2">conteúdo</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Mais variações de criativos para testar em diferentes canais e formatos.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-1 text-purple-600 font-extrabold text-sm mb-2">
                <span>↓</span>
                <span>Diminuir</span>
              </div>
              <h3 className="text-2xl font-black text-slate-950 mb-2">riscos</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Menor dependência de grandes influenciadores ou grandes produções.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-1 text-purple-600 font-extrabold text-sm mb-2">
                <span>↑</span>
                <span>Ampliar</span>
              </div>
              <h3 className="text-2xl font-black text-slate-950 mb-2">resultados</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Mais testes, mais dados e mais chances de encontrar o que realmente funciona.
              </p>
            </div>

          </div>

          {/* Consolidated Numbers Banner */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-10 shadow-xs">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
              
              <div className="flex items-center gap-4 pt-4 lg:pt-0 lg:px-4 first:pt-0">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <Users size={24} />
                </div>
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-950">+12.000</h3>
                  <p className="text-xs text-slate-500 font-medium">Creators cadastrados</p>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4 lg:pt-0 lg:px-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <Video size={24} />
                </div>
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-950">+35.000</h3>
                  <p className="text-xs text-slate-500 font-medium">Conteúdos produzidos</p>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4 lg:pt-0 lg:px-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <Award size={24} />
                </div>
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-950">+3.000</h3>
                  <p className="text-xs text-slate-500 font-medium">Campanhas realizadas</p>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4 lg:pt-0 lg:px-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-950">50+</h3>
                  <p className="text-xs text-slate-500 font-medium">Segmentos atendidos</p>
                </div>
              </div>

            </div>
          </div>

          <p className="text-center text-[11px] text-slate-400 mt-4">
            *Rede de criadores ativos e validados em todo o Brasil.
          </p>

        </div>
      </section>

      {/* 7. CONTEÚDO BOM É CONTEÚDO QUE TRABALHA */}
      <section className="py-16 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 mb-4">
            Conteúdo bom é conteúdo que trabalha.
          </h2>
          <p className="text-slate-600 text-sm max-w-2xl mx-auto mb-8">
            Um creator pode gerar muito mais do que uma publicação. O mesmo conteúdo pode alimentar múltiplos canais da sua marca:
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 max-w-4xl mx-auto">
            {['Instagram', 'TikTok', 'YouTube', 'Meta Ads', 'Landing Pages', 'Marketplace', 'Campanhas de Performance'].map((channel) => (
              <span 
                key={channel}
                className="px-5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs sm:text-sm font-bold text-slate-800 shadow-2xs hover:border-purple-300 hover:text-purple-700 transition-all cursor-default"
              >
                {channel}
              </span>
            ))}
          </div>

        </div>
      </section>

      {/* 8. CARDS DUPLOS DE CONVERSÃO (PARA EMPRESAS & PARA CRIADORES) */}
      <section className="py-20 md:py-28 bg-[#FAFAFC] border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* CARD PARA EMPRESAS */}
            <div id="para-empresas" className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-purple-600 bg-purple-50 px-3 py-1 rounded-full border border-purple-100">
                  Para empresas
                </span>
                
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 mt-4 mb-4">
                  Encontre o creator certo para cada objetivo.
                </h2>

                <ul className="space-y-3 mb-8">
                  {[
                    'Influenciadores, UGC Creators e atores',
                    'Campanhas pontuais ou recorrentes',
                    'Diversos perfis, nichos e estilos',
                    'Conteúdo para redes sociais e mídia paga',
                    'Uma plataforma completa para otimizar seus resultados'
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700 font-medium">
                      <CheckCircle2 size={18} className="text-purple-600 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                {/* Laptop Mockup Visual */}
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 aspect-video shadow-md mb-8">
                  <img
                    src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80"
                    alt="Plataforma de Gestão de Creators"
                    className="w-full h-full object-cover opacity-90"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-4">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Building2 size={14} className="text-purple-400" />
                      Gestão completa de campanhas e aprovações
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsCompanyModalOpen(true)}
                className="w-full py-4 px-6 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-md shadow-purple-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <span>Cadastrar minha empresa</span>
                <ArrowRight size={16} />
              </button>
            </div>

            {/* CARD PARA CRIADORES */}
            <div id="para-criadores" className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-purple-600 bg-purple-50 px-3 py-1 rounded-full border border-purple-100">
                  Para criadores
                </span>
                
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 mt-4 mb-4">
                  Seu próximo trabalho pode começar aqui.
                </h2>

                <ul className="space-y-3 mb-8">
                  {[
                    'Oportunidades com marcas incríveis',
                    'Campanhas pontuais e recorrentes',
                    'Diversos segmentos e formatos',
                    'Liberdade para criar do seu jeito',
                    'Cadastre-se grátis e comece agora'
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700 font-medium">
                      <CheckCircle2 size={18} className="text-purple-600 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                {/* Creator Recording Visual */}
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 aspect-video shadow-md mb-8">
                  <img
                    src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80"
                    alt="Criadora de Conteúdo"
                    className="w-full h-full object-cover opacity-90"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-4">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles size={14} className="text-purple-400" />
                      Não é preciso ter milhões de seguidores
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsCreatorModalOpen(true)}
                className="w-full py-4 px-6 rounded-xl bg-white hover:bg-purple-50/60 text-purple-700 border border-purple-200 font-bold text-sm shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <span>Quero fazer parte</span>
                <ArrowRight size={16} />
              </button>
            </div>

          </div>

        </div>
      </section>

      {/* 9. BANNER CTA FINAL (Dark Card Premium) */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-950 text-white rounded-3xl p-8 sm:p-12 lg:p-16 relative overflow-hidden shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-8 border border-slate-800">
            
            {/* Subtle Gradient Glow */}
            <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-purple-600/30 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -left-20 -top-20 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-xl text-center lg:text-left">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
                Pronto para transformar criadores em resultados?
              </h2>
              <p className="mt-3 text-slate-400 text-sm sm:text-base">
                Conecte sua marca a quem cria conteúdo que vende.
              </p>
            </div>

            <div className="relative z-10 flex flex-col sm:flex-row items-center gap-3.5 w-full lg:w-auto">
              <button
                onClick={() => setIsCompanyModalOpen(true)}
                className="w-full sm:w-auto py-3.5 px-6 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <span>Sou uma empresa</span>
                <ArrowRight size={16} />
              </button>

              <button
                onClick={() => setIsCreatorModalOpen(true)}
                className="w-full sm:w-auto py-3.5 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <span>Quero ser Creator</span>
                <ArrowRight size={16} />
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* 10. FOOTER COMPLETO */}
      <footer className="bg-white border-t border-slate-100 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-12 pb-12 border-b border-slate-100">
            
            {/* Brand column */}
            <div className="md:col-span-5 flex flex-col items-center md:items-start text-center md:text-left">
              <div className="mb-4 flex items-center justify-center md:justify-start">
                <RocketzLogo variant="light" size="md" to="/" />
              </div>

              <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
                Criadores certos. Conteúdos melhores. Mais possibilidades para sua marca.
              </p>
            </div>

            {/* Links column 1 */}
            <div className="md:col-span-3 flex flex-col gap-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-1">
                Plataforma
              </h3>
              <button onClick={() => scrollTo('para-empresas')} className="text-xs text-slate-600 hover:text-purple-600 text-left transition-colors cursor-pointer">
                Para empresas
              </button>
              <button onClick={() => scrollTo('para-criadores')} className="text-xs text-slate-600 hover:text-purple-600 text-left transition-colors cursor-pointer">
                Para criadores
              </button>
              <button onClick={() => scrollTo('como-funciona')} className="text-xs text-slate-600 hover:text-purple-600 text-left transition-colors cursor-pointer">
                Como funciona
              </button>
              <button onClick={() => scrollTo('recursos')} className="text-xs text-slate-600 hover:text-purple-600 text-left transition-colors cursor-pointer">
                Recursos
              </button>
            </div>

            {/* Links column 2 */}
            <div className="md:col-span-4 flex flex-col">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3">
                Siga a Rocketz Creators
              </h3>
              
              <div className="flex items-center gap-3 mb-6">
                <a 
                  href="https://instagram.com" 
                  target="_blank" 
                  rel="noreferrer"
                  className="w-9 h-9 rounded-full bg-slate-50 hover:bg-purple-50 text-slate-600 hover:text-purple-600 border border-slate-200/80 flex items-center justify-center transition-colors"
                >
                  <Instagram size={17} />
                </a>
                <a 
                  href="https://tiktok.com" 
                  target="_blank" 
                  rel="noreferrer"
                  className="w-9 h-9 rounded-full bg-slate-50 hover:bg-purple-50 text-slate-600 hover:text-purple-600 border border-slate-200/80 flex items-center justify-center transition-colors font-bold text-xs"
                >
                  Tk
                </a>
                <a 
                  href="https://youtube.com" 
                  target="_blank" 
                  rel="noreferrer"
                  className="w-9 h-9 rounded-full bg-slate-50 hover:bg-purple-50 text-slate-600 hover:text-purple-600 border border-slate-200/80 flex items-center justify-center transition-colors"
                >
                  <Youtube size={17} />
                </a>
                <a 
                  href="https://linkedin.com" 
                  target="_blank" 
                  rel="noreferrer"
                  className="w-9 h-9 rounded-full bg-slate-50 hover:bg-purple-50 text-slate-600 hover:text-purple-600 border border-slate-200/80 flex items-center justify-center transition-colors"
                >
                  <Linkedin size={17} />
                </a>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] text-slate-400">
                  Central de atendimento e suporte:
                </p>
                <p className="text-xs font-semibold text-slate-700">
                  contato@rocketzmkt.com.br
                </p>
              </div>
            </div>

          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
            <p>© 2026 Rocketz Creators. Todos os direitos reservados.</p>
            <div className="flex items-center gap-6">
              <span>Termos de Uso</span>
              <span>Privacidade (LGPD)</span>
              <span>Segurança da Informação</span>
            </div>
          </div>

        </div>
      </footer>

      {/* ========================================================================= */}
      {/* 11. MODAL CADASTRO DE CRIADORES (Multi-Step Completo) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isCreatorModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative my-8"
            >
              <button
                onClick={() => {
                  setIsCreatorModalOpen(false);
                  setCreatorStep(1);
                  setCreatorError(null);
                  setCreatorSuccess(false);
                }}
                className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>

              {creatorSuccess ? (
                <div className="py-8 text-center flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
                    <Clock size={36} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-950">Cadastro Enviado para Análise!</h3>
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl mt-3 text-left max-w-sm">
                    <p className="text-xs text-amber-900 font-bold leading-relaxed mb-1">
                      ⚠️ Aguardando aprovação do Administrador:
                    </p>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Seu perfil foi criado e está na fila de curadoria. Para ficar disponível para contratações e campanhas, seu cadastro precisa ser aprovado pelo admin.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setIsCreatorModalOpen(false);
                      setCreatorSuccess(false);
                      setCreatorStep(1);
                    }}
                    className="mt-6 px-6 py-2.5 rounded-xl bg-purple-600 text-white font-bold text-sm cursor-pointer hover:bg-purple-700 transition-all shadow-md"
                  >
                    Entendido, Acompanhar Aprovação
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-100">
                      Casting Oficial
                    </span>
                    <h3 className="text-2xl font-black text-slate-950 mt-2">
                      Quero ser Creator
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Etapa {creatorStep} de 3 — Preencha seus dados para receber oportunidades de campanhas.
                    </p>

                    {/* Step indicator */}
                    <div className="flex gap-2 mt-4">
                      <div className={`h-1.5 flex-1 rounded-full transition-all ${creatorStep >= 1 ? 'bg-purple-600' : 'bg-slate-100'}`} />
                      <div className={`h-1.5 flex-1 rounded-full transition-all ${creatorStep >= 2 ? 'bg-purple-600' : 'bg-slate-100'}`} />
                      <div className={`h-1.5 flex-1 rounded-full transition-all ${creatorStep >= 3 ? 'bg-purple-600' : 'bg-slate-100'}`} />
                    </div>
                  </div>

                  {creatorError && (
                    <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                      {creatorError}
                    </div>
                  )}

                  <form onSubmit={handleCreatorSubmit} className="space-y-4">
                    {/* ETAPA 1: Identificação & Redes */}
                    {creatorStep === 1 && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">
                            Nome Completo *
                          </label>
                          <input
                            type="text"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Ex: Maria Clara Silva"
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-purple-600 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">
                            Nome Artístico / Como prefere ser chamado(a) *
                          </label>
                          <input
                            type="text"
                            required
                            value={artisticName}
                            onChange={(e) => setArtisticName(e.target.value)}
                            placeholder="Ex: Clara Silva"
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-purple-600 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">
                            @ do Instagram *
                          </label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">@</span>
                            <input
                              type="text"
                              required
                              value={instagram}
                              onChange={(e) => setInstagram(e.target.value.replace('@', ''))}
                              placeholder="seu.perfil"
                              className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-purple-600 transition-colors"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">
                            Estilo Principal de Criação *
                          </label>
                          <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-purple-600 transition-colors"
                          >
                            <option value="UGC Content">UGC Content (Vídeos Naturais / Reviews)</option>
                            <option value="Influenciador">Influenciador / Criador de Nicho</option>
                            <option value="Ator / Apresentador">Ator / Apresentador / Locutor</option>
                            <option value="Moda & Beleza">Moda, Beleza e Lifestyle</option>
                            <option value="Fitness & Saúde">Fitness, Saúde e Bem-estar</option>
                            <option value="Gastronomia">Gastronomia e Culinária</option>
                            <option value="Tecnologia & Games">Tecnologia, Games e Setup</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (!fullName.trim() || !artisticName.trim() || !instagram.trim()) {
                              setCreatorError('Preencha todos os campos obrigatórios da etapa 1.');
                              return;
                            }
                            setCreatorError(null);
                            setCreatorStep(2);
                          }}
                          className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
                        >
                          <span>Avançar</span>
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    )}

                    {/* ETAPA 2: Contato & Localização */}
                    {creatorStep === 2 && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">
                            WhatsApp com DDD *
                          </label>
                          <input
                            type="tel"
                            required
                            value={whatsapp}
                            onChange={(e) => setWhatsapp(e.target.value)}
                            placeholder="(11) 98765-4321"
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-purple-600 transition-colors"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-2">
                            <label className="text-xs font-bold text-slate-700 block mb-1">
                              Cidade *
                            </label>
                            <input
                              type="text"
                              required
                              value={city}
                              onChange={(e) => setCity(e.target.value)}
                              placeholder="São Paulo"
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-purple-600 transition-colors"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">
                              UF *
                            </label>
                            <input
                              type="text"
                              maxLength={2}
                              required
                              value={state}
                              onChange={(e) => setState(e.target.value.toUpperCase())}
                              placeholder="SP"
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-purple-600 text-center uppercase transition-colors"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-3 pt-4">
                          <button
                            type="button"
                            onClick={() => setCreatorStep(1)}
                            className="w-1/3 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-all cursor-pointer"
                          >
                            Voltar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!whatsapp || !city || !state) {
                                setCreatorError('Preencha todos os campos de contato.');
                                return;
                              }
                              setCreatorError(null);
                              setCreatorStep(3);
                            }}
                            className="w-2/3 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <span>Avançar</span>
                            <ArrowRight size={16} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ETAPA 3: Acesso & LGPD */}
                    {creatorStep === 3 && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">
                            Seu melhor E-mail *
                          </label>
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="seuemail@gmail.com"
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-purple-600 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">
                            Crie uma Senha de Acesso *
                          </label>
                          <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Mínimo 6 caracteres"
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-purple-600 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">
                            Confirme sua Senha *
                          </label>
                          <input
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Repita sua senha"
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-purple-600 transition-colors"
                          />
                        </div>

                        <div className="pt-2">
                          <label className="flex items-start gap-2.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={lgpdAccepted}
                              onChange={(e) => setLgpdAccepted(e.target.checked)}
                              className="mt-1 rounded text-purple-600 focus:ring-purple-500"
                            />
                            <span className="text-[11px] text-slate-600 leading-snug">
                              Autorizo a Rocketz Creators a armazenar meus dados e apresentar meu perfil para campanhas com marcas parceiras em conformidade com a LGPD.
                            </span>
                          </label>
                        </div>

                        <div className="flex items-center gap-3 pt-4">
                          <button
                            type="button"
                            onClick={() => setCreatorStep(2)}
                            className="w-1/3 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-all cursor-pointer"
                          >
                            Voltar
                          </button>
                          <button
                            type="submit"
                            disabled={creatorSubmitting}
                            className="w-2/3 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-purple-200"
                          >
                            {creatorSubmitting ? 'Cadastrando...' : 'Finalizar Cadastro'}
                          </button>
                        </div>
                      </div>
                    )}
                  </form>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 12. MODAL CADASTRO DE EMPRESAS */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isCompanyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative my-8"
            >
              <button
                onClick={() => {
                  setIsCompanyModalOpen(false);
                  setCompanyError(null);
                  setCompanySuccess(false);
                  setCompanyLogo('');
                }}
                className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>

              {companySuccess ? (
                <div className="py-8 text-center flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
                    <Clock size={36} />
                  </div>
                  <h3 className="text-2xl font-black text-slate-950">Empresa Cadastrada!</h3>
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl mt-3 text-left max-w-sm">
                    <p className="text-xs text-amber-900 font-bold leading-relaxed mb-1">
                      ⚠️ Aguardando aprovação do Administrador:
                    </p>
                    <p className="text-xs text-amber-800 leading-relaxed">
                      O cadastro da sua empresa foi enviado e será avaliado pelo administrador. Assim que aprovado, o painel de criação e gestão de campanhas estará liberado para uso.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setIsCompanyModalOpen(false);
                      setCompanySuccess(false);
                      setCompanyLogo('');
                    }}
                    className="mt-6 px-6 py-2.5 rounded-xl bg-purple-600 text-white font-bold text-sm cursor-pointer hover:bg-purple-700 transition-all shadow-md"
                  >
                    Entendido
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-100">
                      Para Marcas & Agências
                    </span>
                    <h3 className="text-2xl font-black text-slate-950 mt-2">
                      Cadastre sua Empresa
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Conecte sua marca a criadores qualificados para ações pontuais ou recorrentes.
                    </p>
                  </div>

                  {companyError && (
                    <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                      {companyError}
                    </div>
                  )}

                  <form onSubmit={handleCompanySubmit} className="space-y-4">
                    {/* Logotipo da Empresa Upload */}
                    <CompanyLogoUpload
                      value={companyLogo}
                      onChange={setCompanyLogo}
                      label="Logotipo da Marca (Opcional)"
                    />

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Nome da Empresa / Marca *
                      </label>
                      <input
                        type="text"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Ex: Minha Marca Cosméticos"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-purple-600 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Nome do Responsável
                      </label>
                      <input
                        type="text"
                        value={companyContactPerson}
                        onChange={(e) => setCompanyContactPerson(e.target.value)}
                        placeholder="Ex: Roberto Mendes (Marketing)"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-purple-600 transition-colors"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          E-mail Corporativo *
                        </label>
                        <input
                          type="email"
                          required
                          value={companyEmail}
                          onChange={(e) => setCompanyEmail(e.target.value)}
                          placeholder="contato@empresa.com"
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-purple-600 transition-colors"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">
                          WhatsApp com DDD *
                        </label>
                        <input
                          type="tel"
                          required
                          value={companyWhatsapp}
                          onChange={(e) => setCompanyWhatsapp(e.target.value)}
                          placeholder="(11) 99999-8888"
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-purple-600 transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Segmento da Empresa
                      </label>
                      <input
                        type="text"
                        value={companySegment}
                        onChange={(e) => setCompanySegment(e.target.value)}
                        placeholder="Ex: Moda, E-commerce, Saúde, Tecnologia..."
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-purple-600 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Objetivo Principal
                      </label>
                      <select
                        value={companyNeed}
                        onChange={(e) => setCompanyNeed(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-purple-600 transition-colors"
                      >
                        <option value="both">Campanhas pontuais e trabalhos recorrentes</option>
                        <option value="ugc">Produção de UGC para anúncios e mídias</option>
                        <option value="influencers">Campanhas com Influenciadores de nicho</option>
                        <option value="actors">Atores / Apresentadores de marca</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={companySubmitting}
                      className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-purple-200 mt-2"
                    >
                      {companySubmitting ? 'Enviando...' : 'Cadastrar Empresa'}
                    </button>
                  </form>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 13. MODAL DE LOGIN RÁPIDO */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isLoginModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative my-8"
            >
              <button
                onClick={() => {
                  setIsLoginModalOpen(false);
                  setLoginError(null);
                }}
                className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>

              <div className="mb-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-3">
                  <Lock size={22} />
                </div>
                <h3 className="text-2xl font-black text-slate-950">Acessar Plataforma</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Entre com seu e-mail e senha cadastrados.
                </p>
              </div>

              {loginError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                  {loginError}
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="seuemail@exemplo.com"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-purple-600 transition-colors"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      Senha
                    </label>
                    <Link to="/login" className="text-[11px] font-semibold text-purple-600 hover:underline">
                      Esqueceu?
                    </Link>
                  </div>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-purple-600 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loginSubmitting}
                  className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-purple-200 mt-2"
                >
                  {loginSubmitting ? 'Entrando...' : 'Entrar na Plataforma'}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-500">
                  Ainda não faz parte?{' '}
                  <button
                    onClick={() => {
                      setIsLoginModalOpen(false);
                      setIsCreatorModalOpen(true);
                    }}
                    className="font-bold text-purple-600 hover:underline cursor-pointer"
                  >
                    Cadastre-se como Creator
                  </button>
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
