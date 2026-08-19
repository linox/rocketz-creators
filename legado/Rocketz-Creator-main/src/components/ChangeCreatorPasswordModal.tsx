import React, { useState, useEffect } from 'react';
import { 
  X, 
  KeyRound, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  Mail, 
  Copy, 
  Check, 
  Sparkles, 
  RefreshCw, 
  ShieldCheck,
  Send
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { sendPasswordResetEmail, updatePassword } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { Creator } from '../types';
import { UserAvatar } from './UserAvatar';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface ChangeCreatorPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  creator: Creator | null;
  onSuccess?: () => void;
}

export function ChangeCreatorPasswordModal({
  isOpen,
  onClose,
  creator,
  onSuccess
}: ChangeCreatorPasswordModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingResetEmail, setSendingResetEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setNewPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setShowConfirmPassword(false);
      setError(null);
      setSuccess(null);
      setCopied(false);
    }
  }, [isOpen, creator]);

  if (!isOpen || !creator) return null;

  const currentAdminEmail = auth.currentUser?.email?.toLowerCase();
  const isSelf = auth.currentUser?.uid === creator.id || auth.currentUser?.email?.toLowerCase() === creator.email?.toLowerCase();

  // Generate strong random temporary password
  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let generated = '';
    for (let i = 0; i < 10; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(generated);
    setConfirmPassword(generated);
    setShowPassword(true);
    setShowConfirmPassword(true);
    setError(null);
  };

  const handleCopyCredentials = () => {
    const textToCopy = `*Acesso à Plataforma Rocketz Creators*\n👤 *Usuário / E-mail:* ${creator.email}\n🔑 *Senha:* ${newPassword || creator.manualPassword || '(senha cadastrada)'}\n🔗 *Link:* ${window.location.origin}/login`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedPassword = newPassword.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (trimmedPassword.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (trimmedPassword !== trimmedConfirm) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setLoading(true);

    try {
      // 1. If user is updating their own logged-in account, update Firebase Auth directly
      if (isSelf && auth.currentUser) {
        try {
          await updatePassword(auth.currentUser, trimmedPassword);
        } catch (authErr: any) {
          console.warn("Could not update auth current user password directly:", authErr);
        }
      }

      // 2. Update creator document in Firestore
      await updateDoc(doc(db, 'creators', creator.id), {
        manualPassword: trimmedPassword,
        passwordUpdatedAt: new Date().toISOString(),
        passwordUpdatedBy: currentAdminEmail || 'admin'
      });

      // 3. Create notification for the creator
      try {
        const { createNotification } = await import('../lib/notifications');
        await createNotification({
          title: 'Senha de Acesso Atualizada 🔑',
          message: 'Sua senha de acesso à plataforma foi atualizada com sucesso.',
          type: 'general',
          targetRole: 'creator',
          creatorId: creator.id,
          link: `/creators/${creator.id}`
        });
      } catch (notifErr) {
        console.warn("Could not create password notification:", notifErr);
      }

      setSuccess(`A senha do criador @${creator.artisticName || creator.fullName} foi alterada e salva com sucesso!`);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error("Error changing creator password:", err);
      setError(err.message || 'Erro ao alterar a senha do criador. Verifique as permissões.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!creator.email) {
      setError('Este criador não possui um endereço de e-mail cadastrado.');
      return;
    }

    setSendingResetEmail(true);
    setError(null);
    setSuccess(null);

    try {
      await sendPasswordResetEmail(auth, creator.email.trim().toLowerCase());
      setSuccess(`Link de redefinição de senha enviado com sucesso para ${creator.email}!`);
    } catch (err: any) {
      console.error("Error sending password reset email:", err);
      if (err.code === 'auth/user-not-found') {
        setError('O usuário com este e-mail ainda não existe no Firebase Auth. Defina uma senha manual abaixo.');
      } else {
        setError(err.message || 'Erro ao enviar e-mail de redefinição.');
      }
    } finally {
      setSendingResetEmail(false);
    }
  };

  return (
    <div 
      id="change-creator-password-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div 
        id="change-creator-password-modal-content"
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-brand-primary flex items-center justify-center font-bold">
              <KeyRound size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 m-0">Alterar Senha do Criador</h3>
              <p className="text-xs text-slate-500 m-0">Gerencie as credenciais de acesso do influenciador</p>
            </div>
          </div>
          <button
            id="close-change-creator-password-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Creator Info Header Box */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/40 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <UserAvatar
              src={creator.photoUrl}
              name={creator.artisticName || creator.fullName}
              size="md"
              shape="rounded-xl"
              className="border border-slate-200"
            />
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-slate-900 truncate m-0">
                @{creator.artisticName || creator.fullName}
              </h4>
              <p className="text-xs text-slate-500 truncate m-0">
                {creator.email || 'Sem e-mail cadastrado'}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
              {creator.role === 'admin' ? 'ADMIN' : 'CRIADOR'}
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Alerts */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2.5"
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                <div className="flex-1 font-medium">{error}</div>
              </motion.div>
            )}

            {success && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-start gap-2.5"
              >
                <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />
                <div className="flex-1 font-medium">{success}</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Previous Password Update Info */}
          {creator.passwordUpdatedAt && (
            <div className="p-3 bg-purple-50/60 border border-purple-100 rounded-xl text-xs text-purple-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck size={15} className="text-brand-primary shrink-0" />
                <span>Última alteração: <strong>{new Date(creator.passwordUpdatedAt).toLocaleDateString('pt-BR')} às {new Date(creator.passwordUpdatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong></span>
              </div>
              {creator.passwordUpdatedBy && (
                <span className="text-[10px] text-purple-700 font-semibold truncate max-w-[150px]" title={creator.passwordUpdatedBy}>
                  por {creator.passwordUpdatedBy}
                </span>
              )}
            </div>
          )}

          {/* Form to set manual password */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">Nova Senha</label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="text-[11px] text-brand-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles size={12} />
                  Gerar Senha Forte
                </button>
              </div>
              <div className="relative">
                <input
                  id="new-creator-password-input"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Confirmar Nova Senha</label>
              <div className="relative">
                <input
                  id="confirm-creator-password-input"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  required
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              <button
                id="save-creator-password-btn"
                type="submit"
                disabled={loading || !newPassword}
                className="w-full sm:flex-1 py-2.5 px-4 bg-brand-primary hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <KeyRound size={14} />
                )}
                {loading ? 'Salvando...' : 'Salvar Nova Senha'}
              </button>

              {newPassword && (
                <button
                  id="copy-creator-credentials-btn"
                  type="button"
                  onClick={handleCopyCredentials}
                  className="w-full sm:w-auto py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Copiar dados de acesso formatados"
                >
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  {copied ? 'Copiado!' : 'Copiar Acesso'}
                </button>
              )}
            </div>
          </form>

          {/* Send Reset Email Option */}
          <div className="border-t border-slate-100 pt-4 mt-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h5 className="text-xs font-bold text-slate-800 m-0">Enviar Link por E-mail</h5>
                <p className="text-[11px] text-slate-500 m-0 mt-0.5">
                  O criador receberá um e-mail oficial para redefinir a própria senha.
                </p>
              </div>
              <button
                id="send-creator-reset-email-btn"
                type="button"
                onClick={handleSendResetEmail}
                disabled={sendingResetEmail || !creator.email}
                className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {sendingResetEmail ? (
                  <RefreshCw size={13} className="animate-spin text-brand-primary" />
                ) : (
                  <Mail size={13} className="text-brand-primary" />
                )}
                <span>{sendingResetEmail ? 'Enviando...' : 'Enviar Link'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            id="close-change-creator-password-footer-btn"
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
