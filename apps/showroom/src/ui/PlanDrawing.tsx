// The flat as an architect draws it: walls, windows and fixed furniture in line, with no text and no render.
import { useMemo } from 'react';
import { wallPlan, type FurniturePiece, type InteriorLayout } from '@bair/project-data';

/** Wall-hung, decorative or loose pieces that would only clutter a plan. */
const LEFT_OUT = new Set<FurniturePiece['kind']>([
  'rug',
  'tv',
  'wallCabinet',
  'hood',
  'mirror',
  'mirrorCabinet',
  'dressingMirror',
  'artwork',
  'wallHooks',
  'wallShelf',
  'towelBar',
  'grabBar',
  'floorLamp',
  'deskLamp',
  'slidingPartition',
]);

const INK = '#22282d';
const FLOOR = '#f2eee6';
const LEDGE = '#fbfaf7';
const LINE = '#8f969c';

export function PlanDrawing({ layout }: { layout: InteriorLayout }) {
  const plan = useMemo(() => wallPlan(layout), [layout]);
  const pieces = useMemo(() => layout.furniture.filter((f) => !f.optional && f.y < 0.3 && !LEFT_OUT.has(f.kind)), [layout]);

  return (
    <svg className="plan-drawing" viewBox={`0 0 ${layout.width} ${layout.depth}`} role="img" aria-hidden="true">
      {layout.rooms.flatMap((r) =>
        r.rects.map((q, i) => (
          <rect key={`${r.room}${i}`} x={q[0]} y={q[1]} width={q[2] - q[0]} height={q[3] - q[1]} fill={r.room === 'acLedge' ? LEDGE : FLOOR} />
        )),
      )}
      <g fill="#fff" stroke={LINE} strokeWidth={0.015} strokeLinejoin="round">
        {pieces.map((f) => {
          const across = f.facing === 'e' || f.facing === 'w';
          const w = across ? f.d : f.w;
          const d = across ? f.w : f.d;
          return f.round ? (
            <ellipse key={f.id} cx={f.x} cy={f.z} rx={w / 2} ry={d / 2} />
          ) : (
            <rect key={f.id} x={f.x - w / 2} y={f.z - d / 2} width={w} height={d} rx={0.03} />
          );
        })}
      </g>
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
    </svg>
  );
}
