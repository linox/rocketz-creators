import React, { useState, useRef } from 'react';
import { Building2, UploadCloud, Image as ImageIcon, Link as LinkIcon, Trash2, RefreshCw, CheckCircle2 } from 'lucide-react';

interface CompanyLogoUploadProps {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
}

export const CompanyLogoUpload: React.FC<CompanyLogoUploadProps> = ({
  value = '',
  onChange,
  label = 'Logo do Perfil da Empresa'
}) => {
  const [uploadMode, setUploadMode] = useState<'upload' | 'url'>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [urlInput, setUrlInput] = useState(value && !value.startsWith('data:') ? value : '');
  const [imageError, setImageError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione um arquivo de imagem válido (PNG, JPG, SVG, WEBP).');
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
        alert('Erro ao carregar o arquivo localmente.');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.warn('Falha no upload para o servidor, usando Base64:', err);
      // Fallback to FileReader
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

  const handleRemoveLogo = () => {
    onChange('');
    setUrlInput('');
    setImageError(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUrlBlur = () => {
    if (urlInput.trim()) {
      setImageError(false);
      onChange(urlInput.trim());
    }
  };

  return (
    <div className="flex flex-col gap-2 p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
          <ImageIcon size={14} className="text-brand-primary" />
          {label}
        </label>
        
        <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setUploadMode('upload')}
            className={`px-2 py-1 rounded-md transition-all ${
              uploadMode === 'upload'
                ? 'bg-brand-primary text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Upload Arquivo
          </button>
          <button
            type="button"
            onClick={() => setUploadMode('url')}
            className={`px-2 py-1 rounded-md transition-all ${
              uploadMode === 'url'
                ? 'bg-brand-primary text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Link URL
          </button>
        </div>
      </div>

      {value && !imageError ? (
        // Preview Active Logo
        <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
          <div className="relative w-16 h-16 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center p-1.5 shrink-0 group">
            <img
              src={value}
              alt="Logo da Empresa"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
              <span>Logo selecionada</span>
            </div>
            <p className="text-[11px] text-slate-400 truncate mt-0.5 font-mono">
              {value.startsWith('data:') ? 'Imagem carregada localmente' : value}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="text-[11px] font-bold text-brand-primary hover:text-indigo-700 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RefreshCw size={12} className={isUploading ? 'animate-spin' : ''} />
                Trocar Imagem
              </button>
              <span className="text-slate-300">•</span>
              <button
                type="button"
                onClick={handleRemoveLogo}
                className="text-[11px] font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Trash2 size={12} />
                Remover
              </button>
            </div>
          </div>
        </div>
      ) : uploadMode === 'upload' ? (
        // Upload Dropzone
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
            dragOver
              ? 'border-brand-primary bg-indigo-50/50'
              : 'border-slate-300 hover:border-brand-primary hover:bg-white bg-slate-50/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/gif"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="w-10 h-10 rounded-xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-brand-primary mb-2">
            {isUploading ? (
              <RefreshCw size={18} className="animate-spin text-brand-primary" />
            ) : (
              <UploadCloud size={20} />
            )}
          </div>

          <p className="text-xs font-bold text-slate-700">
            {isUploading ? 'Processando imagem...' : 'Clique para selecionar ou arraste o logotipo'}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            PNG, JPG, SVG ou WEBP (Quadrado recomendado: 400x400)
          </p>
        </div>
      ) : (
        // Direct URL Input
        <div className="flex flex-col gap-2">
          <div className="relative">
            <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="url"
              placeholder="Cole o link da imagem (ex: https://.../logo.png)"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                onChange(e.target.value.trim());
              }}
              onBlur={handleUrlBlur}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:border-brand-primary"
            />
          </div>
          {imageError && (
            <p className="text-[11px] text-rose-500 font-medium">
              Não foi possível carregar a imagem deste link. Verifique a URL.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
