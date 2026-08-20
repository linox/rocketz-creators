import React from 'react';
import { Link } from 'react-router-dom';

interface RocketzLogoProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  to?: string;
  className?: string;
  showSubtitle?: boolean;
}

export function RocketzLogo({
  variant = 'light',
  size = 'md',
  to,
  className = '',
  showSubtitle = true,
}: RocketzLogoProps) {
  const sizeClasses = {
    sm: { text: 'text-[23px]', sub: 'text-[10px] mt-0.5' },
    md: { text: 'text-[31px]', sub: 'text-[13px] mt-0.5' },
    lg: { text: 'text-[39px]', sub: 'text-[16px] mt-1' },
    xl: { text: 'text-[47px]', sub: 'text-[19px] mt-1' },
  }[size];

  const content = (
    <div className={`inline-flex flex-col items-start leading-none select-none ${className}`} aria-label="creatorz by rocketz">
      <span className={`font-black tracking-tight lowercase ${sizeClasses.text}`}>
        <span className={variant === 'dark' ? 'text-white' : 'text-[#0B0C18]'}>creator</span>
        <span className="text-[#8A3FFC]">z</span>
      </span>
      {showSubtitle && (
        <span className={`font-medium lowercase ${sizeClasses.sub} ${variant === 'dark' ? 'text-slate-400' : 'text-[#6B7280]'}`}>
          by rocketz
        </span>
      )}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="inline-flex items-center no-underline" aria-label="creatorz by rocketz">
        {content}
      </Link>
    );
  }

  return content;
}

export default RocketzLogo;
