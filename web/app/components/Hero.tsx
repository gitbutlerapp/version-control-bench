import { HERO } from '../content';
import type { ResultsData } from '@/lib/types';

export function Hero({ data }: { data: ResultsData }) {
  const m = data.meta;
  return (
    <header className="hero" id="top">
      {/* one stamp line: run shape, date, and the provenance jump */}
      <p className="eyebrow hero-eyebrow">
        3 tools · 2 agents · 5 scenarios · k={m.k} · {m.snapshot_date} ·{' '}
        <a href="#provenance">provenance ↓</a>
      </p>
      <h1 className="hero-title">{HERO.title}</h1>

      <div className="hero-intro">
        {HERO.intro.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </header>
  );
}
