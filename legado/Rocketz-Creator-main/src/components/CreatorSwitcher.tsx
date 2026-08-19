import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Creator } from '../types';
import { formatNumber, cn } from '../lib/utils';
import { Users, Search, ChevronDown, Sparkles, UserCheck, Check, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserAvatar } from './UserAvatar';

interface CreatorSwitcherProps {
  currentCreatorId?: string;
  variant?: 'header' | 'banner' | 'button';
  onSelectCreator?: (creatorId: string) => void;
}

export const CreatorSwitcher: React.FC<CreatorSwitcherProps> = ({
  currentCreatorId,
  variant = 'header',
  onSelectCreator
}) => {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, 'creators'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Creator));
      // Sort alphabetically by artisticName or fullName
      list.sort((a, b) => (a.artisticName || a.fullName || '').localeCompare(b.artisticName || b.fullName || ''));
      setCreators(list);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching creators for switcher:", err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCreators = creators.filter(c => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    return (
      (c.artisticName && c.artisticName.toLowerCase().includes(term)) ||
      (c.fullName && c.fullName.toLowerCase().includes(term)) ||
      (c.categories && c.categories.some(cat => cat.toLowerCase().includes(term)))
    );
  });

  const activeCreator = creators.find(c => c.id === currentCreatorId);

  const handleSelect = (creatorId: string) => {
    setIsOpen(false);
    setSearch('');
    if (onSelectCreator) {
      onSelectCreator(creatorId);
    } else {
      navigate(`/creators/${creatorId}`);
    }
  };

  if (variant === 'banner') {
    return (
      <div className="relative inline-block text-left" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 border border-purple-500"
        >
          <Key size={14} className="text-purple-200 animate-pulse" />
          <span>Trocar de Criador {activeCreator ? `(@${activeCreator.artisticName})` : ''}</span>
          <ChevronDown size={14} className={cn("transition-transform duration-200", isOpen && "rotate-180")} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 sm:right-auto sm:left-0 mt-2 w-80 max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 z-50 text-slate-800"
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                <span className="text-xs font-black uppercase text-purple-900 tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} className="text-purple-600" /> Selecionar Criador para Visualizar
                </span>
                <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                  {creators.length} Criadores
                </span>
              </div>

              {/* Search Box */}
              <div className="relative mb-2">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por @nome ou nicho..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 font-medium"
                  autoFocus
                />
              </div>

              {/* Creators List */}
              <div className="max-h-64 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {loading ? (
                  <div className="py-6 text-center text-xs text-slate-400 animate-pulse">
                    Carregando casting de criadores...
                  </div>
                ) : filteredCreators.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500 font-medium">
                    Nenhum criador encontrado.
                  </div>
                ) : (
                  filteredCreators.map((c) => {
                    const isSelected = c.id === currentCreatorId;
                    return (
                      <button
                        key={c.id}
                        onClick={() => handleSelect(c.id)}
                        className={cn(
                          "w-full flex items-center justify-between p-2 rounded-xl text-left transition-all text-xs",
                          isSelected 
                            ? "bg-purple-50 border border-purple-200 text-purple-950 font-bold" 
                            : "hover:bg-slate-50 text-slate-700"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar
                            src={c.photoUrl}
                            name={c.artisticName || c.fullName}
                            size="custom"
                            shape="rounded-lg"
                            className="w-8 h-8 border border-slate-200"
                            textClassName="text-[10px]"
                          />
                          <div className="min-w-0">
                            <p className="font-bold truncate text-slate-900 m-0">@{c.artisticName || c.fullName}</p>
                            <p className="text-[10px] text-slate-500 truncate m-0">
                              {c.fullName} • {formatNumber(c.metrics?.followers || 0)} seg.
                            </p>
                          </div>
                        </div>

                        {isSelected ? (
                          <span className="bg-purple-600 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                            <Check size={10} /> Atual
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-purple-600 hover:underline shrink-0">
                            Acessar →
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Header Variant (default)
  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="hidden md:flex items-center gap-2 h-10 px-3.5 text-xs font-bold text-purple-700 hover:text-purple-900 border border-purple-200 hover:border-purple-400 rounded-lg bg-purple-50/80 hover:bg-purple-100 transition-all uppercase tracking-wider shadow-sm"
        title="Chave Admin: Trocar Usuário / Ver Tela do Criador"
      >
        <Key size={14} className="text-purple-600 shrink-0" />
        <span className="max-w-[130px] truncate">
          {activeCreator ? `@${activeCreator.artisticName}` : 'Trocar Criador'}
        </span>
        <ChevronDown size={14} className={cn("text-purple-600 transition-transform duration-200 shrink-0", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3.5 z-50 text-slate-800"
          >
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <Key size={14} className="text-purple-600" />
                <span className="text-xs font-black uppercase text-purple-950 tracking-wider">
                  Chave de Troca de Criador
                </span>
              </div>
              <span className="text-[10px] font-extrabold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                {creators.length} Criadores
              </span>
            </div>

            <p className="text-[11px] text-slate-500 mb-2.5 leading-snug">
              Selecione qualquer criador da lista para ir direto para a tela do portal dele:
            </p>

            {/* Search Input */}
            <div className="relative mb-2.5">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nome, @username..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-500 font-medium"
                autoFocus
              />
            </div>

            {/* Creators List */}
            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {loading ? (
                <div className="py-6 text-center text-xs text-slate-400 animate-pulse">
                  Carregando lista de criadores...
                </div>
              ) : filteredCreators.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 font-medium">
                  Nenhum criador encontrado.
                </div>
              ) : (
                filteredCreators.map((c) => {
                  const isSelected = c.id === currentCreatorId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleSelect(c.id)}
                      className={cn(
                        "w-full flex items-center justify-between p-2 rounded-xl text-left transition-all text-xs",
                        isSelected 
                          ? "bg-purple-100/70 border border-purple-300 text-purple-950 font-bold" 
                          : "hover:bg-slate-50 text-slate-700 border border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <UserAvatar
                          src={c.photoUrl}
                          name={c.artisticName || c.fullName}
                          size="custom"
                          shape="rounded-xl"
                          className="w-9 h-9 border border-slate-200"
                          textClassName="text-xs"
                        />
                        <div className="min-w-0">
                          <p className="font-bold truncate text-slate-900 m-0 text-xs">@{c.artisticName || c.fullName}</p>
                          <p className="text-[10px] text-slate-500 truncate m-0">
                            {c.fullName} • {formatNumber(c.metrics?.followers || 0)} seg.
                          </p>
                        </div>
                      </div>

                      {isSelected ? (
                        <span className="bg-purple-700 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                          <Check size={10} /> Atual
                        </span>
                      ) : (
                        <span className="bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white transition-all text-[10px] font-bold px-2.5 py-1 rounded-lg shrink-0">
                          Ver Tela
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
