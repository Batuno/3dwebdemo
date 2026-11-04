import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { site } from '@bair/project-data';
import { mulberry32 } from '@bair/project-data';
import { sceneUniforms } from '../shared';
import { useAppStore } from '../../store/useAppStore';
import { eastX0, eastX1, northZ0, northZ1, southZ0, southZ1, westX0, westX1 } from './Ground';

// A saloon built from a lofted side profile: x = length, y = height, extruded across the width.
function extrudeProfile(points: [number, number][], width: number, bevel: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.7,
    bevelSegments: 2,
    curveSegments: 4,
    steps: 1,
  });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  return g;
}

function carGeometries() {
  const body = extrudeProfile(
    [
      [-2.25, 0.34],
      [-2.3, 0.62],
      [-2.2, 0.82],
      [-1.75, 0.92],
      [-0.9, 0.96],
      [0.9, 0.98],
      [1.55, 0.94],
      [2.1, 0.8],
      [2.28, 0.62],
      [2.25, 0.34],
      [1.75, 0.28],
      [-1.75, 0.28],
    ],
    1.78,
    0.1,
  );
  const cabinTop = extrudeProfile(
    [
      [-1.7, 0.93],
      [-1.15, 1.34],
      [-0.55, 1.44],
      [0.45, 1.44],
      [1.02, 1.28],
      [1.5, 0.95],
    ],
    1.52,
    0.06,
  );
  const roof = extrudeProfile(
    [
      [-1.08, 1.38],
      [-0.55, 1.46],
      [0.45, 1.46],
      [0.95, 1.33],
    ],
    1.44,
    0.03,
  );
  const wheels: THREE.BufferGeometry[] = [];
  for (const x of [-1.42, 1.42]) {
    for (const z of [-0.8, 0.8]) {
      const w = new THREE.CylinderGeometry(0.32, 0.32, 0.22, 14);
      w.rotateX(Math.PI / 2);
      w.translate(x, 0.32, z);
      wheels.push(w);
    }
  }
  const lightsF: THREE.BufferGeometry[] = [];
  const lightsR: THREE.BufferGeometry[] = [];
  for (const z of [-0.62, 0.62]) {
    const h = new THREE.BoxGeometry(0.06, 0.13, 0.34);
    h.translate(2.32, 0.68, z);
    lightsF.push(h);
    const t = new THREE.BoxGeometry(0.05, 0.12, 0.42);
    t.translate(-2.34, 0.75, z);
    lightsR.push(t);
  }
  const res = {
    body: mergeGeometries([body.toNonIndexed(), roof.toNonIndexed()])!,
    glass: cabinTop,
    wheels: mergeGeometries(wheels)!,
    front: mergeGeometries(lightsF)!,
    rear: mergeGeometries(lightsR)!,
  };
  for (const g of [res.body, res.glass]) g.computeVertexNormals();
  return res;
}

interface MovingCar {
  lane: number;
  axis: 'x' | 'z';
  dir: 1 | -1;
  pos: number;
  speed: number;
}

interface ParkedCar {
  x: number;
  z: number;
  rot: number;
}

const PAINT = ['#e8e8e6', '#1b1c1f', '#7c8085', '#c7c9cb', '#23304a', '#8b1f23', '#f0efe9', '#3c4044', '#a0a4a8'];
const RANGE = 420;

export function Cars({ moving = 18 }: { moving?: number }) {
  const geos = useMemo(carGeometries, []);
  const bodyRef = useRef<THREE.InstancedMesh>(null);

  const { cars, parked } = useMemo(() => {
    const rnd = mulberry32(404);
    const list: MovingCar[] = [];
    const sc = (southZ0 + southZ1) / 2;
    const eastC = (eastX0 + eastX1) / 2;
    const westC = (westX0 + westX1) / 2;
    const northC = (northZ0 + northZ1) / 2;
    const add = (lane: number, axis: 'x' | 'z', dir: 1 | -1, n: number) => {
      for (let i = 0; i < n; i++) {
        list.push({ lane, axis, dir, pos: -RANGE + (i + rnd() * 0.6) * ((RANGE * 2) / n), speed: 7 + rnd() * 3.5 });
      }
    };
    const unit = Math.max(1, Math.round(moving / 9));
    // Two lanes each way on the main road; right-hand traffic as in Mongolia
    add(eastC + 5.5, 'z', -1, unit * 2);
    add(eastC + 2, 'z', -1, unit);
    add(eastC - 5.5, 'z', 1, unit * 2);
    add(eastC - 2, 'z', 1, unit);
    add(sc + 2.2, 'x', -1, unit);
    add(sc - 2.2, 'x', 1, unit);
    add(westC + 2.2, 'z', 1, Math.max(1, unit - 1));
    add(northC + 2.2, 'x', 1, Math.max(1, unit - 1));
    const stay: ParkedCar[] = [];
    // Parked along the drop-off and on the side streets
    const drop = site.amenities.find((a) => a.kind === 'dropOff')!;
    stay.push({ x: drop.position[0] + 1, z: drop.position[1] + 1.6, rot: 0 });
    for (let i = 0; i < 7; i++) {
      stay.push({ x: 40 + i * 5.2, z: southZ0 + 1.35, rot: 0 });
      stay.push({ x: westX0 - 1.35, z: -30 + i * 7, rot: -Math.PI / 2 });
      stay.push({ x: 42 + i * 5.2, z: northZ0 - 1.35, rot: 0 });
    }
    return { cars: list, parked: stay };
  }, [moving]);

  const total = cars.length + parked.length;

  const material = useMemo(
    () => ({
      body: new THREE.MeshPhysicalMaterial({ name: 'M_CarPaint', color: '#8c9096', roughness: 0.32, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.06 }),
      glass: new THREE.MeshPhysicalMaterial({ name: 'M_CarGlass', color: '#0d1214', roughness: 0.05, metalness: 0.2, envMapIntensity: 1.5 }),
      wheels: new THREE.MeshStandardMaterial({ name: 'M_CarTyre', color: '#111213', roughness: 0.85 }),
      front: new THREE.MeshStandardMaterial({ name: 'M_CarHeadlight', color: '#e6e6e0', emissive: '#fff1cf', emissiveIntensity: 0, roughness: 0.2 }),
      rear: new THREE.MeshStandardMaterial({ name: 'M_CarTaillight', color: '#5a0d0d', emissive: '#ff2a1a', emissiveIntensity: 0, roughness: 0.3 }),
    }),
    [],
  );

  const meshes = useMemo(() => {
    const mk = (g: THREE.BufferGeometry, m: THREE.Material, shadow = true) => {
      const im = new THREE.InstancedMesh(g, m, total);
      im.frustumCulled = false;
      im.castShadow = shadow;
      im.receiveShadow = false;
      im.raycast = () => null;
      return im;
    };
    return {
      body: mk(geos.body, material.body),
      glass: mk(geos.glass, material.glass),
      wheels: mk(geos.wheels, material.wheels),
      front: mk(geos.front, material.front, false),
      rear: mk(geos.rear, material.rear, false),
    };
  }, [geos, material, total]);

  useEffect(() => {
    const rnd = mulberry32(99);
    const c = new THREE.Color();
    for (let i = 0; i < total; i++) {
      c.set(PAINT[Math.floor(rnd() * PAINT.length)]);
      meshes.body.setColorAt(i, c);
    }
    meshes.body.instanceColor!.needsUpdate = true;
    // Parked cars get placed once
    const o = new THREE.Object3D();
    parked.forEach((p, k) => {
      o.position.set(p.x, 0.02, p.z);
      o.rotation.set(0, p.rot, 0);
      o.updateMatrix();
      const i = cars.length + k;
      for (const m of Object.values(meshes)) m.setMatrixAt(i, o.matrix);
    });
    return () => {
      for (const m of Object.values(meshes)) m.dispose();
    };
  }, [meshes, parked, cars.length, total]);

  const obj = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    // Hidden while the garage is open: nothing to move.
    if (useAppStore.getState().route.view === 'garage') return;
    const step = Math.min(dt, 0.1);
    cars.forEach((car, i) => {
      car.pos += car.dir * car.speed * step;
      if (car.pos > RANGE) car.pos = -RANGE;
      if (car.pos < -RANGE) car.pos = RANGE;
      if (car.axis === 'x') {
        obj.position.set(car.pos, 0.02, car.lane);
        obj.rotation.set(0, car.dir > 0 ? 0 : Math.PI, 0);
      } else {
        obj.position.set(car.lane, 0.02, car.pos);
        obj.rotation.set(0, car.dir > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
      }
      obj.updateMatrix();
      for (const m of Object.values(meshes)) m.setMatrixAt(i, obj.matrix);
    });
    for (const m of Object.values(meshes)) m.instanceMatrix.needsUpdate = true;
    const n = sceneUniforms.uNight.value;
    material.front.emissiveIntensity = n * 14;
    material.rear.emissiveIntensity = n * 4;
  });

  return (
    <group name="Cars" ref={bodyRef as never}>
      {Object.entries(meshes).map(([k, m]) => (
        <primitive key={k} object={m} />
      ))}
    </group>
  );
}

