// Glass dots on the ground at each outdoor standing point. They keep a readable size from far away.
import { useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { outdoorSpots, t, type OutdoorSpot } from '@bair/project-data';
import { useAppStore } from '../../store/useAppStore';
import { dotGeometry, dotGlass, dotHalo, haloGeometry, hitGeometry, hitMaterial } from '../unit/HotspotDots';
import { CLICK_SLOP } from '../shared';

const DOT_Y = 0.55;
const SCREEN_SIZE = 0.012;
const MIN_SIZE = 0.8;
const MAX_SIZE = 5;
const MAX_POV_DISTANCE = 130;

function Dot({ spot }: { spot: OutdoorSpot }) {
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const navigate = useAppStore((s) => s.navigate);
  const point = useMemo(() => new THREE.Vector3(spot.x, DOT_Y, spot.z), [spot]);
  useFrame(({ camera }) => {
    if (!group.current) return;
    const d = camera.position.distanceTo(point);
    group.current.scale.setScalar(THREE.MathUtils.clamp(d * SCREEN_SIZE, MIN_SIZE, MAX_SIZE));
  });
  return (
    <group ref={group} position={point}>
      <mesh geometry={dotGeometry} material={dotGlass} renderOrder={30} raycast={() => null} />
      <mesh geometry={haloGeometry} material={dotHalo} renderOrder={29} raycast={() => null} />
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
          navigate({ view: 'outdoor', spot: spot.id });
        }}
      />
      {hovered && (
        <Html center position={[0, 0.5, 0]} zIndexRange={[35, 25]} wrapperClass="scene-label" pointerEvents="none">
          <span className="room-tag">{t.amenity[spot.labelKey]}</span>
        </Html>
      )}
    </group>
  );
}

export function OutdoorDots() {
  const route = useAppStore((s) => s.route);
  const spots = useMemo(() => {
    if (route.view === 'overview') return outdoorSpots;
    if (route.view !== 'outdoor') return [];
    const here = outdoorSpots.find((s) => s.id === route.spot);
    return outdoorSpots.filter((s) => s !== here && (!here || Math.hypot(s.x - here.x, s.z - here.z) < MAX_POV_DISTANCE));
  }, [route]);
  return (
    <group name="outdoorDots">
      {spots.map((s) => (
        <Dot key={s.id} spot={s} />
      ))}
    </group>
  );
}
