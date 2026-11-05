---
type: decision
date: 2026-11-04
status: accepted
tags: [decision, lighting, showroom]
---

# Neutral tone mapping and a stronger sun

## Context

By day the towers looked flat and washed out. The fill light was almost as strong as the sun, so lit and shaded faces read the same, and AgX tone mapping greyed every colour. An earlier fix had raised the fill on purpose, because shaded walls turned near black and blue-grey.

## Decision

- Khronos PBR Neutral tone mapping instead of AgX, with a much lighter colour grade (`apps/showroom/src/scene/lighting/PostFx.tsx`).
- Sun 2.75, neutral fill 0.55, sky image light 0.6 (`SUN_DAY`, `FILL_DAY`, `SKY_DAY` in `apps/showroom/src/scene/lighting/Lighting.tsx`): shaded faces about 5:1 below lit ones.
- The 3000 K room lamps and the indoor bounce fill a step closer to white, because Neutral shows their warmth at full strength.

## Why

- Neutral keeps material colours as specified, which matters for a sales tool; AgX needed a saturation and contrast grade to undo its own greying.
- A 5:1 ratio gives the towers their shape while shaded faces stay their own colour. Checked at 09:00, 15:00 and 18:30.
- ACES was not chosen: it shifts hues and crushes shadows.

## Consequences

- Top surfaces in full noon sun sit close to white. The flat seen from above at noon clips its sunlit wall tops (about 4 % of pixels).
- Any new warm light needs a less saturated colour than it would under AgX.
- The top-view render (`TopViewScene.tsx`) still uses AgX.
