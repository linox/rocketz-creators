import React from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isDeleting?: boolean;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Excluir Definitivamente',
  cancelText = 'Cancelar',
  isDeleting = false
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1200] overflow-y-auto p-4 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={!isDeleting ? onClose : undefined}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
        />

        {/* Modal Box */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 overflow-hidden z-10 my-auto text-left"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100 shadow-inner">
              <Trash2 size={24} />
            </div>

            <button
              type="button"
              disabled={isDeleting}
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <h3 className="text-lg font-black text-slate-900 tracking-tight mb-2">
            {title}
          </h3>

          <p className="text-xs text-slate-600 font-medium leading-relaxed mb-6">
            {description}
          </p>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              disabled={isDeleting}
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {cancelText}
            </button>

            <button
              type="button"
              disabled={isDeleting}
              onClick={onConfirm}
              className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-200 transition-all flex items-center justify-center gap-1.5 disabled:opacity-75 cursor-pointer border-none"
            >
              {isDeleting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Excluindo...</span>
                </>
              ) : (
                <>
                  <Trash2 size={14} />
                  <span>{confirmText}</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
