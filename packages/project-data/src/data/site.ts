import type { SiteDef } from './types';

// Positions come from reference/site-plan.png at 4.34 px/m, rotated 10 degrees so the wings
// run along +x in world space. The whole site is therefore "plan north up".
export const site: SiteDef = {
  plot: { halfX: 78, halfZ: 62 },
  northOffsetDeg: -10,
  amenities: [
    { id: 'playground', kind: 'playground', labelKey: 'playground', position: [-14.6, 0.6], size: [18, 17], labelHeight: 6 },
    { id: 'adult', kind: 'adultFitness', labelKey: 'adultFitness', position: [-34.3, 8.8], size: [10, 9], labelHeight: 4.5 },
    { id: 'elderly', kind: 'elderlyFitness', labelKey: 'elderlyFitness', position: [-33.6, -4], size: [11, 8], labelHeight: 4.5 },
    { id: 'shelter', kind: 'shelter', labelKey: 'shelter', position: [-27.2, 2.6], size: [5.5, 5.5], labelHeight: 5.5 },
    { id: 'court', kind: 'hardCourt', labelKey: 'hardCourt', position: [8.5, -1.2], size: [15, 25], labelHeight: 5 },
    { id: 'garden', kind: 'garden', labelKey: 'garden', position: [-62, 30], size: [24, 28], labelHeight: 5 },
    { id: 'pavilion', kind: 'pavilion', labelKey: 'pavilion', position: [31, -3.8], size: [22, 12], labelHeight: 7 },
    { id: 'dropoff', kind: 'dropOff', labelKey: 'dropOff', position: [50, -1.2], size: [15, 13], labelHeight: 6.5 },
    { id: 'substation', kind: 'substation', labelKey: 'substation', position: [-53, -6], size: [12, 26], labelHeight: 8 },
    { id: 'garageEntry', kind: 'garageEntry', labelKey: 'garageEntry', position: [66, 38], size: [18, 7], labelHeight: 5 },
  ],
  linkways: [
    [[17.5, -22], [20.5, -10], [21, -5]],
    [[42, -3], [44, 8], [42, 24]],
    [[-27.2, 5.4], [-27.2, 22]],
    [[-27.2, -0.2], [-27.2, -16]],
  ],
  paths: [
    { points: [[-68, 16], [-48, 14], [-27, 12], [-8, 13], [16, 15], [38, 15], [70, 14]], width: 2.6 },
    { points: [[-68, -16], [-46, -13], [-27, -10], [-6, -11.5], [0, -14]], width: 2.2 },
    { points: [[0, -14], [0, 13]], width: 2.2 },
    { points: [[-45, 14], [-44, 3], [-45, -13]], width: 2.0 },
  ],
  garageRamp: { position: [66, 38], rot: 0 },
};
