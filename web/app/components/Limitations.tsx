import { LIMITS, EYEBROWS } from '../content';

// The known limits of the benchmark, stated on the page so they are priced in
// rather than discovered. Reuses the method-list layout for visual consistency.
export function Limitations() {
  return (
    <section id="limitations">
      <div className="section-head">
        <p className="eyebrow">{EYEBROWS.limitations}</p>
        <h2>{LIMITS.title}</h2>
        <p className="lede">{LIMITS.lede}</p>
      </div>

      <dl className="method-list">
        {LIMITS.items.map((f) => (
          <div key={f.term} className="method-item">
            <dt>{f.term}</dt>
            <dd>{f.body}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
