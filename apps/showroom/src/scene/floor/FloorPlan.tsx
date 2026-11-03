import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import type CameraControlsImpl from 'camera-controls';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { interiors, unitTypes, type BlockDef, type StackPlacement } from '@bair/project-data';
import { t } from '@bair/project-data';
import { formatPriceShort, unitNumber } from '@bair/project-data';
import { planToLocal, storeyY, unitEdges, unitXform } from '@bair/project-data';
import { getUnit, type Unit } from '@bair/project-data';
import { CLICK_SLOP } from '../shared';
import { useAppStore } from '../../store/useAppStore';
import { useMaterials } from '../materials';
import { BatchSet } from '../blocks/meshBatch';
import { requestShadowUpdate } from '../lighting/shadowControl';
import { InteriorModel } from '../unit/InteriorModel';

const WALL_H = 1.0;
const PLAN_CUT = 1.2;
/** Closer than this, the flats nearest the view swap their plain plates for furnished top views. */
const DETAIL_DISTANCE = 75;
const DETAIL_COUNT = 3;
const DETAIL_CHECK_SECONDS = 0.4;
const STATUS_COLOR = { available: '#46b873', reserved: '#e7ab36', sold: '#9aa1a7' } as const;

/** Low walls and the floor plate for one flat, in block-local space. */
function unitGeometry(b: BlockDef, s: StackPlacement, wallHeight: number) {
  const xf = unitXform(b, s);
  const set = new BatchSet<'floor' | 'wall'>();
  const floor = set.get('floor');
  const wall = set.get('wall');
  for (const r of xf.layout.rooms) {
    for (const [x0, z0, x1, z1] of r.rects) {
      floor.flat([xf.point(x0, z0), xf.point(x1, z0), xf.point(x1, z1), xf.point(x0, z1)], 0.06, true);
    }
  }
  const edges = unitEdges(xf.layout);
  const seg = (a: [number, number], b2: [number, number], thick: number) => {
    const p = xf.point(a[0], a[1]);
    const q = xf.point(b2[0], b2[1]);
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (L < 0.05) return;
    wall.box(
      [(p[0] + q[0]) / 2, wallHeight / 2 + 0.06, (p[1] + q[1]) / 2],
      [L + thick, wallHeight, thick],
      Math.atan2(-(q[1] - p[1]), q[0] - p[0]),
      { noBottom: true },
    );
  };
  const cut = (a: [number, number], b2: [number, number], thick: number) => {
    // Interrupt the wall where a door sits on it
    const horizontal = Math.abs(a[1] - b2[1]) < 0.01;
    const line = horizontal ? a[1] : a[0];
    const lo = horizontal ? Math.min(a[0], b2[0]) : Math.min(a[1], b2[1]);
    const hi = horizontal ? Math.max(a[0], b2[0]) : Math.max(a[1], b2[1]);
    const gaps = xf.layout.doors
      .filter(
        (d) =>
          d.axis === (horizontal ? 'x' : 'z') &&
          Math.abs((horizontal ? d.at[1] : d.at[0]) - line) < 0.02 &&
          (horizontal ? d.at[0] : d.at[1]) > lo &&
          (horizontal ? d.at[0] : d.at[1]) < hi,
      )
      .map((d) => {
        const c = horizontal ? d.at[0] : d.at[1];
        return [c - d.width / 2, c + d.width / 2] as const;
      })
      .sort((p, q) => p[0] - q[0]);
    let cur = lo;
    const mk = (u: number, v: number) =>
      seg(horizontal ? [u, line] : [line, u], horizontal ? [v, line] : [line, v], thick);
    for (const [g0, g1] of gaps) {
      if (g0 > cur) mk(cur, g0);
      cur = g1;
    }
    if (cur < hi) mk(cur, hi);
  };
  for (const e of edges.exterior) cut(e.a, e.b, e.room === 'acLedge' ? 0.08 : 0.2);
  for (const e of edges.interior) cut(e.a, e.b, 0.1);
  const [[, floorGeo], wallEntry] = set.toGeometries();
  const res = { floor: floorGeo, wall: wallEntry[1] };
  return res;
}

function UnitPiece({
  def,
  stackDef,
  unit,
  storey,
  ghost,
  detailed,
}: {
  def: BlockDef;
  stackDef: StackPlacement;
  unit: Unit;
  storey: number;
  ghost: boolean;
  detailed: boolean;
}) {
  const colorBy = useAppStore((s) => s.colorBy);
  const hovered = useAppStore((s) => s.hover.stack === stackDef.stack);
  const setHover = useAppStore((s) => s.setHover);
  const navigate = useAppStore((s) => s.navigate);
  const lib = useMaterials();

  const { floor, wall } = useMemo(() => unitGeometry(def, stackDef, WALL_H), [def, stackDef]);
  useEffect(
    () => () => {
      floor.dispose();
      wall.dispose();
    },
    [floor, wall],
  );

  const passes = true;
  const base = colorBy === 'type' ? unitTypes[unit.type].color : STATUS_COLOR[unit.status];

  const floorMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: ghost ? '#c9c7c1' : base,
        roughness: 0.75,
        transparent: !passes && !ghost,
        opacity: passes || ghost ? 1 : 0.35,
        emissive: base,
        emissiveIntensity: 0,
      }),
    [base, ghost, passes],
  );
  floorMat.emissiveIntensity = hovered && !ghost ? 0.45 : 0;

  const wallMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: ghost ? '#dedcd6' : '#f7f5f0',
        roughness: 0.85,
        normalMap: lib.sets.plaster.normalMap,
      }),
    [ghost, lib],
  );
  useEffect(
    () => () => {
      floorMat.dispose();
      wallMat.dispose();
    },
    [floorMat, wallMat],
  );

  const xf = unitXform(def, stackDef);

  const handlers = ghost
    ? {}
    : {
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHover({ stack: stackDef.stack });
          document.body.style.cursor = 'pointer';
        },
        onPointerOut: () => {
          setHover({ stack: null });
          document.body.style.cursor = '';
        },
        onClick: (e: ThreeEvent<MouseEvent>) => {
          if (e.delta > CLICK_SLOP) return;
          e.stopPropagation();
          document.body.style.cursor = '';
          navigate({ view: 'unit', block: def.id, storey, stack: stackDef.stack });
        },
      };

  return (
    <group>
      {/* Still clickable while hidden: raycasts ignore visibility. */}
      <mesh geometry={floor} material={floorMat} receiveShadow visible={!detailed} {...handlers} />
      <mesh geometry={wall} material={wallMat} castShadow receiveShadow visible={!detailed} raycast={() => null} />
      {detailed && (
        <group position={[xf.center[0], 0.08, xf.center[1]]} rotation-y={xf.rotY}>
          <group scale-x={stackDef.mirror ? -1 : 1}>
            <group position={[-xf.layout.width / 2, 0, -xf.layout.depth / 2]}>
              <Suspense fallback={null}>
                <InteriorModel layout={interiors[stackDef.type]} cut={PLAN_CUT} hideAbove={PLAN_CUT} standalone />
              </Suspense>
            </group>
          </group>
        </group>
      )}
      {!ghost && (
        <Html
          position={[xf.center[0], 2.2, xf.center[1]]}
          center
          zIndexRange={[30, 20]}
          wrapperClass="scene-label"
          pointerEvents="none"
        >
          <span className="unit-badge" style={{ opacity: passes ? 1 : 0.4 }}>
            <span className={`dot status-${unit.status}`} />
            {stackDef.stack}
          </span>
          {hovered && (
            <div className="scene-tip fade-in" style={{ marginTop: 6, textAlign: 'left' }}>
              <div style={{ fontWeight: 800 }}>{unitNumber(storey, stackDef.stack)}</div>
              <div>
                {t.unitType[unit.type]} · {unit.totalArea} {t.unit.m2}
              </div>
              <div>
                {formatPriceShort(unit.price)} · {t.status[unit.status]}
              </div>
            </div>
          )}
        </Html>
      )}
    </group>
  );
}

function CoreAndCorridor({ def, storey, ghost }: { def: BlockDef; storey: number; ghost: boolean }) {
  const geo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const pts = def.corridor.map((p) => planToLocal(def, p));
    for (let i = 0; i < pts.length - 1; i++) {
      const dx = pts[i + 1][0] - pts[i][0];
      const dz = pts[i + 1][1] - pts[i][1];
      const L = Math.hypot(dx, dz);
      const g = new THREE.BoxGeometry(L + 0.4, 0.1, 2.5);
      g.rotateY(Math.atan2(-dz, dx));
      g.translate((pts[i][0] + pts[i + 1][0]) / 2, 0.02, (pts[i][1] + pts[i + 1][1]) / 2);
      parts.push(g);
    }
    const merged = mergeGeometries(parts)!;
    parts.forEach((p) => p.dispose());
    return merged;
  }, [def]);
  useEffect(() => () => geo.dispose(), [geo]);
  const core = planToLocal(def, def.liftCore.at);
  const coreW = def.liftCore.size[0] / def.plan.pxPerMetre;
  const coreD = def.liftCore.size[1] / def.plan.pxPerMetre;
  const rot = THREE.MathUtils.degToRad(def.liftCore.rot ?? 0);
  const roofs = storey === 2 ? def.secondStoreyRoofs : [];
  return (
    <group>
      <mesh geometry={geo} receiveShadow raycast={() => null}>
        <meshStandardMaterial color="#b9b6ae" roughness={0.9} />
      </mesh>
      <mesh position={[core[0], 0.55, core[1]]} rotation-y={rot} castShadow raycast={() => null}>
        <boxGeometry args={[coreW, 1.1, coreD]} />
        <meshStandardMaterial color="#54493f" roughness={0.6} />
      </mesh>
      {!ghost && (
        <Html position={[core[0], 2.0, core[1]]} center zIndexRange={[19, 10]} wrapperClass="scene-label" pointerEvents="none">
          <span className="amenity-pill">{t.floor.lobby}</span>
        </Html>
      )}
      {def.stairs.map((s, i) => {
        const p = planToLocal(def, s.at);
        return (
          <mesh key={i} position={[p[0], 0.55, p[1]]} castShadow raycast={() => null}>
            <boxGeometry args={[s.size[0] / def.plan.pxPerMetre, 1.1, s.size[1] / def.plan.pxPerMetre]} />
            <meshStandardMaterial color="#8b8781" roughness={0.8} />
          </mesh>
        );
      })}
      {roofs.map((r, i) => {
        const p = planToLocal(def, r.at);
        return (
          <group key={i}>
            <mesh position={[p[0], 0.03, p[1]]} rotation-y={THREE.MathUtils.degToRad(r.rot ?? 0)} receiveShadow raycast={() => null}>
              <boxGeometry args={[r.size[0] / def.plan.pxPerMetre, 0.06, r.size[1] / def.plan.pxPerMetre]} />
              <meshStandardMaterial color="#a4ad93" roughness={1} />
            </mesh>
            {!ghost && (
              <Html position={[p[0], 0.6, p[1]]} center zIndexRange={[19, 10]} wrapperClass="scene-label" pointerEvents="none">
                <span className="amenity-pill" style={{ fontSize: 10 }}>
                  {t.floor.secondStoreyRoof}
                </span>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

/** The opened floor: coloured flats with low walls, plus a neutral version behind a unit view. */
export function FloorPlan({ def, storey, ghostExcept }: { def: BlockDef; storey: number; ghostExcept?: number }) {
  const [detail, setDetail] = useState<number[]>([]);
  const lastCheck = useRef(0);
  const target = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock, controls }) => {
    if (ghostExcept !== undefined || clock.elapsedTime - lastCheck.current < DETAIL_CHECK_SECONDS) return;
    lastCheck.current = clock.elapsedTime;
    const c = controls as unknown as CameraControlsImpl | null;
    if (!c) return;
    let next: number[] = [];
    if (c.distance < DETAIL_DISTANCE) {
      c.getTarget(target);
      next = def.stacks
        .map((s) => {
          const xf = unitXform(def, s);
          return { stack: s.stack, d: Math.hypot(def.position[0] + xf.center[0] - target.x, def.position[1] + xf.center[1] - target.z) };
        })
        .sort((a, b) => a.d - b.d)
        .slice(0, DETAIL_COUNT)
        .map((s) => s.stack)
        .sort((a, b) => a - b);
    }
    if (next.join() !== detail.join()) {
      setDetail(next);
      requestShadowUpdate();
    }
  });
  return (
    <group name="floorplan" position={[def.position[0], storeyY(storey), def.position[1]]}>
      <CoreAndCorridor def={def} storey={storey} ghost={ghostExcept !== undefined} />
      {def.stacks.map((s) => {
        if (s.stack === ghostExcept) return null;
        const unit = getUnit(def.id, storey, s.stack)!;
        return <UnitPiece key={s.stack} def={def} stackDef={s} unit={unit} storey={storey} ghost={ghostExcept !== undefined} detailed={detail.includes(s.stack)} />;
      })}
    </group>
  );
}
