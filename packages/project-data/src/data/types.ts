// Project-agnostic data model. A new building = new data files that satisfy these types.

export type Vec2 = [number, number];
/** [x0, z0, x1, z1] in unit-local metres. z = 0 is the main window facade, +z goes inward. */
export type Rect = [number, number, number, number];

export type UnitTypeId = string;
export type RoomId =
  | 'living'
  | 'master'
  | 'bed2'
  | 'bed3'
  | 'bedroom'
  | 'bath1'
  | 'bath2'
  | 'bath'
  | 'kitchen'
  | 'kitchenUtility'
  | 'service'
  | 'shelter'
  | 'corridor'
  | 'entry'
  | 'dining'
  | 'flex'
  | 'acLedge';

export type FloorFinish = 'wood' | 'tile' | 'concrete';

export interface RoomArea {
  room: RoomId;
  /** Size from the interior design, metres. */
  w: number;
  d: number;
  /** Approximate m². Shown with an "approx." label in the UI. */
  area: number;
}

export interface UnitType {
  id: UnitTypeId;
  totalArea: number;
  internalArea: number;
  color: string;
  rooms: RoomArea[];
  /** Air-con ledge m², counted in totalArea only. */
  ledge: number;
}

export interface RoomShape {
  room: RoomId;
  rects: Rect[];
  floor: FloorFinish;
}

export interface WallDoor {
  /** Door centre on the wall line, unit-local metres. */
  at: Vec2;
  /** Direction the wall runs along. */
  axis: 'x' | 'z';
  width: number;
  entrance?: boolean;
}

export interface WallWindow {
  a: Vec2;
  b: Vec2;
  sill: number;
  head: number;
  /** Vertical slat grille (service yard) instead of glass. */
  louver?: boolean;
}

export interface UnitLayout {
  type: UnitTypeId;
  width: number;
  depth: number;
  rooms: RoomShape[];
  /** Room pairs with no wall between them. */
  open: [RoomId, RoomId][];
  doors: WallDoor[];
  windows: WallWindow[];
}

export interface StackPlacement {
  stack: number;
  type: UnitTypeId;
  /** Unit centre, in brochure floor-plan pixels. */
  at: Vec2;
  /** 0 = windows face north (plan top), 180 = south; a small tilt follows the angled core. */
  rot: number;
  mirror: boolean;
}

export interface PlanBox {
  at: Vec2;
  /** Size in plan pixels. */
  size: Vec2;
  rot?: number;
}

export interface BlockDef {
  id: string;
  labelColor: string;
  /** Block centre on the site, metres. */
  position: Vec2;
  storeys: number;
  /** Brochure plan calibration, from reference/<block>-storey-3-24.png */
  plan: { pxPerMetre: number; origin: Vec2 };
  stacks: StackPlacement[];
  /** Common corridor centreline, plan pixels. */
  corridor: Vec2[];
  liftCore: PlanBox;
  stairs: PlanBox[];
  /** Storey-2-only roof terraces from the 2nd storey plan. */
  secondStoreyRoofs: PlanBox[];
  /** Stacks with no flat on storey 1 but with a named facility there. */
  groundFacility?: { stacks: number[]; labelKey: string };
}

export interface FacadePalette {
  panelLight: string;
  panelMid: string;
  bronze: string;
  warmAccent: string;
  spandrelTeal: string;
  gold: string;
  frame: string;
  glassTint: string;
}

export type AmenityKind =
  | 'playground'
  | 'adultFitness'
  | 'elderlyFitness'
  | 'shelter'
  | 'hardCourt'
  | 'garden'
  | 'pavilion'
  | 'dropOff'
  | 'substation'
  | 'garageEntry';

export interface Amenity {
  id: string;
  kind: AmenityKind;
  labelKey: string;
  position: Vec2;
  size: Vec2;
  rot?: number;
  labelHeight: number;
}

export interface SiteDef {
  /** Buildable plot half-size around the origin (metres). */
  plot: { halfX: number; halfZ: number };
  /** Plan north vs. true north, degrees. */
  northOffsetDeg: number;
  amenities: Amenity[];
  linkways: Vec2[][];
  /** Paved garden paths, metres. */
  paths: { points: Vec2[]; width: number }[];
  garageRamp: { position: Vec2; rot: number };
}

export interface GarageDef {
  columns: number;
  rows: number;
  bayWidth: number;
  bayDepth: number;
  aisleWidth: number;
  depthY: number;
  bayPrice: number;
}
