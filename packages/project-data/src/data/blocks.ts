import type { BlockDef } from './types';
import { projectConfig } from './project.config';

// Stack positions were measured from the coloured regions of the brochure floor plans
// (reference/804A-storey-3-24.png, reference/804B-storey-3-24.png): 1 m = 9.93 plan px.
// Tilted stacks follow the angled lift core, about 11 degrees against the wings.
const CORE_TILT = 11;

export const blocks: BlockDef[] = [
  {
    id: '804A',
    labelColor: projectConfig.blockLabelColors['804A'],
    position: [3.5, -31.4],
    storeys: 24,
    plan: { pxPerMetre: 9.93, origin: [573, 245] },
    stacks: [
      { stack: 317, type: '2RF_T1', at: [675, 163], rot: CORE_TILT, mirror: false },
      { stack: 319, type: '4R', at: [871.5, 138], rot: 0, mirror: true },
      { stack: 321, type: '4R', at: [1010, 138], rot: 0, mirror: false },
      { stack: 323, type: '3R', at: [928, 266.5], rot: 180, mirror: false },
      { stack: 325, type: '4R', at: [806.5, 266], rot: 180, mirror: false },
      { stack: 327, type: '2RF_T2', at: [623, 300], rot: 180 + CORE_TILT, mirror: true },
      { stack: 329, type: '2RF_T2', at: [549, 326], rot: 180 + CORE_TILT, mirror: false },
      { stack: 331, type: '4R', at: [405.5, 351], rot: 180, mirror: true },
      { stack: 333, type: '4R', at: [267, 351], rot: 180, mirror: false },
      { stack: 335, type: '4R', at: [135, 231], rot: 0, mirror: true },
      { stack: 337, type: '4R', at: [305, 231], rot: 0, mirror: false },
      { stack: 339, type: '2RF_T2', at: [504, 208], rot: CORE_TILT, mirror: true },
    ],
    corridor: [[110, 291], [478, 291], [760, 202], [1060, 202]],
    liftCore: { at: [590, 190], size: [82, 92], rot: CORE_TILT },
    stairs: [
      { at: [220, 228], size: [34, 86] },
      { at: [1092, 202], size: [28, 60] },
    ],
    secondStoreyRoofs: [
      { at: [220, 165], size: [36, 44] },
      { at: [1108, 212], size: [40, 40] },
      { at: [700, 330], size: [60, 90], rot: CORE_TILT },
    ],
  },
  {
    id: '804B',
    labelColor: projectConfig.blockLabelColors['804B'],
    position: [-3.5, 31.4],
    storeys: 24,
    plan: { pxPerMetre: 9.93, origin: [649, 230] },
    stacks: [
      { stack: 341, type: '2RF_T1', at: [547, 312.5], rot: 180 + CORE_TILT, mirror: false },
      { stack: 343, type: '4R', at: [350.5, 337], rot: 180, mirror: true },
      { stack: 345, type: '4R', at: [212, 337], rot: 180, mirror: false },
      { stack: 347, type: '3R', at: [294.5, 209.5], rot: 0, mirror: false },
      { stack: 349, type: '4R', at: [415.5, 210], rot: 0, mirror: false },
      { stack: 351, type: '2RF_T2', at: [598.5, 175], rot: CORE_TILT, mirror: true },
      { stack: 353, type: '2RF_T2', at: [673, 149], rot: CORE_TILT, mirror: false },
      { stack: 355, type: '4R', at: [816.5, 124], rot: 0, mirror: true },
      { stack: 357, type: '4R', at: [955, 124], rot: 0, mirror: false },
      { stack: 359, type: '4R', at: [1087, 244.5], rot: 180, mirror: true },
      { stack: 361, type: '4R', at: [917, 244.5], rot: 180, mirror: false },
      { stack: 363, type: '2RF_T2', at: [718, 267.5], rot: 180 + CORE_TILT, mirror: true },
    ],
    corridor: [[150, 268], [470, 268], [800, 182], [1140, 182]],
    liftCore: { at: [626, 262], size: [82, 92], rot: CORE_TILT },
    stairs: [
      { at: [130, 268], size: [30, 56] },
      { at: [1002, 240], size: [32, 88] },
    ],
    secondStoreyRoofs: [
      { at: [120, 290], size: [40, 40] },
      { at: [1002, 300], size: [34, 40] },
      { at: [660, 340], size: [56, 60], rot: CORE_TILT },
    ],
    groundFacility: { stacks: [355, 357], labelKey: 'futureFacilities' },
  },
];

export const blockById = (id: string): BlockDef | undefined => blocks.find((b) => b.id === id);
