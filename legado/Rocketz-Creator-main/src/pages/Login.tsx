import React, { useState } from 'react';
import { 
  Sparkles, 
  ArrowRight, 
  Lock, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  Chrome, 
  ArrowLeft,
  FileText,
  ShieldCheck,
  Scale
} from 'lucide-react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signInWithPopup, 
  GoogleAuthProvider 
} from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db, signInWithGoogle } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { RocketzLogo } from '../components/RocketzLogo';
import { CreatorContractModal } from '../components/CreatorContractModal';
import { CONTRACT_METADATA, CreatorContractAuditRecord } from '../data/creatorContractTerms';
import { formatCPF, isValidCPF } from '../lib/cpfValidation';

export default function Login() {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form fields
  const [userType, setUserType] = useState<'creator' | 'company'>('creator');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [artisticName, setArtisticName] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [instagram, setInstagram] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [contractAuditRecord, setContractAuditRecord] = useState<CreatorContractAuditRecord | null>(null);

  const handleGoogleLogin = async () => {
    setError(null);
    setErrorCode(null);
    setLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result?.user) {
        const userId = result.user.uid;

        // Check if company user document exists first
        const companySnap = await getDoc(doc(db, 'companyUsers', userId));
        if (companySnap.exists()) {
          navigate('/company-dashboard');
          return;
        }

        // Check if creator document exists
        const creatorSnap = await getDoc(doc(db, 'creators', userId));
        if (creatorSnap.exists()) {
          navigate(`/creators/${userId}`);
        } else {
          // If logged in via Google, but don't have a document, navigate to dashboard
          // or they will be auto-created when visiting their profile.
          navigate('/');
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorCode(err.code || 'unknown');
      if (err.code === 'auth/popup-blocked') {
        setError('O pop-up de login foi bloqueado pelo seu navegador.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        setError('O login com Google foi cancelado.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('O login com o Google está desativado no Firebase.');
      } else {
        setError('Erro ao realizar login com o Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email || !email.includes('@')) {
      setError('Por favor, informe um e-mail válido no campo de e-mail acima para redefinir a senha.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      setSuccess(`E-mail de redefinição enviado para ${email.trim().toLowerCase()}! Verifique sua caixa de entrada.`);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao enviar e-mail de redefinição: ' + (err.message || 'Verifique o e-mail digitado.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorCode(null);
    setSuccess(null);

    // Validate inputs
    if (authMode === 'signup') {
      if (userType === 'creator') {
        if (!fullName || !artisticName || !email || !whatsapp || !city || !state || !instagram || !password) {
          setError('Por favor, preencha todos os campos obrigatórios.');
          return;
        }
      } else {
        if (!fullName || !companyName || !email || !whatsapp || !city || !state || !password) {
          setError('Por favor, preencha todos os campos obrigatórios.');
          return;
        }
      }
      if (password !== confirmPassword) {
        setError('As senhas digitadas não coincidem.');
        return;
      }
      if (password.length < 6) {
        setError('A senha deve conter no mínimo 6 caracteres.');
        return;
      }
      if (!lgpdAccepted) {
        setError('Você precisa autorizar o uso de dados de acordo com a LGPD.');
        return;
      }
    } else {
      if (!email || !password) {
        setError('Por favor, informe seu e-mail e sua senha.');
        return;
      }
    }

    setLoading(true);

    try {
      if (authMode === 'signup') {
        const credential = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
        const userId = credential.user.uid;

        if (userType === 'creator') {
          const cleanArtistic = artisticName.replace('@', '').trim();

          // Prepare the default creator profile document
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
            categories: ['UGC Content'],
            pricing: {
              story: 0,
              reel: 0,
              post: 0,
              combo: 0
            },
            acceptsExchange: true,
            acceptsPaidTraffic: true,
            acceptsExclusivity: false,
            internalNotes: `Auto-cadastrado via Login com Termo ${CONTRACT_METADATA.version} aceito (${contractAuditRecord?.termId || 'eletrônico'}).`,
            status: 'review',
            portfolio: [],
            createdAt: new Date().toISOString()
          };

          await setDoc(doc(db, 'creators', userId), newCreatorDoc);
          setSuccess('Cadastro realizado! Sua conta está em análise e precisa ser aprovada pelo administrador para liberação de uso.');
          
          setTimeout(() => {
            navigate(`/creators/${userId}`);
          }, 2000);
        } else {
          // Company signup
          const { collection } = await import('firebase/firestore');
          const companyRef = doc(collection(db, 'companies'));
          const companyId = companyRef.id;

          // Create standard company document
          await setDoc(companyRef, {
            id: companyId,
            name: companyName,
            cnpj: cnpj || '',
            segment: 'Geral',
            email: email,
            whatsapp: whatsapp,
            city: `${city} - ${state}`,
            observations: 'Auto-cadastrado pelo portal.',
            status: 'pending', // Requires admin approval
            contacts: [
              {
                name: fullName,
                role: 'Administrador da Conta',
                email: email,
                whatsapp: whatsapp
              }
            ],
            createdAt: new Date().toISOString()
          });

          // Link to the user
          await setDoc(doc(db, 'companyUsers', userId), {
            uid: userId,
            companyId: companyId,
            name: fullName,
            email: email.trim().toLowerCase(),
            status: 'pending',
            createdAt: new Date().toISOString()
          });

          setSuccess('Cadastro de empresa realizado! Sua conta está em análise e precisa ser aprovada pelo administrador para liberação de uso.');

          setTimeout(() => {
            navigate('/company-dashboard');
          }, 2000);
        }
      } else {
        const loginEmail = email.trim().toLowerCase();
        let credential;
        
        try {
          credential = await signInWithEmailAndPassword(auth, loginEmail, password);
        } catch (signInErr: any) {
          const { isAdminEmail } = await import('../lib/firebase');

          // Check if there is a creator or admin document with matching email and manualPassword
          let creatorManualMatch = false;
          let matchedCreatorDoc: any = null;
          try {
            const creatorsQ = query(collection(db, 'creators'), where('email', '==', loginEmail));
            const creatorsSnap = await getDocs(creatorsQ);
            if (!creatorsSnap.empty) {
              const matched = creatorsSnap.docs.find(d => d.data()?.manualPassword === password);
              if (matched) {
                creatorManualMatch = true;
                matchedCreatorDoc = matched.data();
              }
            }
          } catch (e) {
            console.warn("Could not query creators for manual password check:", e);
          }

          if (creatorManualMatch || isAdminEmail(loginEmail)) {
            console.log("Creator account or manual password detected, attempting auto-creation/login...");
            try {
              credential = await createUserWithEmailAndPassword(auth, loginEmail, password);
            } catch (createErr: any) {
              console.error("Auto-creation result:", createErr);
              if (createErr.code === 'auth/email-already-in-use') {
                if (creatorManualMatch) {
                  throw new Error(`Sua nova senha foi validada no sistema! Caso a senha antiga do Firebase Auth esteja bloqueando, use o botão "Redefinir Senha" com o link enviado para ${loginEmail} ou contate o administrador.`);
                }
                throw new Error(`A conta ${loginEmail} já existe no sistema. Se a senha alterada não entrar, clique em "Redefinir Senha" para atualizar o e-mail de acesso.`);
              }
              throw signInErr;
            }
          } else {
            throw signInErr;
          }
        }

        const userId = credential.user.uid;
        const { isAdminEmail } = await import('../lib/firebase');
        const isUserAdmin = isAdminEmail(loginEmail);

        // If admin, ensure creator doc has role: 'admin' and status: 'approved'
        if (isUserAdmin) {
          let adminName = 'Admin Rocketz';
          let artisticName = 'admin';
          if (loginEmail.includes('larissa')) {
            adminName = 'Larissa Admin';
            artisticName = 'larissa';
          } else if (loginEmail.includes('diogo')) {
            adminName = 'Diogo Admin';
            artisticName = 'diogo';
          }

          await setDoc(doc(db, 'creators', userId), {
            id: userId,
            fullName: adminName,
            artisticName: artisticName,
            email: loginEmail,
            role: 'admin',
            status: 'approved',
            createdAt: new Date().toISOString()
          }, { merge: true });
        }
        
        // Fetch documents to decide redirect path
        const companySnap = await getDoc(doc(db, 'companyUsers', userId));
        const creatorSnap = await getDoc(doc(db, 'creators', userId));
        setSuccess('Login efetuado com sucesso!');

        setTimeout(() => {
          if (isUserAdmin) {
            navigate('/');
          } else if (companySnap.exists()) {
            navigate('/company-dashboard');
          } else if (creatorSnap.exists()) {
            navigate(`/creators/${userId}`);
          } else {
            navigate('/');
          }
        }, 1000);
      }
    } catch (err: any) {
      console.error(err);
      setErrorCode(err.code || 'unknown');
      if (err.code === 'auth/email-already-in-use') {
        setError('O e-mail inserido já possui conta ativa no Rocketz Creators.');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha cadastrada é fraca. Utilize pelo menos 6 caracteres.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('E-mail ou senha incorretos. Por favor, verifique suas credenciais.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('O cadastro ou login por E-mail/Senha está desativado nas configurações do Firebase.');
      } else {
        setError(err.message || 'Falha ao processar a autenticação.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col justify-center items-center font-sans w-full px-4 relative overflow-x-hidden py-12">
      {/* Decorative Glow backdrops */}
      <div className="absolute top-10 left-1/4 w-[300px] h-[300px] rounded-full bg-indigo-600/10 blur-[90px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[350px] h-[350px] rounded-full bg-violet-600/10 blur-[100px] pointer-events-none" />

      {/* Back button to Home */}
      <div className="absolute top-6 left-6 z-10">
        <Link 
          to="/" 
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={16} /> Voltar para o início
        </Link>
      </div>

      <div className="w-full max-w-lg z-10">
        {/* Brand logo */}
        <div className="flex flex-col items-center gap-2 mb-8 text-center">
          <RocketzLogo variant="dark" size="xl" to="/" />
          <p className="text-xs text-purple-400/90 font-medium tracking-wide mt-1">Portal de Elenco & Campanhas</p>
        </div>

        {/* Card Container */}
        <div className="bg-[#0B1220] border border-white/10 p-6 sm:p-8 rounded-[32px] shadow-2xl w-full">
          {/* Header Switcher */}
          <div className="flex bg-[#1E293B]/60 p-1 rounded-xl mb-6">
            <button 
              type="button"
              onClick={() => {
                setAuthMode('login');
                setError(null);
                setSuccess(null);
              }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${authMode === 'login' ? 'bg-brand-primary text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Fazer Login
            </button>
            <button 
              type="button"
              onClick={() => {
                setAuthMode('signup');
                setError(null);
                setSuccess(null);
              }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${authMode === 'signup' ? 'bg-brand-primary text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Criar Conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {authMode === 'signup' && (
              <div className="flex bg-[#1E293B]/40 p-1 rounded-xl mb-2 border border-white/5">
                <button
                  type="button"
                  onClick={() => setUserType('creator')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${userType === 'creator' ? 'bg-indigo-600/50 border border-indigo-500/20 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Sou Criador
                </button>
                <button
                  type="button"
                  onClick={() => setUserType('company')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${userType === 'company' ? 'bg-indigo-600/50 border border-indigo-500/20 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Sou Empresa
                </button>
              </div>
            )}

            {authMode === 'signup' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {userType === 'creator' ? 'Nome Completo' : 'Nome do Responsável'}
                  </label>
                  <input 
                    required
                    type="text" 
                    placeholder="Seu nome completo"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={loading || !!success}
                    className="w-full bg-[#1E293B]/40 border border-white/10 rounded-xl h-11 px-4 text-sm text-white outline-none focus:border-brand-primary focus:bg-[#1E293B]/70 transition-all"
                  />
                </div>

                {userType === 'creator' ? (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nome Artístico</label>
                      <input 
                        required
                        type="text" 
                        placeholder="Ex: dany.lifestyle"
                        value={artisticName}
                        onChange={(e) => setArtisticName(e.target.value)}
                        disabled={loading || !!success}
                        className="w-full bg-[#1E293B]/40 border border-white/10 rounded-xl h-11 px-4 text-sm text-white outline-none focus:border-brand-primary focus:bg-[#1E293B]/70 transition-all"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Instagram (@usuario)</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">@</span>
                        <input 
                          required
                          type="text" 
                          placeholder="seu_perfil"
                          value={instagram}
                          onChange={(e) => setInstagram(e.target.value)}
                          disabled={loading || !!success}
                          className="w-full bg-[#1E293B]/40 border border-white/10 rounded-xl h-11 pl-8 pr-4 text-sm text-white outline-none focus:border-brand-primary focus:bg-[#1E293B]/70 transition-all"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2 p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 text-left flex items-center gap-2.5 text-slate-300">
                      <ShieldCheck size={16} className="text-purple-400 shrink-0" />
                      <p className="text-[11px] text-slate-400">
                        O <strong className="text-purple-200">Termo de Adesão & Licença de Imagem</strong> e validação de CPF serão formalizados internamente no seu perfil após o cadastro.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nome da Empresa / Marca</label>
                      <input 
                        required
                        type="text" 
                        placeholder="Ex: Coca-Cola, Nike, Loja Local"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        disabled={loading || !!success}
                        className="w-full bg-[#1E293B]/40 border border-white/10 rounded-xl h-11 px-4 text-sm text-white outline-none focus:border-brand-primary focus:bg-[#1E293B]/70 transition-all"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CNPJ (Opcional)</label>
                      <input 
                        type="text" 
                        placeholder="00.000.000/0000-00"
                        value={cnpj}
                        onChange={(e) => setCnpj(e.target.value)}
                        disabled={loading || !!success}
                        className="w-full bg-[#1E293B]/40 border border-white/10 rounded-xl h-11 px-4 text-sm text-white outline-none focus:border-brand-primary focus:bg-[#1E293B]/70 transition-all"
                      />
                    </div>
                  </>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">E-mail Comercial</label>
                  <input 
                    required
                    type="email" 
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading || !!success}
                    className="w-full bg-[#1E293B]/40 border border-white/10 rounded-xl h-11 px-4 text-sm text-white outline-none focus:border-brand-primary focus:bg-[#1E293B]/70 transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">WhatsApp</label>
                  <input 
                    required
                    type="tel" 
                    placeholder="(DD) 99999-9999"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    disabled={loading || !!success}
                    className="w-full bg-[#1E293B]/40 border border-white/10 rounded-xl h-11 px-4 text-sm text-white outline-none focus:border-brand-primary focus:bg-[#1E293B]/70 transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cidade</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Ex: São Paulo"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={loading || !!success}
                    className="w-full bg-[#1E293B]/40 border border-white/10 rounded-xl h-11 px-4 text-sm text-white outline-none focus:border-brand-primary focus:bg-[#1E293B]/70 transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estado (UF)</label>
                  <input 
                    required
                    type="text" 
                    maxLength={2}
                    placeholder="Ex: SP"
                    value={state}
                    onChange={(e) => setState(e.target.value.toUpperCase())}
                    disabled={loading || !!success}
                    className="w-full bg-[#1E293B]/40 border border-white/10 rounded-xl h-11 px-4 text-sm text-white outline-none focus:border-brand-primary focus:bg-[#1E293B]/70 transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Senha</label>
                  <input 
                    required
                    type="password" 
                    placeholder="Mínimo 6 dígitos"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading || !!success}
                    className="w-full bg-[#1E293B]/40 border border-white/10 rounded-xl h-11 px-4 text-sm text-white outline-none focus:border-brand-primary focus:bg-[#1E293B]/70 transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Confirmar Senha</label>
                  <input 
                    required
                    type="password" 
                    placeholder="Repita a senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading || !!success}
                    className="w-full bg-[#1E293B]/40 border border-white/10 rounded-xl h-11 px-4 text-sm text-white outline-none focus:border-brand-primary focus:bg-[#1E293B]/70 transition-all"
                  />
                </div>

                <label className="sm:col-span-2 flex items-start gap-3 mt-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={lgpdAccepted}
                    onChange={(e) => setLgpdAccepted(e.target.checked)}
                    disabled={loading || !!success}
                    className="mt-1 accent-indigo-500 rounded text-indigo-600 focus:ring-0 shrink-0 cursor-pointer" 
                  />
                  <span className="text-[11px] text-slate-400 leading-normal">
                    Autorizo a Rocketz a processar meus dados sob os termos da LGPD para fins de cadastramento e oportunidades de campanhas.
                  </span>
                </label>
              </div>
            ) : (
              <div className="flex flex-col gap-4 text-left">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">E-mail cadastrado</label>
                  <input 
                    required
                    type="email" 
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading || !!success}
                    className="w-full bg-[#1E293B]/40 border border-white/10 rounded-xl h-11 px-4 text-sm text-white outline-none focus:border-brand-primary focus:bg-[#1E293B]/70 transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Senha de acesso</label>
                  <div className="relative">
                    <input 
                      required
                      type={showPassword ? "text" : "password"} 
                      placeholder="Sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading || !!success}
                      className="w-full bg-[#1E293B]/40 border border-white/10 rounded-xl h-11 pl-4 pr-10 text-sm text-white outline-none focus:border-brand-primary focus:bg-[#1E293B]/70 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <div className="flex justify-end mt-1">
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium hover:underline transition-colors cursor-pointer bg-transparent border-none p-0"
                    >
                      Esqueceu a senha? Redefinir
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications */}
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="p-4 bg-red-500/10 border border-red-500/20 text-red-200 text-xs rounded-xl font-medium text-left mt-2 flex flex-col gap-2"
                >
                  <p className="font-bold text-red-300 m-0">{error}</p>
                  
                  {errorCode === 'auth/operation-not-allowed' && (
                    <div className="mt-2 p-3 bg-slate-900/95 border border-white/10 rounded-xl text-slate-300 font-normal leading-relaxed text-[11px] flex flex-col gap-2">
                      <strong className="text-white text-xs block">Como ativar no seu Firebase Console:</strong>
                      <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
                        <li>
                          Acesse a aba de Provedores no seu{' '}
                          <a 
                            href="https://console.firebase.google.com/project/gen-lang-client-0095214152/authentication/providers" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-indigo-400 underline hover:text-indigo-300 font-bold"
                          >
                            Console do Firebase
                          </a>.
                        </li>
                        <li>
                          Clique no botão <strong className="text-white font-semibold">Adicionar novo provedor</strong> (ou "Add provider").
                        </li>
                        <li>
                          Selecione a opção <strong className="text-white font-semibold">{error.includes('Google') ? 'Google' : 'E-mail/Senha (Email/Password)'}</strong>.
                        </li>
                        <li>
                          Ative o interruptor e clique em <strong className="text-white font-semibold">Salvar</strong> (Save).
                        </li>
                        <li>
                          Volte para esta aba e tente novamente! O cadastro e login funcionarão instantaneamente.
                        </li>
                      </ol>
                    </div>
                  )}
                </motion.div>
              )}

              {success && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl font-bold text-left mt-2 flex flex-col gap-1"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 text-sm">✓</span> <span>{success}</span>
                  </div>
                  <span className="text-[10px] font-bold opacity-80 uppercase tracking-wider ml-5 block mt-0.5 animate-pulse text-emerald-400">
                    Redirecionando...
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {!success && (
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-brand-primary hover:bg-indigo-600 text-white h-12 rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-indigo-500/20 transition-all mt-4 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait cursor-pointer"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-t border-b border-white animate-spin inline-block" />
                    Processando...
                  </>
                ) : authMode === 'signup' ? (
                  'Criar Conta & Acessar Painel'
                ) : (
                  'Entrar no Portal'
                )}
              </button>
            )}

            {/* Social Divider */}
            <div className="relative my-4 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <span className="relative px-3 bg-[#0B1220] text-[10px] font-bold uppercase tracking-widest text-slate-500">Ou</span>
            </div>

            {/* Google Sign in */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading || !!success}
              className="w-full flex items-center justify-center gap-2.5 h-12 bg-white/5 border border-white/10 text-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-white/10 hover:text-white transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              <Chrome size={16} className="text-slate-200" />
              <span>Entrar com o Google</span>
            </button>
          </form>
        </div>

        {/* Footer text */}
        <p className="mt-6 text-[10px] text-slate-500 text-center uppercase tracking-wider font-semibold">
          © {new Date().getFullYear()} ROCKETZ MARKETING LTDA • CONFIABILIDADE DE DADOS INTEGRADA
        </p>
      </div>

      {/* Official Legal Contract Modal for Creators */}
      <CreatorContractModal
        isOpen={isContractModalOpen}
        onClose={() => setIsContractModalOpen(false)}
        onAccept={(audit) => {
          setContractAuditRecord(audit);
          if (audit.document && !documentNumber) {
            setDocumentNumber(audit.document);
          }
          setIsContractModalOpen(false);
        }}
        prefilledName={fullName}
        prefilledEmail={email}
        prefilledDocument={documentNumber}
      />
    </div>
  );
}
