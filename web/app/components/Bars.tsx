import { passFraction } from '@/lib/format';

export function PassChip({ pass, n, size = 'md' }: { pass: number; n: number; size?: 'sm' | 'md' }) {
  const clean = pass === n;
  const zero = pass === 0;
  const status = clean ? 'pass' : zero ? 'fail' : 'warn';
  const glyph = clean ? '✓' : zero ? '✕' : '!';
  return (
    <span className="passchip num" data-status={status} data-size={size}>
      <span className="passchip-glyph" aria-hidden>
        {glyph}
      </span>
      <span>{passFraction(pass, n)}</span>
      <span className="sr-only">{clean ? 'all runs passed' : `${pass} of ${n} runs passed`}</span>
    </span>
  );
}
