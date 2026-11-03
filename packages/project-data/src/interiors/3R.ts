// Appendix A.3, 3-room: 67 m² total, 64 m² internal.
// Kitchen and utility are combined and open to the corridor, as HDB drew them. The black-framed glass
// partition along the dashed line is optional and drawn open.
import { HIGH_WINDOW, KITCHEN_WINDOW, LayoutBuilder, W1 } from './build';
import type { RoomSpec } from './types';

export const rooms3R: RoomSpec[] = [
  { room: 'master', w: 3.2, d: 3.9, area: 12.5 },
  { room: 'bed2', w: 3.0, d: 3.1, area: 9.3 },
  { room: 'living', w: 3.2, d: 4.6, area: 14.7 },
  { room: 'corridor', w: 3.0, d: 1.7, area: 5.1 },
  { room: 'entry', w: 1.8, d: 1.6, area: 2.9 },
  { room: 'shelter', w: 1.4, d: 1.4, area: 2.0 },
  { room: 'bath1', w: 1.6, d: 1.7, area: 2.7 },
  { room: 'bath2', w: 1.5, d: 1.7, area: 2.6 },
  { room: 'acLedge', w: 1.8, d: 0.85, area: 1.5 },
  { room: 'kitchenUtility', w: 2.7, d: 3.4, area: 9.2 },
];

const b = new LayoutBuilder('3R');

b.room('master', [[0, 0, 3.2, 4.0]], { floor: 'wood', walls: 'paint', accent: 'e' })
  .room('bed2', [[3.3, 0, 6.3, 3.1]], { floor: 'wood', walls: 'paint', accent: 'e' })
  .room('living', [[6.4, 0, 9.6, 4.6]], { floor: 'wood', walls: 'paint', accent: 'w' })
  .room('corridor', [[3.3, 3.2, 6.4, 4.9]], { floor: 'wood', walls: 'paint' })
  .room('entry', [[6.4, 4.6, 8.2, 6.2]], { floor: 'wood', walls: 'paint' })
  .room('shelter', [[8.3, 4.7, 9.7, 6.1]], { floor: 'concrete', walls: 'bare' })
  .room('bath1', [[0, 4.1, 1.6, 5.8]], { floor: 'tile', walls: 'tile', tileAccent: 'w' })
  .room('bath2', [[1.7, 4.1, 3.2, 5.8]], { floor: 'tile', walls: 'tile' })
  .room('acLedge', [[0, 5.9, 1.8, 6.75]], { floor: 'concrete', walls: 'bare' })
  .room('kitchenUtility', [[3.3, 5.0, 6.0, 8.4]], { floor: 'tile', walls: 'paint' });

b.door('entrance', 'entrance', [7.3, 6.3], 'x', 1.0, 'min', 'n')
  .door('master', 'hinged', [3.25, 3.6], 'z', 0.8, 'max', 'w')
  .door('bed2', 'hinged', [3.825, 3.15], 'x', 0.85, 'min', 'n')
  .door('bath1', 'folding', [1.1, 4.05], 'x', 0.7, 'max', 's')
  .door('bath2', 'folding', [3.25, 4.5], 'z', 0.7, 'min', 'w')
  .door('shelter', 'hinged', [8.25, 5.375], 'z', 0.75, 'min', 'w')
  .opening('kitchen', [4.95, 4.95], 'x', 2.0);

b.window('master', 'n', 0.7, 2.7, W1, 'blackout')
  .window('bed2', 'n', 4.5, 6.1, W1, 'blackout')
  .window('living', 'n', 6.8, 9.2, W1, 'sheer')
  .window('kitchenUtility', 'w', 7.7, 8.35, KITCHEN_WINDOW)
  .window('bath1', 's', 0.5, 1.2, HIGH_WINDOW)
  .window('bath2', 's', 2.1, 2.7, HIGH_WINDOW);

// Living. TV on the left wall with the sage accent, sofa on the right, not facing the window.
b.put('rug', 'rug', 'living', [2.4, 1.7, 0.012], 'e', [7.2, 0.0], { finish: 'sand' })
  .put('tv-console', 'tvConsole', 'living', [1.8, 0.4, 0.45], 'e', [6.4, 0.3], { finish: 'oak' })
  .put('tv', 'tv', 'living', [1.22, 0.05, 0.7], 'e', [6.4, 0.59], { y: 0.7 })
  .put('sofa', 'sofa', 'living', [2.1, 0.9, 0.8], 'w', [8.7, 0.1], { finish: 'linen' })
  .put('coffee-table', 'coffeeTable', 'living', [1.0, 0.6, 0.4], 'e', [7.7, 0.05], { finish: 'oak' })
  .put('dining-table', 'diningTable', 'living', [1.2, 0.8, 0.75], 's', [7.7, 2.3], { finish: 'oak' })
  .put('dining-chair-1', 'chair', 'living', [0.45, 0.5, 0.8], 's', [7.75, 1.8], { finish: 'oak' })
  .put('dining-chair-2', 'chair', 'living', [0.45, 0.5, 0.8], 's', [8.25, 1.8], { finish: 'oak' })
  .put('dining-chair-3', 'chair', 'living', [0.45, 0.5, 0.8], 'n', [7.75, 3.1], { finish: 'oak' })
  .put('dining-chair-4', 'chair', 'living', [0.45, 0.5, 0.8], 'n', [8.25, 3.1], { finish: 'oak' })
  .put('floor-lamp', 'floorLamp', 'living', [0.3, 0.3, 1.55], 'w', [9.25, 2.25]);

// Master bedroom. Headboard on the side wall, 60+ cm along both sides, hinged wardrobe with 90 cm in front.
b.put('bed', 'bed', 'master', [1.6, 2.05, 1.1], 'w', [1.15, 0.6], { access: 'both', finish: 'linen' })
  .put('nightstand-1', 'nightstand', 'master', [0.42, 0.4, 0.5], 'w', [2.8, 0.18], { finish: 'oak' })
  .put('nightstand-2', 'nightstand', 'master', [0.42, 0.4, 0.5], 'w', [2.8, 2.2], { finish: 'oak' })
  .put('wardrobe', 'wardrobeHinged', 'master', [1.55, 0.6, 2.4], 'e', [0, 2.45], { finish: 'white' })
  .put('dressing-table', 'dressingTable', 'master', [0.8, 0.42, 0.75], 'e', [0, 0.7], { finish: 'oak' })
  .put('dressing-mirror', 'dressingMirror', 'master', [0.5, 0.03, 0.5], 'e', [0, 0.85], { y: 1.0, finish: 'black' });

// Bedroom 2.
b.put('bed', 'bed', 'bed2', [1.2, 2.0, 0.9], 'w', [4.3, 0.6], { access: 's', finish: 'linen' })
  .put('desk', 'desk', 'bed2', [1.2, 0.6, 0.75], 's', [3.3, 0], { finish: 'oak' })
  .put('desk-chair', 'officeChair', 'bed2', [0.6, 0.6, 0.95], 'n', [3.6, 0.6], { finish: 'grey' })
  .put('wall-shelf', 'wallShelf', 'bed2', [1.2, 0.25, 0.04], 's', [3.3, 0], { y: 1.2, finish: 'oak' })
  .put('desk-lamp', 'deskLamp', 'bed2', [0.2, 0.2, 0.45], 's', [3.35, 0.05], { y: 0.75, finish: 'black' })
  .put('wardrobe', 'wardrobeSliding', 'bed2', [1.6, 0.55, 2.4], 'n', [4.7, 2.55], { finish: 'white' });

// Kitchen and utility. Straight run on the left, fridge and stacked washer-dryer on the right.
b.put('counter', 'counter', 'kitchenUtility', [2.6, 0.6, 0.88], 'e', [3.3, 5.05], { finish: 'white' })
  .put('wall-cabinet', 'wallCabinet', 'kitchenUtility', [2.6, 0.35, 0.7], 'e', [3.3, 5.05], { y: 1.5, finish: 'sage' })
  .put('sink', 'sink', 'kitchenUtility', [0.8, 0.45, 0.02], 'e', [3.38, 5.3], { y: 0.86, finish: 'steel' })
  .put('hob', 'hob', 'kitchenUtility', [0.6, 0.5, 0.02], 'e', [3.35, 6.5], { y: 0.88 })
  .put('hood', 'hood', 'kitchenUtility', [0.6, 0.45, 0.25], 'e', [3.3, 6.5], { y: 1.6, finish: 'steel' })
  .put('fridge', 'fridge', 'kitchenUtility', [0.7, 0.7, 1.85], 'w', [5.3, 5.8], { finish: 'steel' })
  .put('washer-dryer', 'washerDryer', 'kitchenUtility', [0.6, 0.65, 1.7], 'w', [5.35, 7.7], { finish: 'white' })
  // Between the end of the counter and the far wall, so 2.1 m rather than the 2.4 m in Appendix A.
  .put('glass-partition', 'slidingPartition', 'kitchenUtility', [2.1, 0.06, 2.1], 'n', [3.9, 7.0], { optional: true, finish: 'glass' })
  .put('drying-rack', 'dryingRack', 'kitchenUtility', [1.2, 0.5, 0.05], 'e', [3.5, 7.1], { y: 2.3, finish: 'steel' });

// Bathrooms.
b.put('vanity', 'vanity', 'bath1', [0.6, 0.45, 0.5], 's', [0, 4.1], { y: 0.35, finish: 'oak' })
  .put('mirror-cabinet', 'mirrorCabinet', 'bath1', [0.6, 0.12, 0.7], 's', [0, 4.1], { y: 1.15 })
  .put('wc', 'wc', 'bath1', [0.38, 0.62, 0.8], 'n', [0, 5.18], { finish: 'white' })
  .put('shower', 'shower', 'bath1', [0.8, 0.85, 2.1], 'n', [0.8, 4.95], { finish: 'glass' })
  .put('vanity', 'vanity', 'bath2', [0.6, 0.45, 0.5], 's', [1.7, 4.1], { y: 0.35, finish: 'white' })
  .put('mirror-cabinet', 'mirrorCabinet', 'bath2', [0.6, 0.12, 0.7], 's', [1.7, 4.1], { y: 1.15 })
  .put('wc', 'wc', 'bath2', [0.38, 0.62, 0.8], 'n', [1.7, 5.18], { finish: 'white' })
  .put('shower', 'shower', 'bath2', [0.8, 0.85, 2.1], 'n', [2.4, 4.95], { finish: 'glass' });

// Corridor, entry and shelter.
b.put('shoe-cabinet', 'shoeCabinet', 'entry', [1.0, 0.35, 1.2], 'e', [6.4, 4.9], { y: 0.2, finish: 'oak' })
  .put('artwork', 'artwork', 'corridor', [0.6, 0.03, 0.8], 's', [4.6, 3.2], { y: 1.1 })
  .put('shelter-rack', 'shelterRack', 'shelter', [0.9, 0.3, 1.8], 'n', [8.4, 5.75], { finish: 'black' });

b.downlights('living', [6.4, 0, 9.6, 4.6], 2, 3)
  .light('pendant', 'living', 8.3, 2.7, 1.55, 2700)
  .light('floorLamp', 'living', 9.4, 2.4, 1.5, 2700)
  .light('cove', 'living', 8.0, 0.15, 2.5, 3000)
  .downlights('master', [0, 0, 3.2, 4.0], 1, 1, 3000, 'panel')
  .light('wallLamp', 'master', 3.17, 0.39, 1.2, 2700)
  .light('wallLamp', 'master', 3.17, 2.41, 1.2, 2700)
  .downlights('bed2', [3.3, 0, 6.3, 3.1], 1, 1, 3000, 'panel')
  .light('deskLamp', 'bed2', 3.45, 0.15, 1.2, 4000)
  .downlights('kitchenUtility', [3.3, 5.0, 6.0, 8.4], 1, 2, 4000)
  .light('underCabinet', 'kitchenUtility', 3.45, 6.35, 1.48, 4000)
  .light('mirror', 'bath1', 0.3, 4.15, 1.5, 4000)
  .light('mirror', 'bath2', 2.0, 4.15, 1.5, 4000)
  .downlights('bath1', [0, 4.1, 1.6, 5.8], 1, 1, 4000)
  .downlights('bath2', [1.7, 4.1, 3.2, 5.8], 1, 1, 4000)
  .downlights('corridor', [3.3, 3.2, 6.4, 4.9], 2, 1)
  .downlights('entry', [6.4, 4.6, 8.2, 6.2], 2, 1)
  .downlights('shelter', [8.3, 4.7, 9.7, 6.1], 1, 1, 4000);

b.spot('living-1', 'living', 6.8, 4.45, 20, { fov: 74 })
  .spot('living-2', 'living', 8.5, 1.4, 340)
  .spot('living-3', 'living', 9.25, 3.7, 300)
  .spot('window-living', 'living', 7.4, 0.3, 0, { kind: 'window', pitch: 0 })
  .spot('master-1', 'master', 2.7, 3.55, 340, { fov: 74 })
  .spot('master-2', 'master', 0.8, 2.0, 60)
  .spot('window-master', 'master', 1.6, 0.3, 0, { kind: 'window', pitch: 0 })
  .spot('bed2-1', 'bed2', 3.85, 2.6, 40, { fov: 74 })
  .spot('kitchen-1', 'kitchenUtility', 4.6, 5.3, 180, { fov: 74 })
  .spot('bath1-1', 'bath1', 1.05, 4.45, 215, { fov: 75 })
  .spot('bath2-1', 'bath2', 2.75, 4.5, 225, { fov: 75 })
  .spot('corridor-1', 'corridor', 6.0, 4.0, 270, { fov: 74 })
  .spot('entry-1', 'entry', 7.3, 5.7, 0, { fov: 74 })
  .spot('shelter-1', 'shelter', 8.75, 5.1, 150, { fov: 75 });

b.route('entry-to-living', [7.3, 5.6], [7.2, 4.2])
  .route('corridor', [6.0, 4.05], [3.8, 4.05])
  .route('between-sofa-and-tv', [7.25, 3.2], [7.25, 0.5])
  .route('kitchen-aisle', [4.6, 5.5], [4.6, 7.9]);

export const layout3R = b.build();
