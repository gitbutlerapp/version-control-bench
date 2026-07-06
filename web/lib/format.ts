// Display formatters. All numbers render in mono/tabular elsewhere; these just
// decide precision and units.

export function seconds(ms: number | null): string {
  if (ms == null) return '–';
  const s = ms / 1000;
  return s >= 100 ? s.toFixed(0) : s.toFixed(1);
}

export function secondsLabel(ms: number | null): string {
  return ms == null ? '–' : `${seconds(ms)}s`;
}

export function kb(bytes: number | null): string {
  if (bytes == null) return '–';
  return (bytes / 1000).toFixed(1);
}

export function count(n: number): string {
  // one decimal always, so table columns stay digit-stable across rows
  return n.toFixed(1);
}

export function pct(n: number | null, withSign = true): string {
  if (n == null) return '–';
  const r = Math.round(n * 10) / 10;
  const body = `${Math.abs(r)}%`;
  if (!withSign) return body;
  return r > 0 ? `+${body}` : r < 0 ? `−${body}` : body;
}

// "−61%" style delta where negative is the win for time/ops.
export function deltaSavings(n: number | null): string {
  if (n == null) return '–';
  const r = Math.round(n * 10) / 10;
  return r < 0 ? `−${Math.abs(r)}%` : `+${r}%`;
}

export function speedup(ratio: number | null): string {
  if (ratio == null) return '–';
  return `${ratio.toFixed(ratio >= 10 ? 0 : 1)}×`;
}

export function passFraction(pass: number, n: number): string {
  return `${pass}/${n}`;
}

export function ciRange(lo: number | null, hi: number | null): string {
  if (lo == null || hi == null) return '–';
  return `${Math.round(lo)}–${Math.round(hi)}%`;
}

// "−60.4s [−123.5s, +2.8s]" style paired-delta rendering.
export function pairedRange(
  stat: { mean: number; lo: number | null; hi: number | null } | null | undefined,
  fmt: (v: number) => string,
): string {
  if (!stat) return '–';
  const signed = (v: number) => (v > 0 ? `+${fmt(v)}` : v < 0 ? `−${fmt(Math.abs(v))}` : fmt(v));
  if (stat.lo == null || stat.hi == null) return signed(stat.mean);
  return `${signed(stat.mean)} [${signed(stat.lo)}, ${signed(stat.hi)}]`;
}

export function dateLabel(iso: string): string {
  // keep it stable & locale-free: YYYY-MM-DD
  return iso.slice(0, 10);
}
