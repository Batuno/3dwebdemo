import { mn } from './mn';
import { adminMn } from './admin';

// Swap these imports to change the UI language.
export const t = mn;
/** Admin panel and export text. */
export const ta = adminMn;

/** Room name for a unit type. The 4-room living room has no dining area of its own. */
export const roomLabel = (unitType: string, room: string): string =>
  unitType === '4R' && room === 'living' ? t.room.livingOnly : t.room[room];
