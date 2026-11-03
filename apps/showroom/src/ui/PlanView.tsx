// The flat's top view, crossfading over the dollhouse. Hotspots stay clickable on the plan.
import { useEffect, useMemo, useState } from 'react';
import { isPhone } from '@bair/ui';
import { blockById, interiors, mirroredInteriors, roomLabel, t } from '@bair/project-data';
import { useAppStore } from '../store/useAppStore';
import { PlanPicture } from './PlanPicture';

const SIDE_PANEL = 490;
const SCREEN_MARGIN = 16;
const TOP_SPACE = 84;
const BOTTOM_SPACE = 96;

function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const f = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return size;
}

/** Switches a flat between the 3D dollhouse and its top view. */
export function PlanSwitch() {
  const planMode = useAppStore((s) => s.planMode);
  const setPlanMode = useAppStore((s) => s.setPlanMode);
  return (
    <div className="plan-switch glass pointer-events-auto" role="group" aria-label={t.unit.plan}>
      <button type="button" aria-pressed={!planMode} onClick={() => setPlanMode(false)}>
        {t.unit.view3d}
      </button>
      <button type="button" aria-pressed={planMode} onClick={() => setPlanMode(true)}>
        {t.unit.plan}
      </button>
    </div>
  );
}

export function PlanView({ block, stack }: { block: string; stack: number }) {
  const planMode = useAppStore((s) => s.planMode);
  const navigate = useAppStore((s) => s.navigate);
  const minutes = useAppStore((s) => Math.round(s.time / 30) * 30);
  const { w, h } = useWindowSize();
  const st = blockById(block)!.stacks.find((s) => s.stack === stack)!;
  const layout = (st.mirror ? mirroredInteriors : interiors)[st.type];
  // Built on first use and kept while the flat is open, so switching back and forth is instant.
  const [opened, setOpened] = useState(planMode);
  useEffect(() => {
    if (planMode) setOpened(true);
  }, [planMode]);

  const pxPerMetre = useMemo(() => {
    const free = w - SCREEN_MARGIN * 2 - (isPhone() ? 0 : SIDE_PANEL);
    return Math.min(free / layout.width, (h - TOP_SPACE - BOTTOM_SPACE) / layout.depth);
  }, [w, h, layout]);

  return (
    <div className={`plan-view ${planMode ? 'is-on' : ''}`} aria-hidden={!planMode}>
      {opened && (
        <div className="plan-view__sheet" style={{ width: layout.width * pxPerMetre, height: layout.depth * pxPerMetre }}>
          <PlanPicture layout={layout} pxPerMetre={pxPerMetre} people={!isPhone()} minutes={minutes} turnDeg={st.rot} />
          <svg viewBox={`0 0 ${layout.width} ${layout.depth}`}>
            {layout.rooms.filter((r) => r.room !== 'acLedge').map((r) => {
              const q = [...r.rects].sort((a, b) => (b[2] - b[0]) * (b[3] - b[1]) - (a[2] - a[0]) * (a[3] - a[1]))[0];
              return (
                <text key={r.room} x={(q[0] + q[2]) / 2} y={(q[1] + q[3]) / 2} textAnchor="middle" fontSize={0.16} fontWeight={700} fill="#111" stroke="#fff" strokeWidth={0.05} paintOrder="stroke">
                  {roomLabel(layout.type, r.room)}
                </text>
              );
            })}
            {layout.hotspots.map((s) => (
              <g
                key={s.id}
                className="plan-view__dot"
                role="button"
                aria-label={roomLabel(layout.type, s.room)}
                onClick={() => {
                  useAppStore.getState().setPlanMode(false);
                  navigate({ view: 'unit', block, storey: storeyOf(), stack, spot: s.id });
                }}
              >
                <circle cx={s.x} cy={s.z} r={0.3} fill="transparent" />
                <circle cx={s.x} cy={s.z} r={0.13} fill="#fff" fillOpacity={0.92} stroke="#0006" strokeWidth={0.02} />
              </g>
            ))}
          </svg>
        </div>
      )}
    </div>
  );
}

const storeyOf = (): number => {
  const { route } = useAppStore.getState();
  return route.view === 'unit' ? route.storey : 2;
};
