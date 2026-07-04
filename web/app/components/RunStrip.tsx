'use client';

import { useView } from '../state/ViewContext';
import type { ArmId, ResultsData, RunRow } from '@/lib/types';
import { TOOL_COLOR } from '@/lib/selectors';

// One dot per run on a shared time axis: the distribution the matrix means
// summarize. Hollow dots failed grading; the tick marks the median. Kept
// deliberately small — three rows of dots, no axes machinery.
const W = 560;
const ROW_H = 26;
const PAD_L = 34;
const PAD_R = 46;
const R = 4.5;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

const ARM_SHORT: Record<ArmId, string> = { git: 'git', 'jj+skill': 'jj', 'but+skill': 'but' };

export function RunStrip({ data, scenarioId }: { data: ResultsData; scenarioId: string }) {
  const { agent } = useView();
  const arms = data.meta.arm_order;
  const runs = data.rows.filter((r) => r.scenario === scenarioId && r.agent === agent);
  if (runs.length === 0) return null;

  const maxMs = Math.max(...runs.map((r) => r.wall_ms));
  const x = (ms: number) => PAD_L + (ms / maxMs) * (W - PAD_L - PAD_R);
  const height = arms.length * ROW_H + 8;
  const agentLabel = data.meta.agents.find((a) => a.id === agent)?.label ?? agent;

  return (
    <figure className="runstrip">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        role="img"
        aria-label={`Wall-clock time of each ${agentLabel} run on this scenario, one dot per run`}
      >
        {arms.map((arm, i) => {
          const y = i * ROW_H + ROW_H / 2 + 4;
          const armRuns = runs.filter((r) => r.arm === arm);
          if (armRuns.length === 0) return null;
          const med = median(armRuns.map((r) => r.wall_ms));
          const color = TOOL_COLOR[arm];
          return (
            <g key={arm}>
              <text className="runstrip-label" x={PAD_L - 8} y={y + 3.5} textAnchor="end">
                {ARM_SHORT[arm]}
              </text>
              <line
                className="runstrip-axis"
                x1={PAD_L}
                x2={W - PAD_R}
                y1={y}
                y2={y}
              />
              <line
                x1={x(med)}
                x2={x(med)}
                y1={y - 8}
                y2={y + 8}
                stroke={color}
                strokeWidth="2"
                opacity="0.55"
              />
              {armRuns.map((r) => (
                <circle
                  key={r.rep}
                  cx={x(r.wall_ms)}
                  cy={y}
                  r={R}
                  fill={r.passed ? color : 'none'}
                  stroke={color}
                  strokeWidth={r.passed ? 0 : 1.8}
                  opacity={r.passed ? 0.85 : 0.9}
                >
                  <title>
                    {`run ${r.rep}: ${(r.wall_ms / 1000).toFixed(1)}s${r.passed ? '' : ` — failed (${r.failure ?? 'grading'})`}`}
                  </title>
                </circle>
              ))}
              <text className="runstrip-max" x={W - PAD_R + 8} y={y + 3.5}>
                {i === 0 ? `${Math.round(maxMs / 1000)}s →` : ''}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="runstrip-caption faint">
        each dot is one {agentLabel} run (wall-clock, shared axis) · | median · hollow = failed
        grading
      </figcaption>
    </figure>
  );
}
