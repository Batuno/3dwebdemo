// Plants and scale figures shown only in top-view plan renders. Not part of the furnished inventory.
// Coordinates read like the unit files: from the clear inner corner of the plan.
import type { UnitTypeId, Vec2 } from '../data/types';
import { EXTERNAL_WALL } from './build';

export interface PlanFigure {
  at: Vec2;
  /** Degrees clockwise from north. */
  heading: number;
}

export interface PlanExtras {
  plants: Vec2[];
  people: PlanFigure[];
}

const shift = ([x, z]: Vec2): Vec2 => [x + EXTERNAL_WALL, z + EXTERNAL_WALL];

const define = (plants: Vec2[], people: PlanFigure[]): PlanExtras => ({
  plants: plants.map(shift),
  people: people.map((p) => ({ ...p, at: shift(p.at) })),
});

export const planExtras: Record<UnitTypeId, PlanExtras> = {
  '2RF_T1': define(
    [[2.7, 1.75], [5.85, 0.3]],
    [{ at: [2.2, 2.7], heading: 300 }, { at: [4.3, 6.0], heading: 90 }],
  ),
  '2RF_T2': define(
    [[0.25, 5.65], [3.35, 0.2], [4.4, 3.2]],
    [{ at: [1.0, 5.55], heading: 40 }, { at: [4.2, 7.2], heading: 90 }],
  ),
  '3R': define(
    [[9.3, 4.3], [0.3, 0.3], [6.05, 2.15]],
    [{ at: [7.2, 4.2], heading: 20 }, { at: [4.5, 4.2], heading: 270 }],
  ),
  '4R': define(
    [[0.3, 0.25], [9.75, 0.3], [5.95, 2.2], [6.75, 2.2]],
    [{ at: [2.4, 3.6], heading: 320 }, { at: [6.5, 3.9], heading: 90 }],
  ),
};
