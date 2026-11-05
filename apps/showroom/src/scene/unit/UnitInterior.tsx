// A flat as a furnished interior. Built only when a unit opens and disposed on exit.
import { useEffect, useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  CEILING_H,
  interiors,
  roomLabel,
  storeyY,
  t,
  unitTypes,
  unitXform,
  type BlockDef,
  type InteriorLayout,
  type StackPlacement,
} from '@bair/project-data';
import { useAppStore } from '../../store/useAppStore';
import { requestShadowUpdate } from '../lighting/shadowControl';
import { sceneUniforms } from '../shared';
import { HotspotDots } from './HotspotDots';
import { InteriorModel } from './InteriorModel';
import { MAX_ROOM_LIGHTS, roomLights } from './interiorLights';

const H = CEILING_H;

const roomCenter = (l: InteriorLayout, room: string): [number, number] | null => {
  const r = l.rooms.find((q) => q.room === room);
  if (!r) return null;
  const big = [...r.rects].sort((p, q) => (q[2] - q[0]) * (q[3] - q[1]) - (p[2] - p[0]) * (p[3] - p[1]))[0];
  return [(big[0] + big[2]) / 2, (big[1] + big[3]) / 2];
};

function RoomLabels({ st, layout }: { st: StackPlacement; layout: InteriorLayout }) {
  const type = unitTypes[st.type];
  return (
    <group>
      {type.rooms
        .filter((r) => r.room !== 'corridor' && r.room !== 'shelter' && r.room !== 'entry')
        .map((r) => {
          const p = roomCenter(layout, r.room);
          if (!p) return null;
          return (
            <Html key={r.room} position={[p[0], 1.7, p[1]]} center zIndexRange={[25, 15]} wrapperClass="scene-label" pointerEvents="none">
              <span className="room-tag">
                {roomLabel(st.type, r.room)}
                <b>
                  {r.area} {t.unit.m2}
                </b>
              </span>
            </Html>
          );
        })}
    </group>
  );
}

export default function UnitInterior({ def, st, storey }: { def: BlockDef; st: StackPlacement; storey: number }) {
  const spot = useAppStore((s) => (s.route.view === 'unit' ? s.route.spot : undefined));
  const navigate = useAppStore((s) => s.navigate);
  const xf = useMemo(() => unitXform(def, st), [def, st]);
  const layout = interiors[st.type];
  const inside = spot !== undefined;

  useEffect(() => {
    requestShadowUpdate();
    const id = setTimeout(requestShadowUpdate, 900);
    return () => {
      clearTimeout(id);
      requestShadowUpdate();
    };
  }, [layout]);

  // Invisible roof: blocks the sun from above, so daylight only enters through the windows.
  const roofCaster = useMemo(() => new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }), []);

  // Warm room lights, stronger as daylight fades
  const groupRef = useRef<THREE.Group>(null);
  const worldLights = useRef<{ pos: THREE.Vector3; base: number; rad: number; color: THREE.Color }[]>([]);
  useFrame(({ camera }) => {
    const n = sceneUniforms.uNight.value;
    const list = worldLights.current;
    // Seen from above, the rooms take their light from the open top as well, so the lamps stay softer inside.
    const boost = inside ? 0.42 : 0.85;
    // Warm, but not orange: the tone mapping keeps colours at full strength, so the bounce stays close to white.
    // After dark it rises only a little, leaving the lamps to make pools of light rather than an even glow.
    roomLights.uRoomFill.value.setRGB(0.3, 0.28, 0.25).multiplyScalar(inside ? 0.45 + n * 0.1 : 0.6);
    for (let i = 0; i < MAX_ROOM_LIGHTS; i++) {
      const l = list[i];
      if (l) {
        roomLights.uRoomLightPos.value[i].copy(l.pos).applyMatrix4(camera.matrixWorldInverse);
        roomLights.uRoomLightCol.value[i].copy(l.color).multiplyScalar(l.base * boost * (0.2 + n * 0.8));
        roomLights.uRoomLightInvRad.value[i] = 1 / l.rad;
      } else {
        roomLights.uRoomLightCol.value[i].setRGB(0, 0, 0);
      }
    }
  });

  const main = useMemo(() => {
    // One real light per main room keeps the frame rate up; downlights elsewhere are emissive.
    return layout.rooms
      .filter((r) => !['acLedge', 'shelter', 'corridor', 'entry'].includes(r.room))
      .map((r) => ({ room: r.room, c: roomCenter(layout, r.room)! }));
  }, [layout]);

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.updateWorldMatrix(true, false);
    const ordered = [...main].sort((p, q) => Number(p.room.startsWith('bath')) - Number(q.room.startsWith('bath')));
    worldLights.current = ordered.slice(0, MAX_ROOM_LIGHTS).map((m) => {
      const living = m.room === 'living';
      const wet = m.room.startsWith('bath');
      // Appendix A.7: warm in living rooms and bedrooms, neutral white in kitchens and bathrooms.
      const kelvin = layout.lights.find((q) => q.room === m.room && (q.kind === 'downlight' || q.kind === 'panel'))?.k ?? 3000;
      return {
        color: new THREE.Color(kelvin >= 3800 ? '#ffe6cf' : '#ffdab6'),
        pos: new THREE.Vector3(m.c[0], H - 0.3, m.c[1]).applyMatrix4(g.matrixWorld),
        base: living ? 11 : wet ? 5 : 7,
        rad: living ? 6.5 : wet ? 3.2 : 4.6,
      };
    });
  }, [main, layout]);

  const pick = (id: string) => {
    const { route } = useAppStore.getState();
    if (route.view === 'unit') navigate({ ...route, spot: id });
  };

  return (
    <group
      name="unitInterior"
      position={[def.position[0] + xf.center[0], storeyY(storey), def.position[1] + xf.center[1]]}
      rotation-y={xf.rotY}
    >
      <group scale-x={xf.mirror ? -1 : 1}>
        <group ref={groupRef} name="unitRoom" position={[-layout.width / 2, 0, -layout.depth / 2]}>
          <InteriorModel layout={layout} ceiling={inside} />
          <mesh position={[layout.width / 2, H + 0.02, layout.depth / 2]} rotation-x={Math.PI / 2} material={roofCaster} castShadow raycast={() => null}>
            <boxGeometry args={[layout.width + 0.4, layout.depth + 0.4, 0.02]} />
          </mesh>
          {!inside && <RoomLabels st={st} layout={layout} />}
          <HotspotDots layout={layout} current={spot} onPick={pick} />
        </group>
      </group>
    </group>
  );
}
