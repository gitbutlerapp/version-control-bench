// Statistical helpers for benchmark aggregation.
//
// Trials of the same task by the same agent and arm are correlated, so
// cross-task statistics must treat the task, not the trial, as the sampling
// unit: trials are first reduced to one score per task, and arm comparisons
// use paired per-task differences.

export function wilsonInterval(passes, n, z = 1.96) {
  if (!Number.isFinite(passes) || !Number.isFinite(n) || n <= 0) return null;
  const p = passes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return { lo: Math.max(0, center - half), hi: Math.min(1, center + half) };
}

export function quantile(values, q) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (base + 1 < sorted.length) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

// Two-sided 95% critical values of Student's t, indexed by degrees of freedom.
const T_95 = [
  NaN, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228,
  2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086,
  2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042,
];

export function tCritical95(df) {
  if (!Number.isInteger(df) || df < 1) return null;
  if (df < T_95.length) return T_95[df];
  return 1.96 + 2.4 / df;
}

// Mean of paired differences with a t-based 95% CI; df = n - 1 where n is the
// number of pairs (tasks). Returns null when no finite pairs exist, and a
// CI-less mean when only one pair exists.
export function pairedMeanCI(deltas) {
  const values = deltas.filter((value) => Number.isFinite(value));
  const n = values.length;
  if (n === 0) return null;
  const meanValue = values.reduce((sum, value) => sum + value, 0) / n;
  if (n === 1) return { mean: meanValue, lo: null, hi: null, n };
  const variance = values.reduce((sum, value) => sum + (value - meanValue) ** 2, 0) / (n - 1);
  const se = Math.sqrt(variance / n);
  const t = tCritical95(n - 1);
  return { mean: meanValue, lo: meanValue - t * se, hi: meanValue + t * se, n };
}
