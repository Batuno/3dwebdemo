// The flat's floor plan, crossfading over the dollhouse: the drawing with room names and sizes, its number and area, and zoom.
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { isPhone, PORTRAIT_PHONE, useMedia, usePanelOpen } from '@bair/ui';
import { blockById, interiors, mirroredInteriors, t, unitNumber, unitTypes } from '@bair/project-data';
import { useAppStore } from '../store/useAppStore';
import { IconMinus, IconPlus, IconReset } from './icons';
import { PlanDrawing, planFrame } from './PlanDrawing';

const SIDE_PANEL = 490;
const SCREEN_MARGIN = 16;
/** Clear of the breadcrumb, and of the flat's panel when it is folded into a bar at the top right. */
const TOP_SPACE = 100;
/** The navigation and the 3D / plan switch above it. */
const BOTTOM_SPACE = 150;
/** Portrait phones: the folded sheet, the 3D / plan switch on it and the navigation. */
const PHONE_BOTTOM_SPACE = 210;
const PHONE_TOP_SPACE = 64;
/** Landscape phones: the navigation below, and the flat's panel down the right while it is open. */
const LANDSCAPE_BOTTOM_SPACE = 120;
const LANDSCAPE_PANEL = 370;
/** The number and area above the drawing. */
const HEAD = 48;
const MAX_ZOOM = 6;
const STEP = 1.6;

type View = { s: number; x: number; y: number };
const FIT: View = { s: 1, x: 0, y: 0 };

function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const f = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return size;
}

/** Switches a flat between the 3D dollhouse and its floor plan. */
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

export function PlanView({ block, storey, stack }: { block: string; storey: number; stack: number }) {
  const planMode = useAppStore((s) => s.planMode);
  const { w, h } = useWindowSize();
  const st = blockById(block)!.stacks.find((s) => s.stack === stack)!;
  const layout = (st.mirror ? mirroredInteriors : interiors)[st.type];

  // The plan is framed in the space the flat's panel leaves, and widens while that panel is folded.
  const panelOpen = usePanelOpen('unit') ?? true;
  const portrait = useMedia(PORTRAIT_PHONE);
  const landscape = useMedia('(max-height: 480px)');
  const phone = portrait || landscape || isPhone();
  const top = phone ? PHONE_TOP_SPACE : TOP_SPACE;
  const bottom = portrait ? PHONE_BOTTOM_SPACE : landscape ? LANDSCAPE_BOTTOM_SPACE : BOTTOM_SPACE;
  // The time slider steps aside while the plan is up (see Overlay), so only the flat's panel takes room.
  const left = phone ? 8 : SCREEN_MARGIN;
  const right = portrait ? 8 : landscape ? (panelOpen ? LANDSCAPE_PANEL : 8) : panelOpen ? SIDE_PANEL : SCREEN_MARGIN;
  const stageW = Math.max(1, w - left - right);
  const stageH = Math.max(1, h - top - bottom - HEAD);
  // The sheet holds the walls plus the paper around them for the dimension lines and the way in.
  const frame = planFrame(layout);
  const pxPerMetre = Math.min(stageW / frame.w, stageH / frame.h);
  const sheetW = frame.w * pxPerMetre;
  const sheetH = frame.h * pxPerMetre;

  const [wanted, setWanted] = useState<View>(FIT);
  const [smooth, setSmooth] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());

  /** Keeps the zoom in range and the drawing on screen: centred while it fits, edge to edge once it doesn't. */
  const clamp = (v: View): View => {
    const s = Math.min(MAX_ZOOM, Math.max(1, v.s));
    const mx = Math.max(0, (sheetW * s - stageW) / 2);
    const my = Math.max(0, (sheetH * s - stageH) / 2);
    return { s, x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y)) };
  };
  const view = clamp(wanted);

  /** Scales about a point given relative to the stage's centre, so that point stays under the finger or cursor. */
  const zoomAt = (v: View, factor: number, px: number, py: number): View => {
    const s = Math.min(MAX_ZOOM, Math.max(1, v.s * factor));
    const k = s / v.s;
    return { s, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
  };
  const fromCentre = (cx: number, cy: number) => {
    const r = stage.current!.getBoundingClientRect();
    return [cx - (r.left + r.width / 2), cy - (r.top + r.height / 2)] as const;
  };

  // Drawn on first use and kept while the flat is open so it can fade out; every visit starts from the whole plan.
  const [opened, setOpened] = useState(planMode);
  useEffect(() => {
    if (!planMode) return;
    setOpened(true);
    setSmooth(false);
    setWanted(FIT);
  }, [planMode]);

  // React's wheel handler is passive, so the page would scroll as well; this one is not.
  const latest = useRef({ view, clamp, zoomAt, fromCentre });
  latest.current = { view, clamp, zoomAt, fromCentre };
  useEffect(() => {
    const el = stage.current;
    if (!el) return undefined;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { view: v, clamp: c, zoomAt: z, fromCentre: f } = latest.current;
      const [px, py] = f(e.clientX, e.clientY);
      setSmooth(false);
      setWanted(c(z(v, Math.exp(-e.deltaY * 0.0022), px, py)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [opened]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setSmooth(false);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const all = pointers.current;
    const prev = all.get(e.pointerId);
    if (!prev) return;
    const now = { x: e.clientX, y: e.clientY };
    let next: View;
    if (all.size === 1) {
      next = { ...view, x: view.x + now.x - prev.x, y: view.y + now.y - prev.y };
    } else {
      // Two fingers: the gap between them sets the zoom and their midpoint drags the plan.
      const other = [...all.entries()].find(([id]) => id !== e.pointerId)![1];
      const gap0 = Math.hypot(prev.x - other.x, prev.y - other.y);
      const gap1 = Math.hypot(now.x - other.x, now.y - other.y);
      const [mx, my] = fromCentre((prev.x + other.x) / 2, (prev.y + other.y) / 2);
      next = zoomAt(view, gap0 > 0 ? gap1 / gap0 : 1, mx, my);
      next = { ...next, x: next.x + (now.x - prev.x) / 2, y: next.y + (now.y - prev.y) / 2 };
    }
    all.set(e.pointerId, now);
    setWanted(clamp(next));
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
  };
  const step = (factor: number) => {
    setSmooth(true);
    setWanted(clamp(zoomAt(view, factor, 0, 0)));
  };

  return (
    <div className={`plan-view ${planMode ? 'is-on' : ''}`} aria-hidden={!planMode} style={{ padding: `${top}px ${right}px ${bottom}px ${left}px` }}>
      {opened && (
        <>
          <div className="plan-view__head">
            <strong>{unitNumber(storey, stack)}</strong>
            <span>
              {unitTypes[st.type].totalArea} {t.unit.m2}
            </span>
          </div>
          <div
            ref={stage}
            className={`plan-view__stage ${view.s > 1 ? 'is-zoomed' : ''}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={(e) => {
              if ((e.target as HTMLElement).closest('button')) return;
              setSmooth(true);
              const [px, py] = fromCentre(e.clientX, e.clientY);
              setWanted(view.s > 1.05 ? FIT : clamp(zoomAt(view, 2.5, px, py)));
            }}
          >
            <div
              className={`plan-view__sheet ${smooth ? 'is-smooth' : ''}`}
              style={{ width: sheetW, height: sheetH, transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }}
            >
              <PlanDrawing layout={layout} pxPerMetre={pxPerMetre} />
            </div>
            <div className="plan-view__zoom" role="group">
              <button type="button" aria-label={t.unit.zoomIn} disabled={view.s >= MAX_ZOOM} onClick={() => step(STEP)}>
                <IconPlus />
              </button>
              <button type="button" aria-label={t.unit.zoomOut} disabled={view.s <= 1} onClick={() => step(1 / STEP)}>
                <IconMinus />
              </button>
              <button
                type="button"
                aria-label={t.unit.zoomReset}
                disabled={view.s <= 1 && view.x === 0 && view.y === 0}
                onClick={() => {
                  setSmooth(true);
                  setWanted(FIT);
                }}
              >
                <IconReset />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
