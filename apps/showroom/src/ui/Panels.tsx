import { useMemo } from 'react';
import { unitTypeOrder, unitTypes } from '@bair/project-data';
import { t } from '@bair/project-data';
import { formatPriceShort, unitNumber } from '@bair/project-data';
import { countStatuses, unitsOnFloor } from '@bair/project-data';
import { useAppStore } from '../store/useAppStore';
import { Panel } from './common';

/* ---------- Floor view ---------- */

export function FloorPanel({ block, storey }: { block: string; storey: number }) {
  const colorBy = useAppStore((s) => s.colorBy);
  const setColorBy = useAppStore((s) => s.setColorBy);
  const navigate = useAppStore((s) => s.navigate);
  const hoverStack = useAppStore((s) => s.hover.stack);
  const setHover = useAppStore((s) => s.setHover);
  const tick = useAppStore((s) => s.inventoryTick);
  // A new array on every live update, so the counts below follow too.
  const units = useMemo(() => [...unitsOnFloor(block, storey)], [block, storey, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const c = useMemo(() => countStatuses(units), [units]);
  return (
    <Panel id="floor-units" initialOnPhone="collapsed" side="left" width="md:w-[320px]" title={t.floor.title(storey)}>
      <div className="mb-3 flex items-center gap-3 text-[12px] font-semibold">
        <span className="flex items-center gap-1">
          <span className="dot status-available" />
          {c.available}
        </span>
        <span className="flex items-center gap-1">
          <span className="dot status-reserved" />
          {c.reserved}
        </span>
        <span className="flex items-center gap-1">
          <span className="dot status-sold" />
          {c.sold}
        </span>
      </div>
      <div className="mb-3 flex items-center gap-1 rounded-xl bg-black/[0.05] p-1" role="group" aria-label={t.floor.colorBy}>
        {(['type', 'status'] as const).map((k) => (
          <button
            type="button"
            key={k}
            onClick={() => setColorBy(k)}
            className={`min-h-9 flex-1 rounded-lg text-xs font-semibold ${colorBy === k ? 'bg-white/30 shadow-sm' : ''}`}
          >
            {k === 'type' ? t.floor.byType : t.floor.byStatus}
          </button>
        ))}
      </div>
      {colorBy === 'type' && (
        <ul className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px] font-medium">
          {unitTypeOrder.map((id) => (
            <li key={id} className="flex items-center gap-1.5">
              <span className="h-3 w-3 flex-none rounded-[4px]" style={{ background: unitTypes[id].color }} />
              {t.unitType[id]}
            </li>
          ))}
        </ul>
      )}
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-1">
        {units.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              onPointerEnter={() => setHover({ stack: u.stack })}
              onPointerLeave={() => setHover({ stack: null })}
              onClick={() => navigate({ view: 'unit', block, storey, stack: u.stack })}
              className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${
                hoverStack === u.stack ? 'bg-black/[0.08]' : 'hover:bg-black/5'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className={`dot status-${u.status}`} />
                <span className="font-bold whitespace-nowrap">{unitNumber(storey, u.stack)}</span>
                <span className="truncate text-[var(--ink-soft)]">{t.unitType[u.type]}</span>
              </span>
              <span className="font-semibold whitespace-nowrap">
                  {u.price < u.listPrice && <span className="sale-badge mr-1">%</span>}
                  {formatPriceShort(u.price)}
                </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11.5px] text-[var(--ink-soft)]">{t.floor.hint}</p>
    </Panel>
  );
}
