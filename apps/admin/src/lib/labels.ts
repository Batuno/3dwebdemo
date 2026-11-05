// Names for the keys the API uses: analytics places, journey steps, activity entries.
import { getUnit, interiors, outdoorSpotById, roomLabel, t, ta } from '@bair/project-data';
import { unitLabel } from './format';

export const outdoorLabel = (spot: string) => t.amenity[outdoorSpotById(spot)?.labelKey ?? ''] ?? spot;
export const roomName = (room: string) => t.room[room] ?? room;
export const typeName = (type: string) => t.unitType[type] ?? type;

function unitOf(id: string) {
  const [block, storey, stack] = id.split('-');
  return getUnit(block, Number(storey), Number(stack));
}

/** A step of a buyer's path through the showroom: "b:804A", "u:804A-12-325", "r:804A-12-325:living-1"… */
export function pathLabel(key: string): string {
  const [kind, a, b] = key.split(':');
  switch (kind) {
    case 'b':
      return t.nav.block(a);
    case 'f':
      return `${a} · ${t.nav.storey(Number(b))}`;
    case 'u':
      return unitLabel(a);
    case 'r': {
      const unit = unitOf(a);
      const room = unit && interiors[unit.type].hotspots.find((h) => h.id === b)?.room;
      return `${unitLabel(a)} · ${room && unit ? roomLabel(unit.type, room) : b}`;
    }
    case 'o':
      return outdoorLabel(a);
    case 'a':
      return ta.action[a] ?? a;
    case 'v':
      return ta.view[a] ?? a;
    default:
      return key;
  }
}
