// The furnished plan, full size: zoom, pan, labels, scale figures and a download.
import { useEffect, useRef, useState } from 'react';
import { roomLabel, roomSpecs, t, type InteriorLayout } from '@bair/project-data';
import { rendersBase } from '../lib/renderManifest';
import { useAppStore } from '../store/useAppStore';
import { primaryBtn } from './common';
import { IconClose } from './icons';
import { PlanPicture, usePlanRender } from './PlanPicture';

/** The web master is 4096 px on the long side; phones get what they can render. */
const TARGET_LONG_SIDE = 4096;

export function TopViewModal({ layout, turnDeg, fileName, onClose }: { layout: InteriorLayout; turnDeg: number; fileName: string; onClose: () => void }) {
  const minutes = useAppStore((s) => Math.round(s.time / 15) * 15);
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const [labels, setLabels] = useState(true);
  const [people, setPeople] = useState(!coarse);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const canvas = useRef<HTMLCanvasElement>(null);
  const { image, master } = usePlanRender(layout, minutes);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const available = Math.min(window.innerWidth - 48, (window.innerHeight - 170) * (layout.width / layout.depth));
  const pxPerMetre = available / layout.width;
  const longSide = Math.max(layout.width, layout.depth) * pxPerMetre;
  const dpr = Math.min(coarse ? 2 : 4, TARGET_LONG_SIDE / longSide);

  const download = () => {
    const el = canvas.current;
    if (!el && !image) return;
    const a = document.createElement('a');
    a.href = image ? `${rendersBase()}${master}` : el!.toDataURL('image/jpeg', 0.92);
    a.download = `${fileName}.jpg`;
    a.click();
  };

  return (
    <div className="plan-modal pointer-events-auto" role="dialog" aria-modal="true" aria-label={t.unit.plan}>
      <div className="plan-modal__bar">
        <strong>{t.unit.plan}</strong>
        <label>
          <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} />
          {t.unit.planLabels}
        </label>
        <label>
          <input type="checkbox" checked={people} onChange={(e) => setPeople(e.target.checked)} />
          {t.unit.planPeople}
        </label>
        <button type="button" className="plan-modal__download" onClick={download}>
          {t.unit.planDownload}
        </button>
        <button type="button" className={primaryBtn} aria-label={t.panel.close} onClick={onClose}>
          <IconClose />
        </button>
      </div>
      <div
        className="plan-modal__stage"
        onWheel={(e) => setZoom((z) => Math.min(6, Math.max(1, z * (e.deltaY < 0 ? 1.15 : 0.87))))}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
        }}
        onPointerMove={(e) => {
          if (drag.current) setPan({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        <div style={{ position: 'relative', transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          <PlanPicture ref={canvas} layout={layout} pxPerMetre={pxPerMetre} dpr={dpr} people={people} minutes={minutes} turnDeg={turnDeg} />
          {labels && (
            <svg viewBox={`0 0 ${layout.width} ${layout.depth}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              {layout.rooms.filter((r) => r.room !== 'acLedge').map((r) => {
                const big = [...r.rects].sort((p, q) => (q[2] - q[0]) * (q[3] - q[1]) - (p[2] - p[0]) * (p[3] - p[1]))[0];
                const spec = roomSpecs[layout.type].find((q) => q.room === r.room);
                return (
                  <text key={r.room} x={(big[0] + big[2]) / 2} y={(big[1] + big[3]) / 2} textAnchor="middle" fontSize={0.17} fontWeight={700} fill="#111" stroke="#fff" strokeWidth={0.05} paintOrder="stroke">
                    <tspan x={(big[0] + big[2]) / 2}>{roomLabel(layout.type, r.room)}</tspan>
                    {spec && (
                      <tspan x={(big[0] + big[2]) / 2} dy={0.22} fontWeight={500}>
                        {spec.area} {t.unit.m2}
                      </tspan>
                    )}
                  </text>
                );
              })}
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
