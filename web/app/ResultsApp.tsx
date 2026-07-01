'use client';

import { ViewProvider } from './state/ViewContext';
import { StickyBar } from './components/Controls';
import { Hero } from './components/Hero';
import { ResultsTable } from './components/ResultsTable';
import { Scenarios } from './components/Scenarios';
import { FailureLedger } from './components/FailureLedger';
import { Methodology } from './components/Methodology';
import { Provenance, Footer } from './components/Provenance';
import type { ResultsData } from '@/lib/types';

export function ResultsApp({ data }: { data: ResultsData }) {
  return (
    <ViewProvider>
      <StickyBar />
      <main className="page">
        <Hero data={data} />
        <ResultsTable data={data} />
        <Scenarios data={data} />
        <Methodology data={data} />
        <FailureLedger data={data} />
        <Provenance data={data} />
      </main>
      <Footer data={data} />
    </ViewProvider>
  );
}
