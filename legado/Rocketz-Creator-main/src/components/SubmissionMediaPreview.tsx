import React, { useState, useEffect } from 'react';
import { ExternalLink, Play, AlertCircle, Download, Film, RefreshCw } from 'lucide-react';
import { useResolvedMediaUrl } from '../utils/mediaStorage';

interface SubmissionMediaPreviewProps {
  url: string;
  className?: string;
  maxHeight?: string;
}

export const SubmissionMediaPreview: React.FC<SubmissionMediaPreviewProps> = ({
  url,
  className = '',
  maxHeight = 'max-h-[360px]'
}) => {
  const { resolvedUrl, loading } = useResolvedMediaUrl(url);
  const [videoError, setVideoError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // Reset error whenever the URL or retry changes
  useEffect(() => {
    setVideoError(false);
  }, [url, resolvedUrl, retryKey]);

  if (!url) return null;

  if (loading) {
    return (
      <div className="p-6 bg-slate-900 rounded-2xl flex flex-col items-center justify-center gap-2 text-xs font-bold text-indigo-400 animate-pulse border border-slate-800">
        <RefreshCw size={20} className="animate-spin" /> Carregando vídeo e mídia...
      </div>
    );
  }

  const activeUrl = (resolvedUrl || url).trim();

  // 1. Check Google Drive links
  const gDriveMatch = activeUrl.match(/drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?id=([a-zA-Z0-9_-]+))/i);
  if (gDriveMatch) {
    const fileId = gDriveMatch[1] || gDriveMatch[2];
    const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
    return (
      <div className={`flex flex-col gap-2 rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-md ${className}`}>
        <div className={`w-full ${maxHeight} aspect-[16/9] bg-black`}>
          <iframe
            src={previewUrl}
            title="Google Drive Video Preview"
            className="w-full h-full border-0"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>
        <div className="p-2.5 bg-slate-900 flex items-center justify-between gap-2 text-xs text-white">
          <span className="text-[11px] text-slate-300 font-semibold flex items-center gap-1.5 truncate">
            <Film size={13} className="text-indigo-400 shrink-0" /> Google Drive Mídia
          </span>
          <a
            href={activeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 shrink-0 transition-colors"
          >
            Abrir no Drive <ExternalLink size={11} />
          </a>
        </div>
      </div>
    );
  }

  // 2. Check YouTube links
  const ytMatch = activeUrl.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  if (ytMatch) {
    const ytId = ytMatch[1];
    return (
      <div className={`flex flex-col gap-2 rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-md ${className}`}>
        <div className={`w-full ${maxHeight} aspect-[16/9] bg-black`}>
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${ytId}`}
            title="YouTube Video Preview"
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="p-2.5 bg-slate-900 flex items-center justify-between gap-2 text-xs text-white">
          <span className="text-[11px] text-slate-300 font-semibold flex items-center gap-1.5 truncate">
            <Film size={13} className="text-red-400 shrink-0" /> YouTube Vídeo
          </span>
          <a
            href={activeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 shrink-0 transition-colors"
          >
            Ver no YouTube <ExternalLink size={11} />
          </a>
        </div>
      </div>
    );
  }

  // 3. Check Loom links
  const loomMatch = activeUrl.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/i);
  if (loomMatch) {
    const loomId = loomMatch[1];
    return (
      <div className={`flex flex-col gap-2 rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-md ${className}`}>
        <div className={`w-full ${maxHeight} aspect-[16/9] bg-black`}>
          <iframe
            src={`https://www.loom.com/embed/${loomId}`}
            title="Loom Video Preview"
            className="w-full h-full border-0"
            allowFullScreen
          />
        </div>
        <div className="p-2.5 bg-slate-900 flex items-center justify-between gap-2 text-xs text-white">
          <span className="text-[11px] text-slate-300 font-semibold flex items-center gap-1.5 truncate">
            <Film size={13} className="text-indigo-400 shrink-0" /> Loom Gravação
          </span>
          <a
            href={activeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 shrink-0 transition-colors"
          >
            Abrir Loom <ExternalLink size={11} />
          </a>
        </div>
      </div>
    );
  }

  // 4. Video Files / Hosted uploads / Data URLs
  const isVideo = activeUrl.startsWith('data:video') || 
                  activeUrl.startsWith('blob:') ||
                  activeUrl.includes('/uploads/') ||
                  activeUrl.includes('/api/media/') ||
                  activeUrl.match(/\.(mp4|webm|mov|m4v|mkv|ogv)(\?.*)?$/i);

  const isImage = activeUrl.startsWith('data:image') || 
                  activeUrl.match(/\.(jpg|jpeg|png|webp|gif|svg|bmp)(\?.*)?$/i);

  if (isVideo) {
    if (videoError) {
      return (
        <div className="p-5 bg-slate-900 text-white rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-center gap-3">
          <AlertCircle size={28} className="text-amber-400" />
          <div>
            <p className="text-xs font-bold text-slate-200">Não foi possível reproduzir este vídeo diretamente no player embutido.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Você pode recarregar ou abrir/baixar o arquivo diretamente.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <button
              onClick={() => {
                setVideoError(false);
                setRetryKey(k => k + 1);
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-700 cursor-pointer"
            >
              <RefreshCw size={12} /> Tentar Novamente
            </button>
            <a
              href={activeUrl}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Download size={12} /> Abrir / Baixar Vídeo <ExternalLink size={11} />
            </a>
          </div>
        </div>
      );
    }

    return (
      <div className={`flex flex-col gap-2 bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-md ${className}`}>
        <div className="relative group flex items-center justify-center bg-black">
          <video 
            key={`${activeUrl}-${retryKey}`}
            src={activeUrl} 
            controls 
            playsInline
            preload="metadata"
            crossOrigin="anonymous"
            onError={() => setVideoError(true)}
            className={`w-full ${maxHeight} object-contain`}
          />
        </div>
        <div className="p-2 px-3 bg-slate-900/90 flex items-center justify-between gap-2 text-xs text-white">
          <span className="text-[11px] text-slate-300 font-medium flex items-center gap-1.5 truncate">
            <Film size={13} className="text-indigo-400" /> Vídeo Gravado
          </span>
          <div className="flex items-center gap-2">
            <a
              href={activeUrl}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="text-[11px] font-bold text-indigo-300 hover:text-white flex items-center gap-1 transition-colors"
            >
              <Download size={11} /> Baixar
            </a>
            <a
              href={activeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-bold text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <ExternalLink size={11} /> Nova Aba
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (isImage) {
    return (
      <div className={`flex flex-col gap-2 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-md ${className}`}>
        <img 
          src={activeUrl} 
          alt="Preview de Mídia" 
          className={`w-full ${maxHeight} object-contain bg-black`}
        />
        <div className="p-2 px-3 bg-slate-900 flex items-center justify-between gap-2 text-xs text-white">
          <span className="text-[11px] text-slate-400 font-medium truncate">Imagem Enviada</span>
          <a
            href={activeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-bold text-indigo-300 hover:text-white flex items-center gap-1 transition-colors"
          >
            <ExternalLink size={11} /> Ver Imagem Completa
          </a>
        </div>
      </div>
    );
  }

  return (
    <a
      href={activeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 text-decoration-none shadow-sm"
    >
      <ExternalLink size={14} /> Abrir Mídia / Vídeo Enviado ↗️
    </a>
  );
};
