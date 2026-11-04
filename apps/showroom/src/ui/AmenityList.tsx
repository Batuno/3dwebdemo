// Quick jumps between the outdoor standing points.
import { GlassPanel } from '@bair/ui';
import { outdoorSpots, t } from '@bair/project-data';
import { useAppStore } from '../store/useAppStore';

export function AmenityList({ current }: { current: string }) {
  const navigate = useAppStore((s) => s.navigate);
  return (
    <GlassPanel
      id="amenities"
      initialOnPhone="collapsed"
      title={t.nav.amenities}
      minimizeLabel={t.panel.minimize}
      expandLabel={t.panel.expand}
      closeLabel={t.panel.close}
      className="amenity-list pointer-events-auto"
      sheet
      tuck="right"
    >
      <ul>
        {outdoorSpots.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              aria-current={s.id === current}
              className={s.id === current ? 'is-active' : ''}
              onClick={() => navigate({ view: 'outdoor', spot: s.id })}
            >
              {t.amenity[s.labelKey]}
            </button>
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
}
