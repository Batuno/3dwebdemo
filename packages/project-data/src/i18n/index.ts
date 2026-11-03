import { mn } from './mn';

// Swap this import to change the UI language.
export const t = mn;

/** Room name for a unit type. The 4-room living room has no dining area of its own. */
export const roomLabel = (unitType: string, room: string): string =>
  unitType === '4R' && room === 'living' ? t.room.livingOnly : t.room[room];
