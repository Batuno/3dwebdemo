import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { PerformanceMonitor } from '@react-three/drei';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { blockById, blocks, type BlockDef } from '@bair/project-data';
import { useAppStore, type Quality } from '../store/useAppStore';
import { STOREY_H, VOID_DECK_H } from '@bair/project-data';
import { Block, BlockHighlight, BlockProxy, StoreyBand } from './blocks/Block';
import { FloorTickProjector } from './blocks/FloorTickProjector';
import { CameraRig } from './camera/CameraRig';
import { Labels } from './labels/Labels';
import { Lighting } from './lighting/Lighting';
import { PostFx } from './lighting/PostFx';
import { Amenities } from './site/Amenities';
import { Cars } from './site/Cars';
import { Surroundings } from './site/Context';
import { People } from './site/People';
import { Ground } from './site/Ground';
import { Lamps } from './site/Lamps';
import { OutdoorDots } from './site/OutdoorDots';
import { Vegetation } from './site/Vegetation';
import { useMaterials } from './materials';
import { CLICK_SLOP } from './shared';
import { unitsOnFloor } from '@bair/project-data';
import { FloorPlan } from './floor/FloorPlan';
import { PanoramaLayer } from './unit/PanoramaLayer';

const UnitInterior = lazy(() => import('./unit/UnitInterior'));
const Garage = lazy(() => import('./garage/Garage'));

interface QualitySettings {
  dpr: number;
  shadow: number;
  density: number;
  detailedGlass: boolean;
  softShadows: boolean;
  cars: number;
}

const QUALITY: Record<Quality, QualitySettings> = {
  high: { dpr: 2, shadow: 4096, density: 1, detailedGlass: true, softShadows: true, cars: 27 },
  medium: { dpr: 1.5, shadow: 2048, density: 0.8, detailedGlass: true, softShadows: true, cars: 18 },
  low: { dpr: 1.25, shadow: 1024, density: 0.5, detailedGlass: false, softShadows: false, cars: 9 },
};

function BlockInteraction({ def }: { def: BlockDef }) {
  const route = useAppStore((s) => s.route);
  const hoverBlock = useAppStore((s) => s.hover.block);
  const hoverStorey = useAppStore((s) => s.hover.storey ?? s.selectedStorey);
  const setHover = useAppStore((s) => s.setHover);
  const navigate = useAppStore((s) => s.navigate);

  const isOverview = route.view === 'overview';
  const isThisBlockView = route.view === 'block' && route.block === def.id;

  const storeyAtPoint = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    const y = e.point.y;
    const n = Math.floor((y - VOID_DECK_H) / STOREY_H) + 2;
    return n >= 2 && n <= def.storeys ? n : null;
  };

  const emptyFloor = useMemo(
    () =>
      hoverStorey && isThisBlockView
        ? unitsOnFloor(def.id, hoverStorey).every((u) => u.status !== 'available')
        : false,
    [hoverStorey, isThisBlockView, def.id],
  );

  if (isOverview) {
    return (
      <>
        <BlockProxy
          def={def}
          onHover={(e) => {
            e.stopPropagation();
            setHover({ block: def.id });
            document.body.style.cursor = 'pointer';
          }}
          onOut={() => {
            setHover({ block: null });
            document.body.style.cursor = '';
          }}
          onPick={(e) => {
            if (e.delta > CLICK_SLOP) return;
            e.stopPropagation();
            document.body.style.cursor = '';
            navigate({ view: 'block', block: def.id });
          }}
        />
        <BlockHighlight def={def} active={hoverBlock === def.id} />
      </>
    );
  }
  if (isThisBlockView) {
    return (
      <>
        <BlockProxy
          def={def}
          onMove={(e) => {
            e.stopPropagation();
            const s = storeyAtPoint(e);
            if (s !== useAppStore.getState().hover.storey) setHover({ storey: s });
            document.body.style.cursor = s ? 'pointer' : '';
          }}
          onOut={() => {
            setHover({ storey: null });
            document.body.style.cursor = '';
          }}
          onPick={(e) => {
            if (e.delta > CLICK_SLOP) return;
            e.stopPropagation();
            const s = storeyAtPoint(e);
            if (s) {
              document.body.style.cursor = '';
              navigate({ view: 'floor', block: def.id, storey: s });
            }
          }}
        />
        <StoreyBand
          def={def}
          storey={hoverStorey}
          color={emptyFloor ? '#7a8087' : '#ffcf96'}
          opacity={emptyFloor ? 0.45 : 0.7}
        />
      </>
    );
  }
  return null;
}

function Ready() {
  const setSceneReady = useAppStore((s) => s.setSceneReady);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useMaterials();
  useEffect(() => {
    if (import.meta.env.DEV || location.search.includes('debug')) {
      Object.assign(window, { __renderer: gl, __store: useAppStore, __scene: scene });
    }
    const id = requestAnimationFrame(() => {
      setSceneReady();
      if (import.meta.env.DEV || location.search.includes('debug')) {
        Object.assign(window, { __sceneReady: true });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [setSceneReady, gl, scene]);
  return null;
}

function FocusedFloor() {
  const route = useAppStore((s) => s.route);
  if (route.view === 'floor') {
    return <FloorPlan key={`${route.block}-${route.storey}`} def={blockById(route.block)!} storey={route.storey} />;
  }
  if (route.view === 'unit') {
    const def = blockById(route.block)!;
    const st = def.stacks.find((s) => s.stack === route.stack)!;
    return (
      <>
        <FloorPlan key={`${route.block}-${route.storey}`} def={def} storey={route.storey} ghostExcept={route.stack} />
        <Suspense fallback={null}>
          <UnitInterior key={`${route.block}-${route.stack}-${route.storey}`} def={def} st={st} storey={route.storey} />
        </Suspense>
      </>
    );
  }
  return null;
}

/** The post-processing library turns the renderer's auto-clear off and leaves it off when unmounted. */
function PlainRender() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.autoClear = true;
  }, [gl]);
  return null;
}

/** A device that keeps struggling drops a tier, unless the viewer chose one in settings. */
function stepDownQuality() {
  const { quality, setAutoQuality, qualityChosen } = useAppStore.getState();
  if (qualityChosen) return;
  if (quality === 'high') setAutoQuality('medium');
  else if (quality === 'medium') setAutoQuality('low');
}

function World({ q }: { q: QualitySettings }) {
  const view = useAppStore((s) => s.route.view);
  const garage = view === 'garage';
  return (
    <>
      <Lighting shadowSize={q.shadow} softShadows={q.softShadows} />
      <Ground />
      {!garage && <Amenities />}
      {!garage && <Vegetation density={q.density} />}
      {!garage && <Cars moving={q.cars} />}
      {!garage && <People density={q.density} />}
      <Surroundings />
      {!garage && <Lamps />}
      {blocks.map((b) => (
        <group key={b.id}>
          <Block def={b} detailedGlass={q.detailedGlass} />
          <BlockInteraction def={b} />
        </group>
      ))}
      <FocusedFloor />
      <FloorTickProjector />
      <OutdoorDots />
      <PanoramaLayer />
      {garage && (
        <Suspense fallback={null}>
          <Garage />
        </Suspense>
      )}
      <Labels />
      <Ready />
    </>
  );
}

export function SceneRoot() {
  const quality = useAppStore((s) => s.quality);
  const q = QUALITY[quality];
  const closeView = useAppStore((s) => s.route.view === 'unit');
  const panoActive = useAppStore((s) => s.panoActive);
  const [dprScale, setDprScale] = useState(1);
  // Scales what this screen actually uses, so a struggling 1x display drops below 1 as well.
  const dpr = useMemo(() => Math.min(window.devicePixelRatio, q.dpr) * dprScale, [q, dprScale]);
  return (
    <Canvas
      flat
      shadows={{ type: q.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap }}
      dpr={dpr}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, logarithmicDepthBuffer: false }}
      camera={{ fov: 36, near: 1, far: 9000, position: [238, 82, 79] }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true;
      }}
      onPointerMissed={() => useAppStore.getState().setHover({ block: null, storey: null, stack: null })}
    >
      <PerformanceMonitor
        bounds={() => [50, 58]}
        flipflops={3}
        onDecline={() => setDprScale((v) => Math.max(0.7, v - 0.15))}
        onIncline={() => setDprScale((v) => Math.min(1, v + 0.1))}
        onFallback={stepDownQuality}
      />
      <Suspense fallback={null}>
        <World q={q} />
        {panoActive ? <PlainRender /> : <PostFx quality={quality} close={closeView} />}
      </Suspense>
      <CameraRig />
    </Canvas>
  );
}
