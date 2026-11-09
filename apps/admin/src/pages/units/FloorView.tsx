import { useMemo, type KeyboardEvent, type MouseEvent } from 'react';
import { planToLocal, t, ta, unitNumber, unitXform, type BlockDef, type Rect, type Vec2 } from '@bair/project-data';
import { money } from '../../lib/format';
import { typeName } from '../../lib/labels';
import type { UnitsResponse, UnitView } from '../../lib/types';
import { Icon } from '../../ui/icons';
import { Button } from '../../ui/kit';
import { describeUnit, unitColors, type ColorBy } from './look';

const U = ta.units;
const STATUSES = ['available', 'reserved', 'sold'] as const;
/** Clear space around the drawing, in metres. */
const MARGIN = 2;
const CORRIDOR_WIDTH = 2.5;

const points = (ps: Vec2[]) => ps.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');

/** A flat's rooms and the block's shared parts in block-local metres. Rooms keep the gaps between them, which read as walls. */
function planShapes(def: BlockDef) {
  const stacks = def.stacks.map((s) => {
    const xf = unitXform(def, s);
    const corners = ([x0, z0, x1, z1]: Rect): Vec2[] => [xf.point(x0, z0), xf.point(x1, z0), xf.point(x1, z1), xf.point(x0, z1)];
    const rooms = xf.layout.rooms.flatMap((r) => r.rects.map((rect) => ({ ledge: r.room === 'acLedge', corners: corners(rect) })));
    return { stack: s.stack, center: xf.center, rooms };
  });
  const corridor = def.corridor.map((p) => planToLocal(def, p));
  const box = (b: { at: Vec2; size: Vec2; rot?: number }) => {
    const c = planToLocal(def, b.at);
    return { c, w: b.size[0] / def.plan.pxPerMetre, d: b.size[1] / def.plan.pxPerMetre, rot: b.rot ?? 0 };
  };
  const all = [...stacks.flatMap((s) => s.rooms.flatMap((r) => r.corners)), ...corridor];
  const xs = all.map((p) => p[0]);
  const zs = all.map((p) => p[1]);
  const [x, z] = [Math.min(...xs) - MARGIN, Math.min(...zs) - MARGIN];
  return {
    stacks,
    corridor,
    core: box(def.liftCore),
    stairs: def.stairs.map(box),
    roofs: def.secondStoreyRoofs.map(box),
    viewBox: `${x.toFixed(1)} ${z.toFixed(1)} ${(Math.max(...xs) + MARGIN - x).toFixed(1)} ${(Math.max(...zs) + MARGIN - z).toFixed(1)}`,
  };
}

interface Look {
  colorBy: ColorBy;
  interest: UnitsResponse['interest'];
  maxVisitors: number;
}

/** Each floor of the block as a row of small squares, one per flat, so the whole building reads at a glance. */
function FloorList({ def, storeys, at, storey, onStorey, look }: { def: BlockDef; storeys: number[]; at: Map<string, UnitView>; storey: number; onStorey: (n: number) => void; look: Look }) {
  return (
    <nav aria-label={t.block.pick} className="card max-h-[260px] overflow-y-auto p-2 lg:max-h-none">
      <ul className="flex flex-col gap-0.5">
        {storeys.map((s) => {
          const flats = def.stacks.map((c) => at.get(`${s}-${c.stack}`)).filter((u): u is UnitView => !!u);
          const counts = (status: string) => flats.filter((u) => u.status === status).length;
          return (
            <li key={s}>
              <button
                type="button"
                aria-current={s === storey ? 'true' : undefined}
                title={t.block.hoverTip(s, counts('available'), counts('sold'))}
                onClick={() => onStorey(s)}
                className={`flex w-full items-center gap-2 rounded-md px-1.5 py-1 hover:bg-[var(--surface-2)] ${s === storey ? 'bg-[var(--surface-2)] outline-2 outline-offset-[-2px] outline-[var(--accent)] outline-solid' : ''}`}
              >
                <span className={`tnum w-6 text-right text-xs ${s === storey ? 'font-extrabold' : 'font-semibold text-[var(--ink-2)]'}`}>{s}</span>
                <span className="flex flex-1 gap-[2px]" aria-hidden="true">
                  {flats.map((u) => (
                    <span key={u.id} className="h-3 min-w-0 flex-1 rounded-[2px]" style={{ background: unitColors(u, look.colorBy, look.interest[u.id]?.visitors ?? 0, look.maxVisitors).fill }} />
                  ))}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The floor's real plan: every flat in its own shape and place, coloured, with its number on it. */
function FloorPlanDrawing({ def, storey, at, selected, onCell, look }: { def: BlockDef; storey: number; at: Map<string, UnitView>; selected: Set<string>; onCell: (u: UnitView, e: MouseEvent) => void; look: Look }) {
  const plan = useMemo(() => planShapes(def), [def]);
  const onKey = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    e.currentTarget.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  };
  return (
    <div className="scroll-x">
      <svg viewBox={plan.viewBox} className="block w-full min-w-[640px]" role="group" aria-label={t.floor.title(storey)}>
        <polyline points={points(plan.corridor)} fill="none" stroke="var(--surface-2)" strokeWidth={CORRIDOR_WIDTH} strokeLinejoin="round" />
        {plan.stairs.map((b, i) => (
          <rect key={i} x={b.c[0] - b.w / 2} y={b.c[1] - b.d / 2} width={b.w} height={b.d} fill="var(--line)" />
        ))}
        {storey === 2 &&
          plan.roofs.map((b, i) => (
            <rect key={i} x={b.c[0] - b.w / 2} y={b.c[1] - b.d / 2} width={b.w} height={b.d} fill="var(--surface-2)" transform={`rotate(${-b.rot} ${b.c[0]} ${b.c[1]})`}>
              <title>{t.floor.secondStoreyRoof}</title>
            </rect>
          ))}
        <g transform={`rotate(${-plan.core.rot} ${plan.core.c[0]} ${plan.core.c[1]})`}>
          <rect x={plan.core.c[0] - plan.core.w / 2} y={plan.core.c[1] - plan.core.d / 2} width={plan.core.w} height={plan.core.d} fill="var(--line)" />
        </g>
        <text x={plan.core.c[0]} y={plan.core.c[1]} textAnchor="middle" dominantBaseline="middle" fontSize={1} fontWeight={600} fill="var(--ink-2)">
          {t.floor.lobby}
        </text>
        {plan.stacks.map((s) => {
          const u = at.get(`${storey}-${s.stack}`);
          if (!u) {
            // No flat here on this floor, such as the facilities on storey 2 of 804B.
            return <g key={s.stack}>{s.rooms.map((r, i) => <polygon key={i} points={points(r.corners)} fill="var(--surface-2)" />)}</g>;
          }
          const visitors = look.interest[u.id]?.visitors ?? 0;
          const { fill, ink } = unitColors(u, look.colorBy, visitors, look.maxVisitors);
          const isSel = selected.has(u.id);
          const sale = u.price < u.listPrice;
          const detail = look.colorBy === 'interest' ? U.visitorsShort(visitors) : look.colorBy === 'type' ? U.typeShort[u.type] : U.millionShort(Math.round(u.price / 1_000_000));
          const [cx, cz] = s.center;
          return (
            <g key={s.stack} className="plan-unit" role="button" tabIndex={0} aria-pressed={isSel} aria-label={describeUnit(u, visitors)} onClick={(e) => onCell(u, e)} onKeyDown={onKey}>
              <title>{describeUnit(u, visitors)}</title>
              {/* A selected flat gets one outline around its whole shape, drawn behind the rooms. */}
              {isSel && s.rooms.map((r, i) => <polygon key={i} points={points(r.corners)} fill="var(--ink)" stroke="var(--ink)" strokeWidth={0.7} strokeLinejoin="round" />)}
              {s.rooms.map((r, i) => (
                <polygon key={i} points={points(r.corners)} fill={fill} fillOpacity={r.ledge && !isSel ? 0.45 : 1} />
              ))}
              <g style={{ paintOrder: 'stroke' }} stroke={fill} strokeWidth={0.35} strokeLinejoin="round" textAnchor="middle" fill={ink} pointerEvents="none">
                <text x={cx} y={cz - 0.25} fontSize={1.9} fontWeight={800}>
                  {s.stack}
                </text>
                <text x={cx} y={cz + 1.35} fontSize={1.25} fontWeight={600}>
                  {detail}
                </text>
              </g>
              {sale && (
                <g pointerEvents="none">
                  <circle cx={cx + 3.2} cy={cz - 1.9} r={0.95} fill="var(--danger)" />
                  <text x={cx + 3.2} y={cz - 1.9} textAnchor="middle" dominantBaseline="central" fontSize={1.2} fontWeight={800} fill="#fff">
                    %
                  </text>
                </g>
              )}
              {isSel && (
                <g pointerEvents="none">
                  <circle cx={cx - 3.2} cy={cz - 1.9} r={0.95} fill="var(--ink)" />
                  <path d={`M${cx - 3.65} ${cz - 1.9}l.35.4.8-.8`} fill="none" stroke="var(--bg)" strokeWidth={0.28} />
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** The flats page's main view: pick a floor from the building on the left, see its flats on the plan and as cards. */
export function FloorView({
  def,
  units,
  colorBy,
  interest,
  maxVisitors,
  selected,
  storey,
  onStorey,
  canSelectAll,
  onCell,
  onMany,
}: Look & {
  def: BlockDef;
  units: UnitView[];
  selected: Set<string>;
  storey: number;
  onStorey: (n: number) => void;
  canSelectAll: boolean;
  onCell: (u: UnitView, e: MouseEvent) => void;
  onMany: (ids: string[]) => void;
}) {
  const look = { colorBy, interest, maxVisitors };
  const storeys = useMemo(() => [...new Set(units.map((u) => u.storey))].sort((a, b) => b - a), [units]);
  const at = useMemo(() => new Map(units.map((u) => [`${u.storey}-${u.stack}`, u])), [units]);
  const flats = def.stacks.map((c) => at.get(`${storey}-${c.stack}`)).filter((u): u is UnitView => !!u);
  const index = storeys.indexOf(storey);
  return (
    <div className="grid items-start gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
      <FloorList def={def} storeys={storeys} at={at} storey={storey} onStorey={onStorey} look={look} />
      <section className="card p-3" aria-label={t.floor.title(storey)}>
        <header className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
          <div className="flex items-center gap-1.5">
            <Button small aria-label={t.nav.floorDown} title={t.nav.floorDown} disabled={index >= storeys.length - 1} onClick={() => onStorey(storeys[index + 1])}>
              <span className="inline-flex rotate-90">
                <Icon name="arrow" size={15} />
              </span>
            </Button>
            <Button small aria-label={t.nav.floorUp} title={t.nav.floorUp} disabled={index <= 0} onClick={() => onStorey(storeys[index - 1])}>
              <span className="inline-flex -rotate-90">
                <Icon name="arrow" size={15} />
              </span>
            </Button>
          </div>
          <h2 className="text-base font-extrabold">{t.nav.storey(storey)}</h2>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-[var(--ink-2)]">
            {STATUSES.map((s) => (
              <li key={s} className="flex items-center gap-1.5">
                <span className="dot" style={{ background: `var(--st-${s})` }} />
                <b className="tnum text-[var(--ink)]">{flats.filter((u) => u.status === s).length}</b>
              </li>
            ))}
          </ul>
          {canSelectAll && (
            <Button small className="ml-auto" onClick={() => onMany(flats.map((u) => u.id))}>
              {U.selectRow(storey)}
            </Button>
          )}
        </header>
        <FloorPlanDrawing def={def} storey={storey} at={at} selected={selected} onCell={onCell} look={look} />
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {flats.map((u) => {
            const isSel = selected.has(u.id);
            const visitors = interest[u.id]?.visitors ?? 0;
            return (
              <li key={u.id}>
                <button
                  type="button"
                  aria-pressed={isSel}
                  title={describeUnit(u, visitors)}
                  onClick={(e) => onCell(u, e)}
                  className={`flex w-full items-center gap-2.5 rounded-lg border bg-[var(--surface)] p-2 text-left hover:bg-[var(--surface-2)] ${isSel ? 'border-[var(--ink)]' : 'border-[var(--line)]'}`}
                >
                  <span className="h-9 w-1.5 flex-none rounded-full" style={{ background: unitColors(u, colorBy, visitors, maxVisitors).fill }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[13px] font-bold">
                      {unitNumber(u.storey, u.stack)}
                      {isSel && <Icon name="check" size={13} />}
                      {u.price < u.listPrice && <span className="text-xs font-extrabold text-[var(--danger)]">−{Math.round((1 - u.price / u.listPrice) * 100)}%</span>}
                    </span>
                    <span className="block truncate text-xs text-[var(--ink-2)]">
                      {typeName(u.type)} · {u.totalArea} м²
                    </span>
                    <span className="tnum block text-xs font-semibold">{money(u.price)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
