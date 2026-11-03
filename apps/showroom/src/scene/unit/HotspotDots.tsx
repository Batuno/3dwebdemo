// Frosted glass dots floating in each room. Clicking one moves the camera there at eye level.
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

/** Standing nearly on top of a dot would fill the view with it. */
const MIN_DOT_DISTANCE = 1.1;

const distance = (a: Hotspot, b: Hotspot) => Math.hypot(a.x - b.x, a.z - b.z);

function Dot({ spot, type, size, onPick }: { spot: Hotspot; type: string; size: number; onPick: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const room = roomSpecs[type].find((r) => r.room === spot.room);
  return (
    <group position={[spot.x, DOT_HEIGHT, spot.z]} scale={size}>
      <mesh geometry={dotGeometry} material={dotGlass} renderOrder={40} scale={hovered ? 1.25 : 1} raycast={() => null} />
      <mesh geometry={haloGeometry} material={dotHalo} renderOrder={39} name="halo" raycast={() => null} />
      <mesh
        geometry={hitGeometry}
        material={hitMaterial}
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
      {hovered && (
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
  return (
    <group ref={group} name="hotspots">
      {spots.map((h) => (
        <Dot key={h.id} spot={h} type={layout.type} size={here ? Math.min(1, distance(h, here) / 3.5) : 1} onPick={onPick} />
      ))}
    </group>
  );
}
