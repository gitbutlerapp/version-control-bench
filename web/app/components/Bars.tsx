import { ciRange, passFraction } from '@/lib/format';

export function PassChip({
  pass,
  n,
  ciLo,
  ciHi,
  size = 'md',
  onActivate,
}: {
  pass: number;
  n: number;
  ciLo?: number | null;
  ciHi?: number | null;
  size?: 'sm' | 'md';
  onActivate?: () => void;
}) {
  const clean = pass === n;
  const zero = pass === 0;
  const status = clean ? 'pass' : zero ? 'fail' : 'warn';
  const glyph = clean ? '✓' : zero ? '✕' : '!';
  const ci = ciLo != null && ciHi != null ? `95% CI ${ciRange(ciLo, ciHi)}` : null;
  const inner = (
    <>
      <span className="passchip-glyph" aria-hidden>
        {glyph}
      </span>
      <span>{passFraction(pass, n)}</span>
    </>
  );

  if (onActivate) {
    return (
      <button
        type="button"
        className="passchip num"
        data-status={status}
        data-size={size}
        onClick={onActivate}
        title={ci ?? undefined}
        aria-label={`${pass} of ${n} runs passed${ci ? `, ${ci}` : ''}; see failures`}
      >
        {inner}
      </button>
    );
  }
  return (
    <span className="passchip num" data-status={status} data-size={size} title={ci ?? undefined}>
      {inner}
      <span className="sr-only">
        {clean ? 'all runs passed' : `${pass} of ${n} runs passed`}
        {ci ? `, ${ci}` : ''}
      </span>
    </span>
  );
}
