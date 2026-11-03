// Appendix A.2, 2-room Flexi Type 2: 49 m² total, 46 m² internal.
// Bedroom and Flexi are slightly L-shaped because the HDB plan reaches the bedroom through a short
// passage below the TV wall. The Flexi opens to the living room and can close with the optional door.
import { HIGH_WINDOW, KITCHEN_WINDOW, LayoutBuilder, W1 } from './build';
import type { RoomSpec } from './types';

export const roomsT2: RoomSpec[] = [
  { room: 'living', w: 3.0, d: 4.9, area: 14.7 },
  { room: 'bedroom', w: 3.2, d: 2.9, area: 9.3 },
  { room: 'flex', w: 2.8, d: 1.6, area: 4.5 },
  { room: 'bath', w: 1.6, d: 1.5, area: 2.4 },
  { room: 'acLedge', w: 1.1, d: 1.1, area: 1.2 },
  { room: 'kitchen', w: 2.5, d: 2.2, area: 5.5 },
  { room: 'shelter', w: 1.4, d: 1.5, area: 2.1 },
  { room: 'entry', w: 1.6, d: 2.1, area: 3.4 },
];

const b = new LayoutBuilder('2RF_T2');

b.room('living', [[0, 1.0, 3.0, 5.9]], { floor: 'wood', walls: 'paint', accent: 'e' })
  .room('bedroom', [[3.1, 0, 6.35, 2.9], [3.1, 2.9, 4.1, 3.55]], { floor: 'wood', walls: 'paint', accent: 'e' })
  .room('flex', [[4.2, 3.0, 6.35, 4.6], [3.1, 3.65, 4.2, 4.6]], { floor: 'wood', walls: 'paint' })
  .room('bath', [[3.2, 4.7, 4.8, 6.2]], { floor: 'tile', walls: 'tile' })
  .room('acLedge', [[4.9, 4.9, 6.0, 6.0]], { floor: 'concrete', walls: 'bare' })
  .room('kitchen', [[3.2, 6.3, 5.7, 8.5]], { floor: 'tile', walls: 'paint' })
  .room('shelter', [[0, 6.0, 1.4, 7.5]], { floor: 'concrete', walls: 'bare' })
  .room('entry', [[1.5, 5.9, 3.1, 8.0]], { floor: 'wood', walls: 'paint' });

b.door('entrance', 'entrance', [2.4, 8.1], 'x', 1.0, 'max', 'n')
  .opening('bedroom', [3.05, 3.1], 'z', 0.9)
  .door('flex', 'folding', [3.05, 4.125], 'z', 0.95, 'min', 'e', true)
  .door('bath', 'folding', [3.1, 5.625], 'z', 0.75, 'min', 'e')
  .door('shelter', 'hinged', [1.45, 6.425], 'z', 0.75, 'min', 'e')
  .opening('kitchen', [3.15, 7.45], 'z', 1.0);

b.window('living', 'n', 0.3, 2.7, W1, 'sheer')
  .window('bedroom', 'n', 3.7, 6.0, W1, 'blackout')
  .window('flex', 'e', 3.25, 3.85, W1)
  .window('kitchen', 'e', 7.15, 7.85, KITCHEN_WINDOW)
  .window('bath', 'e', 5.2, 5.5, HIGH_WINDOW);

// Living zone above, dining zone below, separated by the rug.
b.put('rug', 'rug', 'living', [2.3, 1.6, 0.012], 'e', [0.55, 1.05], { finish: 'sand' })
  .put('sofa', 'sofa', 'living', [1.8, 0.85, 0.8], 'e', [0, 1.0], { finish: 'linen' })
  .put('coffee-table', 'coffeeTable', 'living', [0.9, 0.5, 0.4], 'w', [1.3, 1.45], { finish: 'oak' })
  .put('tv-console', 'tvConsole', 'living', [1.6, 0.4, 0.4], 'w', [2.6, 1.0], { y: 0.2, finish: 'oak' })
  .put('tv', 'tv', 'living', [1.11, 0.05, 0.64], 'w', [2.95, 1.25], { y: 0.68 })
  .put('dining-table', 'diningTable', 'living', [1.2, 0.75, 0.75], 's', [0.8, 3.85], { finish: 'oak' })
  .put('dining-chair-1', 'chair', 'living', [0.45, 0.5, 0.8], 's', [0.9, 3.35], { finish: 'oak' })
  .put('dining-chair-2', 'chair', 'living', [0.45, 0.5, 0.8], 's', [1.45, 3.35], { finish: 'oak' })
  .put('dining-chair-3', 'chair', 'living', [0.45, 0.5, 0.8], 'n', [0.9, 4.6], { finish: 'oak' })
  .put('dining-chair-4', 'chair', 'living', [0.45, 0.5, 0.8], 'n', [1.45, 4.6], { finish: 'oak' })
  .put('floor-lamp', 'floorLamp', 'living', [0.3, 0.3, 1.55], 'e', [0.1, 3.12]);

// Bedroom. Headboard on the side wall, a nightstand each side, sliding wardrobe across the foot of the bed.
b.put('wardrobe', 'wardrobeSliding', 'bedroom', [1.9, 0.55, 2.4], 'e', [3.1, 0.45], { finish: 'white' })
  .put('bed', 'bed', 'bedroom', [1.6, 2.0, 1.0], 'w', [4.35, 0.6], { access: 'both', finish: 'linen' })
  .put('nightstand-1', 'nightstand', 'bedroom', [0.4, 0.4, 0.5], 'w', [5.95, 0.2], { finish: 'oak' })
  .put('nightstand-2', 'nightstand', 'bedroom', [0.4, 0.4, 0.5], 'w', [5.95, 2.2], { finish: 'oak' });

// Flexi, shown as a home office (option A).
b.put('desk', 'desk', 'flex', [1.2, 0.6, 0.75], 'n', [3.9, 4.0], { finish: 'oak' })
  .put('desk-chair', 'officeChair', 'flex', [0.6, 0.6, 0.95], 's', [4.2, 3.4], { finish: 'grey' })
  .put('bookshelf', 'bookshelf', 'flex', [1.2, 0.35, 1.8], 'n', [5.1, 4.25], { finish: 'oak' })
  .put('wall-shelf', 'wallShelf', 'flex', [1.2, 0.25, 0.04], 'n', [3.9, 4.35], { y: 1.2, finish: 'oak' })
  .put('desk-lamp', 'deskLamp', 'flex', [0.2, 0.2, 0.45], 'n', [4.9, 4.2], { y: 0.75, finish: 'black' });

// Kitchen.
b.put('counter-long', 'counter', 'kitchen', [2.4, 0.6, 0.88], 'n', [3.3, 7.9], { finish: 'white' })
  .put('counter-short', 'counter', 'kitchen', [1.45, 0.6, 0.88], 'w', [5.1, 6.45], { finish: 'white' })
  .put('wall-cabinet', 'wallCabinet', 'kitchen', [2.4, 0.35, 0.7], 'n', [3.3, 8.15], { y: 1.5, finish: 'sage' })
  .put('sink', 'sink', 'kitchen', [0.6, 0.45, 0.02], 'n', [4.0, 7.98], { y: 0.86, finish: 'steel' })
  .put('hob', 'hob', 'kitchen', [0.6, 0.5, 0.02], 'w', [5.15, 6.5], { y: 0.88 })
  .put('hood', 'hood', 'kitchen', [0.6, 0.45, 0.25], 'w', [5.25, 6.5], { y: 1.6, finish: 'steel' })
  .put('fridge', 'fridge', 'kitchen', [0.6, 0.7, 1.8], 'e', [3.2, 6.3], { finish: 'steel' })
  .put('washer', 'washer', 'kitchen', [0.6, 0.6, 0.85], 'n', [4.7, 7.9], { finish: 'white' });

// Bathroom. Vanity and shower sit as on the PDF diagram; the door moved down the wall to make room.
b.put('vanity', 'vanity', 'bath', [0.6, 0.45, 0.5], 's', [3.2, 4.7], { y: 0.35, finish: 'white' })
  .put('mirror-cabinet', 'mirrorCabinet', 'bath', [0.6, 0.12, 0.7], 's', [3.2, 4.7], { y: 1.15 })
  .put('shower', 'shower', 'bath', [0.8, 0.85, 2.1], 's', [4.0, 4.7], { finish: 'glass' })
  .put('wc', 'wc', 'bath', [0.38, 0.62, 0.8], 'w', [4.18, 5.57], { finish: 'white' });

// Entry and shelter.
b.put('shoe-cabinet', 'shoeCabinet', 'entry', [1.0, 0.35, 1.2], 'e', [1.5, 6.9], { finish: 'oak' })
  .put('wall-hooks', 'wallHooks', 'entry', [0.6, 0.05, 0.1], 'w', [3.05, 6.0], { y: 1.6, finish: 'black' })
  .put('mirror', 'mirror', 'entry', [0.5, 0.03, 1.7], 'w', [3.07, 6.3], { y: 0.2, finish: 'black' })
  .put('shelter-rack', 'shelterRack', 'shelter', [0.9, 0.3, 1.8], 's', [0.05, 6.05], { finish: 'black' });

b.downlights('living', [0, 1.0, 3.0, 5.9], 2, 2)
  .light('downlight', 'living', 1.5, 3.45, 2.59, 3000)
  .light('pendant', 'living', 1.4, 4.22, 1.55, 2700)
  .light('floorLamp', 'living', 0.25, 3.27, 1.5, 2700)
  .downlights('bedroom', [3.1, 0, 6.35, 2.9], 1, 1, 3000, 'panel')
  .light('wallLamp', 'bedroom', 6.32, 0.4, 1.2, 2700)
  .light('wallLamp', 'bedroom', 6.32, 2.4, 1.2, 2700)
  .light('deskLamp', 'flex', 5.0, 4.3, 1.2, 4000)
  .downlights('kitchen', [3.2, 6.3, 5.7, 8.5], 1, 1, 4000)
  .light('underCabinet', 'kitchen', 4.5, 8.1, 1.48, 4000)
  .light('mirror', 'bath', 3.5, 4.75, 1.5, 4000)
  .downlights('bath', [3.2, 4.7, 4.8, 6.2], 1, 1, 4000)
  .downlights('entry', [1.5, 5.9, 3.1, 8.0], 1, 2)
  .downlights('shelter', [0, 6.0, 1.4, 7.5], 1, 1, 4000);

b.spot('living-1', 'living', 2.35, 5.7, -18, { fov: 74 })
  .spot('living-2', 'living', 1.0, 2.75, 40)
  .spot('living-3', 'living', 2.3, 2.8, 215)
  .spot('window-living', 'living', 1.9, 1.3, 0, { kind: 'window', pitch: 0 })
  .spot('bedroom-1', 'bedroom', 3.6, 2.55, 65, { fov: 74 })
  .spot('flex-1', 'flex', 3.5, 4.1, 80, { fov: 74 })
  .spot('kitchen-1', 'kitchen', 3.7, 7.3, 80, { fov: 74 })
  .spot('bath-1', 'bath', 3.5, 5.6, 40, { fov: 75 })
  .spot('entry-1', 'entry', 2.5, 7.3, 0, { fov: 74 })
  .spot('shelter-1', 'shelter', 0.9, 6.9, 330, { fov: 75 });

b.route('hall', [2.5, 7.5], [2.5, 6.1])
  .route('between-sofa-and-tv', [2.2, 3.2], [2.2, 1.5])
  .route('to-bedroom', [2.3, 3.1], [3.6, 3.1]);

export const layoutT2 = b.build();
