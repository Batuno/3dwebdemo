// The unit plan with every hotspot, the current position, and a cone that turns as you look around.
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { GlassPanel } from '@bair/ui';
import { blockById, interiors, mirroredInteriors, roomLabel, t, unitTypes, wallPlan } from '@bair/project-data';
import { rendersBase } from '../lib/renderManifest';
import { povState } from '../scene/unit/povState';
import { useAppStore } from '../store/useAppStore';

const TopViewCanvas = lazy(() => import('../scene/unit/TopViewScene').then((m) => ({ default: m.TopViewCanvas })));

const WIDTH_PX = 248;

export function Minimap({ block, stack, spot }: { block: string; stack: number; spot?: string }) {
  const st = blockById(block)!.stacks.find((s) => s.stack === stack)!;
  const layout = (st.mirror ? mirroredInteriors : interiors)[st.type];
  const plan = useMemo(() => wallPlan(layout), [layout]);
  const navigate = useAppStore((s) => s.navigate);
  const minutes = useAppStore((s) => Math.round(s.time / 30) * 30);
  const [photo, setPhoto] = useState(false);
  const cone = useRef<SVGGElement>(null);
  const rendered = useAppStore((s) => s.manifest?.topviews[`${layout.type}${layout.mirrored ? '_mirror' : ''}`]);
  const image = rendered?.day ?? rendered?.evening;
  const here = layout.hotspots.find((h) => h.id === spot);
  const heightPx = (WIDTH_PX * layout.depth) / layout.width;

  useEffect(() => {
    if (!here) return undefined;
    let raf = 0;
    const tick = () => {
      const [x, z] = povState.heading;
      const deg = (Math.atan2(x, -z) * 180) / Math.PI;
      cone.current?.setAttribute('transform', `translate(${here.x} ${here.z}) rotate(${deg.toFixed(1)})`);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [here]);

  const jump = (id: string) => {
    const { route } = useAppStore.getState();
    if (route.view === 'unit') navigate({ ...route, spot: id });
  };

  return (
    <GlassPanel
      id="minimap"
      title={t.unit.plan}
      initialOnPhone="collapsed"
      minimizeLabel={t.panel.minimize}
      expandLabel={t.panel.expand}
      closeLabel={t.panel.close}
      className="minimap pointer-events-auto"
    >
      <div className="minimap__switch" role="group" aria-label={t.unit.plan}>
        <button type="button" aria-pressed={!photo} onClick={() => setPhoto(false)}>
          {t.pov.schematic}
        </button>
        <button type="button" aria-pressed={photo} onClick={() => setPhoto(true)}>
          {t.pov.photo}
        </button>
      </div>
      <div className="minimap__plan" style={{ width: WIDTH_PX, height: heightPx }}>
        {photo && image && <img src={`${rendersBase()}${image}`} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />}
        {photo && !image && (
          <Suspense fallback={null}>
            <TopViewCanvas layout={layout} pxPerMetre={WIDTH_PX / layout.width} dpr={1.5} minutes={minutes} />
          </Suspense>
        )}
        <svg viewBox={`0 0 ${layout.width} ${layout.depth}`} width={WIDTH_PX} height={heightPx}>
          {!photo && (
            <>
              {layout.rooms.flatMap((r) =>
                r.rects.map((q, i) => (
                  <rect key={`${r.room}${i}`} x={q[0]} y={q[1]} width={q[2] - q[0]} height={q[3] - q[1]} fill={unitTypes[st.type].color} fillOpacity={r.room === 'acLedge' ? 0.08 : 0.2} />
                )),
              )}
              {plan.boxes.filter((b) => b.y0 === 0 && b.y1 > 2).map((b, i) => (
                <rect key={i} x={b.rect[0]} y={b.rect[1]} width={b.rect[2] - b.rect[0]} height={b.rect[3] - b.rect[1]} fill="currentColor" fillOpacity={0.85} />
              ))}
              {layout.rooms.filter((r) => r.room !== 'acLedge' && r.room !== 'shelter').map((r) => {
                const q = [...r.rects].sort((p, n) => (n[2] - n[0]) * (n[3] - n[1]) - (p[2] - p[0]) * (p[3] - p[1]))[0];
                return (
                  <text key={r.room} x={(q[0] + q[2]) / 2} y={q[1] + 0.34} textAnchor="middle" fontSize={0.24} fill="currentColor" fillOpacity={0.9} style={{ pointerEvents: 'none' }}>
                    {roomLabel(st.type, r.room).split(' ')[0]}
                  </text>
                );
              })}
            </>
          )}
          {here && (
            <g ref={cone}>
              <path d="M0 0 L-0.62 -1.25 A1.4 1.4 0 0 1 0.62 -1.25 Z" fill="var(--accent-light, #ffd9a8)" fillOpacity={0.55} />
            </g>
          )}
          {layout.hotspots.map((h) => (
            <g key={h.id} className="minimap__dot" onClick={() => jump(h.id)} role="button" aria-label={roomLabel(st.type, h.room)}>
              <circle cx={h.x} cy={h.z} r={0.32} fill="transparent" />
              <circle cx={h.x} cy={h.z} r={h.id === spot ? 0.17 : 0.11} fill={h.id === spot ? '#ffb46a' : 'currentColor'} stroke="#0008" strokeWidth={0.02} />
            </g>
          ))}
        </svg>
      </div>
    </GlassPanel>
  );
}

/** Where you are in the flat: the room's name and size, plus the way back out. */
export function RoomPill({ type, spot, onExit }: { type: string; spot: string; onExit: () => void }) {
  const h = interiors[type].hotspots.find((s) => s.id === spot);
  const spec = unitTypes[type].rooms.find((r) => r.room === h?.room);
  if (!h) return null;
  return (
    <div className="room-pill glass pointer-events-auto">
      <span>
        <strong>{h.kind === 'window' ? t.pov.windowView : roomLabel(type, h.room)}</strong>
        {spec && ` · ${spec.w} × ${spec.d} ${t.unit.metre} · ${spec.area} ${t.unit.m2}`}
      </span>
      <button type="button" onClick={onExit}>
        {t.pov.exit}
      </button>
    </div>
  );
}
