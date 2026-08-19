import React, { useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { usePrivacy } from '../context/PrivacyContext';

export function LgpdBanner() {
  const { lgpdAccepted, acceptLgpd, openLgpdModal } = usePrivacy();
  const [dismissedTemporarily, setDismissedTemporarily] = useState(false);

  if (lgpdAccepted || dismissedTemporarily) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-40 bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-slate-700/80 animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">
          <ShieldCheck size={18} />
        </div>
        <div className="flex-1 text-xs space-y-1 pr-4">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
              Privacidade & LGPD
            </h4>
          </div>
          <p className="text-slate-300 leading-relaxed text-[11px]">
            Utilizamos dados para conectar criadores e empresas de acordo com a LGPD (Lei 13.709/2018).
          </p>
          <div className="pt-2 flex items-center gap-2 flex-wrap">
            <button
              onClick={acceptLgpd}
              className="px-3 py-1.5 bg-brand-primary hover:bg-indigo-500 text-white font-extrabold text-[11px] rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Concordar
            </button>
            <button
              onClick={openLgpdModal}
              className="px-2.5 py-1.5 text-slate-300 hover:text-white font-bold text-[11px] underline transition-colors cursor-pointer"
            >
              Gerenciar
            </button>
          </div>
        </div>
        <button
          onClick={() => setDismissedTemporarily(true)}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          title="Fechar aviso"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
