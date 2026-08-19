import React, { useState, useEffect } from 'react';

export interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'custom';
  className?: string;
  textClassName?: string;
  shape?: 'circle' | 'rounded-lg' | 'rounded-xl' | 'rounded-2xl' | 'square';
  bordered?: boolean;
}

/**
 * Deterministically generates two-letter or single-letter initials from a user/company name.
 */
export function getInitials(name?: string | null): string {
  if (!name) return '?';
  const clean = name.replace(/^@/, '').trim();
  if (!clean) return '?';

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    // Single word name (e.g. "Rocketz" or "anasilva")
    return parts[0].slice(0, 2).toUpperCase();
  }
  
  const first = parts[0][0] || '';
  const last = parts[parts.length - 1][0] || '';
  return (first + last).toUpperCase();
}

/**
 * Array of harmonious background gradient styles for fallback avatars.
 */
const AVATAR_GRADIENTS = [
  'bg-gradient-to-br from-indigo-500 to-purple-600 text-white',
  'bg-gradient-to-br from-blue-500 to-cyan-600 text-white',
  'bg-gradient-to-br from-emerald-500 to-teal-600 text-white',
  'bg-gradient-to-br from-purple-600 to-pink-600 text-white',
  'bg-gradient-to-br from-amber-500 to-orange-600 text-white',
  'bg-gradient-to-br from-rose-500 to-red-600 text-white',
  'bg-gradient-to-br from-violet-600 to-indigo-700 text-white',
  'bg-gradient-to-br from-teal-500 to-emerald-700 text-white',
  'bg-gradient-to-br from-cyan-600 to-blue-700 text-white',
  'bg-gradient-to-br from-fuchsia-500 to-purple-700 text-white',
];

/**
 * Pick a consistent gradient based on hash of the name.
 */
export function getAvatarGradient(name?: string | null): string {
  if (!name) return AVATAR_GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index];
}

const SIZE_MAP = {
  xs: { box: 'w-6 h-6', text: 'text-[9px]' },
  sm: { box: 'w-8 h-8', text: 'text-xs' },
  md: { box: 'w-10 h-10', text: 'text-sm' },
  lg: { box: 'w-12 h-12', text: 'text-base' },
  xl: { box: 'w-16 h-16', text: 'text-xl' },
  '2xl': { box: 'w-20 h-20', text: 'text-2xl' },
  '3xl': { box: 'w-24 h-24', text: 'text-3xl' },
  custom: { box: '', text: '' }
};

const SHAPE_MAP = {
  circle: 'rounded-full',
  'rounded-lg': 'rounded-lg',
  'rounded-xl': 'rounded-xl',
  'rounded-2xl': 'rounded-2xl',
  square: 'rounded-none'
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  name,
  alt,
  size = 'md',
  className = '',
  textClassName = '',
  shape = 'rounded-xl',
  bordered = false
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const initials = getInitials(name);
  const gradient = getAvatarGradient(name);
  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md;
  const shapeClass = SHAPE_MAP[shape] || 'rounded-xl';

  const baseContainerClasses = `relative overflow-hidden shrink-0 flex items-center justify-center select-none ${
    size !== 'custom' ? sizeConfig.box : ''
  } ${shapeClass} ${bordered ? 'border border-white/20 shadow-xs' : ''} ${className}`;

  if (!src || hasError) {
    return (
      <div 
        className={`${baseContainerClasses} ${gradient} font-bold tracking-tight shadow-xs`}
        title={name || alt || 'Usuário'}
      >
        <span className={`${textClassName || sizeConfig.text} uppercase font-extrabold`}>
          {initials}
        </span>
      </div>
    );
  }

  return (
    <div className={baseContainerClasses} title={name || alt || 'Usuário'}>
      <img
        src={src}
        alt={alt || name || 'Avatar do usuário'}
        onError={() => setHasError(true)}
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

export default UserAvatar;
