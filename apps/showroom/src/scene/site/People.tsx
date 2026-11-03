// Scale figures around the site, and the same figure for plan views. Modelled from simple forms so they
// read as people at a distance without pretending to be photographs up close.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hashString, mulberry32, outdoorSpots, site, type Vec2 } from '@bair/project-data';

type Part = 'cloth' | 'legs' | 'skin';

const limb = (radius: number, length: number, x: number, top: number, swing: number) => {
  const g = new THREE.CapsuleGeometry(radius, length, 3, 10);
  g.translate(0, -length / 2, 0);
  g.rotateX(swing);
  g.translate(x, top, 0);
  return g;
};

/** One standing or walking figure, 1.7 m tall, facing +z, split by colour. */
export function makeFigure(stride: number): Record<Part, THREE.BufferGeometry> {
  const torso = new THREE.CapsuleGeometry(0.15, 0.42, 4, 12);
  torso.scale(1, 1, 0.68);
  torso.translate(0, 1.16, 0);
  const merge = (parts: THREE.BufferGeometry[]) => {
    const m = mergeGeometries(parts)!;
    parts.forEach((p) => p.dispose());
    return m;
  };
  const head = new THREE.SphereGeometry(0.105, 16, 12);
  head.translate(0, 1.6, 0);
  const hand = (x: number, swing: number) => {
    const g = new THREE.SphereGeometry(0.04, 8, 6);
    g.translate(x, 0.82 + Math.abs(swing) * 0.04, Math.sin(swing) * 0.54);
    return g;
  };
  return {
    cloth: merge([torso, limb(0.045, 0.5, -0.2, 1.36, -stride * 0.8), limb(0.045, 0.5, 0.2, 1.36, stride * 0.8)]),
    legs: merge([limb(0.065, 0.72, -0.08, 0.84, stride), limb(0.065, 0.72, 0.08, 0.84, -stride)]),
    skin: merge([head, hand(-0.2, -stride * 0.8), hand(0.2, stride * 0.8)]),
  };
}

const CLOTH = ['#d9d4c8', '#7b8a93', '#b5553f', '#3f5d7a', '#e8e4da', '#6f7d5f', '#c9a15a', '#44484c'];
const LEGS = ['#2f3640', '#45494e', '#6d6a63', '#27303a', '#8a8378'];
const SKIN = ['#e0b797', '#c99a75', '#a8795a', '#ecc9ac'];
const STANDING = 0.04;
const WALKING = 0.3;

interface Person {
  x: number;
  z: number;
  rot: number;
  scale: number;
}

const clearOfViews = (x: number, z: number) => outdoorSpots.every((s) => Math.hypot(x - s.x, z - s.z) > 5);

function placePeople(density: number) {
  const rnd = mulberry32(hashString('people'));
  const walking: Person[] = [];
  const standing: Person[] = [];
  const scale = () => 0.92 + rnd() * 0.14;
  const walk = (pts: Vec2[], spacing: number) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const dx = pts[i + 1][0] - ax;
      const dz = pts[i + 1][1] - az;
      const len = Math.hypot(dx, dz);
      for (let d = rnd() * spacing; d < len; d += spacing * (0.6 + rnd() * 0.9)) {
        const across = (rnd() - 0.5) * 1.3;
        const x = ax + (dx / len) * d - (dz / len) * across;
        const z = az + (dz / len) * d + (dx / len) * across;
        const back = rnd() < 0.5;
        if (clearOfViews(x, z)) walking.push({ x, z, rot: Math.atan2(dx, dz) + (back ? Math.PI : 0), scale: scale() });
      }
    }
  };
  for (const p of site.paths) walk(p.points, 13 / density);
  for (const a of site.amenities) {
    if (!['playground', 'adultFitness', 'elderlyFitness', 'hardCourt', 'pavilion', 'garden'].includes(a.kind)) continue;
    const count = Math.round((a.size[0] * a.size[1]) / 70 * density) + 1;
    for (let i = 0; i < count; i++) {
      const x = a.position[0] + (rnd() - 0.5) * a.size[0] * 0.8;
      const z = a.position[1] + (rnd() - 0.5) * a.size[1] * 0.8;
      if (clearOfViews(x, z)) standing.push({ x, z, rot: rnd() * Math.PI * 2, scale: scale() });
    }
  }
  return { walking, standing };
}

function Crowd({ people, stride }: { people: Person[]; stride: number }) {
  const meshes = useMemo(() => {
    const figure = makeFigure(stride);
    const rnd = mulberry32(hashString(`crowd-${stride}`));
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    return (Object.keys(figure) as Part[]).map((part) => {
      const material = new THREE.MeshStandardMaterial({ name: `M_Person_${part}`, color: '#ffffff', roughness: part === 'skin' ? 0.6 : 0.9 });
      const palette = part === 'cloth' ? CLOTH : part === 'legs' ? LEGS : SKIN;
      const mesh = new THREE.InstancedMesh(figure[part], material, people.length);
      people.forEach((p, i) => {
        o.position.set(p.x, 0.02, p.z);
        o.rotation.set(0, p.rot, 0);
        o.scale.setScalar(p.scale);
        o.updateMatrix();
        mesh.setMatrixAt(i, o.matrix);
        mesh.setColorAt(i, c.set(palette[Math.floor(rnd() * palette.length)]));
      });
      mesh.castShadow = true;
      mesh.raycast = () => null;
      return mesh;
    });
  }, [people, stride]);
  useEffect(
    () => () =>
      meshes.forEach((m) => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
        m.dispose();
      }),
    [meshes],
  );
  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  );
}

export function People({ density }: { density: number }) {
  const { walking, standing } = useMemo(() => placePeople(density), [density]);
  return (
    <group name="People">
      <Crowd people={walking} stride={WALKING} />
      <Crowd people={standing} stride={STANDING} />
    </group>
  );
}
