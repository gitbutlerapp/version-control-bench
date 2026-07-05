import { METHOD, EYEBROWS } from '../content';
import type { ResultsData } from '@/lib/types';

export function Methodology({ data }: { data: ResultsData }) {
  const m = data.meta;
  return (
    <section id="method">
      <div className="section-head">
        <p className="eyebrow">{EYEBROWS.method}</p>
        <h2>{METHOD.title}</h2>
        <p className="lede">{METHOD.lede}</p>
      </div>

      <dl className="method-list">
        {METHOD.facts.map((f) => (
          <div key={f.term} className="method-item">
            <dt>{f.term}</dt>
            <dd>{f.body}</dd>
          </div>
        ))}
      </dl>

      <div className="pills" aria-label="Test parameters">
        <span className="pill mono">k={m.k}</span>
        <span className="pill mono">
          n={m.total_runs / (m.arm_order.length * 2)} per tool–agent
        </span>
        <span className="pill mono">grader: git-state</span>
        <span className="pill mono">jj 0.42.0</span>
        <span className="pill mono">{m.total_runs} runs</span>
      </div>
    </section>
  );
}
