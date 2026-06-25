'use client';

import { useEffect } from 'react';
import { CursorGlow } from './CursorGlow';
import { HeroSection } from './sections/HeroSection';
import { ProblemSection } from './sections/ProblemSection';
import { InvestigationSection } from './sections/InvestigationSection';
import { EvidenceSection } from './sections/EvidenceSection';
import { RootCauseSection } from './sections/RootCauseSection';

export function MarketingPage() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;

    html.style.overflow = 'auto';
    body.style.overflow = 'auto';
    body.classList.remove('overflow-hidden');

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.classList.add('overflow-hidden');
    };
  }, []);

  return (
    <div className="marketing-page relative min-h-screen bg-[#050506] text-zinc-100 selection:bg-indigo-500/30">
      <CursorGlow />
      <main>
        <HeroSection />
        <ProblemSection />
        <InvestigationSection />
        <EvidenceSection />
        <RootCauseSection />
      </main>
    </div>
  );
}
