// The furnished plan from directly above: walls cut at 1.2 m in solid black with a white outline,
// daylight from the current time of day, plants, and optional figures for scale.
import { forwardRef, Suspense, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import {
  planExtras,
  projectConfig,
  site,
  sunAt,
  sunDirection,
  type InteriorLayout,
} from '@bair/project-data';
import { makeFigure } from '../site/People';
import { InteriorModel } from './InteriorModel';

const WALL_CUT = 1.2;

const figure = makeFigure(0.2);

function Figure({ at, heading }: { at: [number, number]; heading: number }) {
  return (
    <group position={[at[0], 0, at[1]]} rotation-y={(-heading * Math.PI) / 180}>
      <mesh geometry={figure.cloth} castShadow raycast={() => null}>
        <meshStandardMaterial color="#7a8187" roughness={0.9} />
      </mesh>
      <mesh geometry={figure.legs} castShadow raycast={() => null}>
        <meshStandardMaterial color="#3a4048" roughness={0.9} />
      </mesh>
      <mesh geometry={figure.skin} castShadow raycast={() => null}>
        <meshStandardMaterial color="#c99a75" roughness={0.7} />
      </mesh>
    </group>
  );
}

const sunLocation = {
  latitude: projectConfig.location.latitude,
  longitude: projectConfig.location.longitude,
  timeZone: projectConfig.timeZone,
};

function PlanLights({ layout, minutes, turnDeg }: { layout: InteriorLayout; minutes: number; turnDeg: number }) {
  const { dir, day } = useMemo(() => {
    const s = sunAt(minutes, sunLocation);
    const [x, y, z] = sunDirection(s, site.northOffsetDeg);
    const a = (turnDeg * Math.PI) / 180;
    const c = Math.cos(a);
    const n = Math.sin(a);
    // Daylight must read in plan, so a low or set sun still lights from a usable angle.
    const up = Math.max(y, 0.45);
    return {
      dir: new THREE.Vector3(x * c - z * n, up, x * n + z * c).normalize(),
      day: THREE.MathUtils.smoothstep(s.altitude, -4, 14),
    };
  }, [minutes, turnDeg]);
  const cx = layout.width / 2;
  const cz = layout.depth / 2;
  return (
    <>
      <hemisphereLight args={[day > 0.5 ? '#ffffff' : '#ffe2c0', '#c9c2b4', THREE.MathUtils.lerp(1.5, 2.0, day)]} />
      <directionalLight
        position={[cx + dir.x * 24, dir.y * 24, cz + dir.z * 24]}
        target-position={[cx, 0, cz]}
        color={day > 0.5 ? '#fff4e4' : '#ffc994'}
        intensity={THREE.MathUtils.lerp(1.1, 2.5, day)}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-bias={-0.0004}
        shadow-radius={3}
      />
    </>
  );
}

export interface TopViewProps {
  layout: InteriorLayout;
  /** On-screen size of one metre, in CSS pixels. */
  pxPerMetre: number;
  /** Render scale, for sharper downloads. */
  dpr?: number;
  people?: boolean;
  /** Clock time for the sunlight. */
  minutes: number;
  /** Rotation from site space to this plan, degrees. */
  turnDeg?: number;
  onReady?: () => void;
}

function Ready({ onReady }: { onReady?: () => void }) {
  useEffect(() => {
    if (!onReady) return undefined;
    const id = setTimeout(onReady, 900);
    return () => clearTimeout(id);
  }, [onReady]);
  return null;
}

export const TopViewCanvas = forwardRef<HTMLCanvasElement, TopViewProps>(function TopViewCanvas(
  { layout, pxPerMetre, dpr = 1.5, people = false, minutes, turnDeg = 0, onReady },
  ref,
) {
  const w = layout.width * pxPerMetre;
  const h = layout.depth * pxPerMetre;
  const extras = planExtras[layout.type];
  // Extras are written for the plain plan, so a mirrored one flips them too.
  const place = (p: [number, number]): [number, number] => (layout.mirrored ? [layout.width - p[0], p[1]] : p);
  return (
    <Canvas
      ref={ref}
      shadows
      dpr={dpr}
      gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.AgXToneMapping, toneMappingExposure: 1.15 }}
      style={{ width: w, height: h, background: '#fff' }}
    >
      <OrthographicCamera
        makeDefault
        position={[layout.width / 2, 30, layout.depth / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        left={-layout.width / 2}
        right={layout.width / 2}
        top={layout.depth / 2}
        bottom={-layout.depth / 2}
        near={0.1}
        far={60}
      />
      <PlanLights layout={layout} minutes={minutes} turnDeg={turnDeg} />
      <Suspense fallback={null}>
        <InteriorModel layout={layout} cut={WALL_CUT} hideAbove={WALL_CUT} standalone />
        {people && extras.people.map((f, i) => <Figure key={i} at={place(f.at)} heading={layout.mirrored ? -f.heading : f.heading} />)}
        <Ready onReady={onReady} />
      </Suspense>
    </Canvas>
  );
});
