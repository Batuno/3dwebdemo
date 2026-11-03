import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { site, type Vec2 } from '@bair/project-data';
import { sceneUniforms } from '../shared';
import { CROSSWALK_Z, eastX0, eastX1, northZ0, smoothPath, southZ0, STREET, westX0 } from './Ground';

function streetLampSpots() {
  const street: { x: number; z: number; rot: number }[] = [];
  for (let x = -260; x <= 260; x += 34) {
    street.push({ x, z: southZ0 - 0.9, rot: -Math.PI / 2 });
    street.push({ x, z: northZ0 + 0.9, rot: Math.PI / 2 });
  }
  for (let z = -220; z <= 220; z += 34) {
    if (Math.abs(z - CROSSWALK_Z) < 4) continue;
    street.push({ x: eastX0 - 0.9, z, rot: 0 });
    street.push({ x: eastX1 + 1.2, z: z + 17, rot: Math.PI });
    street.push({ x: westX0 + 0.9, z, rot: Math.PI });
  }
  return street;
}

function pathLampSpots(): Vec2[] {
  const out: Vec2[] = [];
  for (const p of site.paths) {
    const pts = smoothPath(p.points, 2);
    for (let i = 0; i < pts.length; i += 7) {
      // Beside the paving, whichever way the path runs.
      const [ax, az] = pts[Math.max(0, i - 1)];
      const [bx, bz] = pts[Math.min(pts.length - 1, i + 1)];
      const len = Math.hypot(bx - ax, bz - az) || 1;
      const off = p.width / 2 + 0.45;
      out.push([pts[i][0] - ((bz - az) / len) * off, pts[i][1] + ((bx - ax) / len) * off]);
    }
  }
  return out;
}

function poolTexture(): THREE.Texture {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(255,214,150,0.95)');
  grad.addColorStop(0.35, 'rgba(255,190,120,0.42)');
  grad.addColorStop(1, 'rgba(255,170,100,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function Lamps() {
  const streetSpots = useMemo(streetLampSpots, []);
  const pathSpots = useMemo(pathLampSpots, []);

  const { poleGeo, headGeo, bollardGeo, bulbGeo } = useMemo(() => {
    const pole = new THREE.CylinderGeometry(0.07, 0.11, 8.5, 8);
    pole.translate(0, 4.25, 0);
    const arm = new THREE.CylinderGeometry(0.045, 0.045, 1.6, 6);
    arm.rotateZ(Math.PI / 2);
    arm.translate(0.8, 8.5, 0);
    const head = new THREE.BoxGeometry(0.75, 0.12, 0.28);
    head.translate(1.6, 8.44, 0);
    const bollard = new THREE.CylinderGeometry(0.05, 0.06, 3.2, 8);
    bollard.translate(0, 1.6, 0);
    const bulb = new THREE.SphereGeometry(0.17, 12, 8);
    bulb.translate(0, 3.3, 0);
    return { poleGeo: mergeGeometries([pole, arm])!, headGeo: head, bollardGeo: bollard, bulbGeo: bulb };
  }, []);

  const steel = useMemo(() => new THREE.MeshStandardMaterial({ name: 'M_LampPole', color: '#34373a', roughness: 0.5, metalness: 0.7 }), []);
  const glow = useMemo(
    () => new THREE.MeshStandardMaterial({ name: 'M_LampGlow', color: '#f5efe2', emissive: '#ffcf96', emissiveIntensity: 0, roughness: 0.4 }),
    [],
  );
  const poolTex = useMemo(poolTexture, []);
  const poolMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: poolTex,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    [poolTex],
  );

  const meshes = useMemo(() => {
    const o = new THREE.Object3D();
    const place = (g: THREE.BufferGeometry, m: THREE.Material, spots: { x: number; y?: number; z: number; rot?: number; s?: number }[], shadow = false) => {
      const im = new THREE.InstancedMesh(g, m, spots.length);
      spots.forEach((s, i) => {
        o.position.set(s.x, s.y ?? STREET.curb, s.z);
        o.rotation.set(0, s.rot ?? 0, 0);
        o.scale.setScalar(s.s ?? 1);
        o.updateMatrix();
        im.setMatrixAt(i, o.matrix);
      });
      im.frustumCulled = false;
      im.castShadow = shadow;
      im.raycast = () => null;
      return im;
    };
    const lampPath = pathSpots.map(([x, z]) => ({ x, z }));
    const poolGeo = new THREE.PlaneGeometry(1, 1);
    poolGeo.rotateX(-Math.PI / 2);
    return [
      place(poleGeo, steel, streetSpots, true),
      place(headGeo, glow, streetSpots),
      place(bollardGeo, steel, lampPath),
      place(bulbGeo, glow, lampPath),
      place(
        poolGeo,
        poolMat,
        streetSpots.map((s) => ({
          x: s.x + Math.cos(s.rot) * 1.6,
          z: s.z - Math.sin(s.rot) * 1.6,
          y: 0.25,
          s: 17,
        })),
      ),
      place(poolGeo, poolMat, lampPath.map((s) => ({ ...s, y: STREET.curb + 0.09, s: 9.5 }))),
    ];
  }, [poleGeo, headGeo, bollardGeo, bulbGeo, steel, glow, poolMat, streetSpots, pathSpots]);

  useEffect(() => () => meshes.forEach((m) => m.dispose()), [meshes]);

  useFrame(() => {
    const n = sceneUniforms.uNight.value;
    glow.emissiveIntensity = n * 9;
    poolMat.opacity = n * 0.36;
    meshes[4].visible = meshes[5].visible = n > 0.01;
  });

  return (
    <group name="Lamps">
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  );
}
