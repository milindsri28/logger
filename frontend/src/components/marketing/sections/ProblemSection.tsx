'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const LOG_STREAM = [
  { level: 'ERROR', msg: 'Connection refused to postgres://prod:5432', ts: '14:23:01.847' },
  { level: 'WARN', msg: 'Retry attempt 3/5 for payment-service', ts: '14:23:01.852' },
  { level: 'ERROR', msg: 'NullPointerException at UserService.java:247', ts: '14:23:02.103' },
  { level: 'FATAL', msg: 'OOMKilled container api-gateway-7f8b9c', ts: '14:23:02.441' },
  { level: 'ERROR', msg: 'HTTP 500 POST /api/v2/checkout', ts: '14:23:02.887' },
  { level: 'WARN', msg: 'Circuit breaker OPEN for inventory-svc', ts: '14:23:03.012' },
  { level: 'ERROR', msg: 'segfault at 0x00000000 in worker-3', ts: '14:23:03.156' },
  { level: 'ERROR', msg: 'Kafka consumer lag: 847,293 messages', ts: '14:23:03.289' },
  { level: 'FATAL', msg: 'panic: runtime error: index out of range', ts: '14:23:03.401' },
  { level: 'ERROR', msg: 'TLS handshake timeout upstream', ts: '14:23:03.567' },
  { level: 'WARN', msg: 'Memory usage 94.7% on node-prod-03', ts: '14:23:03.712' },
  { level: 'ERROR', msg: 'Dead letter queue overflow: 12,847 msgs', ts: '14:23:03.891' },
  { level: 'ERROR', msg: 'Redis connection pool exhausted', ts: '14:23:04.023' },
  { level: 'FATAL', msg: 'Pod evicted: insufficient memory', ts: '14:23:04.198' },
  { level: 'ERROR', msg: 'gRPC UNAVAILABLE: upstream connect error', ts: '14:23:04.334' },
];

const levelColor: Record<string, string> = {
  ERROR: 'text-red-400',
  WARN: 'text-amber-400',
  FATAL: 'text-red-500',
  DEBUG: 'text-zinc-500',
};

function LogLine({ level, msg, ts, opacity = 1 }: { level: string; msg: string; ts: string; opacity?: number }) {
  return (
    <div className="flex gap-3 font-mono-code text-[11px] leading-relaxed md:text-xs" style={{ opacity }}>
      <span className="shrink-0 text-zinc-600">{ts}</span>
      <span className={`shrink-0 w-12 ${levelColor[level] ?? 'text-zinc-400'}`}>{level}</span>
      <span className="text-zinc-400 truncate">{msg}</span>
    </div>
  );
}

const BAR_HEIGHTS = [28, 14, 35, 22, 41, 18, 31, 25, 38, 16, 29, 33, 20, 37, 24, 42, 19, 30, 26, 36, 17, 32, 23, 39];

export function ProblemSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const chaosRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const chaos = chaosRef.current;
    const counter = counterRef.current;
    const overlay = overlayRef.current;
    if (!section || !chaos || !counter || !overlay) return;

    const ctx = gsap.context(() => {
      gsap.to(chaos, {
        y: '-60%',
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1,
        },
      });

      gsap.fromTo(
        overlay,
        { opacity: 0 },
        {
          opacity: 1,
          scrollTrigger: {
            trigger: section,
            start: 'top 60%',
            end: 'center center',
            scrub: 1,
          },
        },
      );

      const obj = { val: 0 };
      gsap.to(obj, {
        val: 12847,
        scrollTrigger: {
          trigger: section,
          start: 'top 80%',
          end: 'center center',
          scrub: 1,
        },
        onUpdate: () => {
          counter.textContent = Math.floor(obj.val).toLocaleString();
        },
      });
    }, section);

    return () => ctx.revert();
  }, []);

  const rows = Array.from({ length: 12 }, (_, i) => LOG_STREAM[i % LOG_STREAM.length]);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[120vh] overflow-hidden border-t border-zinc-800/60 bg-[#060608]"
    >
      <div className="sticky top-0 flex h-screen flex-col">
        <div className="flex items-center justify-between border-b border-zinc-800/60 px-6 py-4 md:px-10">
          <div>
            <p className="font-mono-code text-[10px] uppercase tracking-[0.3em] text-red-400/80">02 — THE PROBLEM</p>
            <h2 className="font-display mt-1 text-3xl font-bold tracking-tight text-zinc-100 md:text-5xl">
              Drowning in noise
            </h2>
          </div>
          <div className="text-right">
            <p className="font-mono-code text-[10px] tracking-widest text-zinc-600">EVENTS PROCESSED</p>
            <p className="font-display text-2xl font-bold text-red-400 md:text-4xl">
              <span ref={counterRef}>0</span>
            </p>
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden">
          <div
            ref={overlayRef}
            className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-transparent via-red-950/20 to-[#060608] opacity-0"
          />

          <div className="absolute inset-0 grid grid-cols-1 md:grid-cols-[1fr_280px]">
            <div className="relative overflow-hidden border-r border-zinc-800/40">
              <div ref={chaosRef} className="space-y-1.5 p-4 md:p-6">
                {[...rows, ...rows, ...rows, ...rows].map((log, i) => (
                  <LogLine key={i} {...log} opacity={0.4 + (i % 5) * 0.12} />
                ))}
              </div>
              <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(239,68,68,0.03)_2px,rgba(239,68,68,0.03)_4px)]" />
            </div>

            <div className="relative hidden flex-col justify-center gap-4 p-6 md:flex">
              <div className="space-y-3">
                {['ALERTS', 'PAGES', 'TRACES', 'METRICS', 'LOGS'].map((label, i) => (
                  <div key={label} className="flex items-center gap-3">
                    <div
                      className="h-2 flex-1 rounded-full bg-zinc-800"
                      style={{
                        background: `linear-gradient(90deg, hsl(${0 + i * 15} 70% 50%) ${20 + i * 15}%, transparent)`,
                      }}
                    />
                    <span className="font-mono-code w-16 text-[10px] text-zinc-600">{label}</span>
                  </div>
                ))}
              </div>
              <p className="font-display text-4xl font-bold leading-none text-zinc-700">99.7%</p>
              <p className="font-mono-code text-[10px] tracking-widest text-zinc-600">IS NOISE</p>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between px-6 pb-6 md:px-10">
            <div className="flex gap-1">
              {BAR_HEIGHTS.map((h, i) => (
                <div
                  key={i}
                  className="w-1 bg-red-500/60"
                  style={{ height: `${h}px` }}
                />
              ))}
            </div>
            <p className="font-mono-code max-w-xs text-right text-[10px] leading-relaxed text-zinc-600">
              Engineers spend 4+ hours per incident grep-ing through irrelevant output
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
