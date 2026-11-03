// Furniture modelled to the exact Appendix A size. Each model is built in its own frame: width along x,
// depth along z, front toward +z, floor at y = 0. Nothing here scales a piece to fit a room.
import { memo, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Facing, FurniturePiece } from '@bair/project-data';
import type { InteriorMaterialName, InteriorMaterials } from './interiorMaterials';

const boxes = new Map<string, THREE.BufferGeometry>();

/** UVs in metres, so a texture keeps its real size on any piece instead of stretching to each face. */
function metreUvs(g: THREE.BufferGeometry) {
  const p = g.getAttribute('position');
  const n = g.getAttribute('normal');
  const uv = g.getAttribute('uv');
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i));
    const ny = Math.abs(n.getY(i));
    const nz = Math.abs(n.getZ(i));
    if (ny >= nx && ny >= nz) uv.setXY(i, p.getX(i), p.getZ(i));
    else if (nx >= nz) uv.setXY(i, p.getZ(i), p.getY(i));
    else uv.setXY(i, p.getX(i), p.getY(i));
  }
  uv.needsUpdate = true;
}

function boxGeometry(sx: number, sy: number, sz: number, r: number): THREE.BufferGeometry {
  const key = `${sx.toFixed(3)}|${sy.toFixed(3)}|${sz.toFixed(3)}|${r}`;
  let g = boxes.get(key);
  if (!g) {
    const bevel = Math.min(r, sx / 2.01, sy / 2.01, sz / 2.01);
    g = bevel > 0.001 ? new RoundedBoxGeometry(sx, sy, sz, 2, bevel) : new THREE.BoxGeometry(sx, sy, sz);
    metreUvs(g);
    boxes.set(key, g);
  }
  return g;
}

interface PartProps {
  m: InteriorMaterialName;
  /** Corner-free placement: centre x, bottom y, centre z. */
  at: [number, number, number];
  size: [number, number, number];
  r?: number;
}

function makeKit(mats: InteriorMaterials) {
  const B = ({ m, at, size, r = 0.008 }: PartProps) => (
    <mesh
      position={[at[0], at[1] + size[1] / 2, at[2]]}
      geometry={boxGeometry(size[0], size[1], size[2], r)}
      material={mats[m]}
      castShadow
      receiveShadow
      raycast={() => null}
    />
  );
  const C = ({ m, at, radius, h, top }: { m: InteriorMaterialName; at: [number, number, number]; radius: number; h: number; top?: number }) => (
    <mesh position={[at[0], at[1] + h / 2, at[2]]} material={mats[m]} castShadow receiveShadow raycast={() => null}>
      <cylinderGeometry args={[top ?? radius, radius, h, 28]} />
    </mesh>
  );
  return { B, C };
}

type Kit = ReturnType<typeof makeKit>;

const finishOf = (p: FurniturePiece, fallback: InteriorMaterialName): InteriorMaterialName => {
  const f = p.finish;
  if (!f) return fallback;
  if (f === 'glass') return 'glass';
  return f as InteriorMaterialName;
};

/** Four slim legs set in from the corners. */
function Legs({ B, w, d, h, m = 'oak', t = 0.035, inset = 0.04 }: Kit & { w: number; d: number; h: number; m?: InteriorMaterialName; t?: number; inset?: number }) {
  const x = w / 2 - inset - t / 2;
  const z = d / 2 - inset - t / 2;
  return (
    <>
      {[[-x, -z], [x, -z], [-x, z], [x, z]].map(([a, b], i) => (
        <B key={i} m={m} at={[a, 0, b]} size={[t, h, t]} r={0} />
      ))}
    </>
  );
}

function Sofa({ p, kit }: { p: FurniturePiece; kit: Kit }) {
  const { B } = kit;
  const { w, d, h } = p;
  const arm = 0.14;
  const seats = w > 2 ? 3 : 2;
  const seatW = (w - arm * 2) / seats;
  return (
    <>
      <Legs {...kit} w={w} d={d} h={0.14} />
      <B m="linen" at={[0, 0.14, 0]} size={[w, 0.16, d]} r={0.03} />
      <B m="linen" at={[0, 0.3, -d / 2 + 0.1]} size={[w, h - 0.3, 0.2]} r={0.05} />
      <B m="linen" at={[-w / 2 + arm / 2, 0.3, 0]} size={[arm, 0.3, d]} r={0.05} />
      <B m="linen" at={[w / 2 - arm / 2, 0.3, 0]} size={[arm, 0.3, d]} r={0.05} />
      {Array.from({ length: seats }, (_, i) => (
        <group key={i} position={[-w / 2 + arm + seatW * (i + 0.5), 0, 0]}>
          <B m="linen" at={[0, 0.3, 0.08]} size={[seatW - 0.015, 0.14, d - 0.24]} r={0.04} />
          <B m="linen" at={[0, 0.44, -d / 2 + 0.26]} size={[seatW - 0.05, 0.3, 0.13]} r={0.05} />
        </group>
      ))}
      <B m="sand" at={[-w / 2 + arm + 0.2, 0.44, -d / 2 + 0.36]} size={[0.36, 0.3, 0.1]} r={0.04} />
    </>
  );
}

function Armchair({ p, kit }: { p: FurniturePiece; kit: Kit }) {
  const { B } = kit;
  const { w, d, h } = p;
  return (
    <>
      <Legs {...kit} w={w} d={d} h={0.2} />
      <B m="oak" at={[-w / 2 + 0.03, 0.2, 0]} size={[0.05, 0.36, d]} r={0.015} />
      <B m="oak" at={[w / 2 - 0.03, 0.2, 0]} size={[0.05, 0.36, d]} r={0.015} />
      <B m="sageFabric" at={[0, 0.2, 0.02]} size={[w - 0.1, 0.17, d - 0.1]} r={0.04} />
      <B m="sageFabric" at={[0, 0.37, -d / 2 + 0.1]} size={[w - 0.1, h - 0.37, 0.14]} r={0.05} />
    </>
  );
}

function Table({ p, kit, top = 0.03 }: { p: FurniturePiece; kit: Kit; top?: number }) {
  const { B } = kit;
  const { w, d, h } = p;
  return (
    <>
      <Legs {...kit} w={w} d={d} h={h - top} />
      <B m={finishOf(p, 'oak')} at={[0, h - top, 0]} size={[w, top, d]} r={0.012} />
    </>
  );
}

function RoundTable({ p, kit }: { p: FurniturePiece; kit: Kit }) {
  const { C } = kit;
  return (
    <>
      <C m="oak" at={[0, 0, 0]} radius={0.24} h={0.025} />
      <C m="oak" at={[0, 0.025, 0]} radius={0.035} h={p.h - 0.055} />
      <C m="oak" at={[0, p.h - 0.03, 0]} radius={p.w / 2} h={0.03} />
    </>
  );
}

function Chair({ p, kit }: { p: FurniturePiece; kit: Kit }) {
  const { B } = kit;
  const { w, d, h } = p;
  return (
    <>
      <Legs {...kit} w={w} d={d} h={0.43} t={0.028} inset={0.02} />
      <B m="linen" at={[0, 0.43, 0]} size={[w, 0.04, d]} r={0.012} />
      <B m="oak" at={[-w / 2 + 0.025, 0.47, -d / 2 + 0.03]} size={[0.028, h - 0.47, 0.028]} r={0} />
      <B m="oak" at={[w / 2 - 0.025, 0.47, -d / 2 + 0.03]} size={[0.028, h - 0.47, 0.028]} r={0} />
      <B m="oak" at={[0, h - 0.11, -d / 2 + 0.03]} size={[w, 0.11, 0.022]} r={0.008} />
    </>
  );
}

function Shelves({ p, kit, rows = 5 }: { p: FurniturePiece; kit: Kit; rows?: number }) {
  const { B } = kit;
  const { w, d, h } = p;
  return (
    <>
      {[-1, 1].map((s) => (
        <B key={s} m="black" at={[(s * (w - 0.02)) / 2, 0, 0]} size={[0.02, h, d]} r={0} />
      ))}
      {Array.from({ length: rows }, (_, i) => (
        <B key={i} m="oak" at={[0, 0.04 + (i * (h - 0.08)) / (rows - 1), 0]} size={[w - 0.02, 0.024, d - 0.01]} r={0.004} />
      ))}
      <B m="art" at={[-w / 4, 0.42, 0]} size={[0.3, 0.24, d * 0.7]} r={0.004} />
      <B m="sage" at={[w / 5, 0.8, 0]} size={[0.24, 0.3, d * 0.7]} r={0.004} />
    </>
  );
}

function Bed({ p, kit }: { p: FurniturePiece; kit: Kit }) {
  const { B } = kit;
  const { w, d, h } = p;
  const pillows = w > 1.5 ? 2 : 1;
  return (
    <>
      <B m="oak" at={[0, 0, 0.03]} size={[w, 0.3, d - 0.06]} r={0.012} />
      <B m="linen" at={[0, 0, -d / 2 + 0.045]} size={[w, h, 0.09]} r={0.03} />
      <B m="white" at={[0, 0.3, 0.04]} size={[w - 0.06, 0.22, d - 0.16]} r={0.05} />
      <B m="sand" at={[0, 0.51, 0.24]} size={[w - 0.02, 0.05, d - 0.56]} r={0.02} />
      <B m="linen" at={[0, 0.55, d / 2 - 0.3]} size={[w - 0.02, 0.025, 0.42]} r={0.01} />
      {Array.from({ length: pillows }, (_, i) => (
        <B key={i} m="white" at={[pillows === 1 ? 0 : (i - 0.5) * (w / 2), 0.52, -d / 2 + 0.3]} size={[pillows === 1 ? 0.72 : w / 2 - 0.08, 0.13, 0.42]} r={0.05} />
      ))}
    </>
  );
}

function Wardrobe({ p, kit, sliding }: { p: FurniturePiece; kit: Kit; sliding: boolean }) {
  const { B } = kit;
  const { w, d, h } = p;
  const doors = sliding ? 2 : Math.max(2, Math.round(w / 0.5));
  const dw = w / doors;
  return (
    <>
      <B m="white" at={[0, 0, 0]} size={[w, h, d - 0.03]} r={0.004} />
      {Array.from({ length: doors }, (_, i) => {
        const x = -w / 2 + dw * (i + 0.5);
        const offset = sliding && i % 2 ? -0.018 : 0;
        return (
          <group key={i}>
            <B m="white" at={[x, 0.02, d / 2 - 0.012 + offset]} size={[dw - 0.004, h - 0.04, 0.02]} r={0.002} />
            <B m="black" at={[x + (i % 2 ? -1 : 1) * (dw / 2 - 0.045), 0.95, d / 2 + 0.006 + offset]} size={[0.018, 0.32, 0.016]} r={0} />
          </group>
        );
      })}
    </>
  );
}

const BACKSPLASH = 0.6;

function Counter({ p, kit }: { p: FurniturePiece; kit: Kit }) {
  const { B } = kit;
  const { w, d, h } = p;
  const doors = Math.max(1, Math.round(w / 0.6));
  return (
    <>
      <B m="black" at={[0, 0, -0.03]} size={[w, 0.1, d - 0.07]} r={0} />
      <B m="white" at={[0, 0.1, -0.005]} size={[w, h - 0.12, d - 0.03]} r={0.002} />
      {Array.from({ length: doors }, (_, i) => (
        <B key={i} m="black" at={[-w / 2 + (w / doors) * (i + 0.5), h - 0.09, d / 2 - 0.012]} size={[0.16, 0.012, 0.016]} r={0} />
      ))}
      <B m="quartz" at={[0, h - 0.02, 0]} size={[w, 0.02, d]} r={0.003} />
      {/* Runs on the window wall stay clear, so the backsplash only goes behind the main run. */}
      {p.id !== 'counter-short' && <B m="porcelain" at={[0, h, -d / 2 + 0.006]} size={[w, BACKSPLASH, 0.012]} r={0} />}
    </>
  );
}

function Vanity({ p, kit }: { p: FurniturePiece; kit: Kit }) {
  const { B, C } = kit;
  const { w, d, h } = p;
  return (
    <>
      <B m={finishOf(p, 'white')} at={[0, 0, 0]} size={[w, h - 0.02, d]} r={0.004} />
      <B m="quartz" at={[0, h - 0.02, 0]} size={[w, 0.02, d]} r={0.003} />
      <C m="porcelain" at={[0, h, 0.02]} radius={0.17} h={0.035} />
      <C m="black" at={[0, h, -d / 2 + 0.05]} radius={0.012} h={0.16} />
    </>
  );
}

function Wc({ p, kit }: { p: FurniturePiece; kit: Kit }) {
  const { B, C } = kit;
  const { w, d } = p;
  return (
    <>
      <B m="porcelain" at={[0, 0.08, -d / 2 + 0.085]} size={[w, 0.72, 0.17]} r={0.025} />
      <B m="porcelain" at={[0, 0, 0.02]} size={[w * 0.62, 0.36, d - 0.28]} r={0.05} />
      <C m="porcelain" at={[0, 0.36, 0.05]} radius={w / 2 - 0.005} h={0.05} />
      <C m="black" at={[0, 0.8, -d / 2 + 0.085]} radius={0.022} h={0.006} />
    </>
  );
}

function Shower({ p, kit }: { p: FurniturePiece; kit: Kit }) {
  const { B, C } = kit;
  const { w, d, h } = p;
  return (
    <>
      <B m="stoneTile" at={[0, 0, 0]} size={[w, 0.015, d]} r={0} />
      <B m="black" at={[0, 0, d / 2 - 0.08]} size={[w - 0.1, 0.018, 0.04]} r={0} />
      <B m="glass" at={[0, 0.02, d / 2 - 0.006]} size={[w, h - 0.02, 0.008]} r={0} />
      <B m="glass" at={[-w / 2 + 0.004, 0.02, 0]} size={[0.008, h - 0.02, d]} r={0} />
      <B m="black" at={[w / 2 - 0.05, 0.9, -d / 2 + 0.03]} size={[0.018, 1.2, 0.018]} r={0} />
      <C m="black" at={[w / 2 - 0.05 - 0.14, 2.03, -d / 2 + 0.17]} radius={0.1} h={0.012} />
    </>
  );
}

function FloorLamp({ p, kit }: { p: FurniturePiece; kit: Kit }) {
  const { C } = kit;
  return (
    <>
      <C m="black" at={[0, 0, 0]} radius={0.13} h={0.02} />
      <C m="black" at={[0, 0.02, 0]} radius={0.012} h={p.h - 0.26} />
      <C m="sand" at={[0, p.h - 0.26, 0]} radius={0.15} top={0.11} h={0.26} />
    </>
  );
}

function modelOf(p: FurniturePiece, kit: Kit): ReactNode {
  const { B, C } = kit;
  const { w, d, h } = p;
  const mat = (fallback: InteriorMaterialName) => finishOf(p, fallback);
  switch (p.kind) {
    case 'sofa':
      return <Sofa p={p} kit={kit} />;
    case 'armchair':
      return <Armchair p={p} kit={kit} />;
    case 'coffeeTable':
    case 'diningTable':
    case 'dressingTable':
    case 'desk':
      return <Table p={p} kit={kit} />;
    case 'roundTable':
      return <RoundTable p={p} kit={kit} />;
    case 'chair':
      return <Chair p={p} kit={kit} />;
    case 'bookshelf':
      return <Shelves p={p} kit={kit} />;
    case 'shelterRack':
      return <Shelves p={{ ...p, finish: 'black' }} kit={kit} rows={4} />;
    case 'bed':
      return <Bed p={p} kit={kit} />;
    case 'wardrobeSliding':
      return <Wardrobe p={p} kit={kit} sliding />;
    case 'wardrobeHinged':
      return <Wardrobe p={p} kit={kit} sliding={false} />;
    case 'counter':
      return <Counter p={p} kit={kit} />;
    case 'vanity':
      return <Vanity p={p} kit={kit} />;
    case 'wc':
      return <Wc p={p} kit={kit} />;
    case 'shower':
      return <Shower p={p} kit={kit} />;
    case 'floorLamp':
      return <FloorLamp p={p} kit={kit} />;
    case 'tvConsole':
      return (
        <>
          <B m="oak" at={[0, 0, 0]} size={[w, h, d]} r={0.006} />
          <B m="white" at={[-w / 4, 0.03, d / 2 - 0.006]} size={[w / 2 - 0.02, h - 0.06, 0.012]} r={0.002} />
        </>
      );
    case 'tv':
      return <B m="screen" at={[0, 0, 0]} size={[w, h, d]} r={0.004} />;
    case 'rug':
      return <B m="sand" at={[0, 0, 0]} size={[w, h, d]} r={0.004} />;
    case 'nightstand':
      return (
        <>
          <Legs {...kit} w={w} d={d} h={0.16} t={0.025} inset={0.02} />
          <B m="oak" at={[0, 0.16, 0]} size={[w, h - 0.16, d]} r={0.008} />
          <B m="black" at={[0, h - 0.1, d / 2 + 0.002]} size={[0.1, 0.012, 0.012]} r={0} />
        </>
      );
    case 'officeChair':
      return (
        <>
          <C m="black" at={[0, 0, 0]} radius={0.26} top={0.03} h={0.07} />
          <C m="black" at={[0, 0.07, 0]} radius={0.028} h={0.36} />
          <B m="grey" at={[0, 0.43, 0.02]} size={[0.48, 0.07, 0.46]} r={0.03} />
          <B m="grey" at={[0, 0.54, -d / 2 + 0.07]} size={[0.44, h - 0.54, 0.05]} r={0.02} />
        </>
      );
    case 'wallShelf':
      return <B m="oak" at={[0, 0, 0]} size={[w, h, d]} r={0.004} />;
    case 'wallCabinet':
      return (
        <>
          <B m="sage" at={[0, 0, 0]} size={[w, h, d]} r={0.003} />
          <B m="light" at={[0, -0.006, 0.05]} size={[w - 0.1, 0.006, 0.015]} r={0} />
        </>
      );
    case 'sink':
      return (
        <>
          <B m="steel" at={[0, 0, 0]} size={[w, 0.02, d]} r={0.006} />
          <C m="black" at={[0, 0.02, -d / 2 + 0.03]} radius={0.012} h={0.26} />
        </>
      );
    case 'hob':
      return <B m="screen" at={[0, 0, 0]} size={[w, h, d]} r={0.003} />;
    case 'hood':
      return (
        <>
          <B m="steel" at={[0, 0, 0]} size={[w, 0.05, d]} r={0.004} />
          <B m="steel" at={[0, 0.05, -d / 4]} size={[0.26, h, d / 2]} r={0.003} />
        </>
      );
    case 'fridge':
      return (
        <>
          <B m="steel" at={[0, 0.02, -0.02]} size={[w, h - 0.02, d - 0.04]} r={0.012} />
          <B m="steel" at={[0, 0.02, d / 2 - 0.03]} size={[w, h * 0.62, 0.05]} r={0.01} />
          <B m="steel" at={[0, h * 0.64, d / 2 - 0.03]} size={[w, h * 0.36 - 0.01, 0.05]} r={0.01} />
          <B m="black" at={[-w / 2 + 0.05, h * 0.42, d / 2 + 0.002]} size={[0.018, 0.36, 0.02]} r={0} />
          <B m="black" at={[-w / 2 + 0.05, h * 0.68, d / 2 + 0.002]} size={[0.018, 0.24, 0.02]} r={0} />
        </>
      );
    case 'washer':
    case 'washerDryer': {
      const stacks = p.kind === 'washerDryer' ? 2 : 1;
      const unit = h / stacks;
      return (
        <>
          {Array.from({ length: stacks }, (_, i) => (
            <group key={i} position={[0, unit * i, 0]}>
              <B m="white" at={[0, 0, 0]} size={[w, unit - 0.005, d]} r={0.01} />
              <mesh position={[0, unit * 0.46, d / 2 + 0.002]} rotation-x={Math.PI / 2} raycast={() => null}>
                <cylinderGeometry args={[0.17, 0.17, 0.012, 28]} />
                <meshStandardMaterial name="M_WasherDoor" color="#30373a" roughness={0.2} />
              </mesh>
            </group>
          ))}
        </>
      );
    }
    case 'worktop':
      return <B m="quartz" at={[0, 0, 0]} size={[w, h, d]} r={0.003} />;
    case 'dryingRack':
      return (
        <>
          {[-0.2, -0.07, 0.07, 0.2].map((z) => (
            <B key={z} m="steel" at={[0, 0, z]} size={[w, 0.015, 0.015]} r={0} />
          ))}
        </>
      );
    case 'broomCabinet':
      return <B m="white" at={[0, 0, 0]} size={[w, h, d]} r={0.004} />;
    case 'mirrorCabinet':
      return (
        <>
          <B m="white" at={[0, 0, 0]} size={[w, h, d]} r={0.004} />
          <B m="mirror" at={[0, 0.01, d / 2 + 0.001]} size={[w - 0.02, h - 0.02, 0.004]} r={0} />
        </>
      );
    case 'towelBar':
    case 'grabBar':
      return <B m="black" at={[0, 0, d / 2 - 0.012]} size={[w, 0.025, 0.025]} r={0.008} />;
    case 'shoeCabinet':
      return (
        <>
          <B m="oak" at={[0, 0, 0]} size={[w, h, d]} r={0.005} />
          <B m="white" at={[0, 0.06, d / 2 - 0.005]} size={[w - 0.03, h - 0.12, 0.012]} r={0.002} />
          <B m="oak" at={[w / 4, h, 0]} size={[0.2, 0.012, 0.12]} r={0.003} />
        </>
      );
    case 'mirror':
    case 'dressingMirror':
      return (
        <>
          <B m="black" at={[0, 0, 0]} size={[w, h, d]} r={0.002} />
          <B m="mirror" at={[0, 0.012, d / 2 + 0.001]} size={[w - 0.024, h - 0.024, 0.004]} r={0} />
        </>
      );
    case 'artwork':
      return (
        <>
          <B m="black" at={[0, 0, 0]} size={[w, h, d]} r={0.002} />
          <B m="art" at={[0, 0.03, d / 2 + 0.001]} size={[w - 0.06, h - 0.06, 0.004]} r={0} />
        </>
      );
    case 'wallHooks':
      return (
        <>
          <B m="oak" at={[0, 0, -d / 2 + 0.008]} size={[w, 0.08, 0.016]} r={0.003} />
          {[-0.2, 0, 0.2].map((x) => (
            <B key={x} m="black" at={[x, 0.03, 0]} size={[0.014, 0.014, d]} r={0} />
          ))}
        </>
      );
    case 'deskLamp':
      return (
        <>
          <C m="black" at={[0, 0, 0]} radius={0.07} h={0.015} />
          <C m="black" at={[0, 0.015, 0]} radius={0.008} h={h - 0.09} />
          <C m="black" at={[0, h - 0.075, 0.03]} radius={0.06} top={0.03} h={0.075} />
        </>
      );
    case 'bench':
      return <Table p={p} kit={kit} />;
    case 'slidingPartition': {
      // Two black-framed glass panels on a double track.
      const panel = w / 2 + 0.03;
      return (
        <>
          {[-1, 1].map((side) => (
            <group key={side} position={[(side * (w - panel)) / 2, 0, side * 0.012]}>
              <B m={mat('glass')} at={[0, 0.04, 0]} size={[panel - 0.04, h - 0.08, 0.008]} r={0} />
              <B m="black" at={[-panel / 2 + 0.015, 0, 0]} size={[0.03, h, 0.02]} r={0} />
              <B m="black" at={[panel / 2 - 0.015, 0, 0]} size={[0.03, h, 0.02]} r={0} />
              <B m="black" at={[0, 0, 0]} size={[panel, 0.03, 0.02]} r={0} />
              <B m="black" at={[0, h - 0.03, 0]} size={[panel, 0.03, 0.02]} r={0} />
            </group>
          ))}
        </>
      );
    }
  }
}

const YAW: Record<Facing, number> = { s: 0, e: Math.PI / 2, n: Math.PI, w: -Math.PI / 2 };

export const FurnitureSet = memo(function FurnitureSet({
  pieces,
  mats,
}: {
  pieces: FurniturePiece[];
  mats: InteriorMaterials;
}) {
  const kit = useMemo(() => makeKit(mats), [mats]);
  return (
    <group name="furniture">
      {pieces.map((p) => (
        <group key={`${p.room}-${p.id}`} name={`${p.room}_${p.id}`} position={[p.x, p.y, p.z]} rotation-y={YAW[p.facing]}>
          {modelOf(p, kit)}
        </group>
      ))}
    </group>
  );
});
