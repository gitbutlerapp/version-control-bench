import { HERO } from '../content';
import type { ResultsData } from '@/lib/types';
import { dateLabel } from '@/lib/format';

export function Hero({ data }: { data: ResultsData }) {
  const m = data.meta;
  return (
    <header className="hero" id="top">
      <p className="eyebrow hero-eyebrow">
        3 tools · 2 agents · 5 tasks · k={m.k} · {m.snapshot_date}
      </p>
      <h1 className="hero-title">{HERO.title}</h1>

      <div className="hero-intro">
        {HERO.intro.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      <p className="hero-prov faint mono">
        data generated {dateLabel(data.generated_at)} · {m.total_runs} graded runs ·{' '}
        {data.source_snapshots.length} source snapshots · <a href="#provenance">provenance ↓</a>
      </p>
    </header>
  );
}
