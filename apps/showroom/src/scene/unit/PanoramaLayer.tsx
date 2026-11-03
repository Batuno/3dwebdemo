// Shows a rendered 360° image around the camera when one exists for the current hotspot, crossfading
// between the two nearest rendered times. Without a render, this draws nothing and real-time carries on.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  blockById,
  interiorRenderKey,
  interiors,
  outdoorPose,
  outdoorRenderKey,
  outdoorSpotById,
  renderBlend,
  spotPose,
  unitXform,
  type PanoramaFile,
  type SpotPose,
} from '@bair/project-data';
import { rendersBase } from '../../lib/renderManifest';
import type { Route } from '../../lib/routing';
import { useAppStore } from '../../store/useAppStore';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const FRAG = /* glsl */ `
  uniform sampler2D uFrom;
  uniform sampler2D uTo;
  uniform float uT;
  varying vec2 vUv;
  void main() {
    gl_FragColor = vec4(mix(texture2D(uFrom, vUv).rgb, texture2D(uTo, vUv).rgb, uT), 1.0);
    #include <colorspace_fragment>
  }`;

interface Target {
  files: Record<string, PanoramaFile>;
  pose: SpotPose;
  rotY: number;
  mirror: boolean;
}

function targetFor(route: Route, panoramas: Record<string, Record<string, PanoramaFile>>): Target | null {
  if (route.view === 'outdoor') {
    const spot = outdoorSpotById(route.spot);
    const files = panoramas[outdoorRenderKey(route.spot)];
    return spot && files ? { files, pose: outdoorPose(spot), rotY: 0, mirror: false } : null;
  }
  if (route.view !== 'unit' || !route.spot) return null;
  const def = blockById(route.block)!;
  const st = def.stacks.find((s) => s.stack === route.stack)!;
  const h = interiors[st.type].hotspots.find((x) => x.id === route.spot);
  // Window views stay real-time, so the outside matches this flat's own storey.
  if (!h || h.kind === 'window') return null;
  const files = panoramas[interiorRenderKey(st.type, h.id)];
  if (!files) return null;
  const xf = unitXform(def, st);
  return { files, pose: spotPose(def, st, route.storey, h), rotY: xf.rotY, mirror: st.mirror };
}

class PanoramaTextures {
  private cache = new Map<string, { texture: THREE.Texture; loaded: boolean }>();
  private loader = new THREE.TextureLoader();

  /** The best version loaded so far, starting the low-res and full loads if needed. */
  get(file: PanoramaFile): THREE.Texture | null {
    const full = this.request(file.full);
    if (full.loaded) return full.texture;
    if (file.low) {
      const low = this.request(file.low);
      if (low.loaded) return low.texture;
    }
    return null;
  }

  private request(path: string) {
    let entry = this.cache.get(path);
    if (!entry) {
      const created = {
        loaded: false,
        texture: this.loader.load(`${rendersBase()}${path}`, () => {
          created.loaded = true;
        }),
      };
      created.texture.colorSpace = THREE.SRGBColorSpace;
      created.texture.minFilter = THREE.LinearFilter;
      created.texture.generateMipmaps = false;
      created.texture.wrapS = THREE.RepeatWrapping;
      this.cache.set(path, created);
      entry = created;
    }
    return entry;
  }

  dispose() {
    this.cache.forEach((e) => e.texture.dispose());
    this.cache.clear();
  }
}

export function PanoramaLayer() {
  const route = useAppStore((s) => s.route);
  const manifest = useAppStore((s) => s.manifest);
  const setPanoActive = useAppStore((s) => s.setPanoActive);
  const target = useMemo(() => (manifest ? targetFor(route, manifest.panoramas) : null), [route, manifest]);
  const textures = useMemo(() => new PanoramaTextures(), []);
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        name: 'M_Panorama',
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: { uFrom: { value: null }, uTo: { value: null }, uT: { value: 0 } },
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  );
  const uniforms = material.uniforms;
  // Outward-facing sphere seen from inside: flipping x reads the image the right way round, and the
  // quarter turn puts the image centre at -z, the plan's north.
  const geometry = useMemo(() => {
    const g = new THREE.SphereGeometry(1, 64, 32);
    g.scale(-1, 1, 1);
    g.rotateY(-Math.PI / 2);
    return g;
  }, []);

  useEffect(() => () => textures.dispose(), [textures]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    uniforms.uFrom.value = null;
    uniforms.uTo.value = null;
    if (!target) setPanoActive(false);
  }, [target, uniforms, setPanoActive]);

  useFrame(() => {
    if (!target) return;
    const blend = renderBlend(Object.keys(target.files), useAppStore.getState().time);
    if (!blend) return;
    const from = textures.get(target.files[blend.from]);
    const to = textures.get(target.files[blend.to]);
    const ready = !!(from && to);
    if (ready) {
      uniforms.uFrom.value = from;
      uniforms.uTo.value = to;
      uniforms.uT.value = blend.t;
    }
    const showing = !!uniforms.uFrom.value;
    if (mesh.current) mesh.current.visible = showing;
    if (useAppStore.getState().panoActive !== showing) setPanoActive(showing);
  });

  if (!target) return null;
  const { pose, rotY, mirror } = target;
  return (
    <mesh
      ref={mesh}
      name="panorama"
      geometry={geometry}
      material={material}
      position={pose.pos}
      rotation-y={rotY}
      scale={[mirror ? -1 : 1, 1, 1]}
      visible={false}
      frustumCulled={false}
      renderOrder={-20}
      raycast={() => null}
    />
  );
}
