'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MagneticButton } from '../MagneticButton';
import { Logo } from '../Logo';

gsap.registerPlugin(ScrollTrigger);

export function RootCauseSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const chaosRef = useRef<HTMLDivElement>(null);
  const clarityRef = useRef<HTMLDivElement>(null);
  const causeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top 50%',
          end: 'center center',
          scrub: 1,
        },
      });

      if (chaosRef.current) {
        tl.to(chaosRef.current, { opacity: 0, filter: 'blur(8px)', scale: 1.1 }, 0);
      }
      if (clarityRef.current) {
        tl.fromTo(clarityRef.current, { opacity: 0 }, { opacity: 1 }, 0.4);
      }
      if (causeRef.current) {
        tl.fromTo(causeRef.current, { opacity: 0, y: 30 }, { opacity: 1, y: 0 }, 0.6);
      }
    }, section);

    return () => ctx.revert();
  }, []);

  const noiseLines = [
    'ERROR connection refused',
    'WARN retry 3/5',
    'DEBUG heap dump',
    'INFO request complete',
    'TRACE span ended',
    'ERROR timeout 30s',
    'WARN high memory',
    'DEBUG cache miss',
  ];

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen border-t border-zinc-800/60 bg-[#050506]"
    >
      <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16 md:px-10">
        <p className="font-mono-code mb-8 text-[10px] uppercase tracking-[0.3em] text-zinc-600">
          05 — ROOT CAUSE
        </p>

        <div className="relative w-full max-w-3xl">
          <div
            ref={chaosRef}
            className="absolute inset-0 space-y-2 overflow-hidden"
          >
            {noiseLines.map((line, i) => (
              <p
                key={i}
                className="font-mono-code text-xs text-zinc-700 md:text-sm"
                style={{
                  transform: `translateX(${(i % 3 - 1) * 20}px)`,
                  opacity: 0.3 + (i % 4) * 0.15,
                }}
              >
                {line}
              </p>
            ))}
          </div>

          <div ref={clarityRef} className="relative opacity-0">
            <div className="absolute -inset-8 rounded-2xl bg-indigo-500/5 blur-2xl" />
            <div
              ref={causeRef}
              className="relative rounded-xl border border-emerald-500/30 bg-zinc-900/80 p-6 backdrop-blur-md md:p-8"
            >
              <div className="mb-4 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="font-mono-code text-[10px] tracking-widest text-emerald-400">ROOT CAUSE IDENTIFIED</span>
              </div>
              <p className="font-display text-2xl font-bold leading-tight text-zinc-100 md:text-4xl">
                Memory limit too low
                <br />
                <span className="text-zinc-500">on api-gateway deployment</span>
              </p>
              <div className="mt-6 flex flex-wrap gap-3 font-mono-code text-[10px]">
                <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-400">
                  commit a3f9c2d
                </span>
                <span className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-blue-400">
                  pod api-gateway-7f8b9c
                </span>
                <span className="rounded border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-orange-400">
                  OOMKilled 14:23:02
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 text-center">
          <p className="font-display mb-6 text-xl font-semibold text-zinc-300 md:text-2xl">
            Chaos → Clarity
          </p>
          <MagneticButton href="/register">Get Started</MagneticButton>
        </div>
      </div>

      <footer className="border-t border-zinc-800/60 px-6 py-8 md:px-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
          <Logo size="sm" />
          <p className="font-mono-code text-[10px] tracking-widest text-zinc-600">
            © {new Date().getFullYear()} LOGSSUCKS.CLOUD — PRODUCTION NEVER LIES
          </p>
          <div className="flex gap-6 font-mono-code text-[10px] tracking-widest text-zinc-600">
            <a href="/login" className="transition-colors hover:text-zinc-400">LOGIN</a>
            <a href="/register" className="transition-colors hover:text-zinc-400">REGISTER</a>
          </div>
        </div>
      </footer>
    </section>
  );
}
