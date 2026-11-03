// Dev overlay: room outlines and dimensions, door swings, clearance zones, routes and hotspot directions.
// Reads the same geometry and rule code as the Vitest suite, so what it shows is what the tests measure.
import { useMemo } from 'react';
import {
  boxOf,
  canPass,
  checkLayout,
  exceptions,
  footprint,
  roomLabel,
  roomSpecs,
  swingSamples,
  wallPlan,
  type Facing,
  type FurniturePiece,
  type InteriorLayout,
} from '@bair/project-data';

const CLEARANCE: Partial<Record<FurniturePiece['kind'], number>> = {
  wardrobeSliding: 0.7,
  wardrobeHinged: 0.9,
  counter: 1.0,
  fridge: 0.9,
  wc: 0.6,
  desk: 0.8,
};

const zoneRect = (p: FurniturePiece, depth: number) => {
  const { sx, sz } = footprint(p);
  const x0 = p.x - sx / 2;
  const z0 = p.z - sz / 2;
  const by: Record<Facing, [number, number, number, number]> = {
    n: [x0, z0 - depth, sx, depth],
    s: [x0, z0 + sz, sx, depth],
    w: [x0 - depth, z0, depth, sz],
    e: [x0 + sx, z0, depth, sz],
  };
  return by[p.facing];
};

export function DebugPlan({ layout, scale = 56 }: { layout: InteriorLayout; scale?: number }) {
  const plan = useMemo(() => wallPlan(layout), [layout]);
  const violations = useMemo(() => checkLayout(layout, roomSpecs[layout.type]), [layout]);
  const known = useMemo(() => new Set(exceptions.map((e) => e.key)), []);
  const margin = 0.15;
  const vb = `${-margin} ${-margin} ${layout.width + margin * 2} ${layout.depth + margin * 2}`;
  return (
    <div data-testid="debug-plan" style={{ color: '#17201c', font: '12px/1.4 Manrope Variable, system-ui, sans-serif' }}>
      <svg viewBox={vb} width={(layout.width + margin * 2) * scale} height={(layout.depth + margin * 2) * scale} style={{ background: '#fff', display: 'block' }}>
        {plan.boxes.filter((b) => b.y0 === 0 && b.y1 > 2).map((b, i) => (
          <rect key={i} x={b.rect[0]} y={b.rect[1]} width={b.rect[2] - b.rect[0]} height={b.rect[3] - b.rect[1]} fill="#111" />
        ))}
        {plan.windows.map((w) => (
          <rect key={w.id} x={w.rect[0]} y={w.rect[1]} width={w.rect[2] - w.rect[0]} height={w.rect[3] - w.rect[1]} fill="#7fc4d8" />
        ))}
        {layout.rooms.flatMap((r) =>
          r.rects.map((q, i) => <rect key={`${r.room}${i}`} x={q[0]} y={q[1]} width={q[2] - q[0]} height={q[3] - q[1]} fill="#fbf8f2" stroke="#b9ad98" strokeWidth={0.01} />),
        )}
        {layout.furniture.filter((p) => CLEARANCE[p.kind]).map((p) => {
          const [x, y, w, h] = zoneRect(p, CLEARANCE[p.kind]!);
          return <rect key={`z-${p.room}-${p.id}`} x={x} y={y} width={w} height={h} fill="#3f9d69" opacity={0.16} />;
        })}
        {layout.furniture.filter((p) => p.y < 1).map((p) => {
          const b = boxOf(p);
          const fill = p.kind === 'rug' ? '#ece4d3' : p.blocks ? '#d7b98f' : '#c7d6df';
          return p.round ? (
            <circle key={`${p.room}-${p.id}`} cx={p.x} cy={p.z} r={p.w / 2} fill={fill} stroke="#5c4a33" strokeWidth={0.012} />
          ) : (
            <rect key={`${p.room}-${p.id}`} x={b.x0} y={b.z0} width={b.x1 - b.x0} height={b.z1 - b.z0} fill={fill} stroke="#5c4a33" strokeWidth={0.012} />
          );
        })}
        {layout.doors.map((d) => {
          const pts = swingSamples(d);
          return (
            <g key={d.id}>
              {pts.filter((_, i) => i % 9 === 0).map(([x, z], i) => <circle key={i} cx={x} cy={z} r={0.008} fill="#c2563f" />)}
              {d.kind === 'opening' && <circle cx={d.at[0]} cy={d.at[1]} r={0.04} fill="#3f9d69" />}
            </g>
          );
        })}
        {layout.routes.map((r) => {
          const ok = canPass(layout, r.from, r.to, r.width);
          return <line key={r.id} x1={r.from[0]} y1={r.from[1]} x2={r.to[0]} y2={r.to[1]} stroke={ok ? '#2a7d4f' : '#d21f1f'} strokeWidth={0.03} strokeDasharray="0.1 0.06" />;
        })}
        {layout.hotspots.map((h) => {
          const rad = (h.yaw * Math.PI) / 180;
          const color = h.kind === 'window' ? '#1d6fb8' : '#6a35b0';
          return (
            <g key={h.id}>
              <line x1={h.x} y1={h.z} x2={h.x + Math.sin(rad) * 0.42} y2={h.z - Math.cos(rad) * 0.42} stroke={color} strokeWidth={0.025} />
              <circle cx={h.x} cy={h.z} r={0.07} fill={color} />
            </g>
          );
        })}
        {layout.rooms.map((r) => {
          const q = r.rects[0];
          return (
            <text key={r.room} x={q[0] + 0.06} y={q[1] + 0.17} fontSize={0.13} fontWeight={700} fill="#1b2a24">
              {roomLabel(layout.type, r.room)} {(q[2] - q[0]).toFixed(2)} × {(q[3] - q[1]).toFixed(2)}
            </text>
          );
        })}
      </svg>
      <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none' }}>
        {violations.length === 0 && <li>Зөрчил алга</li>}
        {violations.map((v, i) => (
          <li key={i} style={{ color: known.has(v.key) ? '#9a6400' : '#d21f1f' }}>
            {known.has(v.key) ? '○' : '●'} {v.rule}: {v.subject} ({v.actual} / {v.required} м)
          </li>
        ))}
      </ul>
    </div>
  );
}
