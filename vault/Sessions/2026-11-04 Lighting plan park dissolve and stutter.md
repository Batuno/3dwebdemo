---
type: session
date: 2026-11-04
source: cloud
branch: claude/eloquent-cori-n05h9d
tags: [session, showroom]
---

# Lighting, plan, park, dissolve and the flat stutter

## Asked

Better lighting and contrast, a plan view without furniture but with Mongolian room names and measurements, a better-looking environment and transitions, a sharper picture, everything on `main`, and no stutter when going from a block into a flat.

## Done

- Daylight contrast and Neutral tone mapping, evening rooms warm not orange (`scene/lighting/Lighting.tsx`, `PostFx.tsx`, `unit/UnitInterior.tsx`). [[0002 Neutral tone mapping and a stronger sun]]
- Sales plan: no furniture, room names with size and area, door swings, «Орц», overall dimensions (`ui/PlanDrawing.tsx`, `ui/PlanView.tsx`). [[0003 Sales plan draws doors though the 3D flat has none]]
- Parkland across the streets, green lawns, 16x texture filtering (`site/Ground.tsx`, `site/Vegetation.tsx`, `materials.ts`).
- Cross-dissolve between standing points (`scene/dissolve.ts`, `scene/FrameGrab.tsx`, `ui/Dissolve.tsx`).
- Adaptive sharpening and an 85 % resolution floor (`lighting/Sharpen.ts`, `SceneRoot.tsx`).
- Flat-entry stutter: shaders compiled at idle (`unit/InteriorWarmup.tsx`, `warmup.ts`). [[0004 Shaders for a flat compile before anyone enters]]
- Fixed: the opening push-in overrode a standing point picked in its first seconds (`camera/CameraRig.tsx`).
- Before/after images: `docs/lighting/`, `docs/plan/plan-4R.jpg`, `docs/environment/before-after.jpg`.

## Decided

- See the three decision notes above.

## Left open

- Sharper texture files need `ambientcg.com`, `api.polyhaven.com` and `dl.polyhaven.org` allowed in the cloud environment's network settings, or `pnpm --filter @bair/showroom assets` run on a computer after the script asks for 2K sources.
- Baked lighting for the four flat types, and the Unreal render settings (white balance, Local Exposure, path tracer), are not started.
- The top-view render (`TopViewScene.tsx`) still uses AgX tone mapping.
- On phones the 4-room plan's labels are small until pinch-zoomed; rotating wide plans on portrait phones would help.
- The park lawn in the opening shot is one flat colour.
