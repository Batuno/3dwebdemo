# 3D Байр Сонголт: interactive 3D property showroom

[Монгол хэлээр](./README.mn.md)

A buyer explores a residential project in the browser, picks a block, floor and flat, looks around the furnished rooms at any time of day, then books a viewing or leaves a phone number.

The sample project is Oak Ville @ AMK (Blocks 804A and 804B, 552 flats). Everything comes from data, so a new project needs new data files and assets, not code changes.

## Run it

After cloning, double-click `start.bat` on Windows, or run `./start.sh` on Mac or Linux. It downloads the 3D files, installs the libraries, turns on auto-sync and opens http://localhost:5173. The only requirements are Git with [Git LFS](https://git-lfs.com) and Node 22 or newer; on Windows, `start.bat` installs Node if it is missing.

Run by hand, it is `pnpm install` and then `pnpm dev`. If PowerShell says running scripts is disabled, type `pnpm.cmd` instead of `pnpm`. For the marketing site, run `pnpm dev:website`.

| Command | What it does |
|---|---|
| `pnpm test` | Unit tests: pricing, availability, clearances, hotspots, routing, render data |
| `pnpm typecheck` | TypeScript across every package |
| `pnpm lint` | ESLint |
| `pnpm build` | Builds both apps into `dist/`: the website at `/`, the showroom at `/showroom/` |
| `pnpm --filter @bair/showroom e2e` | Browser test of the buying flow against a running dev server (needs Edge or Chrome) |
| `pnpm --filter @bair/showroom assets` | Re-downloads and re-compresses the CC0 assets |

Deep links work everywhere: `#/804A`, `#/804A/12`, `#/804A/12/325`, `#/804A/12/325/living-1`, `#/outdoor/playground`. Add `?t=18:30` for a time of day.

Dev pages: `?debug=1` in a flat shows the measured plan with clearances, `#/dev/plan/4R` compares a flat's top view with its plan, and `#/dev/export` exports for Unreal.

## Layout

| Folder | What is in it |
|---|---|
| `apps/showroom` | The 3D app |
| `apps/website` | Placeholder marketing site |
| `packages/project-data` | Project config, data, interiors, pricing, availability, Mongolian text. No 3D code, so a backend can reuse it |
| `packages/ui` | Shared glass panel |
| `unreal` | Photoreal render pipeline, see [its README](./unreal/README.md) |
| `reference` | Source drawings and the interior design PDF |
| `docs` | Interior notes, Blender guide, review screenshots |

## Add a new project

Everything lives in `packages/project-data/src`:

1. `data/project.config.ts`: name, developer, contact details, accent colour, latitude and longitude, time zone, price per m², floor premium, bay price.
2. `data/blocks.ts`: blocks and the stacks on each floor.
3. `data/unitTypes.ts` and `interiors/`: one file per flat type with rooms, doors, windows, furniture, lights and hotspots. Run `pnpm test` and the clearance checks report anything that doesn't fit. Furniture is never scaled to fit: record a real conflict in `interiors/exceptions.ts`.
4. `data/site.ts`, `data/outdoor.ts`, `data/garage.ts`, `data/cameras.ts`: amenities, outdoor standing points, parking and named cameras.
5. `i18n/mn.ts`: labels. To add a language, copy this file to `en.ts` and translate the values.

## Connect a backend for leads

All forms go through one function, `submitLead()` in `apps/showroom/src/lib/leads.ts`. Without a backend, leads are saved in the browser. To send them to your server, set `leads.endpoint` in `project.config.ts`. The function posts the lead as JSON and still keeps a local copy.

## Working from two machines

Keep `start.bat` running, or run `pnpm sync:install` once on Windows to have sync start with the computer. About 45 seconds after the last edit, your changes are committed and pushed to `main`, and the other side's changes arrive by themselves. It only acts on `main`, so a branch of your own is left alone.

| Command | What it does |
|---|---|
| `pnpm sync` | Syncs right now |
| `pnpm sync:list` | Shows the recent commits |
| `pnpm sync:undo` | Goes back one commit. Run it again to go further back |
| `pnpm sync:back <commit>` | Returns every file to that commit |

Going back adds a new commit and keeps the history, so it is safe with both sides running, and can itself be reversed.

**If both sides edit the same line:** sync does not stop. The side that syncs last wins that line, the earlier version is saved on a `backup/...` branch on GitHub, and the event is written to `.git/sync.log`. Edits to different lines, even in the same file, merge normally.

Sync commits skip CI to save the free Actions minutes, and they are not tested first, so unfinished work can reach the other side. Commit by hand without `[skip ci]` to run the checks.

## Deploy

GitHub Actions runs lint, typecheck and tests on every normal commit. GitHub Pages needs a public repository or a paid plan, so the Pages deploy runs only when started by hand from the **Actions** tab. Before using it, set **Pages → Source** to **GitHub Actions** in the repository settings.

GitHub rejects files over 100 MB and limits the published site's size. Keep rendered images out of Pages for real projects: upload them to a CDN and build with `VITE_ASSET_BASE_URL` set to its address, with a trailing slash. Assets and renders then load from there.

## Rendering and 3D pipelines

- **Unreal:** [unreal/README.md](./unreal/README.md) covers exporting the scene, rendering panoramas, stills and top views, and showing them in the app.
- **Blender:** [docs/BLENDER_PIPELINE.md](./docs/BLENDER_PIPELINE.md) covers object naming, custom properties and export settings for replacing generated geometry.

## Credits

Assets are CC0, listed in [ASSETS.md](./ASSETS.md). The building and flat layouts come from the Oak Ville @ AMK brochure (HDB, Singapore) and are used as a sample only. Get permission or swap in your own project before commercial use.
