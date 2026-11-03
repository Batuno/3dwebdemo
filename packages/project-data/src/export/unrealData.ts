// The JSON files the Unreal scripts read. Positions are glTF metres: x east, y up, z south.
// In Unreal centimetres that is X = x × 100, Y = z × 100, Z = y × 100.
import { blocks } from '../data/blocks';
import { cameras } from '../data/cameras';
import { outdoorSpots } from '../data/outdoor';
import { projectConfig } from '../data/project.config';
import { site } from '../data/site';
import type { UnitTypeId } from '../data/types';
import { storeyY, unitXform } from '../lib/geometry';
import { allUnits } from '../lib/inventory';
import { interiorRenderKey, outdoorRenderKey } from '../lib/renders';
import { formatTime, parseTime, sunAt, sunDirection } from '../lib/sun';
import { interiors, planExtras } from '../interiors';
import { outdoorPose, spotPose } from '../interiors/pov';

/** The stack each unit type is rendered in: not mirrored, on the representative storey. */
export function representativeStack(type: UnitTypeId) {
  const def = blocks[0];
  const st = def.stacks.find((s) => s.type === type && !s.mirror)!;
  return { def, st, storey: projectConfig.renders.storey };
}

const round = (v: number) => Math.round(v * 1000) / 1000;
const roundAll = (v: readonly number[]) => v.map(round);

export function hotspotsJson() {
  const placements = Object.fromEntries(
    Object.keys(interiors).map((type) => {
      const { def, st, storey } = representativeStack(type);
      const xf = unitXform(def, st);
      const [x, z] = xf.point(0, 0);
      return [type, { block: def.id, stack: st.stack, storey, origin: roundAll([def.position[0] + x, storeyY(storey), def.position[1] + z]), rotYDeg: st.rot }];
    }),
  );
  const interior = Object.entries(interiors).flatMap(([type, layout]) => {
    const { def, st, storey } = representativeStack(type);
    const xf = unitXform(def, st);
    const north = xf.dir(0, -1);
    return layout.hotspots.map((h) => {
      const pose = spotPose(def, st, storey, h);
      return {
        id: interiorRenderKey(type, h.id),
        spot: h.id,
        scope: 'interior' as const,
        unitType: type,
        room: h.room,
        position: roundAll(pose.pos),
        direction: roundAll(pose.dir),
        yaw: h.yaw,
        pitch: h.pitch,
        fov: h.fov,
        // Window views stay real-time, so the outside matches each flat's own storey.
        panorama: h.kind !== 'window',
        panoramaNorth: roundAll([north[0], 0, north[1]]),
      };
    });
  });
  const outdoor = outdoorSpots.map((s) => {
    const pose = outdoorPose(s);
    return {
      id: outdoorRenderKey(s.id),
      spot: s.id,
      scope: 'outdoor' as const,
      position: roundAll(pose.pos),
      direction: roundAll(pose.dir),
      yaw: s.yaw,
      pitch: s.pitch,
      fov: s.fov,
      panorama: true,
      panoramaNorth: [0, 0, -1],
    };
  });
  return { placements, hotspots: [...interior, ...outdoor] };
}

export interface ExportShot {
  pos: readonly number[];
  target: readonly number[];
  fov: number;
}

export function camerasJson(blockViews: Record<string, ExportShot>) {
  const out: Record<string, ExportShot> = { opening: cameras.opening, overview: cameras.overview };
  for (const [id, shot] of Object.entries(blockViews)) out[`block_${id}`] = shot;
  return out;
}

export function sunJson(day: Date = new Date()) {
  const loc = {
    latitude: projectConfig.location.latitude,
    longitude: projectConfig.location.longitude,
    timeZone: projectConfig.timeZone,
  };
  return {
    ...loc,
    northOffsetDeg: site.northOffsetDeg,
    date: day.toISOString().slice(0, 10),
    times: projectConfig.renders.times.map((label) => {
      const minutes = parseTime(label)!;
      const s = sunAt(minutes, loc, day);
      return {
        time: formatTime(minutes),
        key: label.replace(':', ''),
        altitude: round(s.altitude),
        bearing: round(s.bearing),
        direction: roundAll(sunDirection(s, site.northOffsetDeg)),
      };
    }),
  };
}

/** Room boxes and light fittings, for placing Unreal lights and top-view cameras. */
export function interiorsJson() {
  return Object.fromEntries(
    Object.entries(interiors).map(([type, l]) => [
      type,
      {
        width: round(l.width),
        depth: round(l.depth),
        lights: l.lights.map((q) => ({ kind: q.kind, room: q.room, position: roundAll([q.x, q.y, q.z]), kelvin: q.k })),
      },
    ]),
  );
}

export function topviewPropsJson() {
  return {
    note: 'Set plantAsset and figureAsset to your own Unreal assets. Empty values use simple stand-in shapes.',
    plantAsset: '',
    figureAsset: '',
    units: Object.fromEntries(
      Object.entries(planExtras).map(([type, e]) => [
        type,
        {
          plants: e.plants.map((p) => roundAll(p)),
          figures: e.people.map((f) => ({ at: roundAll(f.at), heading: f.heading })),
        },
      ]),
    ),
  };
}

export function unitsCsv(): string {
  const rows = ['Name,Block,Storey,Stack,Type,Status,PriceMNT,PricePerM2,TotalM2,InternalM2'];
  for (const u of allUnits) {
    rows.push([u.id, u.block, u.storey, u.stack, u.type, u.status, u.price, u.pricePerM2, u.totalArea, u.internalArea].join(','));
  }
  return rows.join('\n');
}
