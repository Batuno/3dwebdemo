import type { UnitTypeId } from '../data/types';
import { roomsT1, layoutT1 } from './2RF_T1';
import { roomsT2, layoutT2 } from './2RF_T2';
import { rooms3R, layout3R } from './3R';
import { rooms4R, layout4R } from './4R';
import { mirrorLayout } from './build';
import type { InteriorLayout, RoomSpec } from './types';

export * from './types';
export * from './build';
export * from './plan';
export * from './checks';
export { exceptions, type ClearanceException } from './exceptions';
export * from './extras';

export const interiors: Record<UnitTypeId, InteriorLayout> = {
  '2RF_T1': layoutT1,
  '2RF_T2': layoutT2,
  '3R': layout3R,
  '4R': layout4R,
};

export const roomSpecs: Record<UnitTypeId, RoomSpec[]> = {
  '2RF_T1': roomsT1,
  '2RF_T2': roomsT2,
  '3R': rooms3R,
  '4R': rooms4R,
};

export const mirroredInteriors: Record<UnitTypeId, InteriorLayout> = Object.fromEntries(
  Object.entries(interiors).map(([k, v]) => [k, mirrorLayout(v)]),
);
