// "Choose your floor": big level number, what is available there, and the way in.
import { useEffect, useMemo } from 'react';
import { GlassPanel } from '@bair/ui';
import { blockById, formatPriceShort, fromPrice, t, unitTypeOrder, unitTypes, unitsOnFloor } from '@bair/project-data';
import { useAppStore } from '../store/useAppStore';
import { IconDown, IconUp } from './icons';

export function FloorSelect({ block }: { block: string }) {
  const def = blockById(block)!;
  const selected = useAppStore((s) => s.selectedStorey);
  const setSelected = useAppStore((s) => s.setSelectedStorey);
  const hovered = useAppStore((s) => s.hover.storey);
  const navigate = useAppStore((s) => s.navigate);
  const storey = hovered ?? selected;

  const rows = useMemo(() => {
    const units = unitsOnFloor(block, storey);
    return unitTypeOrder
      .map((type) => {
        const list = units.filter((u) => u.type === type);
        return {
          type,
          area: unitTypes[type].totalArea,
          available: list.filter((u) => u.status === 'available').length,
          from: list.length ? fromPrice(list) : 0,
          count: list.length,
        };
      })
      .filter((r) => r.count > 0);
  }, [block, storey]);

  const step = (d: number) => setSelected(Math.min(def.storeys, Math.max(2, storey + d)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        step(1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        step(-1);
      } else if (e.key === 'Enter' && target.tagName !== 'BUTTON') {
        navigate({ view: 'floor', block, storey });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <GlassPanel
      id="floor-select"
      initialOnPhone="collapsed"
      title={t.block.choose}
      pill={`${t.block.storey} ${storey}`}
      minimizeLabel={t.panel.minimize}
      expandLabel={t.panel.expand}
      closeLabel={t.panel.close}
      className="floor-select pointer-events-auto"
    >
      <div className="floor-select__level">
        <span className="floor-select__number">{storey}</span>
        <span className="floor-select__unit">{t.block.storey}</span>
        <span className="floor-select__steps">
          <button type="button" className="glass-icon-btn" aria-label={t.nav.floorUp} onClick={() => step(1)}>
            <IconUp />
          </button>
          <button type="button" className="glass-icon-btn" aria-label={t.nav.floorDown} onClick={() => step(-1)}>
            <IconDown />
          </button>
        </span>
      </div>
      <p className="floor-select__help">{t.block.help}</p>
      <ul className="floor-select__types">
        {rows.map((r) => (
          <li key={r.type} className={r.available === 0 ? 'is-empty' : ''}>
            <span>
              {t.unitType[r.type]} · {r.area} {t.unit.m2}
            </span>
            <span>
              {t.status.availableCount(r.available)} · {t.price.from(formatPriceShort(r.from))}
            </span>
          </li>
        ))}
      </ul>
      <input
        type="range"
        className="floor-select__slider"
        min={2}
        max={def.storeys}
        value={storey}
        aria-label={t.block.storey}
        onChange={(e) => setSelected(Number(e.target.value))}
      />
      <button type="button" className="floor-select__go" onClick={() => navigate({ view: 'floor', block, storey })}>
        {t.block.enter}
      </button>
    </GlassPanel>
  );
}
