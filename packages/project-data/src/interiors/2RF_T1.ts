// Appendix A.1, 2-room Flexi Type 1: 40 m² total, 38 m² internal.
// Rooms and furniture sizes are Appendix A. Topology follows the HDB plan: the kitchen is open to the
// hall, the bedroom closes with a sliding panel, and the bath door is on the hall side.
import { HIGH_WINDOW, KITCHEN_WINDOW, LayoutBuilder, W1 } from './build';
import type { RoomSpec } from './types';

export const roomsT1: RoomSpec[] = [
  { room: 'living', w: 2.9, d: 3.9, area: 11.3 },
  { room: 'bedroom', w: 3.1, d: 3.1, area: 9.6 },
  { room: 'bath', w: 1.7, d: 1.7, area: 2.9 },
  { room: 'acLedge', w: 1.2, d: 1.3, area: 1.6 },
  { room: 'kitchen', w: 2.5, d: 2.3, area: 5.8 },
  { room: 'shelter', w: 1.3, d: 1.2, area: 1.6 },
  { room: 'entry', w: 1.6, d: 2.6, area: 4.2 },
];

const b = new LayoutBuilder('2RF_T1');

b.room('living', [[0, 0, 2.9, 3.9]], { floor: 'wood', walls: 'paint', accent: 'e' })
  .room('bedroom', [[3.0, 0, 6.1, 3.1]], { floor: 'wood', walls: 'paint', accent: 'w' })
  .room('bath', [[3.1, 3.2, 4.8, 4.9]], { floor: 'tile', walls: 'tile' })
  .room('acLedge', [[4.9, 3.3, 6.1, 4.6]], { floor: 'concrete', walls: 'bare' })
  .room('kitchen', [[3.1, 5.0, 5.6, 7.3]], { floor: 'tile', walls: 'paint' })
  .room('shelter', [[0, 4.0, 1.3, 5.2]], { floor: 'concrete', walls: 'bare' })
  .room('entry', [[1.4, 3.9, 3.0, 6.5]], { floor: 'wood', walls: 'paint' });

b.door('entrance', 'entrance', [2.3, 6.6], 'x', 1.0, 'max', 'n')
  .door('bedroom', 'sliding', [2.95, 2.6], 'z', 0.9, 'min', 'e')
  .door('bath', 'folding', [3.0, 3.65], 'z', 0.75, 'min', 'e')
  .door('shelter', 'hinged', [1.35, 4.65], 'z', 0.75, 'min', 'e')
  .opening('kitchen', [3.05, 5.75], 'z', 1.5);

b.window('living', 'n', 0.3, 2.6, W1, 'sheer')
  .window('bedroom', 'n', 3.4, 5.7, W1, 'blackout')
  .window('kitchen', 'e', 5.85, 6.65, KITCHEN_WINDOW)
  .window('bath', 'e', 3.6, 4.3, HIGH_WINDOW);

// Living and dining. Sofa on the left wall, TV on the right, round table clear of the way to the hall.
b.put('rug', 'rug', 'living', [2.3, 1.6, 0.012], 'e', [0.55, 0.0], { finish: 'sand' })
  .put('sofa', 'sofa', 'living', [1.6, 0.85, 0.8], 'e', [0, 0.0], { finish: 'linen' })
  .put('coffee-table', 'coffeeTable', 'living', [0.9, 0.5, 0.4], 'w', [1.3, 0.35], { finish: 'oak' })
  .put('tv-console', 'tvConsole', 'living', [1.5, 0.4, 0.4], 'w', [2.5, 0.05], { y: 0.2, finish: 'oak' })
  .put('tv', 'tv', 'living', [0.96, 0.05, 0.56], 'w', [2.85, 0.32], { y: 0.72 })
  .put('dining-table', 'roundTable', 'living', [0.8, 0.8, 0.75], 's', [1.275, 2.5], { round: true, finish: 'oak' })
  .put('dining-chair-1', 'chair', 'living', [0.45, 0.5, 0.8], 's', [1.45, 2.0], { finish: 'oak' })
  .put('dining-chair-2', 'chair', 'living', [0.45, 0.5, 0.8], 'n', [1.45, 3.3], { finish: 'oak' })
  .put('bookshelf', 'bookshelf', 'living', [1.2, 0.3, 1.8], 'e', [0, 2.5], { finish: 'oak' })
  .put('floor-lamp', 'floorLamp', 'living', [0.3, 0.3, 1.55], 'e', [0.1, 1.72]);

// Bedroom. Headboard on the solid side wall, an 80 cm path along the bed, sliding wardrobe opposite.
b.put('bed', 'bed', 'bedroom', [1.6, 2.05, 1.0], 'e', [3.0, 0.1], { access: 's', finish: 'linen' })
  .put('nightstand', 'nightstand', 'bedroom', [0.42, 0.4, 0.5], 'e', [3.0, 1.7], { finish: 'oak' })
  .put('wardrobe', 'wardrobeSliding', 'bedroom', [2.0, 0.6, 2.4], 'n', [4.1, 2.5], { finish: 'white' });

// Kitchen. L base along the far wall and the window wall.
b.put('counter-long', 'counter', 'kitchen', [2.4, 0.6, 0.88], 'n', [3.2, 6.7], { finish: 'white' })
  .put('counter-short', 'counter', 'kitchen', [1.5, 0.6, 0.88], 'w', [5.0, 5.2], { finish: 'white' })
  .put('wall-cabinet', 'wallCabinet', 'kitchen', [2.4, 0.35, 0.7], 'n', [3.2, 6.95], { y: 1.5, finish: 'sage' })
  .put('sink', 'sink', 'kitchen', [0.6, 0.45, 0.02], 'n', [3.9, 6.78], { y: 0.86, finish: 'steel' })
  .put('hob', 'hob', 'kitchen', [0.6, 0.5, 0.02], 'w', [5.05, 5.2], { y: 0.88 })
  .put('hood', 'hood', 'kitchen', [0.6, 0.45, 0.25], 'w', [5.15, 5.2], { y: 1.6, finish: 'steel' })
  .put('fridge', 'fridge', 'kitchen', [0.6, 0.7, 1.8], 'e', [3.1, 5.05], { finish: 'steel' })
  .put('washer', 'washer', 'kitchen', [0.6, 0.6, 0.85], 'n', [4.7, 6.7], { finish: 'white' });

// Bathroom. The door is on the hall side, so WC and vanity take the HDB positions.
b.put('vanity', 'vanity', 'bath', [0.6, 0.45, 0.5], 'n', [3.1, 4.45], { y: 0.35, finish: 'white' })
  .put('mirror-cabinet', 'mirrorCabinet', 'bath', [0.6, 0.12, 0.7], 'n', [3.1, 4.78], { y: 1.15 })
  .put('wc', 'wc', 'bath', [0.38, 0.65, 0.8], 'w', [4.15, 3.25], { finish: 'white' })
  .put('shower', 'shower', 'bath', [0.8, 0.9, 2.1], 'n', [4.0, 4.0], { finish: 'glass' })
  .put('towel-bar', 'towelBar', 'bath', [0.6, 0.05, 0.05], 's', [3.3, 3.2], { y: 1.2, finish: 'black' })
  .put('grab-wc', 'grabBar', 'bath', [0.6, 0.05, 0.05], 'n', [4.15, 3.2], { y: 0.75, finish: 'black' })
  .put('grab-shower', 'grabBar', 'bath', [0.6, 0.05, 0.05], 's', [4.15, 4.85], { y: 1.0, finish: 'black' });

// Entry and shelter. Nothing is fixed to shelter walls: the rack is freestanding.
b.put('shoe-cabinet', 'shoeCabinet', 'entry', [1.1, 0.35, 1.2], 'e', [1.4, 5.25], { finish: 'oak' })
  .put('mirror', 'mirror', 'entry', [0.5, 0.03, 1.7], 'w', [2.97, 4.25], { y: 0.2, finish: 'black' })
  .put('shelter-rack', 'shelterRack', 'shelter', [0.75, 0.3, 1.8], 's', [0.05, 4.05], { finish: 'black' });

b.downlights('living', [0, 0, 2.9, 3.9], 2, 2)
  .light('pendant', 'living', 1.675, 2.9, 1.55, 2700)
  .light('floorLamp', 'living', 0.25, 1.87, 1.5, 2700)
  .downlights('bedroom', [3.0, 0, 6.1, 3.1], 1, 2, 3000, 'panel')
  .light('wallLamp', 'bedroom', 3.03, 1.91, 1.2, 2700)
  .downlights('kitchen', [3.1, 5.0, 5.6, 7.3], 1, 1, 4000)
  .light('underCabinet', 'kitchen', 4.4, 6.9, 1.48, 4000)
  .light('mirror', 'bath', 3.4, 4.75, 1.5, 4000)
  .downlights('bath', [3.1, 3.2, 4.8, 4.9], 1, 1, 4000)
  .downlights('entry', [1.4, 3.9, 3.0, 6.5], 1, 2)
  .downlights('shelter', [0, 4.0, 1.3, 5.2], 1, 1, 4000);

b.spot('living-1', 'living', 2.25, 3.7, -25, { fov: 74 })
  .spot('living-2', 'living', 1.0, 1.7, 15)
  .spot('living-3', 'living', 2.15, 1.75, 215)
  .spot('window-living', 'living', 1.9, 0.35, 0, { kind: 'window', pitch: 0 })
  .spot('bedroom-1', 'bedroom', 3.4, 2.6, 50, { fov: 74 })
  .spot('bedroom-2', 'bedroom', 5.55, 0.6, 250)
  .spot('kitchen-1', 'kitchen', 3.6, 6.1, 95, { fov: 74 })
  .spot('bath-1', 'bath', 3.45, 3.65, 110, { fov: 75 })
  .spot('entry-1', 'entry', 2.2, 5.8, 0, { fov: 74 })
  .spot('shelter-1', 'shelter', 0.85, 4.75, 300, { fov: 75 });

b.route('hall', [2.45, 5.9], [2.3, 4.2])
  .route('between-sofa-and-tv', [2.05, 1.85], [2.05, 0.5])
  .route('to-bedroom', [2.3, 2.6], [3.6, 2.6]);

export const layoutT1 = b.build();
