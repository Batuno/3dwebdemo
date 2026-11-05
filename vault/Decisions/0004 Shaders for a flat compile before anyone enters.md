---
type: decision
date: 2026-11-04
status: accepted
tags: [decision, performance, showroom]
---

# Shaders for a flat compile before anyone enters

## Context

Entering a flat from the block view stuttered. A CPU profile showed the main thread blocked in `getProgramInfoLog` for most of the glide: 15 shader programs compiled on the first frames inside (the flat's materials, decor plants, hotspot dots, and on the medium tier the six ambient-occlusion passes, which only run inside flats). The existing idle warm-up could not help: those objects are not in the scene until a flat opens, and it compiled for the screen while the effect composer draws into off-screen buffers, so its programs never matched (40 of them).

## Decision

- `InteriorWarmup` (`apps/showroom/src/scene/unit/InteriorWarmup.tsx`), loaded at idle, builds the flat's real materials (`useInteriorMaterials(true)`), the decor models (`DECOR_MODELS`) and the hotspot materials, and compiles them off-screen against the main scene. It stays mounted so the programs stay cached.
- `compileOffscreen` in `apps/showroom/src/scene/warmup.ts` compiles into a 1×1 render target, like the composer. Full-screen passes (the n8ao quads in `PostFx.tsx`) compile without a scene, as they are drawn: no lights, no shadows.
- `finish` then uses every program once, as many per idle moment as fit. Without `KHR_parallel_shader_compile`, `compileAsync` returns at once and the driver compiles only on first use. Double-sided transparent materials hold two programs (back then front), and both are taken.
- The scene-wide `warmUp` uses the same off-screen target and finishing.

## Why

- Moving the compile to idle time is the only fix that keeps every material: no shader was too expensive, there were just many of them at the worst moment.
- Rendering the flat hidden for one frame was rejected: it would block a frame while the visitor may be orbiting, and it would also compile on the screen target.

## Consequences

- Checked in headless Chromium (no parallel compile, software GPU): 0 programs created and none slow on first use when entering a flat after the warm-up; main-thread compile time in the glide went from 5.8 s to 0.
- A new interior material, decor model or full-screen pass must be reachable by the warm-up, or it compiles in the glide again. `n8ao` quad names are listed in `AO_QUADS`.
- Leaving the page idle long enough matters on slow devices: a visitor who enters a flat within seconds of opening the page can still meet a compile.
