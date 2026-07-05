import type { ResultsData } from '@/lib/types';
import { dateLabel } from '@/lib/format';
import { EYEBROWS, HISTORY, MICRO, MODEL_FALLBACK, RELATED } from '../content';

const REPO_URL = 'https://github.com/gitbutlerapp/version-control-bench';
const DATA_URL = `${REPO_URL}/blob/main/web/data/results.json`;

function short(hash: string | null | undefined, n = 12): string {
  return hash ? hash.slice(0, n) : '—';
}

// Compact one-line summary of a source snapshot's provenance: the identifying
// tokens only. The full SHA-256 set lives in the linked results.json.
function snapshotSummary(s: ResultsData['source_snapshots'][number]): { label: string; body: string } {
  const p = s.provenance;
  const label = p.jj_version ? 'Jujutsu' : 'GitButler';
  const bits: string[] = [];
  if (p.jj_version) bits.push(p.jj_version);
  if (p.binary_hash) bits.push(`build ${short(p.binary_hash, 10)}`);
  if (p.skill_package) bits.push(p.skill_package);
  else if (p.skill_hash) bits.push(`skill ${short(p.skill_hash, 10)}`);
  return { label, body: bits.join(' · ') || '—' };
}

export function Provenance({ data }: { data: ResultsData }) {
  const m = data.meta;
  const agents = m.agents.filter((a) => a.id !== 'both');

  return (
    <section id="provenance">
      <div className="section-head">
        <p className="eyebrow">{EYEBROWS.provenance}</p>
        <h2>{MICRO.reproduceTitle}</h2>
      </div>

      <dl className="prov mono">
        {agents.map((a) => (
          <div key={a.id}>
            <dt>{a.label}</dt>
            <dd>
              {a.observed_model ?? MODEL_FALLBACK[a.id] ?? '?'}
              {a.agent_cli_version ? ` · ${a.agent_cli_version}` : ''}
            </dd>
          </div>
        ))}
        <div>
          <dt>grader</dt>
          <dd>deterministic git-state verifier · no LLM judge</dd>
        </div>
        {data.source_snapshots.map((s) => {
          const { label, body } = snapshotSummary(s);
          return (
            <div key={`${s.batch}:${s.arms.join('-')}`}>
              <dt>{label}</dt>
              <dd>{body}</dd>
            </div>
          );
        })}
        <div>
          <dt>batch</dt>
          <dd>
            k={m.k} · {m.total_runs} runs · {m.snapshot_date} ·{' '}
            <a href={DATA_URL}>results.json ↗</a> · <a href={REPO_URL}>source ↗</a>
            <span className="faint"> (full hashes in the aggregate)</span>
          </dd>
        </div>
      </dl>

      <div className="prov-block">
        <h3>{HISTORY.title}</h3>
        <ul className="history-list mono">
          {HISTORY.entries.map((entry) => (
            <li key={entry.date}>
              <a href={entry.url} target="_blank" rel="noopener noreferrer">
                {entry.date}
              </a>{' '}
              · {entry.scope} · {entry.passed}
              {entry.current ? <span className="history-current"> · shown above</span> : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="prov-block">
        <h3>{RELATED.title}</h3>
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
