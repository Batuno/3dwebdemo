// The thin storey scale beside the tower. Positions come from FloorTickProjector inside the canvas.
import { useMemo } from 'react';
import { blockById, countStatuses, t, unitsOnFloor } from '@bair/project-data';
import { useAppStore } from '../store/useAppStore';

export const tickElements = new Map<number, HTMLElement>();

export function FloorTicks({ block, current }: { block: string; current: number }) {
  const def = blockById(block)!;
  const navigate = useAppStore((s) => s.navigate);
  const setHover = useAppStore((s) => s.setHover);
  const hovered = useAppStore((s) => s.hover.storey);
  const active = hovered ?? current;
  const tick = useAppStore((s) => s.inventoryTick);
  const storeys = useMemo(() => {
    const out: { n: number; empty: boolean }[] = [];
    for (let n = 2; n <= def.storeys; n++) {
      out.push({ n, empty: countStatuses(unitsOnFloor(def.id, n)).available === 0 });
    }
    return out;
  }, [def, tick]); // eslint-disable-line react-hooks/exhaustive-deps -- live statuses change the units in place
  return (
    <div className="floor-ticks" role="group" aria-label={t.block.storey}>
      {storeys.map(({ n, empty }) => (
        <button
          type="button"
          key={n}
          ref={(el) => {
            if (el) tickElements.set(n, el);
            else tickElements.delete(n);
          }}
          className={`floor-tick ${n === active ? 'is-active' : ''} ${empty ? 'is-empty' : ''}`}
          aria-label={t.nav.storey(n)}
          aria-current={n === current}
          onPointerEnter={() => setHover({ storey: n })}
          onPointerLeave={() => setHover({ storey: null })}
          onClick={() => navigate({ view: 'floor', block, storey: n })}
        >
          <span className="floor-tick__line" />
          <span className="floor-tick__number">{n}</span>
        </button>
      ))}
    </div>
  );
}
