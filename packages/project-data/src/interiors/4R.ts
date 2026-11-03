// Appendix A.4, 4-room: 90 m² total, 86 m² internal.
// Living and dining on one axis, three bedrooms along the corridor, kitchen with a separate service yard.
// Counters follow the HDB plan (left and far walls) so the service yard door stays reachable.
import { HIGH_WINDOW, LayoutBuilder, W1 } from './build';
import type { RoomSpec } from './types';

export const rooms4R: RoomSpec[] = [
  { room: 'living', w: 3.2, d: 4.4, area: 14.1 },
  { room: 'dining', w: 3.0, d: 2.6, area: 7.8 },
  { room: 'bed2', w: 3.0, d: 3.2, area: 9.6 },
  { room: 'bed3', w: 3.0, d: 3.2, area: 9.6 },
  { room: 'master', w: 3.3, d: 4.4, area: 14.5 },
  { room: 'corridor', w: 6.0, d: 1.2, area: 7.2 },
  { room: 'shelter', w: 1.4, d: 1.6, area: 2.2 },
  { room: 'kitchen', w: 2.2, d: 3.6, area: 7.9 },
  { room: 'service', w: 1.5, d: 2.1, area: 3.2 },
  { room: 'bath2', w: 1.7, d: 1.45, area: 2.5 },
  { room: 'bath1', w: 1.9, d: 1.6, area: 3.0 },
  { room: 'acLedge', w: 2.0, d: 0.9, area: 1.8 },
];

const b = new LayoutBuilder('4R');

b.room('living', [[0, 0, 3.2, 4.5]], { floor: 'wood', walls: 'paint', accent: 'e' })
  .room('bed2', [[3.3, 0, 6.3, 3.2]], { floor: 'wood', walls: 'paint', accent: 'w' })
  .room('bed3', [[6.4, 0, 9.4, 3.2]], { floor: 'wood', walls: 'paint', accent: 'e' })
  .room('master', [[9.5, 0, 12.8, 4.4]], { floor: 'wood', walls: 'paint', accent: 'e' })
  .room('corridor', [[3.2, 3.3, 9.4, 4.5]], { floor: 'wood', walls: 'paint' })
  .room('shelter', [[0, 4.6, 1.4, 6.2]], { floor: 'concrete', walls: 'bare' })
  .room('dining', [[1.5, 4.5, 4.5, 7.1]], { floor: 'wood', walls: 'paint' })
  .room('kitchen', [[4.6, 4.6, 6.8, 8.2]], { floor: 'tile', walls: 'paint' })
  .room('service', [[6.9, 6.15, 8.4, 8.25]], { floor: 'tile', walls: 'bare' })
  .room('bath2', [[6.9, 4.6, 8.6, 6.05]], { floor: 'tile', walls: 'tile' })
  .room('bath1', [[8.7, 4.6, 10.6, 6.3]], { floor: 'tile', walls: 'tile', tileAccent: 'e' })
  .room('acLedge', [[8.9, 6.4, 10.9, 7.3]], { floor: 'concrete', walls: 'bare' });

b.door('entrance', 'entrance', [2.05, 7.2], 'x', 1.0, 'min', 'n')
  .door('bed2', 'hinged', [5.8, 3.25], 'x', 0.9, 'max', 'n')
  .door('bed3', 'hinged', [6.9, 3.25], 'x', 0.9, 'min', 'n')
  .door('master', 'hinged', [9.45, 3.75], 'z', 0.9, 'max', 'e')
  .door('bath1', 'folding', [9.975, 4.5], 'x', 0.75, 'max', 's')
  .door('bath2', 'folding', [7.325, 4.55], 'x', 0.75, 'min', 's')
  .door('shelter', 'hinged', [1.45, 5.575], 'z', 0.75, 'min', 'e')
  .door('service', 'folding', [6.85, 6.875], 'z', 0.75, 'min', 'e')
  .opening('kitchen', [5.75, 4.55], 'x', 1.0);

b.window('living', 'n', 0.4, 2.8, W1, 'sheer')
  .window('bed2', 'n', 3.5, 5.1, W1, 'blackout')
  .window('bed3', 'n', 7.6, 9.2, W1, 'blackout')
  .window('master', 'n', 10.0, 12.3, W1, 'blackout')
  .window('service', 'e', 6.4, 8.0, { sill: 0.2, head: 2.4 }, 'none', true)
  .window('bath2', 's', 7.0, 7.6, HIGH_WINDOW)
  .window('bath1', 's', 9.3, 9.9, HIGH_WINDOW);

// Living.
b.put('rug', 'rug', 'living', [2.5, 2.0, 0.012], 'e', [0.5, 0.3], { finish: 'sand' })
  .put('sofa', 'sofa', 'living', [2.1, 0.9, 0.8], 'e', [0, 0.5], { finish: 'linen' })
  .put('coffee-table', 'coffeeTable', 'living', [1.0, 0.6, 0.4], 'w', [1.3, 1.05], { finish: 'oak' })
  .put('tv-console', 'tvConsole', 'living', [2.0, 0.4, 0.45], 'w', [2.8, 0.4], { finish: 'oak' })
  .put('tv', 'tv', 'living', [1.22, 0.05, 0.7], 'w', [3.15, 0.79], { y: 0.7 })
  .put('armchair', 'armchair', 'living', [0.75, 0.75, 0.8], 'n', [1.33, 2.95], { finish: 'sage' })
  .put('bookshelf', 'bookshelf', 'living', [1.2, 0.35, 1.8], 'e', [0, 3.2], { finish: 'oak' })
  .put('floor-lamp', 'floorLamp', 'living', [0.3, 0.3, 1.55], 'e', [0.1, 2.75]);

// Dining, entry and shelter.
b.put('dining-table', 'diningTable', 'dining', [1.6, 0.9, 0.75], 'e', [2.9, 4.6], { finish: 'oak' })
  .put('dining-chair-1', 'chair', 'dining', [0.45, 0.5, 0.8], 'e', [2.4, 4.72], { finish: 'oak' })
  .put('dining-chair-2', 'chair', 'dining', [0.45, 0.5, 0.8], 'e', [2.4, 5.17], { finish: 'oak' })
  .put('dining-chair-3', 'chair', 'dining', [0.45, 0.5, 0.8], 'e', [2.4, 5.62], { finish: 'oak' })
  .put('dining-chair-4', 'chair', 'dining', [0.45, 0.5, 0.8], 'w', [3.8, 4.72], { finish: 'oak' })
  .put('dining-chair-5', 'chair', 'dining', [0.45, 0.5, 0.8], 'w', [3.8, 5.17], { finish: 'oak' })
  .put('dining-chair-6', 'chair', 'dining', [0.45, 0.5, 0.8], 'w', [3.8, 5.62], { finish: 'oak' })
  .put('shoe-cabinet', 'shoeCabinet', 'dining', [0.8, 0.35, 1.2], 'n', [3.6, 6.75], { finish: 'oak' })
  .put('mirror', 'mirror', 'dining', [0.5, 0.03, 1.7], 'n', [2.75, 7.07], { y: 0.2, finish: 'black' })
  .put('shelter-rack', 'shelterRack', 'shelter', [1.0, 0.3, 1.8], 'e', [0, 4.9], { finish: 'black' });

// Master bedroom. Headboard on the side wall, 60+ cm along each side of the king bed, sliding wardrobe opposite.
b.put('bed', 'bed', 'master', [1.9, 2.1, 1.1], 'w', [10.7, 0.6], { access: 'both', finish: 'linen' })
  .put('nightstand-1', 'nightstand', 'master', [0.4, 0.42, 0.5], 'w', [12.38, 0.2], { finish: 'oak' })
  .put('nightstand-2', 'nightstand', 'master', [0.4, 0.42, 0.5], 'w', [12.38, 2.5], { finish: 'oak' })
  .put('wardrobe', 'wardrobeSliding', 'master', [2.15, 0.6, 2.4], 'n', [10.45, 3.8], { finish: 'white' })
  .put('dressing-table', 'dressingTable', 'master', [1.0, 0.45, 0.75], 'e', [9.5, 0.7], { finish: 'oak' })
  .put('dressing-mirror', 'dressingMirror', 'master', [0.6, 0.03, 0.8], 'e', [9.5, 0.9], { y: 0.95, finish: 'black' });

// Bedrooms 2 and 3, mirrored. Doors and wardrobes take the HDB positions.
b.put('bed', 'bed', 'bed2', [1.2, 2.0, 0.9], 'e', [3.3, 0.6], { access: 's', finish: 'linen' })
  .put('desk', 'desk', 'bed2', [1.2, 0.6, 0.75], 's', [5.1, 0], { finish: 'oak' })
  .put('desk-chair', 'officeChair', 'bed2', [0.6, 0.6, 0.95], 'n', [5.4, 0.6], { finish: 'grey' })
  .put('wall-shelf-1', 'wallShelf', 'bed2', [1.2, 0.25, 0.04], 's', [5.1, 0], { y: 1.2, finish: 'oak' })
  .put('wall-shelf-2', 'wallShelf', 'bed2', [1.2, 0.25, 0.04], 's', [5.1, 0], { y: 1.6, finish: 'oak' })
  .put('desk-lamp', 'deskLamp', 'bed2', [0.2, 0.2, 0.45], 's', [6.05, 0.05], { y: 0.75, finish: 'black' })
  .put('wardrobe', 'wardrobeSliding', 'bed2', [1.6, 0.55, 2.4], 'n', [3.3, 2.65], { finish: 'white' })
  .put('bed', 'bed', 'bed3', [1.2, 2.0, 0.9], 'w', [7.4, 0.6], { access: 's', finish: 'linen' })
  .put('desk', 'desk', 'bed3', [1.2, 0.6, 0.75], 's', [6.4, 0], { finish: 'oak' })
  .put('desk-chair', 'officeChair', 'bed3', [0.6, 0.6, 0.95], 'n', [6.7, 0.6], { finish: 'grey' })
  .put('wall-shelf-1', 'wallShelf', 'bed3', [1.2, 0.25, 0.04], 's', [6.4, 0], { y: 1.2, finish: 'oak' })
  .put('wall-shelf-2', 'wallShelf', 'bed3', [1.2, 0.25, 0.04], 's', [6.4, 0], { y: 1.6, finish: 'oak' })
  .put('desk-lamp', 'deskLamp', 'bed3', [0.2, 0.2, 0.45], 's', [6.45, 0.05], { y: 0.75, finish: 'black' })
  .put('wardrobe', 'wardrobeSliding', 'bed3', [1.6, 0.55, 2.4], 'n', [7.8, 2.65], { finish: 'white' });

// Kitchen and service yard.
b.put('counter-long', 'counter', 'kitchen', [2.0, 0.6, 0.88], 'n', [4.6, 7.6], { finish: 'white' })
  .put('counter-short', 'counter', 'kitchen', [2.1, 0.6, 0.88], 'e', [4.6, 5.4], { finish: 'white' })
  .put('wall-cabinet-long', 'wallCabinet', 'kitchen', [2.0, 0.35, 0.7], 'n', [4.6, 7.85], { y: 1.5, finish: 'sage' })
  .put('wall-cabinet-short', 'wallCabinet', 'kitchen', [1.5, 0.35, 0.7], 'e', [4.6, 5.4], { y: 1.5, finish: 'sage' })
  .put('sink', 'sink', 'kitchen', [0.8, 0.45, 0.02], 'n', [5.4, 7.68], { y: 0.86, finish: 'steel' })
  .put('hob', 'hob', 'kitchen', [0.6, 0.5, 0.02], 'e', [4.65, 6.1], { y: 0.88 })
  .put('hood', 'hood', 'kitchen', [0.6, 0.45, 0.25], 'e', [4.6, 6.1], { y: 1.6, finish: 'steel' })
  .put('fridge', 'fridge', 'kitchen', [0.7, 0.7, 1.85], 'e', [4.6, 4.65], { finish: 'steel' })
  .put('broom-cabinet', 'broomCabinet', 'kitchen', [0.6, 0.4, 2.0], 'w', [6.4, 5.1], { finish: 'white' })
  .put('washer', 'washer', 'service', [0.6, 0.6, 0.85], 'n', [6.95, 7.65], { finish: 'white', blocks: true })
  .put('dryer', 'washer', 'service', [0.6, 0.6, 0.85], 'n', [7.55, 7.65], { finish: 'white', blocks: true })
  .put('worktop', 'worktop', 'service', [1.4, 0.6, 0.03], 'n', [6.95, 7.65], { y: 0.85, finish: 'quartz' })
  .put('drying-rack', 'dryingRack', 'service', [1.2, 0.5, 0.05], 'w', [7.85, 6.3], { y: 2.3, finish: 'steel' });

// Bathrooms.
b.put('shower', 'shower', 'bath2', [0.8, 0.8, 2.1], 's', [7.8, 4.6], { finish: 'glass' })
  .put('vanity', 'vanity', 'bath2', [0.6, 0.45, 0.5], 'n', [8.0, 5.6], { y: 0.35, finish: 'white' })
  .put('mirror-cabinet', 'mirrorCabinet', 'bath2', [0.6, 0.12, 0.7], 'n', [8.0, 5.93], { y: 1.15 })
  .put('wc', 'wc', 'bath2', [0.38, 0.62, 0.8], 'n', [6.95, 5.43], { finish: 'white' })
  .put('vanity', 'vanity', 'bath1', [0.8, 0.45, 0.5], 's', [8.7, 4.6], { y: 0.35, finish: 'oak' })
  .put('mirror-cabinet', 'mirrorCabinet', 'bath1', [0.8, 0.12, 0.7], 's', [8.7, 4.6], { y: 1.15 })
  .put('wc', 'wc', 'bath1', [0.38, 0.62, 0.8], 'n', [8.75, 5.68], { finish: 'white' })
  .put('shower', 'shower', 'bath1', [0.85, 0.85, 2.1], 'n', [9.75, 5.45], { finish: 'glass' });

b.downlights('living', [0, 0, 3.2, 4.5], 2, 3)
  .light('floorLamp', 'living', 0.25, 2.9, 1.5, 2700)
  .light('cove', 'living', 1.6, 0.15, 2.5, 3000)
  .light('linearPendant', 'dining', 3.35, 5.4, 1.55, 2700)
  .downlights('dining', [1.5, 4.5, 4.5, 7.1], 1, 1)
  .downlights('master', [9.5, 0, 12.8, 4.4], 1, 1, 3000, 'panel')
  .light('wallLamp', 'master', 12.77, 0.4, 1.2, 2700)
  .light('wallLamp', 'master', 12.77, 2.7, 1.2, 2700)
  .downlights('bed2', [3.3, 0, 6.3, 3.2], 1, 1, 3000, 'panel')
  .light('deskLamp', 'bed2', 6.15, 0.15, 1.2, 4000)
  .downlights('bed3', [6.4, 0, 9.4, 3.2], 1, 1, 3000, 'panel')
  .light('deskLamp', 'bed3', 6.55, 0.15, 1.2, 4000)
  .downlights('corridor', [3.2, 3.3, 9.4, 4.5], 3, 1)
  .downlights('kitchen', [4.6, 4.6, 6.8, 8.2], 1, 2, 4000)
  .light('underCabinet', 'kitchen', 5.6, 8.0, 1.48, 4000)
  .downlights('service', [6.9, 6.15, 8.4, 8.25], 1, 1, 4000)
  .light('mirror', 'bath2', 8.3, 5.95, 1.5, 4000)
  .light('mirror', 'bath1', 9.1, 4.65, 1.5, 4000)
  .downlights('bath2', [6.9, 4.6, 8.6, 6.05], 1, 1, 4000)
  .downlights('bath1', [8.7, 4.6, 10.6, 6.3], 1, 1, 4000)
  .downlights('shelter', [0, 4.6, 1.4, 6.2], 1, 1, 4000);

b.spot('living-1', 'living', 2.7, 4.2, -15, { fov: 74 })
  .spot('living-2', 'living', 1.1, 0.3, 150)
  .spot('living-3', 'living', 2.3, 2.7, 265)
  .spot('window-living', 'living', 2.3, 0.3, 0, { kind: 'window', pitch: 0 })
  .spot('dining-1', 'dining', 1.9, 6.5, 40, { fov: 74 })
  .spot('master-1', 'master', 9.8, 2.6, 70, { fov: 74 })
  .spot('master-2', 'master', 11.2, 3.1, 20)
  .spot('window-master', 'master', 10.3, 0.35, 0, { kind: 'window', pitch: 0 })
  .spot('bed2-1', 'bed2', 5.8, 2.6, 300, { fov: 74 })
  .spot('bed3-1', 'bed3', 6.9, 2.6, 60, { fov: 74 })
  .spot('corridor-1', 'corridor', 8.9, 3.9, 270, { fov: 74 })
  .spot('kitchen-1', 'kitchen', 5.75, 5.3, 190, { fov: 74 })
  .spot('service-1', 'service', 7.25, 6.6, 150, { fov: 75 })
  .spot('bath2-1', 'bath2', 7.3, 4.95, 150, { fov: 75 })
  .spot('bath1-1', 'bath1', 9.85, 4.95, 225, { fov: 75 })
  .spot('shelter-1', 'shelter', 0.9, 5.4, 300, { fov: 75 });

b.route('entry-to-living', [1.95, 6.4], [2.5, 2.6])
  .route('corridor', [3.6, 3.9], [9.0, 3.9])
  .route('between-sofa-and-tv', [2.35, 2.2], [2.35, 0.5])
  .route('kitchen-aisle', [5.75, 5.0], [5.75, 7.1]);

export const layout4R = b.build();
