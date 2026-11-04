// Frosted glass dots floating in each room. Clicking one moves the camera there at eye level. Standing
// inside, the floor itself is a target too: pointing at it lights up the nearest reachable dot, and a
// click goes there, so a small dot (or one behind a panel) never has to be hit exactly.
import { useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { DOT_HEIGHT, roomLabel, roomSpecs, t, visibleSpots, type Hotspot, type InteriorLayout } from '@bair/project-data';
import { CLICK_SLOP } from '../shared';

export const dotGlass = new THREE.MeshStandardMaterial({
  name: 'M_HotspotGlass',
  color: '#ffffff',
  emissive: '#ffffff',
  emissiveIntensity: 0.7,
  roughness: 0.25,
  transparent: true,
  opacity: 0.72,
  depthTest: false,
});
export const dotHalo = new THREE.MeshBasicMaterial({ name: 'M_HotspotHalo', color: '#ffffff', transparent: true, opacity: 0.2, depthTest: false, depthWrite: false });
export const hitMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
export const dotGeometry = new THREE.SphereGeometry(0.11, 24, 16);
export const haloGeometry = new THREE.SphereGeometry(0.19, 24, 16);
export const hitGeometry = new THREE.SphereGeometry(0.34, 12, 8);
/** Mirrored flats flip the floor target's facing, so it answers rays from either side. */
const floorHitMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide });

/** Standing nearly on top of a dot would fill the view with it. */
const MIN_DOT_DISTANCE = 1.1;
/**
 * Standing inside, dots float higher than in the dollhouse view: from eye height, dots near the floor
 * land in the bottom of the screen, under the plan, the navigation and the time slider.
 */
const POV_DOT_HEIGHT = 0.85;
/** Near dots are drawn smaller so they don't fill the view, but their click target never shrinks below this. */
const MIN_HIT_SCALE = 0.75;
/** How far from a dot, in metres, pointing at the floor still means that dot. */
const FLOOR_REACH = 2.2;

const distance = (a: Hotspot, b: Hotspot) => Math.hypot(a.x - b.x, a.z - b.z);
const noRaycast = () => null;

function Dot({
  spot,
  type,
  size,
  height,
  aimed,
  onPick,
}: {
  spot: Hotspot;
  type: string;
  size: number;
  height: number;
  /** The floor pointer is near this dot. */
  aimed: boolean;
  onPick: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const lit = hovered || aimed;
  const room = roomSpecs[type].find((r) => r.room === spot.room);
  return (
    <group position={[spot.x, height, spot.z]} scale={size}>
      <mesh geometry={dotGeometry} material={dotGlass} renderOrder={40} scale={lit ? 1.25 : 1} raycast={noRaycast} />
      <mesh geometry={haloGeometry} material={dotHalo} renderOrder={39} name="halo" raycast={noRaycast} />
      <mesh
        geometry={hitGeometry}
        material={hitMaterial}
        scale={Math.max(1, MIN_HIT_SCALE / size)}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = '';
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (e.delta > CLICK_SLOP) return;
          e.stopPropagation();
          document.body.style.cursor = '';
          onPick(spot.id);
        }}
      />
      {lit && (
        <Html center position={[0, 0.42, 0]} zIndexRange={[35, 25]} wrapperClass="scene-label" pointerEvents="none">
          <span className="room-tag">
            {spot.kind === 'window' ? t.pov.windowView : roomLabel(type, spot.room)}
            {room && (
              <b>
                {room.area} {t.unit.m2}
              </b>
            )}
          </span>
        </Html>
      )}
    </group>
  );
}

export function HotspotDots({
  layout,
  current,
  onPick,
}: {
  layout: InteriorLayout;
  current?: string;
  onPick: (id: string) => void;
}) {
  const here = layout.hotspots.find((h) => h.id === current);
  const spots = useMemo(
    () => (here ? visibleSpots(layout, here).filter((h) => distance(h, here) > MIN_DOT_DISTANCE) : layout.hotspots),
    [layout, here],
  );
  const group = useRef<THREE.Group>(null);
  const reduce = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);
  useFrame(({ clock }) => {
    if (reduce || !group.current) return;
    const s = 1 + Math.sin(clock.elapsedTime * 2.1) * 0.14;
    group.current.traverse((o) => {
      if (o.name === 'halo') o.scale.setScalar(s);
    });
  });

  // Floor targeting, only while standing inside.
  const [aim, setAim] = useState<string | null>(null);
  const local = useMemo(() => new THREE.Vector3(), []);
  const nearest = (e: ThreeEvent<PointerEvent | MouseEvent>): Hotspot | null => {
    const g = group.current;
    if (!g) return null;
    // Plan coordinates, whatever the flat's turn or mirroring.
    g.worldToLocal(local.copy(e.point));
    let best: Hotspot | null = null;
    let bestD = FLOOR_REACH;
    for (const s of spots) {
      const d = Math.hypot(s.x - local.x, s.z - local.z);
      if (d < bestD) {
        best = s;
        bestD = d;
      }
    }
    return best;
  };

  return (
    <group ref={group} name="hotspots">
      {spots.map((h) => (
        <Dot
          key={h.id}
          spot={h}
          type={layout.type}
          size={here ? Math.min(1, distance(h, here) / 3.5) : 1}
          height={here ? POV_DOT_HEIGHT : DOT_HEIGHT}
          aimed={aim === h.id}
          onPick={onPick}
        />
      ))}
      {here && (
        <mesh
          name="floorTarget"
          position={[layout.width / 2, 0.03, layout.depth / 2]}
          rotation-x={-Math.PI / 2}
          material={floorHitMaterial}
          onPointerMove={(e: ThreeEvent<PointerEvent>) => {
            const s = nearest(e);
            const id = s?.id ?? null;
            if (id !== aim) setAim(id);
            document.body.style.cursor = id ? 'pointer' : '';
          }}
          onPointerOut={() => {
            setAim(null);
            document.body.style.cursor = '';
          }}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            if (e.delta > CLICK_SLOP) return;
            const s = nearest(e);
            if (!s) return;
            e.stopPropagation();
            setAim(null);
            document.body.style.cursor = '';
            onPick(s.id);
          }}
        >
          <planeGeometry args={[layout.width, layout.depth]} />
        </mesh>
      )}
    </group>
  );
}
