import type { ResultsData } from '@/lib/types';
import { dateLabel } from '@/lib/format';
import { EYEBROWS, MICRO, RELATED } from '../content';

const REPO_URL = 'https://github.com/gitbutlerapp/version-control-bench';
const DATA_URL = `${REPO_URL}/blob/main/web/data/results.json`;

function short(hash: string | null | undefined, n = 12): string {
  return hash ? hash.slice(0, n) : '—';
}

export function Provenance({ data }: { data: ResultsData }) {
  return (
    <section id="provenance">
      <div className="section-head">
        <p className="eyebrow">{EYEBROWS.provenance}</p>
        <h2>{MICRO.reproduceTitle}</h2>
        <p className="lede">{MICRO.reproduceLede}</p>
      </div>

      <div className="prov-grid">
        {data.source_snapshots.map((s) => (
          <div key={`${s.batch}:${s.arms.join('-')}`} className="prov-card">
            <div className="prov-card-head">
              <span className="eyebrow">{s.arms.join(' · ')}</span>
              <span className="faint mono">
                {s.runs} runs · {dateLabel(s.generated_at)}
              </span>
            </div>
            <dl className="prov-kv mono">
              <div>
                <dt>batch</dt>
                <dd>{s.batch.split('/').pop()}</dd>
              </div>
              {Object.entries(s.provenance).map(([k, v]) =>
                v ? (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd className="prov-hash">{k.includes('url') || k.includes('package') || k.includes('version') ? v : short(v)}</dd>
                  </div>
                ) : null,
              )}
            </dl>
          </div>
        ))}
      </div>

      <div className="prov-meta mono faint">
        <div>
          generator: <span className="prov-cmd">{data.meta.generator}</span>
        </div>
        <div className="prov-links">
          <a href={DATA_URL}>derived results.json ↗</a>
          <a href={REPO_URL}>benchmark source ↗</a>
        </div>
      </div>

      <div className="related">
        <h3>{RELATED.title}</h3>
        <p className="lede">{RELATED.lede}</p>
        <ul className="related-list">
          {RELATED.items.map((r) => (
            <li key={r.name}>
              <a href={r.url} target="_blank" rel="noopener noreferrer">
                {r.name}
              </a>{' '}
              <span className="faint">({r.by})</span> — {r.read}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Footer({ data }: { data: ResultsData }) {
  const m = data.meta;
  return (
    <footer className="footer">
      <div className="page footer-inner">
        <p className="footer-bias">
          Maintained by <a href="https://gitbutler.com">GitButler</a>, one of the three tools
          measured. The grader is deterministic and the data is <a href={DATA_URL}>on GitHub</a>.
        </p>
        <p className="footer-stamp mono faint">
          data generated {dateLabel(data.generated_at)} · {m.total_passed}/{m.total_runs} passed ·{' '}
          {m.total_runs} runs across {m.scenarios.length} chores, 2 agents, 3 tools
        </p>
      </div>
    </footer>
  );
}
