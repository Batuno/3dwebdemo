---
type: decision
date: 2026-11-04
status: accepted
tags: [decision, plan, showroom]
---

# Sales plan draws doors though the 3D flat has none

## Context

Version 0.3.2 removed the door leaves from the 3D flats, leaving open doorways. The plan view (3D / «Төлөвлөгөө» switch) was then redrawn as a sales plan: no furniture, Mongolian room names with size and area, «Орц» at the front door and overall dimensions.

## Decision

The plan draws each hinged door's swing (leaf and dashed arc) and sliding doors as offset panels (`apps/showroom/src/ui/PlanDrawing.tsx`, using `doorSwing()` in `packages/project-data/src/interiors/checks.ts`).

## Why

- The real flats have doors, and every developer's plan shows their swings. Buyers read the plan to see how rooms connect and where furniture can go.
- The 3D flat has no doors so the camera and hotspots are never blocked. The two views serve different purposes.

## Consequences

- The plan and the 3D view disagree about doors. If doors return to 3D, both follow `layout.doors`.
- Room sizes come from `roomSpecs` (the developer's figures), not from the drawn rectangles, so they can differ from the drawing by a few centimetres.
