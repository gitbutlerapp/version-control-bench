import { SCENARIOS_INTRO, EYEBROWS, MICRO, taskDefUrl } from '../content';
import { CommitGraph } from './CommitGraph';
import type { ResultsData, ScenarioMeta } from '@/lib/types';

function ScenarioSection({ scenario, index }: { scenario: ScenarioMeta; index: number }) {
  return (
    <article className="scenario-block" id={scenario.id}>
      <div className="scenario-text">
        <div className="scenario-block-head">
          <span className="scenario-num mono">{String(index + 1).padStart(2, '0')}</span>
          <h3 className="scenario-title">{scenario.title}</h3>
        </div>
        <p className="scenario-situation-text">{scenario.situation}</p>
        <div className="scenario-crux">
          <p className="eyebrow">The crux</p>
          <p className="scenario-crux-text">{scenario.crux}</p>
        </div>
        <details className="scenario-prompt">
          <summary>{MICRO.promptLabel}</summary>
          <blockquote className="mono">{scenario.prompt}</blockquote>
        </details>
        <a className="scenario-source mono" href={taskDefUrl(scenario.id)}>
          tasks/{scenario.id} ↗
        </a>
      </div>
      <div className="scenario-illo">
        <CommitGraph scenario={scenario} />
      </div>
    </article>
  );
}

export function Scenarios({ data }: { data: ResultsData }) {
  return (
    <section id="chores">
      <div className="section-head">
        <p className="eyebrow">{EYEBROWS.scenarios}</p>
        <h2>{SCENARIOS_INTRO.title}</h2>
        <p className="lede">{SCENARIOS_INTRO.lede}</p>
      </div>
      <div className="scenario-list">
        {data.meta.scenarios.map((s, i) => (
          <ScenarioSection key={s.id} scenario={s} index={i} />
        ))}
      </div>
    </section>
  );
}
