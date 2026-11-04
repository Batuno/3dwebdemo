# Changelog

## 0.3.3

### Changed

- Hiding a panel no longer removes it. Its × button, Esc, or dragging a sheet down slides it out to its side and leaves a tab that slides it back, and the subject moves to the middle of the screen while the panel is away.
- On portrait phones, panels are sheets above the navigation that fold into their header. A flat's sheet shows its number, availability and price when folded, with the 3D / plan switch riding on top of it, so nothing overlaps at the bottom of the screen.
- Calmer motion: moves between views glide more slowly and ease in and out, the lens eases to each view's field of view instead of jumping, the opening push-in is longer, and moving the time slider lets the sun and sky glide to the new time.
- The camera stays inside a circle around the site: zooming out stops at its edge, it cannot enter the neighbouring buildings or go below ground, and the orbit point stays on the site and its streets.
- Entering the garage removes the towers at once instead of erasing them from the top, and leaving it shows them whole.
- Phones load half-resolution textures and image lights, made at build time from the same files, and load only the image light the opening time needs. Interior textures load once the page is idle, and textures nothing used are no longer fetched. A phone downloads about 4 MB before its first frame instead of 14 MB.
- The floor highlight in block view glides between storeys and fades its colour; windows and lamps glow a little more after dark; ambient occlusion fades in and out of flats.
- The first step of the breadcrumb reads «Эхлэл» instead of «Төсөл».
- A flat's information panel no longer slides off the screen. One toggle button in its header folds it into a slim bar where it stood (number, availability and price) and opens it again. On portrait phones the sheet's × is the same toggle (chevron down to fold, up to open).
- The flat's plan view (the 3D / «Төлөвлөгөө» switch) shows a clean drawn floor plan instead of the furnished render: walls, windows and fixed furniture in line, with no room names. The flat's number and total area sit above it. It zooms with the mouse wheel, a pinch, double-click or the + / − buttons, pans by dragging once zoomed, and stays sharp at every zoom. The time slider steps aside while the plan is up, and the controls over it switch to dark text.
- On computers the flat's minimap is always on screen, with no button to hide it. Phones no longer show the minimap or its «Төлөвлөгөө» tab.
- Room names and areas over the 3D flat are plain text with a soft shadow instead of white boxes, so they no longer hide the rooms beneath them.

### Fixed

- Hitches on every view change: shadows re-rendered every frame while a cut moved, the garage added a light (recompiling every material on the way in and out), the lawn recompiled its shader, the site's trees, cars, people and lamps were rebuilt after each garage visit, the garage drew 272 separate bay numbers, flats rebuilt the post-processing chain, and transition frames could lower the resolution or quality tier.
- The garage, the see-through lawn and the flat code are prepared while the page is idle, so a first visit no longer stalls on loading or shader compilation.
- In-scene labels no longer use a backdrop blur, which was recomputed every frame the camera moved.
- The PCFSoftShadowMap warning from three 0.187 (it now softens PCF shadows by their radius).
- The Unreal export's block step now runs after the site step without missing the void-deck meshes.
- Standing inside a flat, hotspot dots were often hidden under the plan, the navigation or the time slider, so clicking them did nothing. Dots now float higher in that view, near dots keep a full-size click target, and clicking the floor near a dot (which lights up as you point) walks there. This also works in mirrored flats.
- On portrait phones inside a room, the plan's tab covered the room pill's «Бүх өрөө» button. The room pill is now a two-line card (name, then size) with the button beside it, and the plan's tab and panel sit below it.
- An open menu from the bottom navigation (such as the quality menu) opened underneath a flat's 3D / plan switch. It now opens above the switch, and in front of the phone sheet.

## 0.3.2

### Changed

- Doors are gone from every flat: doorways are clean openings, and the front doorway reads as plain wall from inside. The 2RF_T2 folding door option went with them.

### Fixed

- Text in the viewing and information forms was white on white in evening and night scenes.

## 0.3.1

### Added

- People around the site: stylised figures on the paths and at the amenities.
- Plan view for a flat: a switch beside the dollhouse crossfades to the top view, with clickable hotspot dots.
- Furnished top views of the nearest flats when zooming into a floor plan.
- 3R sliding glass kitchen partition and 2RF_T2 folding door as options in the flat panel.
- Ceiling cove lighting, double curtains and kitchen backsplashes.
- Per-room light colours from each fitting's colour temperature.
- Opening still shown before the first input, when a render exists.
- Context model: a Blender or OpenStreetMap `context.glb` can replace the generated city.
- Lit tower windows at night in the Unreal export.
- `start.bat` and `start.sh`: one step from a clone to the running app.
- `tools/sync.mjs`: automatic commit, pull and push from two machines, with undo and return to any commit.

### Changed

- Every panel can now be closed, and settings has a row to bring them all back.
- Medium quality uses ambient occlusion only inside flats, at lower samples.
- Pages deploys by hand only, because the repository is private.
- Line endings are normalised to LF across machines.

### Fixed

- Adaptive resolution did almost nothing on 1× screens.
- Path lamps stood in the middle of the paving.
- Building colours no longer shift during the day: walls keep their own colour when the sun moves off them, instead of turning near black and blue-grey.
- Unreal colours: sun, moon and sky tints were in the wrong channel order, which made day interiors blue and moonlight orange.
- Unreal tower windows and top views: triangles and zigzags from surfaces too close together, overbright windows, and heavy top-view shadows.
- A missing or broken context model falls back to the generated buildings instead of stopping the app, and context models can use compressed textures.
- "Service yard" now reads in Mongolian.

## 0.3.0

### Added

- Monorepo with the showroom, a placeholder marketing site, shared data and UI packages, CI, and a combined GitHub Pages deploy.
- Flats rebuilt from the interior design: exact furniture sizes, doors, windows, lights and materials, with automated clearance checks for each type and its mirror, and a `?debug=1` overlay.
- Dusk opening shot with a push-in, free orbit, pan and zoom, and fly-to on double-click.
- Time-of-day slider driving the real sun position, sky, shadows, window lights and interior lights, with `?t=` links.
- Floor selection with a storey scale beside the tower, a soft storey highlight, and a glass panel.
- Glass hotspots with eye-level look-around inside flats and outdoors, window views from each flat's real storey, a minimap with a live view cone, and deep links to any hotspot.
- Top-view plans with cut walls, room labels, scale figures, zoom and download.
- Phone layouts in both orientations, with collapsible panels everywhere and drag-to-collapse sheets.
- Unreal pipeline: `#/dev/export`, Python scripts for import, cameras, panoramas, stills and top views, and a manifest the app reads to show rendered images with crossfades between times.

### Changed

- Bed headboards moved from the window wall to side walls.
- Bottom navigation replaces the side controls.

### Removed

- First-person walking, filters, budget and mortgage calculator, compare, favourites and the day/night toggle.

## 0.1.0

- First single-package demo.
