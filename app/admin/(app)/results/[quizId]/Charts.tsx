"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

/*
 * Chart conventions: thin bars with 4px rounded ends, a 2px surface gap between stacked
 * segments, recessive grid and axes, text in ink/stone tokens (never series colours),
 * a legend whenever there is more than one series, and a hover tooltip on every mark.
 * Colours are CSS variables so charts follow the active theme. Animations are off so the
 * charts are complete in printouts and PDF exports.
 */

const AXIS = { fontSize: 11, fill: "var(--color-stone-500)" };
const GRID = "var(--color-stone-200)";
export const STATUS = { good: "var(--chart-good)", warn: "var(--chart-warn)", bad: "var(--chart-bad)" };

type TipRow = { name: ReactNode; value: ReactNode; color?: string };

function TooltipBox({ title, rows }: { title?: ReactNode; rows: TipRow[] }) {
  return (
    <div className="rounded-md border-2 border-line bg-surface px-3 py-2 text-xs text-ink shadow-sm">
      {title && <p className="mb-1 font-semibold">{title}</p>}
      {rows.map((r, i) => (
        <p key={i} className="flex items-center gap-2">
          {r.color && <span className="h-2.5 w-2.5 rounded-xs" style={{ background: r.color }} />}
          <span className="text-stone-600">{r.name}</span>
          <span className="ml-auto pl-3 font-semibold tabular-nums">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs" style={{ background: it.color }} />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/** Each reviewer's factual-correctness verdicts as one stacked horizontal bar. */
export function VerdictChart({ data }: { data: { name: string; yes: number; partially: number; no: number }[] }) {
  const series = [
    { key: "yes", label: "Correct", color: STATUS.good },
    { key: "partially", label: "Partially correct", color: STATUS.warn },
    { key: "no", label: "Incorrect", color: STATUS.bad },
  ] as const;
  return (
    <div>
      <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />
      <div className="mt-2 h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barSize={18}>
            <CartesianGrid horizontal={false} stroke={GRID} strokeDasharray="2 4" />
            <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={88} tick={AXIS} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: "var(--color-stone-100)" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={label}
                    rows={series.map((s) => ({
                      name: s.label,
                      value: (payload[0].payload as Record<string, number>)[s.key],
                      color: s.color,
                    }))}
                  />
                ) : null
              }
            />
            {series.map((s, i) => (
              <Bar
                isAnimationActive={false}
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId="v"
                fill={s.color}
                stroke="var(--surface)"
                strokeWidth={2}
                radius={i === series.length - 1 ? [0, 4, 4, 0] : i === 0 ? [4, 0, 0, 4] : 0}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Single-series horizontal bars, e.g. error tags. */
export function HBars({ data, unit }: { data: { label: string; value: number }[]; unit: string }) {
  return (
    <div style={{ height: Math.max(120, data.length * 30 + 24) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }} barSize={14}>
          <CartesianGrid horizontal={false} stroke={GRID} strokeDasharray="2 4" />
          <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" width={150} tick={{ ...AXIS, fill: "var(--color-stone-700)" }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "var(--color-stone-100)" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipBox rows={[{ name: String(payload[0].payload.label), value: `${payload[0].value} ${unit}` }]} />
              ) : null
            }
          />
          <Bar isAnimationActive={false} dataKey="value" fill="var(--brand-600)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Single-series vertical columns, e.g. % correct per question or answer distributions. */
export function Columns({
  data,
  max,
  unit,
  reference,
}: {
  data: { label: string; value: number | null; title?: string }[];
  max?: number;
  unit: string;
  reference?: { value: number; label: string };
}) {
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -16 }} barSize={22}>
          <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="2 4" />
          <XAxis dataKey="label" tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} interval={0} />
          <YAxis domain={[0, max ?? "auto"]} allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
          {reference && (
            <ReferenceLine
              y={reference.value}
              stroke="var(--color-stone-400)"
              strokeDasharray="4 4"
              label={{ value: reference.label, position: "insideTopRight", fontSize: 10, fill: "var(--color-stone-500)" }}
            />
          )}
          <Tooltip
            cursor={{ fill: "var(--color-stone-100)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as { label: string; value: number | null; title?: string };
              return (
                <TooltipBox
                  title={d.title ?? d.label}
                  rows={[{ name: "Value", value: d.value === null ? "no data" : `${Math.round(d.value * 10) / 10}${unit}` }]}
                />
              );
            }}
          />
          <Bar isAnimationActive={false} dataKey="value" fill="var(--brand-600)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type Point = { label: string; expertScore: number; perceived: number; verdict: "accurate" | "not accurate" | "split" };

/** One dot per question: expert accuracy score (x) against students' perceived accuracy (y). */
export function ExpertVsStudentScatter({ data }: { data: Point[] }) {
  const groups = [
    { verdict: "accurate", label: "Experts: accurate", color: STATUS.good },
    { verdict: "split", label: "Reviewers split", color: STATUS.warn },
    { verdict: "not accurate", label: "Experts: not accurate", color: STATUS.bad },
  ] as const;
  return (
    <div>
      <Legend items={groups.map((g) => ({ label: g.label, color: g.color }))} />
      <div className="mt-2 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 16, bottom: 16, left: -8 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="2 4" />
            <XAxis
              type="number"
              dataKey="expertScore"
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={AXIS}
              axisLine={{ stroke: GRID }}
              tickLine={false}
              label={{ value: "Expert accuracy score (%)", position: "insideBottom", offset: -10, fontSize: 11, fill: "var(--color-stone-500)" }}
            />
            <YAxis
              type="number"
              dataKey="perceived"
              domain={[1, 5]}
              ticks={[1, 2, 3, 4, 5]}
              tick={AXIS}
              axisLine={false}
              tickLine={false}
              label={{ value: "Student rating", angle: -90, position: "insideLeft", offset: 20, fontSize: 11, fill: "var(--color-stone-500)" }}
            />
            <ZAxis type="number" dataKey="z" range={[110, 110]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3", stroke: "var(--color-stone-400)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as Point;
                return (
                  <TooltipBox
                    title={d.label}
                    rows={[
                      { name: "Expert accuracy score", value: `${d.expertScore}%` },
                      { name: "Students' perceived accuracy", value: `${d.perceived} / 5` },
                    ]}
                  />
                );
              }}
            />
            {groups.map((g) => (
              <Scatter
                isAnimationActive={false}
                key={g.verdict}
                name={g.label}
                data={data.filter((d) => d.verdict === g.verdict).map((d) => ({ ...d, z: 1 }))}
                fill={g.color}
                stroke="var(--surface)"
                strokeWidth={2}
                shape="circle"
                legendType="circle"
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
