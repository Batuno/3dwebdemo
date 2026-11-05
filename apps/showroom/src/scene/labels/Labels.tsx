import { useEffect, useMemo, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { blocks, outdoorSpotForAmenity, site, type Amenity, type BlockDef } from '@bair/project-data';
import { t } from '@bair/project-data';
import { formatPriceShort } from '@bair/project-data';
import { roofY } from '@bair/project-data';
import { countStatuses, fromPrice, unitsInBlock } from '@bair/project-data';
import { useAppStore } from '../../store/useAppStore';
import { getBuiltBlock } from '../blocks/Block';
import { getOccluders } from './occluders';

/** Low-frequency line-of-sight test against the tower proxies, for HTML labels. */
function useVisibleFromCamera(pos: THREE.Vector3): boolean {
  const camera = useThree((s) => s.camera);
  const [visible, setVisible] = useState(true);
  const last = useRef(0);
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    if (clock.elapsedTime - last.current < 0.25) return;
    last.current = clock.elapsedTime;
    dir.subVectors(pos, camera.position);
    const dist = dir.length();
    ray.set(camera.position, dir.normalize());
    ray.far = dist - 1;
    const hit = ray.intersectObjects(getOccluders(), false).length > 0;
    setVisible((v) => (v === !hit ? v : !hit));
  });
  return visible;
}

function BlockLabel({ def }: { def: BlockDef }) {
  const hovered = useAppStore((s) => s.hover.block === def.id);
  const navigate = useAppStore((s) => s.navigate);
  const setHover = useAppStore((s) => s.setHover);
  const tick = useAppStore((s) => s.inventoryTick);
  const [c, from] = useMemo(() => {
    const u = unitsInBlock(def.id);
    return [countStatuses(u), fromPrice(u)];
  }, [def.id, tick]); // eslint-disable-line react-hooks/exhaustive-deps -- tick: live statuses change the units in place
  const data = getBuiltBlock(def);
  const y = roofY(def) + 13;
  const x = def.position[0] + data.liftCore.center[0];
  const z = def.position[1] + data.liftCore.center[1];
  return (
    <Html position={[x, y, z]} center zIndexRange={[20, 10]} wrapperClass="scene-label" pointerEvents="none">
      <button
        type="button"
        className={`block-label ${hovered ? 'is-hovered' : ''}`}
        onClick={() => navigate({ view: 'block', block: def.id })}
        onPointerEnter={() => setHover({ block: def.id })}
        onPointerLeave={() => setHover({ block: null })}
      >
        <span className="block-label__pill">
          <span className="dot" style={{ background: def.labelColor }} />
          {t.nav.block(def.id)}
        </span>
        <span className="block-label__chip">
          <span className="available">{t.status.availableCount(c.available)}</span>
          <span className="extra"> · {t.status.reservedCount(c.reserved)}</span>
          <span className="extra"> · {t.status.soldCount(c.sold)}</span>
          <span className="extra price"> · {t.price.from(formatPriceShort(from))}</span>
        </span>
      </button>
    </Html>
  );
}

function AmenityLabel({ a }: { a: Amenity }) {
  const pos = useMemo(
    () => new THREE.Vector3(a.position[0], a.labelHeight, a.position[1]),
    [a],
  );
  const visible = useVisibleFromCamera(pos);
  return (
    <Html position={pos} center zIndexRange={[9, 1]} wrapperClass="scene-label" pointerEvents="none">
      <button
        type="button"
        className={`amenity-pill ${visible ? '' : 'is-hidden'}`}
        onClick={() => {
          const { flyTo, navigate } = useAppStore.getState();
          const spot = outdoorSpotForAmenity(a.id);
          if (spot) navigate({ view: 'outdoor', spot: spot.id });
          else flyTo([a.position[0], 3, a.position[1]]);
        }}
      >
        {t.amenity[a.labelKey]}
      </button>
    </Html>
  );
}

export function Labels() {
  const view = useAppStore((s) => s.route.view);
  const [shown, setShown] = useState(view === 'overview');
  useEffect(() => {
    if (view === 'overview') {
      // Let the camera settle before labels return.
      const id = setTimeout(() => setShown(true), 650);
      return () => clearTimeout(id);
    }
    setShown(false);
    return undefined;
  }, [view]);
  if (!shown) return null;
  return (
    <group>
      {blocks.map((b) => (
        <BlockLabel key={b.id} def={b} />
      ))}
      {site.amenities.map((a) => (
        <AmenityLabel key={a.id} a={a} />
      ))}
    </group>
  );
}
