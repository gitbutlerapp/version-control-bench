'use client';

import { ViewProvider } from './state/ViewContext';
import { StickyBar } from './components/Controls';
import { Hero } from './components/Hero';
import { ResultsTable } from './components/ResultsTable';
import { Scenarios } from './components/Scenarios';
import { FailureLedger } from './components/FailureLedger';
import { Methodology } from './components/Methodology';
import { Limitations } from './components/Limitations';
import { Provenance, Footer } from './components/Provenance';
import type { ResultsData } from '@/lib/types';

export function ResultsApp({ data }: { data: ResultsData }) {
  // A near-perfect batch has no failure *pattern* worth a dedicated table: the
  // stray miss is already visible as the non-full pass chip in the matrix and
  // the hollow dot in the scenario run-strips. Show the ledger only when the
  // failures are numerous enough to reveal something the matrix doesn't.
  const failed = data.meta.total_runs - data.meta.total_passed;
  const showFailures = failed >= 3;

  return (
    <ViewProvider>
      <StickyBar showFailures={showFailures} />
      <main className="page">
        <Hero data={data} />
        <ResultsTable data={data} />
        <Scenarios data={data} />
        <Methodology data={data} />
        {showFailures && <FailureLedger data={data} />}
        <Limitations />
        <Provenance data={data} />
      </main>
      <Footer data={data} />
    </ViewProvider>
  );
}
