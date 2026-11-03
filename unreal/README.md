# Unreal pipeline / Unreal дамжлага

The web app stays the interactive product. Unreal produces photoreal images that the app displays: 360° panoramas at each hotspot, stills of the main cameras, and top-view plans.

Веб апп нь интерактив бүтээгдэхүүн хэвээр үлдэнэ. Unreal нь апп дээр харагдах бодит зургуудыг гаргана: цэг бүрийн 360° панорама, гол камеруудын зураг, төлөвлөгөөний дээрээс харсан зураг.

Tested on Unreal Engine 5.8. / Unreal Engine 5.8 дээр туршсан.

## Steps / Алхмууд

**1. Export from the web app / Веб аппаас экспортлох**

```bash
pnpm --filter @bair/showroom export:unreal
```

```bash
pnpm --filter @bair/showroom exec node scripts/check-export.mjs
```

This writes `export/`: `site.glb`, `block_804A.glb`, `block_804B.glb`, `interior_<type>.glb`, `topview_<type>.glb`, `hotspots.json`, `cameras.json`, `sun.json`, `interiors.json`. You can also open `#/dev/export` on the dev server and export one part at a time.

Энэ нь `export/` хавтас руу бичнэ. Хөгжүүлэлтийн сервер дээр `#/dev/export` хуудсыг нээж нэг нэгээр нь экспортлож болно.

**2. Open the project / Төслийг нээх**

Double-click `unreal/BairShowroom/BairShowroom.uproject`. The plugins it needs are already enabled: Python Editor Script, Movie Render Queue, Movie Render Queue Additional Render Passes, Sun Position Calculator, and Interchange for glTF. Rendering needs a DX12 graphics card.

`unreal/BairShowroom/BairShowroom.uproject` файлыг давхар дарж нээнэ. Шаардлагатай plugin-ууд аль хэдийн идэвхтэй. Рендер хийхэд DX12 дэмждэг видео карт хэрэгтэй.

**3. Run the scripts / Скриптүүдийг ажиллуулах**

In the editor choose **Tools → Execute Python Script**, or use the **Output Log** Python console. Run them in this order:

Редактор дээр **Tools → Execute Python Script** сонгож дараах дарааллаар ажиллуулна:

| Script | What it does / Юу хийдэг |
|---|---|
| `import_scene.py` | Imports every GLB, applies `material_map.json`, builds the level with sky, room lights and render camera / GLB файлуудыг оруулж, материал солиод, түвшнийг угсарна |
| `place_cameras.py` | Adds a camera for every hotspot and shot, for working by hand / Цэг бүрт камер нэмнэ |
| `render_panoramas.py` | Every hotspot × every time, 6144×3072, to `pano/<hotspotId>/<HHMM>.jpg` |
| `render_stills.py` | Opening, overview and block cameras, to `stills/<cameraId>/<HHMM>.jpg` |
| `render_topviews.py` | Each type and its mirror, day and evening, 8192 px, to `topview/master/` |

Renders go to `apps/showroom/public/renders/` unless `BAIR_RENDERS` says otherwise. To try one image first, set environment variables before opening the editor:

Рендерүүд `apps/showroom/public/renders/` руу орно. Эхлээд нэг зураг туршихын тулд редакторыг нээхээс өмнө орчны хувьсагч тохируулна:

```bash
BAIR_ONLY=4R_living-1 BAIR_TIMES=1200 BAIR_WIDTH=2048
```

To run a script from the command line, use `-ExecCmds`. Don't use `-ExecutePythonScript` for renders: it closes the editor as soon as the script returns, which stops the render.

Командын мөрөөс ажиллуулахдаа `-ExecCmds` ашиглана. Рендерт `-ExecutePythonScript` бүү ашигла: скрипт дуусмагц редакторыг хааж, рендерийг зогсооно.

```bash
UnrealEditor-Cmd.exe BairShowroom.uproject -ExecCmds="py C:/path/to/unreal/render_panoramas.py" -nosplash -stdout
```

Set `BAIR_QUIT=1` to close the editor when the script finishes.

**4. Prepare for the web / Вебэд бэлтгэх**

```bash
pnpm --filter @bair/showroom exec node scripts/optimize-renders.mjs
```

```bash
python unreal/build_manifest.py
```

The app finds `renders/manifest.json` by itself. Hotspots with a render show it; everything else stays real-time. Window-view hotspots always stay real-time, so the outside matches each flat's own storey.

Апп `renders/manifest.json` файлыг өөрөө олно. Рендертэй цэгүүд зургаа харуулж, бусад нь бодит цагийн дүрслэлээр үлдэнэ. Цонхны харагдац үргэлж бодит цагийнх байна.

## What to expect / Юу хүлээх вэ

Tested on Unreal 5.8 on an integrated Radeon: a 6144 px panorama finished in about 22 minutes, and 4096 px top views in about 90 seconds each. An 8192 px top view ran out of video memory and crashed the graphics driver, so it needs a dedicated graphics card, or use `BAIR_WIDTH=4096`. The full render set has not been run.

Unreal 5.8 дээр нэгдсэн Radeon-оор туршсан: 6144 px панорама 22 орчим минут, 4096 px төлөвлөгөө тус бүр 90 орчим секунд зарцуулсан. 8192 px төлөвлөгөө видео санах ой дүүрч унасан тул тусдаа видео карт хэрэгтэй, эсвэл `BAIR_WIDTH=4096` ашиглана. Бүтэн рендерийг ажиллуулж үзээгүй.

- **Lighting is a starting point.** Exposure per time of day lives in `exposure_for` in `bair_common.py`. Colours use the `rgb()` helper there, because `unreal.Color` takes its channels in the order b, g, r.
- **Time.** A full run is 100+ hotspot-time combinations per unit type, so use a dedicated graphics card and expect it to take many hours.
- **Reimporting keeps old material values.** A material instance that already exists stays as it was. To pick up a changed colour from the web app, delete `Content/Bair` first. The tower window glow is set by `WINDOW_GLOW` in `import_scene.py`.
- **Surfaces need a gap.** Two surfaces 2 cm or less apart showed as triangles or zigzags, so lit windows and plan outlines sit further back or out than you might expect.
- **Plants and people in top views** are plain shapes until you set real assets.

- **Гэрэлтүүлэг бол эхлэл.** Цаг бүрийн гэрэлтэлтийг `bair_common.py` доторх `exposure_for`-оос тохируулна. Өнгөнд `rgb()` туслах функц ашиглана, учир нь `unreal.Color` сувгуудаа b, g, r дарааллаар авдаг.
- **Хугацаа.** Бүтэн рендерт тусдаа видео карт хэрэгтэй, олон цаг шаардана.
- **Дахин импорт хуучин материалын утгыг хадгалдаг.** Веб аппын өөрчилсөн өнгийг авахын тулд эхлээд `Content/Bair` хавтсыг устгана. Цамхгийн цонхны гэрлийг `import_scene.py` доторх `WINDOW_GLOW` тохируулна.
- **Гадаргуунуудын хооронд зай хэрэгтэй.** 2 см ба түүнээс ойр гадаргуу гурвалжин, зигзаг хэлбэртэй харагдсан.
- **Төлөвлөгөөн дээрх ургамал, хүн** жинхэнэ файл оноох хүртэл энгийн дүрс хэвээр байна.

## Better materials / Материал сайжруулах

Edit `material_map.json`: point a name such as `M_Oak` at your own material path, for example `/Game/Materials/MI_Oak`. Then run `import_scene.py` again. Exported materials keep stable names, so your mapping survives every re-export.

`material_map.json` дотор `M_Oak` мэт нэрийг өөрийн материалын зам руу зааж, `import_scene.py`-г дахин ажиллуулна.

For top views, set `plantAsset` and `figureAsset` in `topview_props.json` to real plant and people meshes. Without them, the script uses plain shapes.

## How things line up / Зохицуулалт

- glTF metres become Unreal centimetres as X = x, Y = z, Z = y.
- Flats are placed in the real tower on storey 12, on a non-mirrored stack. Mirrored stacks flip the same image in the web app.
- A panorama's centre faces the flat's plan north, the main window wall. Outdoor panoramas face site north.
- The sun comes from `sun.json`, computed from the project's latitude, longitude and time zone. Change them in `project.config.ts` and export again. The directional light is set directly rather than through the Sun Position blueprint, so a render always matches the web app's sun.
- Top-view walls are real cut geometry from `topview_<type>.glb`, with black fill (`M_PlanCut`) and a white outline (`M_PlanOutline`).

## Size limits / Хэмжээний хязгаар

Full panoramas are large. GitHub Pages limits the published site, and GitHub rejects files over 100 MB. For real projects, upload `renders/` to a CDN and build with `VITE_ASSET_BASE_URL` set to its address.

Бүрэн панорамууд том хэмжээтэй. Бодит төсөлд `renders/` хавтсыг CDN руу байршуулж, `VITE_ASSET_BASE_URL` хувьсагчаар хаягийг нь зааж өгнө.
