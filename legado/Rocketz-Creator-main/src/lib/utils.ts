import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isHideValues(): boolean {
  try {
    return localStorage.getItem('rc_hide_values') === 'true';
  } catch {
    return false;
  }
}

export function formatCurrency(value: number, overrideShow = false) {
  if (!overrideShow && isHideValues()) {
    return 'R$ ••••••';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value);
}

export function formatDeliverablesSummary(del?: {
  summary?: string;
  reels?: number;
  stories?: number;
  tiktok?: number;
  ugc?: number;
  posts?: number;
  youtube?: number;
}): string {
  if (!del) return '';
  if (del.summary && del.summary.trim()) return del.summary.trim();
  const parts: string[] = [];
  if (del.reels && del.reels > 0) parts.push(`${del.reels}x Reel${del.reels > 1 ? 's' : ''}`);
  if (del.stories && del.stories > 0) parts.push(`${del.stories}x Storie${del.stories > 1 ? 's' : ''}`);
  if (del.tiktok && del.tiktok > 0) parts.push(`${del.tiktok}x TikTok${del.tiktok > 1 ? 's' : ''}`);
  if (del.ugc && del.ugc > 0) parts.push(`${del.ugc}x UGC`);
  if (del.posts && del.posts > 0) parts.push(`${del.posts}x Feed/Post${del.posts > 1 ? 's' : ''}`);
  if (del.youtube && del.youtube > 0) parts.push(`${del.youtube}x YouTube`);
  return parts.join(' + ') || '';
}
