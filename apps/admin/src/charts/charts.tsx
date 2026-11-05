// Small SVG/HTML charts. The rules they follow: thin marks with rounded data ends on one baseline, hairline
// grids, text in ink colours (never the series colour), a tooltip on hover and keyboard focus for every mark,
// and a table view of the same numbers (ChartCard), so nothing is only readable by colour or by hovering.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ta } from '@bair/project-data';
import { compact } from '../lib/format';

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/* ---------- Tooltip ---------- */

interface Tip {
  x: number;
  y: number;
  value: ReactNode;
  label: ReactNode;
}

function useTip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const node = tip && (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg"
      style={{ left: tip.x, top: tip.y - 8 }}
    >
      <div className="text-sm font-bold">{tip.value}</div>
      <div className="text-[var(--ink-2)]">{tip.label}</div>
    </div>
  );
  return { setTip, node };
}

/* ---------- Column chart: one series over time or categories ---------- */

export interface Column {
  key: string;
  label: string;
  value: number;
  /** Tooltip label; defaults to `label`. */
  tip?: string;
}

function niceMax(max: number): { top: number; step: number } {
  if (max <= 0) return { top: 4, step: 1 };
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  return { top: Math.ceil(max / step) * step, step };
}

export function ColumnChart({
  data,
  height = 200,
  format = (n: number) => n.toLocaleString('en-US'),
  every,
  ariaLabel,
  color = 'var(--series-1)',
}: {
  data: Column[];
  height?: number;
  format?: (n: number) => string;
  /** Label every nth column on the axis. */
  every?: number;
  ariaLabel: string;
  color?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const { setTip, node } = useTip();
  const left = 36;
  const bottom = 22;
  const plotW = Math.max(0, width - left - 4);
  const plotH = height - bottom - 8;
  const { top, step } = niceMax(Math.max(...data.map((d) => d.value), 0));
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.max(2, Math.min(24, band - 2));
  const y = (v: number) => 8 + plotH - (v / top) * plotH;
  const labelEvery = every ?? Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(plotW / 44))));
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setTip(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={left} x2={width} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--axis)' : 'var(--grid)'} strokeWidth="1" />
              <text x={left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="tnum fill-[var(--ink-3)] text-[11px]">
                {compact(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = left + i * band + (band - barW) / 2;
            const h = Math.max(0, y(0) - y(d.value));
            const r = Math.min(4, barW / 2, h);
            const show = (cx: number) => setTip({ x: cx, y: y(d.value), value: format(d.value), label: d.tip ?? d.label });
            return (
              <g key={d.key}>
                {h > 0 && (
                  <path
                    d={`M${x},${y(0)} V${y(d.value) + r} Q${x},${y(d.value)} ${x + r},${y(d.value)} H${x + barW - r} Q${x + barW},${y(d.value)} ${x + barW},${y(d.value) + r} V${y(0)} Z`}
                    fill={color}
                  />
                )}
                <rect
                  x={left + i * band}
                  y={8}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${d.tip ?? d.label}: ${format(d.value)}`}
                  onMouseEnter={() => show(x + barW / 2)}
                  onFocus={() => show(x + barW / 2)}
                  onBlur={() => setTip(null)}
                  className="outline-none focus:fill-[var(--surface-3)] hover:fill-[var(--surface-2)]"
                  style={{ fillOpacity: 0.6 }}
                />
                {i % labelEvery === 0 && (
                  <text x={x + barW / 2} y={height - 6} textAnchor="middle" className="tnum fill-[var(--ink-3)] text-[11px]">
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {node}
    </div>
  );
}

/* ---------- Ranked bars: label, bar, value at the tip ---------- */

export interface BarItem {
  key: string;
  label: ReactNode;
  value: number;
  /** Shown after the value, e.g. "3 зочин". */
  sub?: string;
  /** Identity mark before the label (a status dot). */
  mark?: string;
  onClick?: () => void;
}

export function BarList({ items, format = (n: number) => n.toLocaleString('en-US'), color = 'var(--series-1)', empty }: { items: BarItem[]; format?: (n: number) => string; color?: string; empty?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="py-4 text-center text-sm text-[var(--ink-3)]">{empty ?? ta.app.noData}</p>;
  return (
    <ul className="grid gap-2">
      {items.map((it) => {
        const Row = it.onClick ? 'button' : 'div';
        return (
          <li key={it.key}>
            <Row
              {...(it.onClick ? { type: 'button' as const, onClick: it.onClick } : {})}
              className={`grid w-full grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-left text-[13px] ${it.onClick ? 'rounded-lg hover:bg-[var(--surface-2)]' : ''}`}
            >
              <span className="flex min-w-0 items-center gap-1.5 font-semibold">
                {it.mark && <span className="dot" style={{ background: it.mark }} />}
                <span className="truncate">{it.label}</span>
              </span>
              <span className="h-2.5 rounded-r bg-[var(--surface-2)]" aria-hidden="true">
                <span className="block h-full rounded-r" style={{ width: `${(it.value / max) * 100}%`, background: color, minWidth: it.value > 0 ? 3 : 0 }} />
              </span>
              <span className="tnum text-right whitespace-nowrap">
                <b>{format(it.value)}</b>
                {it.sub && <span className="ml-1 text-[var(--ink-3)]">{it.sub}</span>}
              </span>
            </Row>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- One whole split into parts ---------- */

export interface Part {
  key: string;
  label: string;
  value: number;
  color: string;
}

export function SegmentedBar({ parts, tall, legend = true, format = (n: number) => n.toLocaleString('en-US') }: { parts: Part[]; tall?: boolean; legend?: boolean; format?: (n: number) => string }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  const { setTip, node } = useTip();
  const [ref, width] = useWidth<HTMLDivElement>();
  const share = (v: number) => (total ? Math.round((v / total) * 100) : 0);
  return (
    <div>
      <div
        ref={ref}
        role="img"
        aria-label={parts.map((p) => `${p.label} ${format(p.value)} (${share(p.value)}%)`).join(', ')}
        className={`relative flex gap-[2px] ${tall ? 'h-7' : 'h-2'}`}
        onMouseLeave={() => setTip(null)}
      >
        {parts
          .filter((p) => p.value > 0)
          .map((p) => {
            const w = total ? (p.value / total) * width : 0;
            const text = `${share(p.value)}%`;
            return (
              <div
                key={p.key}
                tabIndex={0}
                className={`relative flex items-center overflow-hidden outline-none ${tall ? 'rounded-[4px] px-2' : 'rounded-full'}`}
                style={{ flex: `${p.value} 0 0`, background: p.color }}
                onMouseEnter={(e) => setTip({ x: (e.currentTarget.offsetLeft ?? 0) + e.currentTarget.clientWidth / 2, y: 0, value: `${format(p.value)} (${text})`, label: p.label })}
                onFocus={(e) => setTip({ x: e.currentTarget.offsetLeft + e.currentTarget.clientWidth / 2, y: 0, value: `${format(p.value)} (${text})`, label: p.label })}
                onBlur={() => setTip(null)}
              >
                {tall && w > text.length * 8 + 16 && (
                  <span className={`text-xs font-bold ${p.color.includes('reserved') ? 'text-[#15191c]' : 'text-white'}`}>{text}</span>
                )}
              </div>
            );
          })}
        {node}
      </div>
      {legend && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--ink-2)]">
          {parts.map((p) => (
            <li key={p.key} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: p.color }} />
              {p.label} <b className="tnum text-[var(--ink)]">{format(p.value)}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Sequential ramp for heat maps ---------- */

/** One of the eight --heat-N steps for a value from 0 to max; 0 stays at the surface step. */
export function heatStep(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(7, 1 + Math.floor((value / max) * 6.999));
}
export const heatColor = (value: number, max: number) => `var(--heat-${heatStep(value, max)})`;
/** Text on a heat cell: near-black on the light steps, white on the dark ones. */
export const heatInk = (step: number) => (step >= 5 ? '#ffffff' : 'var(--ink)');

export function HeatLegend({ max, label }: { max: number; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-[var(--ink-2)]">
      <span>0</span>
      <span className="flex h-2.5 w-36 overflow-hidden rounded-full" aria-hidden="true">
        {[1, 2, 3, 4, 5, 6, 7].map((s) => (
          <span key={s} className="flex-1" style={{ background: `var(--heat-${s})` }} />
        ))}
      </span>
      <span className="tnum">{compact(max)}</span>
      <span>{label}</span>
    </div>
  );
}

/* ---------- A chart card that can show its numbers as a table ---------- */

export function ChartCard({
  title,
  children,
  table,
  action,
  className = '',
}: {
  title: string;
  children: ReactNode;
  /** Rows for the table view: first row is the header. */
  table?: (string | number)[][];
  action?: ReactNode;
  className?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={`card ${className}`}>
      <header className="flex min-h-12 items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-2">
        <h2 className="text-[15px] font-bold">{title}</h2>
        <div className="flex items-center gap-1">
          {action}
          {table && (
            <button type="button" onClick={() => setAsTable(!asTable)} className="rounded-lg px-2 py-1 text-xs font-semibold text-[var(--ink-2)] hover:bg-[var(--surface-2)]">
              {asTable ? ta.analytics.chart : ta.analytics.table}
            </button>
          )}
        </div>
      </header>
      <div className="p-4">
        {asTable && table ? (
          <div className="scroll-x max-h-80 overflow-y-auto">
            <table className="tnum w-full text-left text-[13px]">
              <thead className="sticky top-0 bg-[var(--surface)]">
                <tr>
                  {table[0].map((h, i) => (
                    <th key={i} className={`border-b border-[var(--line)] py-1.5 pr-3 font-semibold text-[var(--ink-2)] ${i ? 'text-right' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.slice(1).map((r, i) => (
                  <tr key={i} className="border-b border-[var(--line)] last:border-0">
                    {r.map((c, j) => (
                      <td key={j} className={`py-1.5 pr-3 ${j ? 'text-right' : ''}`}>
                        {typeof c === 'number' ? c.toLocaleString('en-US') : c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
