import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { PerformanceMonitor, type PerformanceMonitorApi } from '@react-three/drei';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { blockById, blocks, type BlockDef } from '@bair/project-data';
import { lastRouteChange, useAppStore, type Quality } from '../store/useAppStore';
import { STOREY_H, VOID_DECK_H } from '@bair/project-data';
import { Block, BlockHighlight, BlockProxy, StoreyBand } from './blocks/Block';
import { FloorTickProjector } from './blocks/FloorTickProjector';
import { CameraRig } from './camera/CameraRig';
import { Labels } from './labels/Labels';
import { Lighting } from './lighting/Lighting';
import { PostFx } from './lighting/PostFx';
import { FrameGrab } from './FrameGrab';
import { Amenities } from './site/Amenities';
import { Cars } from './site/Cars';
import { Surroundings } from './site/Context';
import { People } from './site/People';
import { Ground } from './site/Ground';
import { Lamps } from './site/Lamps';
import { OutdoorDots } from './site/OutdoorDots';
import { Vegetation } from './site/Vegetation';
import { useInteriorSets, useMaterials } from './materials';
import { CLICK_SLOP } from './shared';
import { unitsOnFloor } from '@bair/project-data';
import { FloorPlan } from './floor/FloorPlan';
import { PanoramaLayer } from './unit/PanoramaLayer';
import { requestShadowUpdate } from './lighting/shadowControl';
import { warmUp, whenIdle } from './warmup';

const UnitInterior = lazy(() => import('./unit/UnitInterior'));
const Garage = lazy(() => import('./garage/Garage'));
const InteriorWarmup = lazy(() => import('./unit/InteriorWarmup'));

// Dev-only frame-time probe. The static check removes it from normal production builds.
const TransitionProbe =
  (import.meta.env.DEV || import.meta.env.VITE_PROBE === '1') && (import.meta.env.DEV || location.search.includes('debug'))
    ? lazy(() => import('../dev/TransitionProbe'))
    : null;

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

  const tick = useAppStore((s) => s.inventoryTick);
  const emptyFloor = useMemo(
    () =>
      hoverStorey && isThisBlockView
        ? unitsOnFloor(def.id, hoverStorey).every((u) => u.status !== 'available')
        : false,
    [hoverStorey, isThisBlockView, def.id, tick], // eslint-disable-line react-hooks/exhaustive-deps -- tick: live statuses
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

/**
 * The frame-rate monitor judges the last 2.5 s of frames (10 samples of 250 ms). A route change
 * inside that window means the slow frames were the transition, not the device, so they don't count.
 */
const TRANSITION_GRACE_MS = 2500;
const inTransition = () => performance.now() - lastRouteChange() < TRANSITION_GRACE_MS;

/** After the opening shot, fetch the code for views that aren't open yet, so a first visit doesn't wait for it. */
const OPENING_SECONDS = 5;

/** Compiles the hidden garage and the alternate lawn once both are in the scene. */
function WarmUp() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(
    () =>
      whenIdle(() => {
        void warmUp(gl, scene, camera).catch(() => {});
      }),
    [gl, scene, camera],
  );
  return null;
}

/**
 * Loads the flats' textures ahead of time, then compiles the flat's materials, decor and hotspot dots off-screen
 * (see InteriorWarmup), so the first flat opens without waiting for either in the middle of the glide.
 */
function PrefetchInterior() {
  useInteriorSets();
  return (
    <Suspense fallback={null}>
      <InteriorWarmup />
    </Suspense>
  );
}

function World({ q }: { q: QualitySettings }) {
  const view = useAppStore((s) => s.route.view);
  const sceneReady = useAppStore((s) => s.sceneReady);
  const garage = view === 'garage';
  // The garage is built once (in idle time, or on the first visit) and then only hidden and shown.
  const [garageBuilt, setGarageBuilt] = useState(false);
  const [prefetch, setPrefetch] = useState(false);
  useEffect(() => {
    if (garage) setGarageBuilt(true);
  }, [garage]);
  useEffect(() => {
    if (!sceneReady) return undefined;
    return whenIdle(() => {
      void import('./garage/Garage');
      void import('./unit/UnitInterior');
      setGarageBuilt(true);
      setPrefetch(true);
    }, OPENING_SECONDS * 1000);
  }, [sceneReady]);
  // Heading into a block is heading towards a flat: fetch its textures now rather than at the next idle moment.
  useEffect(() => {
    if (sceneReady && view !== 'overview' && view !== 'outdoor') setPrefetch(true);
  }, [sceneReady, view]);
  // Site layers stay mounted under the garage view: only hidden, so nothing is rebuilt on the way back.
  useEffect(() => {
    requestShadowUpdate();
  }, [garage]);
  return (
    <>
      <Lighting shadowSize={q.shadow} softShadows={q.softShadows} />
      <Ground />
      <group visible={!garage}>
        <Amenities />
      </group>
      <group visible={!garage}>
        <Vegetation density={q.density} />
      </group>
      <group visible={!garage}>
        <Cars moving={q.cars} />
      </group>
      <group visible={!garage}>
        <People density={q.density} />
      </group>
      <Surroundings />
      <group visible={!garage}>
        <Lamps />
      </group>
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
      {(garageBuilt || garage) && (
        <Suspense fallback={null}>
          <Garage />
          <WarmUp />
        </Suspense>
      )}
      <Labels />
      {prefetch && (
        <Suspense fallback={null}>
          <PrefetchInterior />
        </Suspense>
      )}
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
      // three 0.187 dropped PCFSoftShadowMap (it falls back to PCF with a warning); PCF softens by shadow.radius.
      shadows={{ type: THREE.PCFShadowMap }}
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
        onDecline={(api: PerformanceMonitorApi) => {
          if (inTransition()) {
            // Not the device's fault: undo the flip so it doesn't count towards a fallback either.
            api.flipped = Math.max(0, api.flipped - 1);
            return;
          }
          // Never below 85 %: past that the picture turns visibly soft, and dropping a tier (below) is the better trade.
          setDprScale((v) => Math.max(0.85, v - 0.15));
        }}
        onIncline={() => setDprScale((v) => Math.min(1, v + 0.1))}
        onFallback={(api: PerformanceMonitorApi) => {
          if (inTransition()) {
            // Keep monitoring; the next real flip decides.
            api.fallback = false;
            api.flipped = 3;
            return;
          }
          stepDownQuality();
        }}
      />
      <Suspense fallback={null}>
        <World q={q} />
        {panoActive ? (
          <PlainRender />
        ) : (
          <>
            <PostFx quality={quality} close={closeView} />
            <FrameGrab />
          </>
        )}
      </Suspense>
      <CameraRig />
      {TransitionProbe && (
        <Suspense fallback={null}>
          <TransitionProbe />
        </Suspense>
      )}
    </Canvas>
  );
}
