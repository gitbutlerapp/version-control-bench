'use client';

import { useEffect, useRef, useState } from 'react';
import { useView } from '../state/ViewContext';
import type { ArmId, ResultsData } from '@/lib/types';
import { TOOL_COLOR } from '@/lib/selectors';

// One dot per run on a shared time axis: the distribution the matrix means
// summarize. Hollow dots failed grading; the tick marks the median. Light
// gridlines give the axis a readable scale.
//
// The SVG viewBox width tracks the measured pixel width so the render scale
// stays 1:1 — dots and labels keep a constant size while the axis stretches to
// fill the available horizontal space.
const ROW_H = 22; // px
const AXIS_H = 16; // space below the rows for tick labels
const PAD_L = 34;
const PAD_R = 40;
const R = 3.2;
const DEFAULT_W = 720;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.round(q * (sorted.length - 1)))];
}

// nearest "nice" number (1/2/5 × 10^k) at or below x — used for the tick step.
function niceStep(x: number): number {
  if (x <= 0) return 1;
  const e = Math.floor(Math.log10(x));
  const b = 10 ** e;
  const f = x / b;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * b;
}

const ARM_SHORT: Record<ArmId, string> = { git: 'git', 'jj+skill': 'jj', 'but+skill': 'but' };

export function RunStrip({ data, scenarioId }: { data: ResultsData; scenarioId: string }) {
  const { agent } = useView();
  const wrapRef = useRef<HTMLElement>(null);
  const [w, setW] = useState(DEFAULT_W);
  // Hover tooltip. The strip renders at 1:1 scale, so a dot's SVG coordinates
  // are pixel offsets within the figure — an HTML overlay positions directly.
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width;
      if (cw && cw > 0) setW(cw);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const arms = data.meta.arm_order;
  const runs = data.rows.filter((r) => r.scenario === scenarioId && r.agent === agent);
  if (runs.length === 0) return null;

  // Robust axis: cap near the 90th percentile so one slow run doesn't flatten
  // the rest, but never below any tool's median. Runs beyond the cap clamp to
  // the right edge and are flagged, so the axis stays honest (slower = right)
  // while the bulk spreads out.
  const sorted = [...runs.map((r) => r.wall_ms)].sort((a, b) => a - b);
  const medians = arms.map((arm) => {
    const rr = runs.filter((r) => r.arm === arm).map((r) => r.wall_ms);
    return rr.length ? median(rr) : 0;
  });
  const robust = Math.max(quantile(sorted, 0.9), ...medians);
  const step = niceStep(robust / 3.2);
  const axisMax = Math.max(step, Math.ceil(robust / step) * step);
  const hasClamped = sorted[sorted.length - 1] > axisMax;

  const x = (ms: number) => PAD_L + (Math.min(ms, axisMax) / axisMax) * (w - PAD_L - PAD_R);
  const chartH = arms.length * ROW_H;
  const height = chartH + 4 + AXIS_H;
  const agentLabel = data.meta.agents.find((a) => a.id === agent)?.label ?? agent;

  const ticks: number[] = [];
  for (let t = 0; t <= axisMax + 0.5; t += step) ticks.push(t);

  return (
    <figure className="runstrip" ref={wrapRef}>
      <svg
        viewBox={`0 0 ${w} ${height}`}
        width={w}
        height={height}
        role="img"
        aria-label={`Wall-clock time of each ${agentLabel} run on this scenario, one dot per run`}
      >
        {/* gridlines + scale */}
        {ticks.map((t) => (
          <g key={`tick-${t}`}>
            <line
              className="runstrip-grid"
              x1={x(t)}
              x2={x(t)}
              y1={4}
              y2={chartH + 4}
            />
            <text className="runstrip-tick" x={x(t)} y={height - 4} textAnchor="middle">
              {t === 0 ? '0' : `${Math.round(t / 1000)}s`}
            </text>
          </g>
        ))}

        {arms.map((arm, i) => {
          const y = i * ROW_H + ROW_H / 2 + 4;
          const armRuns = runs.filter((r) => r.arm === arm);
          if (armRuns.length === 0) return null;
          const med = median(armRuns.map((r) => r.wall_ms));
          const color = TOOL_COLOR[arm];
          return (
            <g key={arm}>
              <text className="runstrip-label" x={PAD_L - 10} y={y + 3.5} textAnchor="end">
                {ARM_SHORT[arm]}
              </text>
              <line
                x1={x(med)}
                x2={x(med)}
                y1={y - 6}
                y2={y + 6}
                stroke={color}
                strokeWidth="1.5"
                opacity="0.55"
              />
              {armRuns.map((r) => {
                const clamped = r.wall_ms > axisMax;
                const cx = x(r.wall_ms);
                const secs = `${(r.wall_ms / 1000).toFixed(1)}s`;
                return (
                  <g
                    key={r.rep}
                    className="runstrip-dot"
                    onMouseEnter={() =>
                      setTip({ x: cx, y, text: r.passed ? secs : `${secs} · failed` })
                    }
                    onMouseLeave={() => setTip(null)}
                  >
                    <title>
                      {`run ${r.rep}: ${secs}${clamped ? ' (beyond axis)' : ''}${r.passed ? '' : `, failed (${r.failure ?? 'grading'})`}`}
                    </title>
                    {/* transparent hit target, larger than the drawn dot */}
                    <circle cx={cx} cy={y} r={8} fill="transparent" />
                    <circle
                      cx={cx}
                      cy={y}
                      r={R}
                      fill={r.passed ? color : 'none'}
                      stroke={color}
                      strokeWidth={r.passed ? 0 : 1.4}
                      opacity={r.passed ? 0.85 : 0.9}
                      pointerEvents="none"
                    />
                    {clamped && (
                      <text className="runstrip-clamp" x={cx + 5} y={y + 3} pointerEvents="none">
                        ›
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      {tip && (
        <span className="runstrip-tip mono" style={{ left: tip.x, top: tip.y }} aria-hidden>
          {tip.text}
        </span>
      )}
      <figcaption className="runstrip-caption faint">
        one dot per {agentLabel} run · tick = median · hollow = failed
        {hasClamped ? ' · › = off-axis' : ''}
      </figcaption>
    </figure>
  );
}
