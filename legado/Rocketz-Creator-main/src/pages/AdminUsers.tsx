import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  UserPlus, 
  Trash2, 
  KeyRound, 
  Eye, 
  EyeOff, 
  Search, 
  CheckCircle2, 
  X, 
  AlertCircle, 
  User, 
  Mail, 
  Lock, 
  RefreshCw, 
  Shield, 
  Sparkles,
  Info,
  Database,
  Megaphone,
  Repeat,
  Users
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  setDoc, 
  doc, 
  deleteDoc, 
  getDoc,
  getDocs, 
  updateDoc 
} from 'firebase/firestore';
import { auth, db, ADMIN_EMAILS } from '../lib/firebase';
import { sendPasswordResetEmail, updatePassword } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { DatabaseResetModal, ResetScope } from '../components/DatabaseResetModal';

export interface AdminUser {
  id: string;
  fullName: string;
  artisticName?: string;
  email: string;
  role: 'admin';
  status: 'approved' | 'active';
  createdAt?: string;
  createdBy?: string;
  isSystemAdmin?: boolean;
  manualPassword?: string;
  passwordUpdatedAt?: string;
}

export default function AdminUsers() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [artisticName, setArtisticName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Manual Password Modal State
  const [userToChangePassword, setUserToChangePassword] = useState<AdminUser | null>(null);
  const [newManualPassword, setNewManualPassword] = useState('');
  const [confirmNewManualPassword, setConfirmNewManualPassword] = useState('');
  const [showNewManualPassword, setShowNewManualPassword] = useState(false);
  const [showConfirmNewManualPassword, setShowConfirmNewManualPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  
  // UI Action State
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resettingEmail, setResettingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Database Reset Modal State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetScope, setResetScope] = useState<ResetScope>('all');

  const currentAdminEmail = auth.currentUser?.email?.toLowerCase();

  // Listen to admin users in Firestore creators collection
  useEffect(() => {
    const q = query(
      collection(db, 'creators'),
      where('role', '==', 'admin')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const adminDocs: AdminUser[] = [];
      const fetchedEmails = new Set<string>();

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const em = (data.email || '').toLowerCase();
        fetchedEmails.add(em);
        adminDocs.push({
          id: docSnap.id,
          fullName: data.fullName || 'Administrador Rocketz',
          artisticName: data.artisticName || 'admin',
          email: data.email || '',
          role: 'admin',
          status: 'approved',
          createdAt: data.createdAt,
          createdBy: data.createdBy,
          isSystemAdmin: ADMIN_EMAILS.map(e => e.toLowerCase()).includes(em),
          manualPassword: data.manualPassword,
          passwordUpdatedAt: data.passwordUpdatedAt
        });
      });

      // Include system admins from ADMIN_EMAILS if they don't have a creator document yet
      ADMIN_EMAILS.forEach((sysEmail, index) => {
        const lowerSys = sysEmail.toLowerCase();
        if (!fetchedEmails.has(lowerSys)) {
          let name = 'Admin Rocketz';
          let handle = 'admin';
          if (lowerSys.includes('diogo')) {
            name = 'Diogo Admin';
            handle = 'diogo';
          } else if (lowerSys.includes('larissa')) {
            name = 'Larissa Admin';
            handle = 'larissa';
          }
          adminDocs.push({
            id: `sys_admin_${index}`,
            fullName: name,
            artisticName: handle,
            email: sysEmail,
            role: 'admin',
            status: 'approved',
            createdAt: new Date().toISOString(),
            isSystemAdmin: true
          });
        }
      });

      // Sort by name
      adminDocs.sort((a, b) => a.fullName.localeCompare(b.fullName));
      setAdmins(adminDocs);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching admin users:", err);
      setError("Não foi possível carregar a lista de administradores.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setFullName('');
    setArtisticName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedFullName = fullName.trim();
    const trimmedHandle = artisticName.trim().toLowerCase() || 'admin';

    if (!trimmedFullName) {
      setError('Por favor, informe o nome completo do administrador.');
      return;
    }

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Por favor, informe um e-mail válido.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    // Check if email already exists in our current admin list
    if (admins.some(a => a.email.toLowerCase() === trimmedEmail)) {
      setError(`O e-mail ${trimmedEmail} já está cadastrado como administrador.`);
      return;
    }

    setCreating(true);
    let secondaryApp;

    try {
      // Initialize secondary app so creating account doesn't sign out the current admin session
      const secondaryAppName = `SecondaryAdminApp_${Date.now()}`;
      secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);

      // Create Firebase Auth User
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, trimmedEmail, password);
      const newUid = userCredential.user.uid;

      // Save document in Firestore 'creators' collection with role: 'admin'
      await setDoc(doc(db, 'creators', newUid), {
        id: newUid,
        fullName: trimmedFullName,
        artisticName: trimmedHandle,
        email: trimmedEmail,
        role: 'admin',
        status: 'approved',
        createdAt: new Date().toISOString(),
        createdBy: currentAdminEmail || 'admin'
      }, { merge: true });

      setSuccess(`Administrador "${trimmedFullName}" (${trimmedEmail}) criado com sucesso!`);
      resetForm();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Error creating admin user:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError(`O e-mail "${trimmedEmail}" já está em uso na autenticação. Tente redefinir a senha ou utilizar outro e-mail.`);
      } else if (err.code === 'auth/invalid-email') {
        setError('O e-mail informado é inválido.');
      } else if (err.code === 'auth/weak-password') {
        setError('A senha é muito fraca. Digite pelo menos 6 caracteres.');
      } else {
        setError(`Erro ao criar administrador: ${err.message || 'Ocorreu um erro inesperado.'}`);
      }
    } finally {
      if (secondaryApp) {
        try {
          await deleteApp(secondaryApp);
        } catch (e) {
          console.warn("Could not delete secondary app:", e);
        }
      }
      setCreating(false);
    }
  };

  const handleRemoveAdmin = async () => {
    if (!userToDelete) return;

    if (userToDelete.email.toLowerCase() === currentAdminEmail) {
      setError('Você não pode remover seu próprio acesso de administrador enquanto estiver conectado.');
      setUserToDelete(null);
      return;
    }

    setDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      if (userToDelete.id && !userToDelete.id.startsWith('sys_admin_')) {
        // If they have a document in creators, change role to creator or remove admin privilege
        await updateDoc(doc(db, 'creators', userToDelete.id), {
          role: 'creator',
          updatedAt: new Date().toISOString(),
          removedAdminBy: currentAdminEmail || 'admin'
        });
      }

      setSuccess(`Acesso de administrador de "${userToDelete.fullName}" (${userToDelete.email}) foi removido.`);
      setUserToDelete(null);
    } catch (err: any) {
      console.error("Error removing admin:", err);
      // Try fallback deleteDoc if update failed
      try {
        if (userToDelete.id && !userToDelete.id.startsWith('sys_admin_')) {
          await deleteDoc(doc(db, 'creators', userToDelete.id));
        }
        setSuccess(`Acesso de administrador de "${userToDelete.fullName}" foi removido.`);
        setUserToDelete(null);
      } catch (fallbackErr: any) {
        setError(`Erro ao remover administrador: ${err.message || 'Falha na permissão.'}`);
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleSendResetPassword = async (targetEmail: string, targetName: string) => {
    setResettingEmail(targetEmail);
    setError(null);
    setSuccess(null);

    try {
      await sendPasswordResetEmail(auth, targetEmail);
      setSuccess(`E-mail para redefinição de senha enviado com sucesso para ${targetName} (${targetEmail})!`);
    } catch (err: any) {
      console.error("Error sending reset password email:", err);
      setError(`Erro ao enviar e-mail de redefinição para ${targetEmail}: ${err.message || 'Tente novamente.'}`);
    } finally {
      setResettingEmail(null);
    }
  };

  const handleChangePasswordManually = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToChangePassword) return;

    setError(null);
    setSuccess(null);

    const trimmedPassword = newManualPassword.trim();
    const trimmedConfirm = confirmNewManualPassword.trim();

    if (trimmedPassword.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (trimmedPassword !== trimmedConfirm) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setChangingPassword(true);

    try {
      const targetEmail = userToChangePassword.email.toLowerCase();
      const isSelf = targetEmail === currentAdminEmail;

      // 1. If updating current logged-in user, update Firebase Auth directly
      if (isSelf && auth.currentUser) {
        try {
          await updatePassword(auth.currentUser, trimmedPassword);
        } catch (authErr: any) {
          console.warn("Could not update auth current user password directly:", authErr);
        }
      }

      // 2. Update or set document in 'creators' collection
      if (userToChangePassword.id && !userToChangePassword.id.startsWith('sys_admin_')) {
        await updateDoc(doc(db, 'creators', userToChangePassword.id), {
          manualPassword: trimmedPassword,
          passwordUpdatedAt: new Date().toISOString(),
          passwordUpdatedBy: currentAdminEmail || 'admin'
        });
      } else {
        const q = query(collection(db, 'creators'), where('email', '==', targetEmail));
        const snap = await getDocs(q);
        if (!snap.empty) {
          await updateDoc(doc(db, 'creators', snap.docs[0].id), {
            manualPassword: trimmedPassword,
            passwordUpdatedAt: new Date().toISOString(),
            passwordUpdatedBy: currentAdminEmail || 'admin'
          });
        } else {
          const newDocRef = doc(collection(db, 'creators'));
          await setDoc(newDocRef, {
            id: newDocRef.id,
            fullName: userToChangePassword.fullName,
            artisticName: userToChangePassword.artisticName || 'admin',
            email: targetEmail,
            role: 'admin',
            status: 'approved',
            manualPassword: trimmedPassword,
            passwordUpdatedAt: new Date().toISOString(),
            passwordUpdatedBy: currentAdminEmail || 'admin',
            createdAt: new Date().toISOString()
          });
        }
      }

      setSuccess(`Nova senha inserida e atualizada com sucesso para ${userToChangePassword.fullName} (${userToChangePassword.email})!`);
      setUserToChangePassword(null);
      setNewManualPassword('');
      setConfirmNewManualPassword('');
      setShowNewManualPassword(false);
      setShowConfirmNewManualPassword(false);
    } catch (err: any) {
      console.error("Error changing password manually:", err);
      setError(`Erro ao alterar senha: ${err.message || 'Ocorreu um erro ao atualizar.'}`);
    } finally {
      setChangingPassword(false);
    }
  };

  const filteredAdmins = admins.filter((admin) => 
    admin.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    admin.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (admin.artisticName && admin.artisticName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col gap-6 animate-fadeIn pb-12 max-w-7xl mx-auto">
      {/* Header Banner */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">
            <ShieldCheck size={16} /> Gestão de Acessos & Permissões
          </div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            Usuários Administradores
            <span className="bg-indigo-100 text-indigo-700 text-xs font-extrabold px-3 py-1 rounded-full border border-indigo-200">
              {admins.length} {admins.length === 1 ? 'Admin' : 'Admins'}
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium max-w-2xl">
            Cadastre novos administradores com e-mail e senha, envie links de redefinição de acesso e gerencie a equipe de gestão da Rocketz.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setResetScope('all');
              setIsResetModalOpen(true);
            }}
            className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold px-4 py-3 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 text-sm cursor-pointer shrink-0"
          >
            <Trash2 size={16} className="text-rose-600" />
            Zerar Banco de Dados
          </button>

          <button
            onClick={() => {
              resetForm();
              setError(null);
              setIsModalOpen(true);
            }}
            className="bg-brand-primary hover:bg-brand-primary/90 text-white font-extrabold px-5 py-3 rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer shrink-0"
          >
            <UserPlus size={18} />
            Novo Administrador
          </button>
        </div>
      </header>

      {/* Alert Messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start gap-3 shadow-sm"
          >
            <AlertCircle size={20} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm font-medium">{error}</div>
            <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 p-1">
              <X size={16} />
            </button>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-start gap-3 shadow-sm"
          >
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm font-medium">{success}</div>
            <button onClick={() => setSuccess(null)} className="text-emerald-500 hover:text-emerald-700 p-1">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 text-white border border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-indigo-600/30 rounded-xl border border-indigo-500/30 text-indigo-300 shrink-0 mt-0.5">
            <Shield size={22} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Privilégios de Administrador
              <Sparkles size={14} className="text-amber-400" />
            </h3>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Administradores possuem acesso completo para visualizar relatórios, gerenciar criadores e empresas, aprovar entregas de vídeos, criar campanhas e administrar usuários do sistema.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-200 bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 shrink-0 self-stretch md:self-auto justify-center">
          <Info size={14} /> Seu Usuário: <span className="text-white font-bold">{currentAdminEmail}</span>
        </div>
      </div>

      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800 font-medium"
          />
        </div>

        <div className="text-xs text-slate-500 font-semibold self-end sm:self-auto">
          Exibindo {filteredAdmins.length} de {admins.length} administradores
        </div>
      </div>

      {/* Admin Users Table / Cards */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center gap-3">
          <RefreshCw size={28} className="animate-spin text-indigo-600" />
          <p className="text-sm font-bold text-slate-600">Carregando usuários administradores...</p>
        </div>
      ) : filteredAdmins.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
            <Search size={22} />
          </div>
          <h3 className="text-base font-bold text-slate-800">Nenhum administrador encontrado</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            Tente buscar com outro termo ou clique no botão "+ Novo Administrador" para cadastrar um novo usuário.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                  <th className="py-3.5 px-5">Administrador</th>
                  <th className="py-3.5 px-4">E-mail de Acesso</th>
                  <th className="py-3.5 px-4">Papel / Nível</th>
                  <th className="py-3.5 px-4">Data de Cadastro</th>
                  <th className="py-3.5 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                {filteredAdmins.map((admin) => {
                  const isCurrent = admin.email.toLowerCase() === currentAdminEmail;
                  const initials = admin.fullName
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase();

                  return (
                    <tr key={admin.id || admin.email} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & Handle */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 border",
                            isCurrent
                              ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          )}>
                            {initials}
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                              {admin.fullName}
                              {isCurrent && (
                                <span className="bg-indigo-50 text-indigo-700 text-[10px] font-extrabold px-2 py-0.5 rounded border border-indigo-200">
                                  Você (Conectado)
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-medium">
                              @{admin.artisticName || 'admin'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-4 px-4 font-semibold text-slate-800">
                        <div className="flex items-center gap-2">
                          <Mail size={14} className="text-slate-400 shrink-0" />
                          <span>{admin.email}</span>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-4 px-4">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border",
                          admin.isSystemAdmin 
                            ? "bg-purple-50 text-purple-700 border-purple-200" 
                            : "bg-indigo-50 text-indigo-700 border-indigo-200"
                        )}>
                          <ShieldCheck size={12} />
                          {admin.isSystemAdmin ? 'Admin Sistema' : 'Administrador'}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-4 px-4 text-slate-500 font-medium">
                        {admin.createdAt 
                          ? new Date(admin.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                          : 'Padrão do Sistema'}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Set Manual Password Button */}
                          <button
                            onClick={() => {
                              setUserToChangePassword(admin);
                              setNewManualPassword('');
                              setConfirmNewManualPassword('');
                              setShowNewManualPassword(false);
                              setShowConfirmNewManualPassword(false);
                            }}
                            title="Inserir nova senha manualmente para este administrador"
                            className="px-3 py-1.5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-600/20"
                          >
                            <KeyRound size={13} className="text-amber-300" />
                            <span>Alterar Senha</span>
                          </button>

                          {/* Reset Password Link via Email */}
                          <button
                            onClick={() => handleSendResetPassword(admin.email, admin.fullName)}
                            disabled={resettingEmail === admin.email}
                            title="Enviar e-mail para o usuário redefinir a senha"
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            {resettingEmail === admin.email ? (
                              <RefreshCw size={14} className="animate-spin text-indigo-600" />
                            ) : (
                              <Mail size={14} className="text-slate-500" />
                            )}
                          </button>

                          {/* Remove Admin Button */}
                          <button
                            onClick={() => setUserToDelete(admin)}
                            disabled={isCurrent}
                            title={isCurrent ? "Você não pode remover seu próprio usuário" : "Remover acesso de administrador"}
                            className={cn(
                              "p-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center",
                              isCurrent
                                ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                                : "bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 cursor-pointer"
                            )}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create New Administrator */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                    <UserPlus size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-white">Cadastrar Novo Administrador</h2>
                    <p className="text-xs text-slate-300 font-medium">Crie uma nova conta com e-mail e senha para gerenciar o painel.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body / Form */}
              <form onSubmit={handleCreateAdmin} className="p-6 space-y-4">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nome Completo <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="Ex: Mariana Silva"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 transition-all"
                    />
                  </div>
                </div>

                {/* Handle / Artistic Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nome de Usuário / Apelido <span className="text-slate-400 font-normal">(Opcional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">@</span>
                    <input
                      type="text"
                      placeholder="Ex: mariana"
                      value={artisticName}
                      onChange={(e) => setArtisticName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 transition-all"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    E-mail de Acesso <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      required
                      placeholder="Ex: mariana@rocketz.com.br"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 transition-all"
                    />
                  </div>
                </div>

                {/* Password Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Password */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Senha de Acesso <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        placeholder="Mínimo 6 digitos"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Confirmar Senha <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        placeholder="Repita a senha"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Password helper note */}
                <p className="text-[11px] text-slate-400 font-medium italic">
                  * A senha será utilizada pelo novo administrador no momento de fazer login no painel.
                </p>

                {/* Buttons */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-5 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl text-sm font-extrabold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {creating ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Criando Usuário...
                      </>
                    ) : (
                      <>
                        <UserPlus size={16} />
                        Cadastrar Administrador
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Change Password Manually */}
      <AnimatePresence>
        {userToChangePassword && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white">
                    <KeyRound size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-white">Alterar Senha do Usuário</h2>
                    <p className="text-xs text-slate-300 font-medium">
                      Insira uma nova senha para <strong className="text-white">{userToChangePassword.fullName}</strong>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setUserToChangePassword(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleChangePasswordManually} className="p-6 space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-medium flex items-start gap-2.5">
                  <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    E-mail do Administrador: <strong>{userToChangePassword.email}</strong>
                    <br />
                    A nova senha inserida manualmente passará a valer para este usuário imediatamente.
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nova Senha de Acesso <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showNewManualPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder="Digite a nova senha (mínimo 6 dígitos)"
                      value={newManualPassword}
                      onChange={(e) => setNewManualPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewManualPassword(!showNewManualPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNewManualPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Confirmar Nova Senha <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showConfirmNewManualPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      placeholder="Repita a nova senha para confirmar"
                      value={confirmNewManualPassword}
                      onChange={(e) => setConfirmNewManualPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewManualPassword(!showConfirmNewManualPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmNewManualPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setUserToChangePassword(null)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={changingPassword}
                    className="px-5 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl text-sm font-extrabold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {changingPassword ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        Salvando Senha...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        Salvar Nova Senha
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Danger Zone: Database Management & Reset */}
      <div className="bg-white rounded-2xl border border-rose-200 p-6 shadow-xs overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-rose-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
              <Database size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                Zona de Manutenção do Banco de Dados
                <span className="bg-rose-100 text-rose-800 text-[10px] font-black px-2 py-0.5 rounded uppercase">
                  Ação Crítica
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Exclua dados em massa (criadores, campanhas de marketing ou contratos recorrentes) para iniciar novos testes ou zerar a base.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setResetScope('all');
              setIsResetModalOpen(true);
            }}
            className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs shadow-md shadow-rose-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Trash2 size={14} />
            Zerar Tudo de uma Vez
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 font-bold text-slate-800 text-xs mb-1">
                <Users size={15} className="text-indigo-600" />
                Casting de Criadores
              </div>
              <p className="text-[11px] text-slate-500">
                Limpa todos os influenciadores cadastrados, preservando os administradores do sistema.
              </p>
            </div>
            <button
              onClick={() => {
                setResetScope('creators');
                setIsResetModalOpen(true);
              }}
              className="mt-3 w-full py-2 bg-white hover:bg-rose-50 text-rose-700 border border-slate-200 hover:border-rose-200 font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Trash2 size={13} />
              Zerar Criadores
            </button>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 font-bold text-slate-800 text-xs mb-1">
                <Megaphone size={15} className="text-amber-600" />
                Campanhas & Entregas
              </div>
              <p className="text-[11px] text-slate-500">
                Exclui todos os projetos de campanhas pontuais e suas alocações de criadores.
              </p>
            </div>
            <button
              onClick={() => {
                setResetScope('campaigns');
                setIsResetModalOpen(true);
              }}
              className="mt-3 w-full py-2 bg-white hover:bg-rose-50 text-rose-700 border border-slate-200 hover:border-rose-200 font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Trash2 size={13} />
              Zerar Campanhas
            </button>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 font-bold text-slate-800 text-xs mb-1">
                <Repeat size={15} className="text-purple-600" />
                Trabalhos Recorrentes
              </div>
              <p className="text-[11px] text-slate-500">
                Remove todos os contratos mensais fixos e seus planejamentos de conteúdo.
              </p>
            </div>
            <button
              onClick={() => {
                setResetScope('recurring');
                setIsResetModalOpen(true);
              }}
              className="mt-3 w-full py-2 bg-white hover:bg-rose-50 text-rose-700 border border-slate-200 hover:border-rose-200 font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Trash2 size={13} />
              Zerar Recorrência
            </button>
          </div>
        </div>
      </div>

      {/* Database Reset Modal */}
      <DatabaseResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        initialScope={resetScope}
        onSuccess={() => {
          setSuccess('Limpeza do banco de dados concluída com sucesso.');
        }}
      />
      <AnimatePresence>
        {userToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 w-full max-w-md text-center flex flex-col items-center gap-4"
            >
              <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center font-bold">
                <Trash2 size={26} />
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900">Remover Acesso de Administrador?</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Tem certeza que deseja remover as permissões de gestão do usuário{' '}
                  <strong className="text-slate-900">{userToDelete.fullName}</strong> ({userToDelete.email})?
                </p>
              </div>

              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-xl text-left w-full">
                ⚠️ Este usuário perderá o acesso às áreas administrativas e relatórios da plataforma.
              </div>

              <div className="flex items-center gap-3 w-full pt-2">
                <button
                  onClick={() => setUserToDelete(null)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleRemoveAdmin}
                  disabled={deleting}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-extrabold text-sm shadow-md shadow-rose-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" /> Removendo...
                    </>
                  ) : (
                    'Confirmar Remoção'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
