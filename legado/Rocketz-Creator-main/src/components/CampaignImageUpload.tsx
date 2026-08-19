import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  Sparkles,
  Info,
  Maximize2,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';

// Preset curated aesthetic banners in 16:9 for quick selection
const PRESET_BANNERS = [
  {
    name: 'Moda & Estilo',
    url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&auto=format&fit=crop&q=80',
  },
  {
    name: 'Beleza & Skincare',
    url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1200&auto=format&fit=crop&q=80',
  },
  {
    name: 'Tecnologia & Gadgets',
    url: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&auto=format&fit=crop&q=80',
  },
  {
    name: 'Gastronomia & Food',
    url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&auto=format&fit=crop&q=80',
  },
  {
    name: 'Fitness & Saúde',
    url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=1200&auto=format&fit=crop&q=80',
  },
  {
    name: 'Lifestyle & Viagens',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80',
  },
  {
    name: 'Games & Entretenimento',
    url: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1200&auto=format&fit=crop&q=80',
  },
  {
    name: 'E-commerce & Varejo',
    url: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1200&auto=format&fit=crop&q=80',
  }
];

interface CampaignImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
  compact?: boolean;
}

export const CampaignImageUpload: React.FC<CampaignImageUploadProps> = ({
  value = '',
  onChange,
  label = 'Imagem de Capa da Campanha',
  compact = false,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'url' | 'presets'>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [urlInput, setUrlInput] = useState(value && !value.startsWith('data:') ? value : '');
  const [imageError, setImageError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (PNG, JPG, JPEG, WEBP).');
      return;
    }

    setIsUploading(true);
    setImageError(false);

    try {
      // 1. Try uploading to /api/upload
      const formData = new FormData();
      formData.append('photo', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          onChange(data.url);
          setIsUploading(false);
          return;
        }
      }

      // 2. Fallback to FileReader Base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        onChange(base64);
        setIsUploading(false);
      };
      reader.onerror = () => {
        setIsUploading(false);
        alert('Erro ao carregar o arquivo.');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.warn('Falha no upload para o servidor, usando Base64:', err);
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        onChange(base64);
        setIsUploading(false);
      };
      reader.onerror = () => {
        setIsUploading(false);
        alert('Erro ao processar imagem.');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleApplyUrl = () => {
    if (!urlInput.trim()) return;
    onChange(urlInput.trim());
    setImageError(false);
  };

  const handleRemoveImage = () => {
    onChange('');
    setUrlInput('');
    setImageError(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* Header Label and Specification Badge */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <ImageIcon size={14} className="text-brand-primary" />
          {label}
        </label>

        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
          <Info size={11} className="text-slate-400" />
          Formato Padrão: 16:9 (1200×675 px)
        </span>
      </div>

      {/* Main Image Preview & Drop Area */}
      <div className="relative rounded-2xl border border-slate-200 bg-slate-900/5 overflow-hidden shadow-xs">
        {value && !imageError ? (
          /* Preview of Selected Image in Standard 16:9 */
          <div className="relative w-full aspect-[16/9] bg-slate-950 flex items-center justify-center overflow-hidden group">
            <img
              src={value}
              alt="Capa da Campanha"
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            
            {/* Dark overlay with actions */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-4">
              <div className="flex items-center justify-between">
                <span className="bg-emerald-500/90 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 size={12} /> Capa Definida (16:9)
                </span>

                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="p-2 bg-rose-600/90 hover:bg-rose-600 text-white rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer"
                  title="Remover imagem"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-white/95 hover:bg-white text-slate-900 rounded-xl text-xs font-extrabold shadow-lg transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={13} /> Trocar Imagem
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Empty / Uploading Drop Area in Standard 16:9 */
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "w-full aspect-[16/9] flex flex-col items-center justify-center p-6 text-center transition-all border-2 border-dashed rounded-2xl",
              dragOver 
                ? "border-brand-primary bg-indigo-50/50" 
                : "border-slate-300 hover:border-slate-400 bg-slate-50/50"
            )}
          >
            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-9 h-9 border-3 border-brand-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-bold text-slate-700">Enviando e ajustando imagem...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 max-w-sm">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-brand-primary flex items-center justify-center shadow-xs">
                  <UploadCloud size={24} />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-800">
                    Arraste a imagem da campanha aqui ou{' '}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-brand-primary hover:underline font-extrabold bg-transparent border-none cursor-pointer p-0"
                    >
                      clique para enviar
                    </button>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Proporção ideal 16:9 • PNG, JPG ou WEBP até 10MB
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {imageError && (
          <div className="p-3 bg-rose-50 text-rose-700 text-xs flex items-center gap-2 border-t border-rose-100">
            <AlertCircle size={14} className="shrink-0" />
            <span>Não foi possível carregar o link da imagem. Verifique a URL ou envie um novo arquivo.</span>
          </div>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Upload Modes Switcher (Upload / URL / Presets) */}
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={cn(
              "px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1",
              activeTab === 'upload' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
            )}
          >
            <UploadCloud size={12} /> Arquivo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={cn(
              "px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1",
              activeTab === 'url' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
            )}
          >
            <LinkIcon size={12} /> Inserir Link (URL)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={cn(
              "px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1",
              activeTab === 'presets' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
            )}
          >
            <Sparkles size={12} className="text-amber-500" /> Galeria Padrão
          </button>
        </div>

        {/* Tab 1: Upload Action Button */}
        {activeTab === 'upload' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <UploadCloud size={14} className="text-slate-600" />
              {value ? 'Substituir Arquivo do Computador' : 'Selecionar Arquivo do Computador'}
            </button>
            {value && (
              <button
                type="button"
                onClick={handleRemoveImage}
                className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Remover Imagem
              </button>
            )}
          </div>
        )}

        {/* Tab 2: URL Input */}
        {activeTab === 'url' && (
          <div className="flex items-center gap-2">
            <input
              type="url"
              placeholder="Cole o link direto da imagem (ex: https://images.unsplash.com/...)"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-brand-primary font-medium"
            />
            <button
              type="button"
              onClick={handleApplyUrl}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
            >
              Aplicar URL
            </button>
          </div>
        )}

        {/* Tab 3: Curated 16:9 Presets */}
        {activeTab === 'presets' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {PRESET_BANNERS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => {
                  onChange(preset.url);
                  setUrlInput(preset.url);
                  setImageError(false);
                }}
                className={cn(
                  "group relative rounded-xl overflow-hidden aspect-[16/9] border-2 text-left transition-all cursor-pointer p-0",
                  value === preset.url ? "border-brand-primary ring-2 ring-indigo-200" : "border-slate-200 hover:border-slate-400"
                )}
              >
                <img
                  src={preset.url}
                  alt={preset.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-2">
                  <span className="text-[10px] font-bold text-white leading-tight drop-shadow-sm">
                    {preset.name}
                  </span>
                </div>
                {value === preset.url && (
                  <div className="absolute top-1.5 right-1.5 bg-brand-primary text-white p-0.5 rounded-full shadow-md">
                    <CheckCircle2 size={12} />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignImageUpload;
