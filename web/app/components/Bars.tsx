import { passFraction } from '@/lib/format';

export function PassChip({
  pass,
  n,
  size = 'md',
  onActivate,
}: {
  pass: number;
  n: number;
  size?: 'sm' | 'md';
  onActivate?: () => void;
}) {
  const clean = pass === n;
  const zero = pass === 0;
  const status = clean ? 'pass' : zero ? 'fail' : 'warn';
  const glyph = clean ? '✓' : zero ? '✕' : '!';
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
        aria-label={`${pass} of ${n} runs passed — see failures`}
      >
        {inner}
      </button>
    );
  }
  return (
    <span className="passchip num" data-status={status} data-size={size}>
      {inner}
      <span className="sr-only">{clean ? 'all runs passed' : `${pass} of ${n} runs passed`}</span>
    </span>
  );
}
