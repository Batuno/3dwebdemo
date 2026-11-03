# Blender pipeline

The showroom generates its towers, flats and site from data. Use Blender when a project has modelled geometry to bring in, such as a surroundings model or a custom facade.

## Surroundings: `context.glb`

The app draws simple generated neighbouring buildings by default. To replace them with a real model:

1. Build the area in Blender. OpenStreetMap through the Blosm add-on works well, or use drone photogrammetry later. Never use Google Maps or Google 3D Tiles data.
2. Use metres, with the site centre at the origin, Y up after export, and plan north along -Z.
3. Remove the project's own plot, so the buildings aren't doubled.
4. Export as `apps/showroom/public/assets/models/context.glb`.
5. Show "© OpenStreetMap contributors" wherever OSM data is used.

To use it, build with `VITE_CONTEXT_URL=models/context.glb`. It replaces the generated buildings, and the attribution appears in the app. Adjust `context.position` and `context.rotationDeg` in `project.config.ts` to line it up.

## Object naming

Use the names the Unreal export uses, so tools and scripts can find objects the same way:

| Object | Name |
|---|---|
| A block | `Block_<id>`, for example `Block_804A` |
| One storey | `Floor_<block>_<storey>` |
| One flat | `Unit_<block>_<storey>_<stack>` |
| A room in a flat type | `Room_<unitType>_<roomId>` |
| An amenity | `Amenity_<key>` |
| Anything in the surroundings | `Context_<name>` |

Materials start with `M_`, for example `M_Oak`, `M_StoneTile`, `M_Glass`. The list is in `unreal/material_map.json`.

## Custom properties

Blender custom properties export as glTF `extras`, and three.js reads them into `object.userData`. The export uses `number` and `type` on `Unit_*` nodes and `kind` on `Amenity_*` nodes. Follow the same keys for anything you add.

## Export settings

In **File → Export → glTF 2.0**:

| Setting | Value |
|---|---|
| Format | glTF Binary (`.glb`) |
| Include | Custom Properties on, Selected Objects as needed |
| Transform | +Y Up on |
| Geometry | Apply Modifiers on, UVs and Normals on |
| Compression | Off here: `apps/showroom/scripts/fetch-assets.mjs` shows how the project compresses with meshopt and KTX2 |

Keep each file under 100 MB, and track `.glb` files with Git LFS, which this repository already does.
