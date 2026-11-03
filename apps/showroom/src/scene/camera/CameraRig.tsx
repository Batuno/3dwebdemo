import { useEffect, useMemo, useRef } from 'react';
import { CameraControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import CameraControlsImpl from 'camera-controls';
import * as THREE from 'three';
import { blockById, cameras, garage, headingOnPlan, interiors, outdoorPose, outdoorSpotById, roofY, spotPose, storeyY, unitXform, type SpotPose } from '@bair/project-data';
import { useAppStore } from '../../store/useAppStore';
import type { Route } from '../../lib/routing';
import { getGroundCollider, getOccluders } from '../labels/occluders';
import { povState } from '../unit/povState';

export interface Shot {
  pos: [number, number, number];
  target: [number, number, number];
  minDistance: number;
  maxDistance: number;
  minPolar: number;
  maxPolar: number;
  fov: number;
}

const rad = THREE.MathUtils.degToRad;

const INTRO_SECONDS = 2.6;
const INTRO_PULL_BACK = 0.14;
/** The loading screen takes this long to fade after the scene is ready. */
const INTRO_DELAY = 1.1;

const OPENING: Shot = {
  ...cameras.opening,
  minDistance: 45,
  maxDistance: 520,
  minPolar: rad(18),
  // Above 90 degrees the camera looks up at the towers from near the ground.
  maxPolar: rad(104),
};

export function shotFor(route: Route): Shot {
  switch (route.view) {
    case 'overview':
    case 'outdoor':
      return OPENING;
    case 'garage':
      return {
        pos: [62, 42, 98],
        target: [0, garage.depthY, 0],
        minDistance: 25,
        maxDistance: 170,
        minPolar: rad(15),
        maxPolar: rad(78),
        fov: 38,
      };
    case 'block': {
      const b = blockById(route.block)!;
      const h = roofY(b);
      // 3/4 view from the sunlit side. While 804A is in focus, 804B is cut down (see clipTarget).
      return {
        pos: [b.position[0] + 112, h * 0.72, b.position[1] + 142],
        target: [b.position[0] + 2, h * 0.5, b.position[1]],
        minDistance: 70,
        maxDistance: 320,
        minPolar: rad(40),
        maxPolar: rad(100),
        fov: 34,
      };
    }
    case 'floor': {
      const b = blockById(route.block)!;
      const y = storeyY(route.storey);
      return {
        pos: [b.position[0] + 6, y + 122, b.position[1] + 80],
        target: [b.position[0], y, b.position[1] + 1],
        minDistance: 28,
        maxDistance: 180,
        minPolar: rad(8),
        maxPolar: rad(72),
        fov: 34,
      };
    }
    case 'unit': {
      const b = blockById(route.block)!;
      const st = b.stacks.find((x) => x.stack === route.stack)!;
      const xf = unitXform(b, st);
      const y = storeyY(route.storey);
      const front = xf.dir(0, -1);
      const span = Math.max(xf.layout.width, xf.layout.depth);
      const cx = b.position[0] + xf.center[0];
      const cz = b.position[1] + xf.center[1];
      const dist = span * 1.45 + 5;
      return {
        pos: [cx + front[0] * dist * 0.42 + 2, y + dist * 0.98, cz + front[1] * dist * 0.42 + 2],
        target: [cx, y + 0.4, cz],
        minDistance: 5,
        maxDistance: dist * 2,
        minPolar: rad(5),
        maxPolar: rad(78),
        fov: 38,
      };
    }
  }
}

const POV_FADE_MS = 220;
const POV_FOV_MIN = 55;
const POV_FOV_MAX = 80;

/** The eye-level camera for a route, when it is standing at a hotspot. */
function poseFor(route: Route): SpotPose | null {
  if (route.view === 'outdoor') {
    const spot = outdoorSpotById(route.spot);
    return spot ? outdoorPose(spot) : null;
  }
  if (route.view !== 'unit' || !route.spot) return null;
  const def = blockById(route.block)!;
  const st = def.stacks.find((s) => s.stack === route.stack)!;
  const h = interiors[st.type].hotspots.find((x) => x.id === route.spot);
  return h ? spotPose(def, st, route.storey, h) : null;
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

// Zooming the overview out tilts it from the low hero angle up to the elevated 3/4 view.
const heroDistance = new THREE.Vector3(...cameras.opening.pos).distanceTo(new THREE.Vector3(...cameras.opening.target));
const overviewDistance = new THREE.Vector3(...cameras.overview.pos).distanceTo(new THREE.Vector3(...cameras.overview.target));
const polarOf = (c: { pos: number[]; target: number[] }) =>
  Math.acos((c.pos[1] - c.target[1]) / Math.hypot(c.pos[0] - c.target[0], c.pos[1] - c.target[1], c.pos[2] - c.target[2]));
const heroPolar = polarOf(cameras.opening);
const overviewPolar = polarOf(cameras.overview);
const zoomBlend = (d: number) => THREE.MathUtils.smoothstep(d, heroDistance, overviewDistance);

export function CameraRig() {
  const ref = useRef<CameraControlsImpl>(null);
  const route = useAppStore((s) => s.route);
  const resetTick = useAppStore((s) => s.resetTick);
  const flyTarget = useAppStore((s) => s.flyTarget);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const reduce = useMemo(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);
  const firstRun = useRef(true);
  // The slow push-in that opens the demo. Any user input cuts it short and hands over control.
  const intro = useRef<{ t: number; wait: number; from: THREE.Vector3; to: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const lastZoom = useRef(0);
  const lastDistance = useRef(0);
  const wasInside = useRef(false);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const cancelIntro = () => {
      intro.current = null;
    };
    c.addEventListener('controlstart', cancelIntro);
    const el = gl.domElement;
    const markZoom = (e?: Event) => {
      lastZoom.current = performance.now();
      intro.current = null;
      if (e instanceof WheelEvent && poseFor(useAppStore.getState().route)) {
        camera.fov = THREE.MathUtils.clamp(camera.fov + Math.sign(e.deltaY) * 2.5, POV_FOV_MIN, POV_FOV_MAX);
        camera.updateProjectionMatrix();
      }
    };
    const onTouch = (e: TouchEvent) => {
      if (e.touches.length === 2) markZoom();
    };
    el.addEventListener('wheel', markZoom, { passive: true });
    el.addEventListener('touchmove', onTouch, { passive: true });
    return () => {
      c.removeEventListener('controlstart', cancelIntro);
      el.removeEventListener('wheel', markZoom);
      el.removeEventListener('touchmove', onTouch);
    };
  }, [gl, camera]);

  // Double-click or double-tap flies to the point under the pointer.
  useEffect(() => {
    const el = gl.domElement;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let last = { t: 0, x: 0, y: 0 };
    const up = (e: PointerEvent) => {
      const now = performance.now();
      const near = Math.hypot(e.clientX - last.x, e.clientY - last.y) < 24;
      const twice = now - last.t < 320 && near;
      last = { t: now, x: e.clientX, y: e.clientY };
      if (!twice) return;
      const view = useAppStore.getState().route.view;
      if (view !== 'overview' && view !== 'block') return;
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects([...getOccluders(), getGroundCollider()], false)[0];
      if (hit) useAppStore.getState().flyTo([hit.point.x, Math.max(hit.point.y, 4), hit.point.z]);
    };
    el.addEventListener('pointerup', up);
    return () => el.removeEventListener('pointerup', up);
  }, [gl, camera]);

  // On phones, tilting the device looks around while standing at a hotspot.
  useEffect(() => {
    let last: { alpha: number; beta: number } | null = null;
    const onTilt = (e: DeviceOrientationEvent) => {
      const c = ref.current;
      if (!c || e.alpha == null || e.beta == null || !poseFor(useAppStore.getState().route)) {
        last = null;
        return;
      }
      if (last) {
        let da = e.alpha - last.alpha;
        if (da > 180) da -= 360;
        if (da < -180) da += 360;
        c.rotate(rad(da), rad(e.beta - last.beta), false);
      }
      last = { alpha: e.alpha, beta: e.beta };
    };
    window.addEventListener('deviceorientation', onTilt, { passive: true });
    return () => window.removeEventListener('deviceorientation', onTilt);
  }, []);

  useEffect(() => {
    const c = ref.current;
    if (!c || !flyTarget) return;
    intro.current = null;
    c.moveTo(flyTarget.pos[0], flyTarget.pos[1], flyTarget.pos[2], !reduce);
    c.dollyTo(Math.max(c.minDistance, c.distance * 0.62), !reduce);
  }, [flyTarget, reduce]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const store = useAppStore.getState();
    const pose = poseFor(route);
    const first = firstRun.current;
    // Moving between hotspots, or in and out of one, happens behind a quick fade so the camera
    // never passes through a wall.
    const cover = !first && (pose !== null || wasInside.current);
    wasInside.current = pose !== null;
    const animate = !reduce && !first && !cover;
    firstRun.current = false;

    const standAt = (p: SpotPose) => {
      c.colliderMeshes = [];
      c.setBoundary();
      c.minDistance = 0.01;
      c.maxDistance = 0.2;
      c.minPolarAngle = rad(35);
      c.maxPolarAngle = rad(140);
      c.azimuthRotateSpeed = -0.38;
      c.polarRotateSpeed = -0.38;
      c.mouseButtons.right = CameraControlsImpl.ACTION.NONE;
      c.mouseButtons.middle = CameraControlsImpl.ACTION.NONE;
      c.mouseButtons.wheel = CameraControlsImpl.ACTION.NONE;
      c.touches.two = CameraControlsImpl.ACTION.NONE;
      camera.fov = p.fov;
      camera.near = 0.08;
      camera.far = 5000;
      camera.updateProjectionMatrix();
      c.setFocalOffset(0, 0, 0, false);
      const [x, y, z] = p.pos;
      c.setLookAt(x, y, z, x + p.dir[0] * 0.05, y + p.dir[1] * 0.05, z + p.dir[2] * 0.05, false);
    };

    if (pose) {
      if (!cover) {
        standAt(pose);
        return undefined;
      }
      store.setPovFade(true);
      const id = setTimeout(() => {
        standAt(pose);
        store.setPovFade(false);
      }, POV_FADE_MS);
      return () => clearTimeout(id);
    }

    c.azimuthRotateSpeed = 1;
    c.polarRotateSpeed = 1;
    c.mouseButtons.right = CameraControlsImpl.ACTION.TRUCK;
    c.mouseButtons.middle = CameraControlsImpl.ACTION.DOLLY;
    c.mouseButtons.wheel = CameraControlsImpl.ACTION.DOLLY;
    c.touches.two = CameraControlsImpl.ACTION.TOUCH_DOLLY_TRUCK;
    camera.far = 9000;
    if (cover) {
      store.setPovFade(true);
      setTimeout(() => store.setPovFade(false), POV_FADE_MS);
    }

    const shot = shotFor(route);
    // Narrow screens need to pull back so the buildings still fit.
    const aspect = size.width / Math.max(1, size.height);
    const fit = aspect < 1 ? THREE.MathUtils.clamp(0.95 / aspect, 1, 2.3) : 1;
    const [tx, ty, tz] = shot.target;
    const px = tx + (shot.pos[0] - tx) * fit;
    const py = ty + (shot.pos[1] - ty) * fit;
    const pz = tz + (shot.pos[2] - tz) * fit;

    c.minPolarAngle = shot.minPolar;
    c.maxPolarAngle = shot.maxPolar;
    c.minDistance = shot.minDistance * Math.min(fit, 1.3);
    c.maxDistance = shot.maxDistance * fit;
    camera.fov = shot.fov;
    camera.near = route.view === 'unit' ? 0.5 : 1;
    camera.updateProjectionMatrix();

    const open = route.view === 'overview' || route.view === 'block';
    // Outside views may not enter a building or go below ground, or wander off the site.
    c.colliderMeshes = open ? [getGroundCollider()] : [];
    if (open) c.setBoundary(new THREE.Box3(new THREE.Vector3(-170, 0, -170), new THREE.Vector3(170, 95, 170)));
    else c.setBoundary();
    c.dollyToCursor = route.view === 'overview' || route.view === 'floor';

    // Keep the subject clear of the side panel on wide screens.
    const span = 2 * Math.hypot(px - tx, py - ty, pz - tz) * Math.tan(rad(shot.fov / 2)) * aspect;
    const wide = size.width >= 768;
    const shift = !wide ? 0 : route.view === 'floor' ? -0.1 : route.view === 'unit' || route.view === 'garage' ? 0.11 : route.view === 'block' ? 0.17 : 0;
    // On phones the sheet covers the bottom instead, so lift the subject.
    const lift = wide || route.view === 'overview' || route.view === 'block' ? 0 : 0.2 * (span / aspect);
    c.setFocalOffset(shift * span, lift, 0, animate);

    if (first && route.view === 'overview' && !reduce) {
      const to = new THREE.Vector3(px, py, pz);
      const target = new THREE.Vector3(tx, ty, tz);
      const from = to.clone().sub(target).multiplyScalar(1 + INTRO_PULL_BACK).add(target);
      c.setLookAt(from.x, from.y, from.z, tx, ty, tz, false);
      intro.current = { t: 0, wait: INTRO_DELAY, from, to, target };
    } else {
      intro.current = null;
      c.setLookAt(px, py, pz, tx, ty, tz, animate);
    }
    lastDistance.current = 0;
    return undefined;
  }, [route, resetTick, camera, reduce, size.width, size.height]);

  const step = useMemo(() => new THREE.Vector3(), []);
  const local = useMemo(() => new THREE.Vector3(), []);
  const lookDir = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const c = ref.current;
    if (!c) return;
    const now = useAppStore.getState().route;
    if (now.view === 'unit' && now.spot) {
      const def = blockById(now.block)!;
      const st = def.stacks.find((s) => s.stack === now.stack)!;
      camera.getWorldDirection(lookDir);
      povState.heading = headingOnPlan(def, st, lookDir.x, lookDir.z);
      return;
    }
    const run = intro.current;
    if (run) {
      if (!useAppStore.getState().sceneReady) return;
      // A slow first frame must not swallow the move.
      const frame = Math.min(dt, 0.05);
      if (run.wait > 0) {
        run.wait -= frame;
        return;
      }
      run.t = Math.min(1, run.t + frame / INTRO_SECONDS);
      step.lerpVectors(run.from, run.to, easeOut(run.t));
      c.setLookAt(step.x, step.y, step.z, run.target.x, run.target.y, run.target.z, false);
      if (run.t >= 1) intro.current = null;
      return;
    }
    const view = useAppStore.getState().route.view;
    if (view === 'overview' || view === 'block') {
      // Back out along the view line if the camera ever ends up inside a tower.
      for (const box of getOccluders()) {
        const size = (box.geometry as THREE.BoxGeometry).parameters;
        local.copy(camera.position);
        box.worldToLocal(local);
        if (Math.abs(local.x) < size.width / 2 + 2 && Math.abs(local.y) < size.height / 2 + 2 && Math.abs(local.z) < size.depth / 2 + 2) {
          c.dollyTo(c.distance + 4, false);
          break;
        }
      }
    }
    if (view !== 'overview') return;
    const d = c.distance;
    const zooming = performance.now() - lastZoom.current < 450;
    if (zooming && lastDistance.current > 0) {
      const delta = zoomBlend(d) - zoomBlend(lastDistance.current);
      if (delta !== 0) {
        c.rotatePolarTo(c.polarAngle + delta * (overviewPolar - heroPolar), false);
        const t = c.getTarget(step);
        c.moveTo(t.x, t.y + delta * (cameras.overview.target[1] - cameras.opening.target[1]), t.z, false);
      }
    }
    lastDistance.current = d;
  });

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.smoothTime = 0.42;
    c.draggingSmoothTime = 0.14;
    c.mouseButtons.left = CameraControlsImpl.ACTION.ROTATE;
    c.mouseButtons.right = CameraControlsImpl.ACTION.TRUCK;
    c.mouseButtons.middle = CameraControlsImpl.ACTION.DOLLY;
    c.mouseButtons.wheel = CameraControlsImpl.ACTION.DOLLY;
    c.touches.one = CameraControlsImpl.ACTION.TOUCH_ROTATE;
    c.touches.two = CameraControlsImpl.ACTION.TOUCH_DOLLY_TRUCK;
    c.touches.three = CameraControlsImpl.ACTION.NONE;
    if (import.meta.env.DEV) Object.assign(window, { __controls: c });
  }, []);

  return <CameraControls ref={ref as never} makeDefault />;
}
