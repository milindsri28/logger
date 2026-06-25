'use client';

import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { Logo } from '../Logo';
import { MagneticButton } from '../MagneticButton';

const HeroScene = dynamic(() => import('../three/HeroScene').then((m) => m.HeroScene), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#050506]" />,
});

export function HeroSection() {
  return (
    <section className="relative h-screen w-full overflow-hidden">
      <HeroScene />

      <nav className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-6 py-5 md:px-10">
        <Logo size="md" />
        <div className="hidden items-center gap-6 text-xs font-medium tracking-wider text-zinc-500 md:flex">
          <span className="font-mono-code text-zinc-600">v0.9.4</span>
          <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
          <span>SYSTEMS ONLINE</span>
        </div>
      </nav>

      <div className="absolute inset-0 z-10 flex flex-col items-center justify-end pb-16 md:pb-20">
        <div className="w-full max-w-6xl px-6 text-center md:px-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="mb-4 font-mono-code text-[10px] uppercase tracking-[0.35em] text-indigo-400/80 md:text-xs">
              Infrastructure Investigation
            </p>
            <h1 className="font-display text-[clamp(2.75rem,10vw,7rem)] font-bold leading-[0.9] tracking-[-0.04em] text-zinc-50">
              FIND ROOT
              <br />
              <span className="bg-gradient-to-r from-indigo-400 via-violet-300 to-cyan-300 bg-clip-text text-transparent">
                CAUSES
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-zinc-400 md:text-base">
              Stop drowning in logs. Connect evidence across your stack and see what actually broke.
            </p>
            <div className="mt-8">
              <MagneticButton href="/register">Get Started</MagneticButton>
            </div>
          </motion.div>
        </div>

        <motion.div
          className="absolute bottom-6 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="flex flex-col items-center gap-2 text-zinc-600">
            <span className="font-mono-code text-[10px] tracking-widest">SCROLL</span>
            <svg width="12" height="20" viewBox="0 0 12 20" fill="none">
              <rect x="1" y="1" width="10" height="18" rx="5" stroke="currentColor" strokeWidth="1" />
              <circle cx="6" cy="6" r="1.5" fill="currentColor" className="animate-pulse" />
            </svg>
          </div>
        </motion.div>
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[5] grid grid-cols-3 border-t border-zinc-800/50 bg-zinc-950/40 backdrop-blur-sm">
        {[
          { label: 'EVENTS/SEC', value: '12,847' },
          { label: 'SIGNAL RATIO', value: '0.3%' },
          { label: 'MTTR', value: '4.2h' },
        ].map((stat) => (
          <div key={stat.label} className="border-r border-zinc-800/50 px-4 py-3 last:border-r-0 md:px-6 md:py-4">
            <p className="font-mono-code text-[9px] tracking-widest text-zinc-600 md:text-[10px]">{stat.label}</p>
            <p className="font-display text-lg font-semibold text-zinc-300 md:text-xl">{stat.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
