# Changelog

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
