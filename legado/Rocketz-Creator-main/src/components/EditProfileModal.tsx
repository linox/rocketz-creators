import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  User, 
  Mail, 
  Smartphone, 
  Instagram, 
  UploadCloud, 
  Check, 
  Sparkles, 
  Building2, 
  CreditCard, 
  MapPin, 
  FileText,
  AlertCircle,
  CheckCircle2,
  Camera,
  Shield
} from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { uploadFileInChunks } from '../utils/fileUpload';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { UserAvatar } from './UserAvatar';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  role?: 'admin' | 'creator' | 'company' | null;
  onProfileUpdated?: (updatedData: any) => void;
}

export function EditProfileModal({ isOpen, onClose, role, onProfileUpdated }: EditProfileModalProps) {
  const currentUser = auth.currentUser;
  
  const [fullName, setFullName] = useState('');
  const [artisticName, setArtisticName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [instagram, setInstagram] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [bankDetails, setBankDetails] = useState('');
  const [document, setDocument] = useState('');
  const [companyName, setCompanyName] = useState('');

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing profile data
  useEffect(() => {
    if (!isOpen || !currentUser) return;

    setFetching(true);
    setErrorMessage('');
    setSuccessMessage('');

    // Pre-fill from auth
    setFullName(currentUser.displayName || '');
    setPhotoUrl(currentUser.photoURL || '');

    async function loadData() {
      try {
        if (!currentUser) return;
        
        // 1. Try creators collection
        const creatorSnap = await getDoc(doc(db, 'creators', currentUser.uid));
        if (creatorSnap.exists()) {
          const data = creatorSnap.data();
          if (data.fullName) setFullName(data.fullName);
          if (data.artisticName) setArtisticName(data.artisticName);
          if (data.photoUrl) setPhotoUrl(data.photoUrl);
          if (data.whatsapp) setWhatsapp(data.whatsapp);
          if (data.bio) setBio(data.bio);
          if (data.city) setCity(data.city);
          if (data.state) setState(data.state);
          if (data.socials?.instagram) setInstagram(data.socials.instagram);
          if (data.socials?.tiktok) setTiktok(data.socials.tiktok);
          if (data.pixKey) setPixKey(data.pixKey);
          if (data.bankDetails) setBankDetails(data.bankDetails);
          if (data.document) setDocument(data.document);
        }

        // 2. Try companyUsers if company role
        if (role === 'company') {
          const companyUserSnap = await getDoc(doc(db, 'companyUsers', currentUser.uid));
          if (companyUserSnap.exists()) {
            const data = companyUserSnap.data();
            if (data.name) setFullName(data.name);
            if (data.whatsapp) setWhatsapp(data.whatsapp);
            if (data.companyName) setCompanyName(data.companyName);
            if (data.logoUrl) setPhotoUrl(data.logoUrl);
          }
        }
      } catch (err: any) {
        console.error("Error loading user profile:", err);
      } finally {
        setFetching(false);
      }
    }

    loadData();
  }, [isOpen, currentUser, role]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Por favor, selecione um arquivo de imagem válido (JPG, PNG, WebP).');
      return;
    }

    setIsUploadingPhoto(true);
    setUploadProgress(10);
    setErrorMessage('');

    try {
      // Chunk upload to server
      const result = await uploadFileInChunks(file, setUploadProgress);
      setPhotoUrl(result.url);
      setSuccessMessage('Foto carregada com sucesso!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      console.error('Error uploading photo:', err);
      setErrorMessage('Erro ao carregar a imagem. Tente novamente ou use uma URL.');
    } finally {
      setIsUploadingPhoto(false);
      setUploadProgress(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!fullName.trim()) {
      setErrorMessage('O nome é obrigatório.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const trimmedName = fullName.trim();
      const trimmedPhoto = photoUrl.trim();

      // 1. Update Firebase Auth Profile
      await updateProfile(currentUser, {
        displayName: trimmedName,
        photoURL: trimmedPhoto || null
      });

      const cleanArtistic = artisticName.trim().replace(/^@+/, '') || trimmedName;

      const updatedPayload: any = {
        fullName: trimmedName,
        artisticName: cleanArtistic,
        photoUrl: trimmedPhoto,
        email: currentUser.email || '',
        whatsapp: whatsapp.trim(),
        bio: bio.trim(),
        city: city.trim(),
        state: state.trim(),
        document: document.trim(),
        pixKey: pixKey.trim(),
        bankDetails: bankDetails.trim(),
        socials: {
          instagram: instagram.trim().replace(/^@/, ''),
          tiktok: tiktok.trim().replace(/^@/, '')
        },
        updatedAt: serverTimestamp()
      };

      // 2. Persist to Firestore
      if (role === 'company') {
        await setDoc(doc(db, 'companyUsers', currentUser.uid), {
          name: trimmedName,
          email: currentUser.email || '',
          whatsapp: whatsapp.trim(),
          companyName: companyName.trim(),
          logoUrl: trimmedPhoto,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } else {
        // Creator or Admin
        await setDoc(doc(db, 'creators', currentUser.uid), updatedPayload, { merge: true });

        if (role === 'admin') {
          await setDoc(doc(db, 'adminUsers', currentUser.uid), {
            fullName: trimmedName,
            artisticName: artisticName.trim() || trimmedName,
            email: currentUser.email || '',
            photoUrl: trimmedPhoto,
            whatsapp: whatsapp.trim(),
            bio: bio.trim(),
            role: 'admin',
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
      }

      setSuccessMessage('Perfil atualizado com sucesso!');
      if (onProfileUpdated) {
        onProfileUpdated(updatedPayload);
      }

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Error saving user profile:', err);
      setErrorMessage(err.message || 'Erro ao salvar alterações no perfil.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] overflow-y-auto p-3 sm:p-4 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" 
          onClick={onClose} 
        />

        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.95, y: 15 }} 
          className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto z-10 border border-slate-200"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-primary text-white flex items-center justify-center shadow-md shadow-indigo-200">
                <User size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">Editar Meu Perfil de Usuário</h2>
                <p className="text-xs text-slate-500">Mantenha seus dados cadastrais, foto e contatos atualizados</p>
              </div>
            </div>
            <button 
              type="button" 
              onClick={onClose} 
              className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {fetching ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="w-8 h-8 border-3 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-semibold">Carregando informações do perfil...</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-5">
              {/* Status alerts */}
              {errorMessage && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0 text-rose-500" />
                  <span>{errorMessage}</span>
                </div>
              )}
              {successMessage && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Photo & Identity Section */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-center gap-5">
                <div className="relative group shrink-0">
                  <UserAvatar
                    src={photoUrl}
                    name={artisticName || fullName || currentUser?.displayName || currentUser?.email}
                    size="custom"
                    shape="rounded-2xl"
                    className="w-20 h-20 sm:w-24 sm:h-24 border-2 border-white shadow-md"
                    textClassName="text-2xl font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    className="absolute -bottom-2 -right-2 p-2 bg-brand-primary text-white rounded-xl shadow-md hover:bg-indigo-600 transition-colors cursor-pointer"
                    title="Trocar Foto"
                  >
                    <Camera size={14} />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </div>

                <div className="flex-1 w-full space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Foto de Perfil / Avatar
                    </label>
                    {isUploadingPhoto && (
                      <span className="text-[10px] text-brand-primary font-bold animate-pulse">
                        Enviando foto ({uploadProgress}%)...
                      </span>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={photoUrl}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                      placeholder="https://link-da-sua-foto.jpg ou faça upload ao lado"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 outline-none focus:border-brand-primary bg-white font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
                    >
                      <UploadCloud size={14} /> Upload
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">Recomendado formato quadrado ou foto de rosto nítida (JPG, PNG).</p>
                </div>
              </div>

              {/* Main Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex: João da Silva"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 outline-none focus:border-brand-primary"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    {role === 'company' ? 'Empresa / Razão Social' : 'Nome Artístico / @ (Arroba)'}
                  </label>
                  {role === 'company' ? (
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Ex: Minha Empresa LTDA"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 outline-none focus:border-brand-primary"
                    />
                  ) : (
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">@</span>
                      <input
                        type="text"
                        value={artisticName}
                        onChange={(e) => setArtisticName(e.target.value.replace(/^@+/, ''))}
                        placeholder="ex: juliana.fit"
                        className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 outline-none focus:border-brand-primary"
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    E-mail de Acesso (Google / Conta)
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      disabled
                      value={currentUser.email || ''}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-sm font-medium text-slate-500 cursor-not-allowed pl-9"
                    />
                    <Mail size={16} className="absolute left-3 top-3 text-slate-400" />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    WhatsApp / Telefone para Contato
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 outline-none focus:border-brand-primary pl-9"
                    />
                    <Smartphone size={16} className="absolute left-3 top-3 text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Social / Creator specifics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Instagram size={13} className="text-pink-500" /> Usuário Instagram
                  </label>
                  <input
                    type="text"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder="seu_usuario (sem @)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-brand-primary"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={13} className="text-rose-500" /> Usuário TikTok
                  </label>
                  <input
                    type="text"
                    value={tiktok}
                    onChange={(e) => setTiktok(e.target.value)}
                    placeholder="seu_tiktok (sem @)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-brand-primary"
                  />
                </div>
              </div>

              {/* Location */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Cidade</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ex: São Paulo"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 outline-none focus:border-brand-primary"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Estado (UF)</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={state}
                    onChange={(e) => setState(e.target.value.toUpperCase())}
                    placeholder="SP"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 outline-none focus:border-brand-primary uppercase"
                  />
                </div>
              </div>

              {/* Bio / Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Biografia / Apresentação
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Conte brevemente sobre seu estilo de conteúdo, nicho, experiências ou histórico profissional..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 outline-none focus:border-brand-primary resize-none"
                />
              </div>

              {/* Payment details for creators */}
              {role === 'creator' && (
                <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                    <CreditCard size={16} className="text-emerald-600" />
                    Dados Financeiros para Pagamentos de Cachê
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-emerald-800 uppercase">Chave PIX</label>
                      <input
                        type="text"
                        value={pixKey}
                        onChange={(e) => setPixKey(e.target.value)}
                        placeholder="CPF, E-mail ou Telefone"
                        className="w-full px-3 py-2 rounded-lg border border-emerald-200 text-xs font-semibold text-slate-800 bg-white"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-emerald-800 uppercase">CPF / CNPJ</label>
                      <input
                        type="text"
                        value={document}
                        onChange={(e) => setDocument(e.target.value)}
                        placeholder="000.000.000-00"
                        className="w-full px-3 py-2 rounded-lg border border-emerald-200 text-xs font-semibold text-slate-800 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Footer Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0 bg-white">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || isUploadingPhoto}
                  className="px-6 py-2.5 bg-brand-primary text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-600 transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Check size={16} /> Salvar Alterações
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
