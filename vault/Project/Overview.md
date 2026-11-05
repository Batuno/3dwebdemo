---
type: overview
tags: [project]
---

# Overview

A buyer explores a residential project in the browser: picks a block, floor and flat, looks around the furnished rooms at any time of day, then books a viewing or leaves a phone number. The sample project is Oak Ville @ AMK (Blocks 804A and 804B, 552 flats). Everything comes from data, so a new project needs new data files and assets, not code changes. The interface is in Mongolian.

## Where things live

| Path | What |
|---|---|
| `apps/showroom` | The 3D app (React, three.js) |
| `apps/website` | Placeholder marketing site |
| `apps/admin` | Admin panel at `/admin/`: leads, flat grid, prices and sales, analytics, exports, users |
| `apps/api` | The admin's API: Cloudflare Worker with D1 (free), or Node with SQLite on a computer |
| `packages/project-data` | Project config, blocks, flat types, interiors, pricing, availability, Mongolian text (`src/i18n/mn.ts`) |
| `packages/ui` | Shared glass panel |
| `unreal` | Photoreal render pipeline |
| `reference` | Source drawings and the interior design PDF |
| `docs` | Interior notes, Blender guide, review screenshots |
| `tools/sync.mjs` | Auto-sync between the computers and GitHub |
| `vault` | These notes |

## The repository's own docs

Obsidian cannot open files outside this folder, so these open on GitHub:

- [README](https://github.com/ba7aa-ireedui/3d-bair-songolt/blob/main/README.md) ([Монгол](https://github.com/ba7aa-ireedui/3d-bair-songolt/blob/main/README.mn.md)): running it, commands, adding a project, sync, deploy
- [CHANGELOG](https://github.com/ba7aa-ireedui/3d-bair-songolt/blob/main/CHANGELOG.md): what changed in each version
- [Interior notes](https://github.com/ba7aa-ireedui/3d-bair-songolt/blob/main/docs/INTERIOR_NOTES.md): how the interiors match the brochure and the design PDF, and the clearances that cannot be met
- [Unreal pipeline](https://github.com/ba7aa-ireedui/3d-bair-songolt/blob/main/unreal/README.md): panoramas, stills, top views
- [Blender pipeline](https://github.com/ba7aa-ireedui/3d-bair-songolt/blob/main/docs/BLENDER_PIPELINE.md): naming and export settings
- [Assets](https://github.com/ba7aa-ireedui/3d-bair-songolt/blob/main/ASSETS.md): CC0 sources

## Rules the code keeps

- Furniture is never scaled to fit. A real conflict is recorded in `packages/project-data/src/interiors/exceptions.ts`, and the tests fail on any new one.
- Interface text comes from `packages/project-data/src/i18n/mn.ts`, not from the components.
- Leads all go through `submitLead()` in `apps/showroom/src/lib/leads.ts` (the website's form through `apps/website/src/App.tsx`) and reach the API when the build has `VITE_API_URL`.
- The API stays inside Cloudflare's free plan: see [[0005 The admin API runs free on Cloudflare Workers and D1]].
