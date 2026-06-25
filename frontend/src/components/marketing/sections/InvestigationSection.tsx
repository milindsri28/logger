'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const InvestigationGraph = dynamic(
  () => import('../three/InvestigationGraph').then((m) => m.InvestigationGraph),
  { ssr: false, loading: () => <div className="h-full w-full" /> },
);

const SIGNALS = [
  { from: 'LOGS', to: 'SIGNALS', color: 'from-orange-500/40' },
  { from: 'COMMITS', to: 'DEPLOY', color: 'from-green-500/40' },
  { from: 'CONTAINERS', to: 'FAILURE', color: 'from-blue-500/40' },
  { from: 'INFRA', to: 'EVIDENCE', color: 'from-violet-500/40' },
];

export function InvestigationSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [graphProgress, setGraphProgress] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: section,
        start: 'top 70%',
        end: 'bottom 30%',
        scrub: 1,
        onUpdate: (self) => setGraphProgress(self.progress),
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen border-t border-zinc-800/60 bg-[#070709]"
    >
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <div className="flex flex-col justify-center border-b border-zinc-800/60 p-6 md:p-10 lg:border-b-0 lg:border-r">
          <p className="font-mono-code text-[10px] uppercase tracking-[0.3em] text-indigo-400/80">
            03 — INVESTIGATION ENGINE
          </p>
          <h2 className="font-display mt-2 text-3xl font-bold tracking-tight text-zinc-100 md:text-5xl">
            Signals emerge
          </h2>
          <p className="mt-3 max-w-sm text-sm text-zinc-500">
            Logs collapse. Commits connect. Containers map to failures.
          </p>

          <div className="mt-8 space-y-3">
            {SIGNALS.map((s, i) => (
              <div
                key={s.from}
                className="flex items-center gap-3 transition-opacity duration-500"
                style={{ opacity: 0.3 + graphProgress * 0.7 * ((i + 1) / SIGNALS.length) }}
              >
                <span className="font-mono-code w-24 text-[10px] text-zinc-500">{s.from}</span>
                <div className="relative h-px flex-1 bg-zinc-800">
                  <div
                    className={`absolute inset-y-0 left-0 bg-gradient-to-r ${s.color} to-indigo-500/60`}
                    style={{ width: `${graphProgress * 100}%` }}
                  />
                </div>
                <span className="font-mono-code text-[10px] text-indigo-400">{s.to}</span>
              </div>
            ))}
          </div>

          <div className="mt-10 grid grid-cols-4 gap-2">
            {[
              { n: '847', l: 'LOGS' },
              { n: '12', l: 'COMMITS' },
              { n: '6', l: 'PODS' },
              { n: '1', l: 'ROOT' },
            ].map((item, i) => (
              <div
                key={item.l}
                className="rounded border border-zinc-800/80 bg-zinc-900/50 p-3 text-center backdrop-blur-sm"
                style={{ opacity: 0.4 + graphProgress * 0.6 * ((i + 1) / 4) }}
              >
                <p className="font-display text-xl font-bold text-zinc-200 md:text-2xl">{item.n}</p>
                <p className="font-mono-code mt-0.5 text-[9px] tracking-widest text-zinc-600">{item.l}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative min-h-[50vh] lg:min-h-screen">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.08)_0%,transparent_70%)]" />
          <InvestigationGraph progress={graphProgress} />
          <div className="pointer-events-none absolute inset-0 border border-zinc-800/30" />
          <div className="pointer-events-none absolute left-4 top-4 font-mono-code text-[9px] tracking-widest text-zinc-700">
            GRAPH // LIVE
          </div>
        </div>
      </div>
    </section>
  );
}
