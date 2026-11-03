import type { GarageDef } from './types';
import { projectConfig } from './project.config';

export const garage: GarageDef = {
  columns: 34,
  rows: 8,
  bayWidth: 2.6,
  bayDepth: 5.0,
  aisleWidth: 6.0,
  depthY: -4.2,
  bayPrice: projectConfig.bayPrice,
};
export const garageSeed = projectConfig.availability.seed + '-garage';
