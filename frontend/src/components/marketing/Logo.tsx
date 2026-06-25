'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
}

const sizes = {
  sm: { icon: 28, text: 'text-sm' },
  md: { icon: 32, text: 'text-base' },
  lg: { icon: 40, text: 'text-lg' },
};

export function Logo({ className, size = 'md', showWordmark = true }: LogoProps) {
  const s = sizes[size];

  return (
    <Link href="/" className={cn('group inline-flex items-center gap-2.5', className)}>
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 48 48"
        fill="none"
        className="shrink-0 transition-transform duration-300 group-hover:scale-105"
        aria-hidden
      >
        <rect width="48" height="48" rx="10" fill="#0c0c0f" />
        <rect x="1" y="1" width="46" height="46" rx="9" stroke="url(#logo-border)" strokeWidth="1" />
        <defs>
          <linearGradient id="logo-border" x1="0" y1="0" x2="48" y2="48">
            <stop stopColor="#6366f1" stopOpacity="0.6" />
            <stop offset="1" stopColor="#22d3ee" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <path d="M12 32V16h4.8l6.6 10.8V16H28v16h-4.6l-6.8-11.1V32H12z" fill="#f4f4f5" />
        <circle cx="35" cy="35" r="7" stroke="#6366f1" strokeWidth="1.8" fill="none" />
        <path d="M39.5 39.5L43 43" stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M32 35h6M35 32v6" stroke="#a5b4fc" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
      </svg>
      {showWordmark && (
        <span className={cn('font-display font-semibold tracking-tight', s.text)}>
          <span className="text-zinc-100">LogsSucks</span>
          <span className="text-zinc-500">.cloud</span>
        </span>
      )}
    </Link>
  );
}
