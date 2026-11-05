// The flat as a sales plan draws it: walls, windows and doors in line, each room named in Mongolian with its
// size and area, the way in, and the flat's overall dimensions. No furniture, so the rooms read at a glance.
import { useEffect, useMemo, useState } from 'react';
import { doorSwing, roomLabel, roomSpecs, t, wallPlan, type InteriorLayout, type Rect } from '@bair/project-data';

const INK = '#22282d';
const SOFT = '#5d656b';
const LINE = '#8f969c';
const FLOOR = '#f2eee6';
const WET = '#e9ecec';
const BARE = '#ebe8e2';
const LEDGE = '#fbfaf7';
const FONT = "'Manrope Variable', 'Inter', system-ui, sans-serif";

/** Paper around the walls, in metres, for the dimension lines and the way in. */
const MARGIN = 0.85;
/** Room labels keep this far inside the room's walls, in metres. */
const PAD = 0.14;
/** The smallest a label may shrink to, in metres. */
const MIN_FONT = 0.1;

export interface PlanFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The area the drawing covers, in metres: the walls plus the paper for dimensions. */
export function planFrame(layout: InteriorLayout): PlanFrame {
  const e = extents(layout);
  return { x: e[0] - MARGIN, y: e[1] - MARGIN, w: e[2] - e[0] + MARGIN * 2, h: e[3] - e[1] + MARGIN * 2 };
}

/** Outside face of the full-height walls, falling back to the rooms where a side has no wall. */
function extents(layout: InteriorLayout): Rect {
  const out: Rect = [0, 0, layout.width, layout.depth];
  for (const b of wallPlan(layout).boxes) {
    if (b.y0 !== 0 || b.y1 <= 2) continue;
    out[0] = Math.min(out[0], b.rect[0]);
    out[1] = Math.min(out[1], b.rect[1]);
    out[2] = Math.max(out[2], b.rect[2]);
    out[3] = Math.max(out[3], b.rect[3]);
  }
  return out;
}

/** Sizes always keep one decimal, the way the sales plans print them: 3.0 × 3.2 м. */
const fmt = (m: number) => m.toFixed(1);

let measureCtx: CanvasRenderingContext2D | null | undefined;
/** Text width in metres at a font size in metres. Falls back to an average glyph width without a canvas. */
function textWidth(text: string, size: number, weight: number): number {
  measureCtx ??= typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  if (!measureCtx) return text.length * size * 0.58;
  measureCtx.font = `${weight} 100px ${FONT}`;
  return (measureCtx.measureText(text).width / 100) * size;
}

/** Greedy word wrap to a width; a single word wider than the width keeps its own line. */
function wrap(text: string, size: number, weight: number, width: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(' ')) {
    const last = lines[lines.length - 1];
    if (last !== undefined && textWidth(`${last} ${word}`, size, weight) <= width) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

interface Label {
  x: number;
  y: number;
  size: number;
  name: string[];
  details: string[];
}

const LINE_GAP = 1.22;
const DETAIL = 0.82;

/**
 * Fits a room's name, size and area into its largest rectangle. Tries the full label first, then drops the size,
 * then the area, shrinking the text as needed, so small rooms like bathrooms keep at least their name.
 */
function fitLabel(name: string, size: string | null, area: string | null, box: Rect, base: number): Label {
  const w = box[2] - box[0] - PAD * 2;
  const h = box[3] - box[1] - PAD * 2;
  const variants = [[size, area], [area], []].map((d) => d.filter((x): x is string => !!x));
  const seen = new Set<string>();
  let last: Label | null = null;
  for (const details of variants) {
    const key = details.join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    for (let s = base; s >= MIN_FONT - 1e-6; s *= 0.9) {
      const lines = wrap(name, s, 700, w);
      const widest = Math.max(...lines.map((l) => textWidth(l, s, 700)), ...details.map((d) => textWidth(d, s * DETAIL, 600)));
      const height = (lines.length + details.length * DETAIL) * s * LINE_GAP;
      last = { x: (box[0] + box[2]) / 2, y: (box[1] + box[3]) / 2, size: s, name: lines, details };
      // Shrinking a full label below two thirds of the base reads worse than dropping a line of it.
      if (widest <= w && height <= h && (s >= base * 0.66 || details.length === 0)) return last;
    }
  }
  return last!;
}

function biggest(rects: Rect[]): Rect {
  return [...rects].sort((p, q) => (q[2] - q[0]) * (q[3] - q[1]) - (p[2] - p[0]) * (p[3] - p[1]))[0];
}

/** Redraws once the web font has loaded, since labels are fitted to its measured widths. */
function useFontsReady(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    document.fonts?.ready.then(() => live && setN((v) => v + 1));
    return () => {
      live = false;
    };
  }, []);
  return n;
}

export function PlanDrawing({ layout, pxPerMetre }: { layout: InteriorLayout; pxPerMetre: number }) {
  const plan = useMemo(() => wallPlan(layout), [layout]);
  const frame = useMemo(() => planFrame(layout), [layout]);
  const ext = useMemo(() => extents(layout), [layout]);
  const fonts = useFontsReady();

  // About 13 px on screen at the fitted size, within what the rooms can hold; zooming in enlarges it from there.
  const base = Math.min(0.3, Math.max(0.17, 13 / Math.max(1, pxPerMetre)));
  const labels = useMemo(() => {
    void fonts;
    const specs = roomSpecs[layout.type];
    return layout.rooms.map((r) => {
      const spec = specs.find((q) => q.room === r.room);
      const small = r.room === 'acLedge' || r.room === 'shelter' || r.room === 'service';
      return {
        room: r.room,
        label: fitLabel(
          roomLabel(layout.type, r.room),
          spec ? `${fmt(spec.w)} × ${fmt(spec.d)} ${t.unit.metre}` : null,
          spec ? `${fmt(spec.area)} ${t.unit.m2}` : null,
          biggest(r.rects),
          small ? base * 0.8 : base,
        ),
      };
    });
  }, [layout, base, fonts]);

  const entrance = layout.doors.find((d) => d.kind === 'entrance');
  const way = entrance ? doorSwing(entrance) : null;

  const dimY = ext[1] - MARGIN * 0.45;
  const dimX = ext[0] - MARGIN * 0.45;
  const tick = 0.09;
  const dimSize = base * 0.8;

  return (
    <svg className="plan-drawing" viewBox={`${frame.x} ${frame.y} ${frame.w} ${frame.h}`} role="img" aria-label={t.unit.plan}>
      {layout.rooms.flatMap((r) =>
        r.rects.map((q, i) => (
          <rect
            key={`${r.room}${i}`}
            x={q[0]}
            y={q[1]}
            width={q[2] - q[0]}
            height={q[3] - q[1]}
            fill={r.room === 'acLedge' ? LEDGE : r.floor === 'tile' ? WET : r.floor === 'concrete' ? BARE : FLOOR}
          />
        )),
      )}

      {/* Door swings: the open leaf and the arc it sweeps. */}
      <g fill="none" stroke={LINE} strokeWidth={0.012}>
        {layout.doors.map((d) => {
          const s = doorSwing(d);
          if (!s) return null;
          const ax = s.cx + s.closed[0] * s.r;
          const az = s.cz + s.closed[1] * s.r;
          const bx = s.cx + s.open[0] * s.r;
          const bz = s.cz + s.open[1] * s.r;
          const sweep = s.closed[0] * s.open[1] - s.closed[1] * s.open[0] > 0 ? 1 : 0;
          return (
            <g key={d.id}>
              <path d={`M ${ax} ${az} A ${s.r} ${s.r} 0 0 ${sweep} ${bx} ${bz}`} strokeDasharray="0.05 0.035" />
              <line x1={s.cx} y1={s.cz} x2={bx} y2={bz} stroke={INK} strokeWidth={0.025} />
            </g>
          );
        })}
      </g>
      {plan.doors.map((d) => {
        const door = layout.doors.find((q) => q.id === d.id);
        if (door?.kind !== 'sliding') return null;
        const [x0, z0, x1, z1] = d.rect;
        const along = door.axis === 'x';
        const mid = along ? (z0 + z1) / 2 : (x0 + x1) / 2;
        const o = 0.025;
        return along ? (
          <g key={d.id} stroke={INK} strokeWidth={0.02}>
            <line x1={x0} x2={(x0 + x1) / 2 + 0.05} y1={mid - o} y2={mid - o} />
            <line x1={(x0 + x1) / 2 - 0.05} x2={x1} y1={mid + o} y2={mid + o} />
          </g>
        ) : (
          <g key={d.id} stroke={INK} strokeWidth={0.02}>
            <line y1={z0} y2={(z0 + z1) / 2 + 0.05} x1={mid - o} x2={mid - o} />
            <line y1={(z0 + z1) / 2 - 0.05} y2={z1} x1={mid + o} x2={mid + o} />
          </g>
        );
      })}

      {plan.boxes
        .filter((b) => b.y0 === 0 && b.y1 > 2)
        .map((b, i) => (
          <rect key={i} x={b.rect[0]} y={b.rect[1]} width={b.rect[2] - b.rect[0]} height={b.rect[3] - b.rect[1]} fill={INK} />
        ))}
      {plan.windows.map((w) => {
        const [x0, z0, x1, z1] = w.rect;
        const along = w.side === 'n' || w.side === 's';
        return (
          <g key={w.id}>
            <rect x={x0} y={z0} width={x1 - x0} height={z1 - z0} fill="#fff" stroke={INK} strokeWidth={0.02} />
            {along ? (
              <line x1={x0} x2={x1} y1={(z0 + z1) / 2} y2={(z0 + z1) / 2} stroke={INK} strokeWidth={0.015} />
            ) : (
              <line x1={(x0 + x1) / 2} x2={(x0 + x1) / 2} y1={z0} y2={z1} stroke={INK} strokeWidth={0.015} />
            )}
          </g>
        );
      })}

      {/* Room names, sizes and areas. */}
      <g fontFamily={FONT} textAnchor="middle" style={{ fontKerning: 'normal' }}>
        {labels.map(({ room, label }) => {
          const lineH = label.size * LINE_GAP;
          const total = (label.name.length + label.details.length * DETAIL) * lineH;
          let y = label.y - total / 2 + label.size * 0.92;
          return (
            <text key={room} x={label.x} fill={INK}>
              {label.name.map((line, i) => {
                const at = y;
                y += lineH;
                return (
                  <tspan key={`n${i}`} x={label.x} y={at} fontSize={label.size} fontWeight={700}>
                    {line}
                  </tspan>
                );
              })}
              {label.details.map((line, i) => {
                const at = y + (i === 0 ? lineH * 0.06 : 0);
                y += lineH * DETAIL;
                return (
                  <tspan key={`d${i}`} x={label.x} y={at} fontSize={label.size * DETAIL} fontWeight={600} fill={SOFT}>
                    {line}
                  </tspan>
                );
              })}
            </text>
          );
        })}
      </g>

      {/* The way in: an arrow outside the front door, pointing the way the door opens. */}
      {entrance && way && (
        <g>
          {(() => {
            const [ox, oz] = way.open;
            const cx = entrance.at[0] - ox * 0.42;
            const cz = entrance.at[1] - oz * 0.42;
            const px = -oz;
            const pz = ox;
            const a = 0.13;
            const tip = [cx + ox * a, cz + oz * a];
            const l = [cx - ox * a + px * a, cz - oz * a + pz * a];
            const r = [cx - ox * a - px * a, cz - oz * a - pz * a];
            const tx = entrance.at[0] - ox * 0.72;
            const tz = entrance.at[1] - oz * 0.72 + dimSize * 0.35;
            return (
              <>
                <path d={`M ${tip[0]} ${tip[1]} L ${l[0]} ${l[1]} L ${r[0]} ${r[1]} Z`} fill={INK} />
                <text x={tx} y={tz} fontFamily={FONT} fontSize={dimSize} fontWeight={800} fill={INK} textAnchor="middle">
                  {t.unit.planEntrance}
                </text>
              </>
            );
          })()}
        </g>
      )}

      {/* Overall width along the top and depth down the left, outside face to outside face. */}
      <g stroke={SOFT} strokeWidth={0.012} fill="none">
        <line x1={ext[0]} x2={ext[2]} y1={dimY} y2={dimY} />
        <line x1={ext[0]} x2={ext[0]} y1={dimY - tick} y2={dimY + tick} />
        <line x1={ext[2]} x2={ext[2]} y1={dimY - tick} y2={dimY + tick} />
        <line x1={ext[0] - tick * 0.7} x2={ext[0] + tick * 0.7} y1={dimY + tick * 0.7} y2={dimY - tick * 0.7} strokeWidth={0.02} />
        <line x1={ext[2] - tick * 0.7} x2={ext[2] + tick * 0.7} y1={dimY + tick * 0.7} y2={dimY - tick * 0.7} strokeWidth={0.02} />
        <line y1={ext[1]} y2={ext[3]} x1={dimX} x2={dimX} />
        <line y1={ext[1]} y2={ext[1]} x1={dimX - tick} x2={dimX + tick} />
        <line y1={ext[3]} y2={ext[3]} x1={dimX - tick} x2={dimX + tick} />
        <line x1={dimX - tick * 0.7} x2={dimX + tick * 0.7} y1={ext[1] + tick * 0.7} y2={ext[1] - tick * 0.7} strokeWidth={0.02} />
        <line x1={dimX - tick * 0.7} x2={dimX + tick * 0.7} y1={ext[3] + tick * 0.7} y2={ext[3] - tick * 0.7} strokeWidth={0.02} />
      </g>
      <g fontFamily={FONT} fontSize={dimSize} fontWeight={700} fill={SOFT} textAnchor="middle">
        <text x={(ext[0] + ext[2]) / 2} y={dimY - dimSize * 0.45}>
          {`${fmt(ext[2] - ext[0])} ${t.unit.metre}`}
        </text>
        <text
          x={dimX - dimSize * 0.45}
          y={(ext[1] + ext[3]) / 2}
          transform={`rotate(-90 ${dimX - dimSize * 0.45} ${(ext[1] + ext[3]) / 2})`}
        >
          {`${fmt(ext[3] - ext[1])} ${t.unit.metre}`}
        </text>
      </g>
    </svg>
  );
}
