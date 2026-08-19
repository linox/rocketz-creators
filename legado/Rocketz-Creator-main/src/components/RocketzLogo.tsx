import React from 'react';
import { Link } from 'react-router-dom';

interface RocketzLogoProps {
  variant?: 'light' | 'dark'; // 'light' is for light backgrounds (dark text), 'dark' is for dark backgrounds (white text)
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
    sm: {
      text: 'text-[23px]',
      sub: 'text-[9.8px] -mt-1',
      tracking: 'tracking-[0.24em] pl-[0.24em]',
    },
    md: {
      text: 'text-[31px]',
      sub: 'text-[11.7px] -mt-1.5',
      tracking: 'tracking-[0.25em] pl-[0.25em]',
    },
    lg: {
      text: 'text-[39px]',
      sub: 'text-[13.6px] -mt-2',
      tracking: 'tracking-[0.27em] pl-[0.27em]',
    },
    xl: {
      text: 'text-[47px]',
      sub: 'text-[15.6px] -mt-2.5',
      tracking: 'tracking-[0.28em] pl-[0.28em]',
    },
  }[size];

  const content = (
    <div className={`flex flex-col items-center justify-center text-center select-none group inline-flex ${className}`}>
      <div className="flex items-center justify-center leading-none">
        <span
          className={`font-black font-sans tracking-tight transition-colors ${
            sizeClasses.text
          } ${
            variant === 'dark' ? 'text-white' : 'text-slate-950'
          }`}
        >
          rocket
        </span>
        <span
          className={`font-black transition-colors ${sizeClasses.text} ${
            variant === 'dark' ? 'text-purple-400 group-hover:text-purple-300' : 'text-purple-600 group-hover:text-purple-700'
          }`}
        >
          z
        </span>
      </div>
      {showSubtitle && (
        <span
          className={`font-black uppercase text-center ${sizeClasses.sub} ${sizeClasses.tracking} ${
            variant === 'dark' ? 'text-slate-400 group-hover:text-slate-300' : 'text-slate-500 group-hover:text-slate-600'
          }`}
        >
          CREATORS
        </span>
      )}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="inline-flex items-center justify-center no-underline">
        {content}
      </Link>
    );
  }

  return content;
}

export default RocketzLogo;
