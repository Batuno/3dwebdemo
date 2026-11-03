import { roomSpecs } from '../interiors';
import type { UnitType, UnitTypeId } from './types';

// Areas from the brochure "Layout Ideas"; room sizes from Appendix A of the interior design.
const type = (id: UnitTypeId, totalArea: number, internalArea: number, color: string): UnitType => ({
  id,
  totalArea,
  internalArea,
  color,
  ledge: totalArea - internalArea,
  rooms: roomSpecs[id].filter((r) => r.room !== 'acLedge'),
});

export const unitTypes: Record<UnitTypeId, UnitType> = {
  '2RF_T1': type('2RF_T1', 40, 38, '#F6B48F'),
  '2RF_T2': type('2RF_T2', 49, 46, '#E07A66'),
  '3R': type('3R', 67, 64, '#A8D38A'),
  '4R': type('4R', 90, 86, '#F5EC6E'),
};

export const unitTypeOrder: UnitTypeId[] = ['2RF_T1', '2RF_T2', '3R', '4R'];
