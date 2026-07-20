import { HERO } from '../content';
import type { ResultsData } from '@/lib/types';

export function Hero({ data }: { data: ResultsData }) {
  const m = data.meta;
  return (
    <header className="hero" id="top">
      {/* one stamp line: run shape, date, and the provenance jump. On phones
          the shape summary is hidden (the intro states it in words), leaving
          a single short line of stamp. */}
      <p className="eyebrow hero-eyebrow">
        <span className="hero-eyebrow-shape">3 tools · 2 agents · {m.scenarios.length} scenarios · </span>
        k={m.k} · {m.snapshot_date} · <a href="#provenance">provenance ↓</a>
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
