import { useState, useEffect } from 'react';
import { Building2, Search, Plus, MapPin, Mail, Phone, Eye, MoreHorizontal, Edit, Trash2, Users, Lock, CheckCircle2, Clock, XCircle, ShieldCheck } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, addDoc, doc, updateDoc, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Company, CompanyContact } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import firebaseConfig from '../../firebase-applet-config.json';
import { CompanyLogoUpload } from '../components/CompanyLogoUpload';
import { UserAvatar } from '../components/UserAvatar';

export default function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active' | 'rejected'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editStatus, setEditStatus] = useState<'active' | 'pending' | 'rejected'>('active');

  // Logo states
  const [createLogo, setCreateLogo] = useState('');
  const [editLogo, setEditLogo] = useState('');

  // States for new contact creation inside edit modal
  const [newContactName, setNewContactName] = useState('');
  const [newContactRole, setNewContactRole] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactWhatsapp, setNewContactWhatsapp] = useState('');
  const [tempContacts, setTempContacts] = useState<CompanyContact[]>([]);

  // States for access users list and creation inside edit modal
  const [companyUsersList, setCompanyUsersList] = useState<{ id: string; name: string; email: string }[]>([]);
  const [newAccessUserName, setNewAccessUserName] = useState('');
  const [newAccessUserEmail, setNewAccessUserEmail] = useState('');
  const [newAccessUserPassword, setNewAccessUserPassword] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'companies'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setCompanies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company)));
    }, (err) => {
      console.warn("Companies onSnapshot warning:", err.message);
    });
  }, []);

  const handleApproveCompany = async (companyId: string, companyName: string) => {
    try {
      await updateDoc(doc(db, 'companies', companyId), {
        status: 'active'
      });
      alert(`A empresa "${companyName}" foi aprovada e está disponível para uso!`);
    } catch (err: any) {
      console.error("Error approving company:", err);
      alert("Erro ao aprovar empresa: " + (err.message || 'Tente novamente.'));
    }
  };

  const handleRejectCompany = async (companyId: string, companyName: string) => {
    if (!confirm(`Deseja realmente recusar o cadastro da empresa "${companyName}"?`)) return;
    try {
      await updateDoc(doc(db, 'companies', companyId), {
        status: 'rejected'
      });
    } catch (err: any) {
      console.error("Error rejecting company:", err);
      alert("Erro ao recusar empresa: " + (err.message || 'Tente novamente.'));
    }
  };

  const pendingCount = companies.filter(c => (c.status === 'pending' || !c.status)).length;
  const activeCount = companies.filter(c => c.status === 'active').length;

  const filtered = companies.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const companyStatus = c.status || 'pending';
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'pending' && (c.status === 'pending' || !c.status)) ||
      (statusFilter === 'active' && c.status === 'active') ||
      (statusFilter === 'rejected' && c.status === 'rejected');
    return matchesSearch && matchesStatus;
  });

  const handleOpenEditModal = (company: Company) => {
    setEditingCompany(company);
    setEditStatus(company.status || 'active');
    setEditLogo(company.logo || company.logoUrl || '');
    setTempContacts(company.contacts || []);
    setIsEditModalOpen(true);
  };

  const handleAddContact = () => {
    if (!newContactName.trim()) {
      alert('O nome do contato é obrigatório.');
      return;
    }
    const contact: CompanyContact = {
      name: newContactName,
      role: newContactRole || 'Contato Geral',
      email: newContactEmail,
      whatsapp: newContactWhatsapp
    };
    setTempContacts([...tempContacts, contact]);
    setNewContactName('');
    setNewContactRole('');
    setNewContactEmail('');
    setNewContactWhatsapp('');
  };

  const handleRemoveContact = (index: number) => {
    setTempContacts(tempContacts.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (editingCompany) {
      const q = query(collection(db, 'companyUsers'), where('companyId', '==', editingCompany.id));
      const unsub = onSnapshot(q, (snapshot) => {
        setCompanyUsersList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
      }, async (err) => {
        console.warn("companyUsers onSnapshot warning:", err.message);
        if (err.message?.includes('permission') || (err as any).code === 'permission-denied') {
          const { handleFirestoreError, OperationType } = await import('../lib/firebase');
          handleFirestoreError(err, OperationType.LIST, 'companyUsers');
        }
      });
      return () => unsub();
    } else {
      setCompanyUsersList([]);
    }
  }, [editingCompany]);

  const handleCreateCompanyUser = async () => {
    if (!newAccessUserName.trim() || !newAccessUserEmail.trim() || !newAccessUserPassword.trim()) {
      alert('Preencha nome, e-mail e senha.');
      return;
    }
    if (newAccessUserPassword.length < 6) {
      alert('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newAccessUserEmail.trim())) {
      alert('Por favor, insira um e-mail válido.');
      return;
    }
    if (!editingCompany) return;

    setCreatingUser(true);
    let secondaryApp: any = null;
    try {
      const { collection, getDocs, query, where, setDoc, doc } = await import('firebase/firestore');
      const targetEmail = newAccessUserEmail.trim().toLowerCase();

      let foundUid: string | null = null;

      // 1. Check if user already exists in companyUsers
      let companyUserSnapshot;
      try {
        const companyUserQuery = query(collection(db, 'companyUsers'), where('email', '==', targetEmail));
        companyUserSnapshot = await getDocs(companyUserQuery);
      } catch (err: any) {
        if (err.message?.includes('permission') || err.code === 'permission-denied') {
          const { handleFirestoreError, OperationType } = await import('../lib/firebase');
          handleFirestoreError(err, OperationType.LIST, 'companyUsers');
        }
        throw err;
      }

      if (!companyUserSnapshot.empty) {
        foundUid = companyUserSnapshot.docs[0].id;
      }

      // 2. Check if user already exists in creators
      if (!foundUid) {
        let creatorSnapshot;
        try {
          const creatorQuery = query(collection(db, 'creators'), where('email', '==', targetEmail));
          creatorSnapshot = await getDocs(creatorQuery);
        } catch (err: any) {
          if (err.message?.includes('permission') || err.code === 'permission-denied') {
            const { handleFirestoreError, OperationType } = await import('../lib/firebase');
            handleFirestoreError(err, OperationType.LIST, 'creators');
          }
          throw err;
        }

        if (!creatorSnapshot.empty) {
          foundUid = creatorSnapshot.docs[0].id;
        }
      }

      // If user exists, link them directly to this company!
      if (foundUid) {
        try {
          await setDoc(doc(db, 'companyUsers', foundUid), {
            uid: foundUid,
            companyId: editingCompany.id,
            name: newAccessUserName,
            email: targetEmail,
            createdAt: new Date().toISOString()
          });
        } catch (err: any) {
          if (err.message?.includes('permission') || err.code === 'permission-denied') {
            const { handleFirestoreError, OperationType } = await import('../lib/firebase');
            handleFirestoreError(err, OperationType.WRITE, `companyUsers/${foundUid}`);
          }
          throw err;
        }

        alert('Usuário existente associado com sucesso a esta empresa!');
        setNewAccessUserName('');
        setNewAccessUserEmail('');
        setNewAccessUserPassword('');
        setCreatingUser(false);
        return;
      }

      // If user does not exist, proceed with creating a brand new Firebase Auth account using SecondaryApp
      const { initializeApp } = await import('firebase/app');
      const { initializeAuth, inMemoryPersistence, createUserWithEmailAndPassword, signInWithEmailAndPassword } = await import('firebase/auth');

      secondaryApp = initializeApp(firebaseConfig, `SecondaryApp_${Date.now()}`);
      const secondaryAuth = initializeAuth(secondaryApp, {
        persistence: inMemoryPersistence
      });

      let newUid: string;
      try {
        const userCredential = await createUserWithEmailAndPassword(
          secondaryAuth,
          targetEmail,
          newAccessUserPassword
        );
        newUid = userCredential.user.uid;
      } catch (authErr: any) {
        const isEmailInUse = authErr.code === 'auth/email-already-in-use' || 
                             authErr.message?.includes('email-already-in-use') ||
                             authErr.message?.includes('auth/email-already-in-use');
        if (isEmailInUse) {
          try {
            // Se o e-mail já estiver em uso no Auth mas não no Firestore por algum motivo, tenta fazer login
            const loginCredential = await signInWithEmailAndPassword(
              secondaryAuth,
              targetEmail,
              newAccessUserPassword
            );
            newUid = loginCredential.user.uid;
            console.log("Recuperou credenciais de usuário existente com sucesso. Prosseguindo com o Firestore.");
          } catch (signInErr) {
            throw authErr;
          }
        } else {
          throw authErr;
        }
      }

      try {
        await setDoc(doc(db, 'companyUsers', newUid), {
          uid: newUid,
          companyId: editingCompany.id,
          name: newAccessUserName,
          email: targetEmail,
          createdAt: new Date().toISOString()
        });
      } catch (err: any) {
        if (err.message?.includes('permission') || err.code === 'permission-denied') {
          const { handleFirestoreError, OperationType } = await import('../lib/firebase');
          handleFirestoreError(err, OperationType.WRITE, `companyUsers/${newUid}`);
        }
        throw err;
      }

      alert('Usuário de acesso criado ou associado com sucesso!');
      setNewAccessUserName('');
      setNewAccessUserEmail('');
      setNewAccessUserPassword('');
    } catch (err: any) {
      console.error("Error creating company user:", err);
      // Check if it's our JSON format, and rethrow it to let it propagate to the test runner!
      let isFirestoreJson = false;
      try {
        const parsed = JSON.parse(err.message);
        if (parsed && parsed.operationType) {
          isFirestoreJson = true;
        }
      } catch (e) {}

      if (isFirestoreJson) {
        throw err;
      }

      const isEmailInUse = err.code === 'auth/email-already-in-use' || 
                           err.message?.includes('email-already-in-use') ||
                           err.message?.includes('auth/email-already-in-use');
      if (isEmailInUse) {
        alert('Este e-mail já está em uso no sistema por outro usuário.');
      } else {
        alert(`Erro ao criar usuário: ${err.message}`);
      }
    } finally {
      if (secondaryApp) {
        try {
          const { deleteApp } = await import('firebase/app');
          await deleteApp(secondaryApp);
        } catch (delErr) {
          console.error("Error deleting secondary app:", delErr);
        }
      }
      setCreatingUser(false);
    }
  };

  const handleDeleteCompanyUser = async (userId: string) => {
    if (confirm('Tem certeza de que deseja remover o acesso deste usuário?')) {
      const { deleteDoc, doc } = await import('firebase/firestore');
      try {
        await deleteDoc(doc(db, 'companyUsers', userId));
        alert('Acesso removido com sucesso!');
      } catch (err: any) {
        console.error(err);
        alert(`Erro ao remover: ${err.message}`);
      }
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#0F172A] m-0">Gestão de Empresas</h1>
          <p className="m-1 mt-0 text-[#64748B] text-[14px]">Gerencie seus clientes e parceiros estratégicos</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-brand-primary text-white h-11 px-6 rounded-lg text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-600 transition-all active:scale-95 flex items-center gap-2"
        >
          <Plus size={18} />
          Nova Empresa
        </button>
      </header>

      <div className="bg-white p-4 sm:p-5 rounded-[16px] border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Pesquisar por nome da empresa..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
              statusFilter === 'all' 
                ? 'bg-slate-900 text-white shadow-xs' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todas ({companies.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'pending' 
                ? 'bg-amber-500 text-white shadow-xs' 
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <Clock size={13} />
            Pendentes de Aprovação ({pendingCount})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'active' 
                ? 'bg-emerald-600 text-white shadow-xs' 
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 size={13} />
            Ativas / Aprovadas ({activeCount})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {filtered.map(company => {
            const status = company.status || 'pending';
            return (
            <motion.div 
              layout
              key={company.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`bg-white rounded-[16px] border p-6 hover:border-brand-primary transition-all flex flex-col h-full ${
                status === 'pending' ? 'border-amber-300 ring-2 ring-amber-400/20 bg-amber-50/10' : 'border-[#E2E8F0]'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <UserAvatar
                  src={company.logo || company.logoUrl}
                  name={company.name}
                  size="custom"
                  shape="rounded-xl"
                  className="w-12 h-12 border border-slate-200 shadow-xs"
                  textClassName="text-base font-black"
                />
                
                <div className="flex items-center gap-1.5">
                  {/* Status badge */}
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider border uppercase flex items-center gap-1 ${
                    status === 'active' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                    status === 'rejected' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                    'bg-amber-100 text-amber-900 border-amber-300'
                  }`}>
                    {status === 'active' && <CheckCircle2 size={10} />}
                    {status === 'pending' && <Clock size={10} />}
                    {status === 'rejected' && <XCircle size={10} />}
                    {status === 'active' ? 'ATIVO' : status === 'rejected' ? 'RECUSADO' : 'PENDENTE'}
                  </span>

                  <button 
                    onClick={() => handleOpenEditModal(company)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all cursor-pointer"
                    title="Editar Empresa / Contatos / Logo"
                  >
                    <Edit size={16} />
                  </button>
                </div>
              </div>

              <div className="flex-1">
                <h2 className="text-[18px] font-bold text-[#0F172A] mb-1">{company.name}</h2>
                <div className="flex flex-wrap gap-2 items-center mb-4">
                  <span className="text-[11px] font-bold text-brand-primary bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wider">{company.segment || 'Sem Segmento'}</span>
                  {company.contacts && company.contacts.length > 0 && (
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                      <Users size={10} /> {company.contacts.length} {company.contacts.length === 1 ? 'Contato' : 'Contatos'}
                    </span>
                  )}
                </div>

                {/* Pending approval alert banner on card */}
                {status === 'pending' && (
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-amber-900 font-bold">
                      <Clock size={14} className="text-amber-600 shrink-0" />
                      <span>Aguardando Aprovação do Admin</span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-snug m-0">
                      Esta empresa foi cadastrada pelo site e necessita de liberação para ficar 100% disponível.
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => handleApproveCompany(company.id, company.name)}
                        className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                      >
                        <CheckCircle2 size={13} />
                        Aprovar Empresa
                      </button>
                      <button
                        onClick={() => handleRejectCompany(company.id, company.name)}
                        className="py-1.5 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                        title="Recusar cadastro"
                      >
                        <XCircle size={13} />
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-col gap-2">
                  <div className="flex items-center gap-3 text-xs text-[#64748B]">
                    <MapPin size={14} className="shrink-0" />
                    {company.city || 'Cidade não informada'}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#64748B]">
                    <Mail size={14} className="shrink-0" />
                    {company.email || 'E-mail não informado'}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#64748B]">
                    <Phone size={14} className="shrink-0" />
                    {company.whatsapp || 'WhatsApp não informado'}
                  </div>
                  {company.cnpj && (
                    <div className="text-[11px] text-[#94A3B8] font-mono mt-1">
                      CNPJ: {company.cnpj}
                    </div>
                  )}
                </div>

                {/* Inline preview of contacts if they exist */}
                {company.contacts && company.contacts.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-[#F1F5F9]">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Contatos Principais</span>
                    <div className="flex flex-col gap-1 max-h-[70px] overflow-y-auto">
                      {company.contacts.map((contact, idx) => (
                        <div key={idx} className="text-[11px] text-slate-600 flex justify-between gap-1">
                          <span className="font-semibold truncate">{contact.name} ({contact.role})</span>
                          <span className="text-[10px] text-slate-400 shrink-0">{contact.whatsapp || contact.email}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-[#F1F5F9] flex gap-2">
                <button 
                  onClick={() => handleOpenEditModal(company)}
                  className="flex-1 py-2 bg-[#F8FAFC] hover:bg-slate-100 text-[#0F172A] text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 border border-[#E2E8F0]"
                >
                  <Edit size={14} className="text-slate-500" />
                  Editar
                </button>
                <Link 
                  to={`/company-dashboard?companyId=${company.id}`}
                  className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-brand-primary text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 border border-indigo-100"
                >
                  <Eye size={14} />
                  Ver Painel
                </Link>
              </div>
            </motion.div>
          )})}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20">
          <p className="text-slate-500">Nenhuma empresa encontrada.</p>
        </div>
      )}

      {/* New Company Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] overflow-y-auto p-3 sm:p-4 flex items-center justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative w-full max-w-lg bg-white rounded-[20px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto z-10">
              <div className="p-5 sm:p-6 border-b border-[#E2E8F0] flex items-center justify-between shrink-0 bg-white">
                <h2 className="text-xl font-bold text-[#0F172A]">Nova Empresa</h2>
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer">✕</button>
              </div>
              <form className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-4" onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                await addDoc(collection(db, 'companies'), {
                  name: formData.get('name'),
                  logo: createLogo.trim(),
                  logoUrl: createLogo.trim(),
                  cnpj: formData.get('cnpj') || '',
                  segment: formData.get('segment') || '',
                  email: formData.get('email') || '',
                  whatsapp: formData.get('whatsapp') || '',
                  city: formData.get('city') || '',
                  observations: formData.get('observations') || '',
                  status: 'active',
                  contacts: [],
                  createdAt: serverTimestamp(),
                });
                setCreateLogo('');
                setIsModalOpen(false);
              }}>
                {/* Logo Upload Component */}
                <CompanyLogoUpload 
                  value={createLogo} 
                  onChange={setCreateLogo} 
                  label="Logo do Perfil da Empresa (Opcional)" 
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Nome da Empresa</label>
                  <input name="name" required className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm font-semibold text-slate-800" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">CNPJ</label>
                    <input name="cnpj" className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Segmento</label>
                    <input name="segment" className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">E-mail de Contato</label>
                    <input name="email" type="email" className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">WhatsApp / Telefone</label>
                    <input name="whatsapp" className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Cidade / UF</label>
                  <input name="city" className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Observações</label>
                  <textarea name="observations" rows={3} className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm resize-none" placeholder="Detalhes de faturamento, canais preferidos, notas gerais..." />
                </div>
                
                <div className="pt-4 border-t border-[#E2E8F0] flex gap-3 shrink-0 bg-white">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 text-sm font-bold text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">Cancelar</button>
                  <button type="submit" className="flex-1 py-2.5 bg-brand-primary text-white text-sm font-bold rounded-lg shadow-lg shadow-indigo-200 hover:bg-indigo-600 transition-colors cursor-pointer">Adicionar</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Company & Contacts Modal */}
      <AnimatePresence>
        {isEditModalOpen && editingCompany && (
          <div className="fixed inset-0 z-[100] overflow-y-auto p-3 sm:p-4 flex items-center justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)} />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative w-full max-w-2xl bg-white rounded-[20px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto z-10">
              <div className="p-5 sm:p-6 border-b border-[#E2E8F0] flex items-center justify-between shrink-0 bg-white">
                <div>
                  <h2 className="text-xl font-bold text-[#0F172A]">Editar Empresa</h2>
                  <p className="text-xs text-[#64748B] mt-0.5">Atualize dados gerais e gerencie contatos desta marca</p>
                </div>
                <button 
                  onClick={() => setIsEditModalOpen(false)} 
                  className="h-8 w-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-4 custom-scrollbar" onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const docRef = doc(db, 'companies', editingCompany.id);
                
                await updateDoc(docRef, {
                  name: formData.get('name'),
                  logo: editLogo.trim(),
                  logoUrl: editLogo.trim(),
                  cnpj: formData.get('cnpj') || '',
                  segment: formData.get('segment') || '',
                  email: formData.get('email') || '',
                  whatsapp: formData.get('whatsapp') || '',
                  city: formData.get('city') || '',
                  observations: formData.get('observations') || '',
                  status: editStatus,
                  contacts: tempContacts
                });
                
                setIsEditModalOpen(false);
                setEditingCompany(null);
                setEditLogo('');
              }}>
                {/* Status Switcher & Logo */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">Status da Empresa</label>
                    <span className="text-[11px] text-slate-500">Defina se a empresa está aprovada para uso</span>
                  </div>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as 'active' | 'pending' | 'rejected')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border outline-none cursor-pointer ${
                      editStatus === 'active' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                      editStatus === 'rejected' ? 'bg-rose-50 text-rose-800 border-rose-300' :
                      'bg-amber-50 text-amber-900 border-amber-300'
                    }`}
                  >
                    <option value="active">✅ Ativo (Aprovado)</option>
                    <option value="pending">⏳ Pendente de Aprovação</option>
                    <option value="rejected">❌ Recusado / Bloqueado</option>
                  </select>
                </div>

                {/* Logo Upload / Edit Component */}
                <CompanyLogoUpload 
                  value={editLogo} 
                  onChange={setEditLogo} 
                  label="Logo do Perfil da Empresa" 
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Nome da Empresa</label>
                  <input name="name" required defaultValue={editingCompany.name} className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm font-semibold text-slate-800" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">CNPJ</label>
                    <input name="cnpj" defaultValue={editingCompany.cnpj} className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm text-slate-800" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Segmento</label>
                    <input name="segment" defaultValue={editingCompany.segment} className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm text-slate-800" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">E-mail Principal</label>
                    <input name="email" type="email" defaultValue={editingCompany.email} className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm text-slate-800" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">WhatsApp Principal</label>
                    <input name="whatsapp" defaultValue={editingCompany.whatsapp} className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm text-slate-800" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Cidade / UF</label>
                  <input name="city" defaultValue={editingCompany.city} className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm text-slate-800" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Observações</label>
                  <textarea name="observations" rows={2} defaultValue={editingCompany.observations} className="w-full px-4 py-2.5 rounded-lg border border-[#E2E8F0] outline-none focus:border-brand-primary text-sm resize-none text-slate-800" placeholder="Informações gerais de faturamento, prazos..." />
                </div>

                {/* Contacts management section */}
                <div className="flex flex-col gap-3 mt-2 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Users size={14} className="text-indigo-600" /> Contatos Adicionais
                    </h3>
                    <span className="text-[10px] text-slate-500 font-bold">{tempContacts.length} cadastrados</span>
                  </div>
                  
                  {/* Add contact input grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex flex-col gap-1">
                      <input 
                        type="text" 
                        placeholder="Nome do Contato" 
                        value={newContactName} 
                        onChange={e => setNewContactName(e.target.value)}
                        className="px-3 py-2 rounded-md border border-[#E2E8F0] outline-none bg-white font-medium"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <input 
                        type="text" 
                        placeholder="Cargo / Setor (ex: Marketing)" 
                        value={newContactRole} 
                        onChange={e => setNewContactRole(e.target.value)}
                        className="px-3 py-2 rounded-md border border-[#E2E8F0] outline-none bg-white font-medium"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <input 
                        type="email" 
                        placeholder="E-mail" 
                        value={newContactEmail} 
                        onChange={e => setNewContactEmail(e.target.value)}
                        className="px-3 py-2 rounded-md border border-[#E2E8F0] outline-none bg-white"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <input 
                        type="text" 
                        placeholder="WhatsApp / Telefone" 
                        value={newContactWhatsapp} 
                        onChange={e => setNewContactWhatsapp(e.target.value)}
                        className="px-3 py-2 rounded-md border border-[#E2E8F0] outline-none bg-white"
                      />
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={handleAddContact}
                    className="py-1.5 px-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 self-end transition-all"
                  >
                    <Plus size={14} /> Adicionar Contato
                  </button>

                  {/* Temp Contacts List */}
                  <div className="flex flex-col gap-2 max-h-[140px] overflow-y-auto mt-2 custom-scrollbar">
                    {tempContacts.length === 0 ? (
                      <p className="text-[11px] text-[#64748B] italic text-center py-2">Nenhum contato cadastrado para esta empresa.</p>
                    ) : (
                      tempContacts.map((contact, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2.5 bg-white rounded-lg border border-slate-200 shadow-sm text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-slate-800">{contact.name} <span className="font-normal text-indigo-600 text-[10px] bg-indigo-50 px-1.5 py-0.5 rounded-full ml-1">{contact.role}</span></span>
                            <span className="text-[10px] text-[#64748B] flex flex-wrap gap-2">
                              {contact.email && <span>Email: {contact.email}</span>}
                              {contact.whatsapp && <span>WhatsApp: {contact.whatsapp}</span>}
                            </span>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => handleRemoveContact(idx)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all"
                            title="Remover Contato"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Access Users Section */}
                <div className="flex flex-col gap-3 mt-4 p-4 bg-[#F8FAFC] rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Lock size={14} className="text-emerald-600" /> Usuários de Acesso ao Portal (Logins)
                    </h3>
                    <span className="text-[10px] text-slate-500 font-bold">{companyUsersList.length} cadastrados</span>
                  </div>

                  {/* Create New Access User Form */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="flex flex-col gap-1">
                      <input 
                        type="text" 
                        placeholder="Nome do Usuário" 
                        value={newAccessUserName} 
                        onChange={e => setNewAccessUserName(e.target.value)}
                        className="px-3 py-2 rounded-md border border-[#E2E8F0] outline-none bg-white font-medium text-slate-800"
                        disabled={creatingUser}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <input 
                        type="email" 
                        placeholder="E-mail de Login" 
                        value={newAccessUserEmail} 
                        onChange={e => setNewAccessUserEmail(e.target.value)}
                        className="px-3 py-2 rounded-md border border-[#E2E8F0] outline-none bg-white text-slate-800"
                        disabled={creatingUser}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <input 
                        type="password" 
                        placeholder="Senha de Acesso" 
                        value={newAccessUserPassword} 
                        onChange={e => setNewAccessUserPassword(e.target.value)}
                        className="px-3 py-2 rounded-md border border-[#E2E8F0] outline-none bg-white text-slate-800"
                        disabled={creatingUser}
                      />
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={handleCreateCompanyUser}
                    disabled={creatingUser}
                    className="py-1.5 px-3 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 self-end transition-all disabled:opacity-50"
                  >
                    {creatingUser ? (
                      <>
                        <span className="w-3.5 h-3.5 rounded-full border border-t-transparent border-emerald-600 animate-spin" />
                        Criando Conta...
                      </>
                    ) : (
                      <>
                        <Plus size={14} /> Cadastrar Usuário
                      </>
                    )}
                  </button>

                  {/* List of Registered Access Users */}
                  <div className="flex flex-col gap-2 max-h-[140px] overflow-y-auto mt-2 custom-scrollbar">
                    {companyUsersList.length === 0 ? (
                      <p className="text-[11px] text-[#64748B] italic text-center py-2">Nenhum usuário de acesso cadastrado para esta empresa.</p>
                    ) : (
                      companyUsersList.map((cUser) => (
                        <div key={cUser.id} className="flex justify-between items-center p-2.5 bg-white rounded-lg border border-slate-200 shadow-sm text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-slate-800">{cUser.name}</span>
                            <span className="text-[10px] text-[#64748B]">{cUser.email}</span>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => handleDeleteCompanyUser(cUser.id)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all"
                            title="Remover Acesso"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                
                <div className="pt-4 border-t border-[#E2E8F0] flex gap-3 mt-4 shrink-0 bg-white">
                  <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-2.5 text-sm font-bold text-[#64748B] border border-[#E2E8F0] rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">Cancelar</button>
                  <button type="submit" className="flex-1 py-2.5 bg-brand-primary text-white text-sm font-bold rounded-lg shadow-lg shadow-indigo-200 hover:bg-indigo-600 transition-colors cursor-pointer">Salvar Alterações</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

