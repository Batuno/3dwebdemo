// The furnished interior of a unit type, in metres. Pure data: no three.js here.
// Frame: x along the main facade, z inward from it, so z = 0 is the window wall ("north" on the plan).
import type { FloorFinish, Rect, RoomId, UnitTypeId, Vec2 } from '../data/types';

export type Facing = 'n' | 'e' | 's' | 'w';

export type FurnitureKind =
  | 'sofa'
  | 'armchair'
  | 'coffeeTable'
  | 'tvConsole'
  | 'tv'
  | 'roundTable'
  | 'diningTable'
  | 'chair'
  | 'bookshelf'
  | 'rug'
  | 'bed'
  | 'nightstand'
  | 'wardrobeSliding'
  | 'wardrobeHinged'
  | 'dressingTable'
  | 'desk'
  | 'officeChair'
  | 'wallShelf'
  | 'counter'
  | 'wallCabinet'
  | 'sink'
  | 'hob'
  | 'hood'
  | 'fridge'
  | 'washer'
  | 'washerDryer'
  | 'worktop'
  | 'dryingRack'
  | 'broomCabinet'
  | 'vanity'
  | 'mirrorCabinet'
  | 'wc'
  | 'shower'
  | 'towelBar'
  | 'grabBar'
  | 'shoeCabinet'
  | 'mirror'
  | 'shelterRack'
  | 'bench'
  | 'artwork'
  | 'wallHooks'
  | 'floorLamp'
  | 'deskLamp'
  | 'dressingMirror'
  | 'slidingPartition';

export type Finish = 'oak' | 'white' | 'sage' | 'linen' | 'sand' | 'black' | 'quartz' | 'steel' | 'grey' | 'glass';

export interface FurniturePiece {
  id: string;
  kind: FurnitureKind;
  room: RoomId;
  /** Exact catalogue size from Appendix A: width along the front, depth front to back, height. Never scaled. */
  w: number;
  d: number;
  h: number;
  /** Where the front of the piece points. */
  facing: Facing;
  /** Centre in unit-local metres. */
  x: number;
  z: number;
  /** Bottom edge above the floor, for wall-hung pieces. */
  y: number;
  /** Stops a person walking through it. Rugs, wall cabinets and appliances set into a counter do not. */
  blocks: boolean;
  round?: boolean;
  finish?: Finish;
  /** Offered as an option by HDB; hidden unless switched on. */
  optional?: boolean;
  /** Which long side of a bed must stay free, as a plan direction, or both of them. */
  access?: 'both' | Facing;
}

export interface InteriorRoom {
  room: RoomId;
  rects: Rect[];
  floor: FloorFinish;
  /** One sage accent wall per room, per Appendix A. */
  accent?: Facing;
  /** Wet rooms get tiled walls, everything else paint and skirting. */
  walls: 'paint' | 'tile' | 'bare';
  /** A tile accent wall in sage, master ensuite only. */
  tileAccent?: Facing;
}

export type DoorKind = 'entrance' | 'hinged' | 'folding' | 'sliding' | 'opening';

export interface InteriorDoor {
  id: string;
  kind: DoorKind;
  /** Centre of the opening, inside the wall. */
  at: Vec2;
  /** Direction the wall runs along. */
  axis: 'x' | 'z';
  width: number;
  /** Height of the opening; 'opening' passages run to the door head as well. */
  head: number;
  /** Hinge end along the wall axis. */
  hinge: 'min' | 'max';
  /** The side of the wall the leaf swings into. */
  swing: Facing;
  /** Offered as an option by HDB, drawn open by default. */
  optional?: boolean;
}

export interface InteriorWindow {
  id: string;
  room: RoomId;
  /** Which wall of the room the window is in. */
  side: Facing;
  /** Start and end along that wall, unit-local metres. */
  from: number;
  to: number;
  sill: number;
  head: number;
  curtain: 'none' | 'sheer' | 'blackout';
  louver?: boolean;
}

export type LightKind = 'downlight' | 'panel' | 'pendant' | 'linearPendant' | 'wallLamp' | 'floorLamp' | 'deskLamp' | 'underCabinet' | 'mirror' | 'cove';

export interface InteriorLight {
  kind: LightKind;
  room: RoomId;
  x: number;
  y: number;
  z: number;
  /** Colour temperature, kelvin. */
  k: number;
}

export interface Hotspot {
  id: string;
  room: RoomId;
  kind: 'room' | 'window';
  x: number;
  z: number;
  /** View direction, degrees clockwise from north (the main facade). */
  yaw: number;
  pitch: number;
  fov: number;
}

/** A walking route that must stay clear to the given width. */
export interface WalkRoute {
  id: string;
  from: Vec2;
  to: Vec2;
  width: number;
}

export interface InteriorLayout {
  type: UnitTypeId;
  mirrored?: boolean;
  /** Outer size including 200 mm external walls. */
  width: number;
  depth: number;
  rooms: InteriorRoom[];
  doors: InteriorDoor[];
  windows: InteriorWindow[];
  furniture: FurniturePiece[];
  lights: InteriorLight[];
  hotspots: Hotspot[];
  routes: WalkRoute[];
}

/** Room table from Appendix A. */
export interface RoomSpec {
  room: RoomId;
  w: number;
  d: number;
  area: number;
}
