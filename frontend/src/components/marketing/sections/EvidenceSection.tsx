'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { GitBranch, Server, ScrollText, Boxes, Activity, Shield } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const SOURCES = [
  { icon: GitBranch, label: 'REPOSITORY', color: 'text-emerald-400', bar: 'from-emerald-500/60', border: 'border-emerald-500/30' },
  { icon: Server, label: 'INFRASTRUCTURE', color: 'text-violet-400', bar: 'from-violet-500/60', border: 'border-violet-500/30' },
  { icon: ScrollText, label: 'LOGS', color: 'text-orange-400', bar: 'from-orange-500/60', border: 'border-orange-500/30' },
  { icon: Boxes, label: 'SERVICES', color: 'text-blue-400', bar: 'from-blue-500/60', border: 'border-blue-500/30' },
  { icon: Activity, label: 'METRICS', color: 'text-cyan-400', bar: 'from-cyan-500/60', border: 'border-cyan-500/30' },
];

export function EvidenceSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const sourcesRef = useRef<HTMLDivElement>(null);
  const convergeRef = useRef<HTMLDivElement>(null);
  const evidenceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top 60%',
          end: 'bottom 40%',
          scrub: 1,
        },
      });

      if (sourcesRef.current) {
        tl.fromTo(
          sourcesRef.current.children,
          { x: (i) => (i - 2) * 80, opacity: 0.3, scale: 0.9 },
          { x: 0, opacity: 1, scale: 1, stagger: 0.05 },
          0,
        );
      }

      if (convergeRef.current) {
        tl.fromTo(convergeRef.current, { scaleX: 0 }, { scaleX: 1 }, 0.3);
      }

      if (evidenceRef.current) {
        tl.fromTo(evidenceRef.current, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1 }, 0.6);
      }
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen border-t border-zinc-800/60 bg-[#060608] py-12 md:py-16"
    >
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="font-mono-code text-[10px] uppercase tracking-[0.3em] text-cyan-400/80">
              04 — EVIDENCE FIRST
            </p>
            <h2 className="font-display mt-1 text-3xl font-bold tracking-tight text-zinc-100 md:text-5xl">
              Everything connects
            </h2>
          </div>
          <p className="hidden font-mono-code text-[10px] tracking-widest text-zinc-600 md:block">
            UNIFIED CONTEXT
          </p>
        </div>

        <div ref={sourcesRef} className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
          {SOURCES.map(({ icon: Icon, label, color, bar, border }) => (
            <div
              key={label}
              className={`group relative overflow-hidden rounded-lg border ${border} bg-zinc-900/60 p-4 backdrop-blur-sm transition-colors hover:bg-zinc-900`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent" />
              <Icon className={`h-5 w-5 ${color} md:h-6 md:w-6`} strokeWidth={1.5} />
              <p className="font-mono-code mt-3 text-[9px] tracking-widest text-zinc-500 md:text-[10px]">{label}</p>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
                <div className={`h-full w-2/3 bg-gradient-to-r ${bar} to-transparent`} />
              </div>
            </div>
          ))}
        </div>

        <div className="relative my-8 flex items-center justify-center md:my-12">
          <div
            ref={convergeRef}
            className="absolute h-px w-full max-w-2xl origin-center bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent"
          />
          <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-indigo-500/40 bg-zinc-950">
            <span className="font-mono-code text-lg text-indigo-400">+</span>
          </div>
        </div>

        <div
          ref={evidenceRef}
          className="relative overflow-hidden rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-zinc-900/80 to-zinc-950 p-6 md:p-8"
        >
          <div className="absolute -right-20 -top-20 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-indigo-500/40 bg-indigo-500/10">
                <Shield className="h-7 w-7 text-indigo-400" strokeWidth={1.5} />
              </div>
              <div>
                <p className="font-mono-code text-[10px] tracking-[0.3em] text-indigo-400">EVIDENCE</p>
                <p className="font-display text-2xl font-bold text-zinc-100 md:text-3xl">Unified investigation context</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 border-t border-zinc-800/60 pt-4 md:border-l md:border-t-0 md:pl-8 md:pt-0">
              {[
                { v: '47', l: 'ARTIFACTS' },
                { v: '6', l: 'SYSTEMS' },
                { v: '1', l: 'TIMELINE' },
              ].map((item) => (
                <div key={item.l} className="text-center md:text-left">
                  <p className="font-display text-xl font-bold text-zinc-200">{item.v}</p>
                  <p className="font-mono-code text-[9px] tracking-widest text-zinc-600">{item.l}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-2 font-mono-code text-[11px] md:grid-cols-2">
            <div className="rounded border border-zinc-800/60 bg-zinc-950/60 p-3">
              <span className="text-zinc-600">commit </span>
              <span className="text-emerald-400">a3f9c2d</span>
              <span className="text-zinc-500"> → deployed 14:22:58</span>
            </div>
            <div className="rounded border border-zinc-800/60 bg-zinc-950/60 p-3">
              <span className="text-zinc-600">pod </span>
              <span className="text-blue-400">api-gateway-7f8b9c</span>
              <span className="text-zinc-500"> → OOMKilled 14:23:02</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
