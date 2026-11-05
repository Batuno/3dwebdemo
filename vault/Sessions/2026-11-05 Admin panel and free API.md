---
type: session
date: 2026-11-05
source: cloud
branch: claude/gifted-dirac-iiz8ap
tags: [session, admin, api]
---

# Admin panel and free API

## Asked

An admin panel: login, the contacts from the website and showroom, CSV and Excel export, a dashboard, flat statuses (available, ordered, sold) shown in colour on the site, price changes and sales (basic admins too), interest analytics per block, floor and room, contact stages (new, in progress, meeting, order), more useful features, pushed to GitHub. Mid-task: no API costs.

## Done

- `apps/api`: the API, one code base for Cloudflare Workers with D1 (`src/worker.ts`, `wrangler.jsonc`) and Node with `node:sqlite` (`src/node/`). Sessions, roles, throttling, leads, inventory with sales and history, analytics counters, dashboard, users, pricing settings, audit log. 18 tests (`src/app.test.ts`), and the same flows checked in `wrangler dev` against local D1.
- `apps/admin`: the panel at `/admin/`. Dashboard, leads table and board, lead page with timeline and showroom path, flat grid with bulk status, sale and price changes, flat page, parking, analytics with a floor heat map, users, settings, audit log, CSV and Excel export, setup page. Checked at 1440 px and on an iPhone 13 size in Playwright.
- `packages/project-data`: shared lead, analytics and inventory types (`lib/crm.ts`), `applyInventory` and `listPrice` (`lib/inventory.ts`), login-key settings (`lib/loginKey.ts`), admin text (`i18n/admin.ts`).
- Showroom: live statuses and prices with sale badges (`lib/liveInventory.ts`, `ui/UnitPanel.tsx`), anonymous statistics (`lib/analytics.ts`), leads to the API with a retry queue (`lib/leads.ts`). Website: the contact form sends leads, with a honeypot.
- `tools/cloudflare.mjs` (`pnpm cf:setup`, `cf:deploy`, `build:online`), `tools/dev.mjs` (`pnpm dev:admin`, `dev:all`), `pnpm demo:data`. `pnpm-workspace.yaml` allows esbuild's install script, without which `pnpm install --frozen-lockfile` failed.
- `start.bat` / `start.sh` (`tools/start.mjs`) also start the API and admin, so the other computer runs everything with one double-click; merged into `main` at the owner's request.
- README (both languages), CHANGELOG 0.4.0, `CLAUDE.md` rules for the API.

## Decided

- [[0005 The admin API runs free on Cloudflare Workers and D1]]
- [[0006 Passwords are stretched in the browser]]
- [[0007 Showroom analytics are daily counters]]
- [[0008 Spreadsheets are built in the browser]]
- [[0009 Lead stages and admin roles]]
- [[0010 Admin text has its own file]]

## Left open

- Not online yet: the owner runs `pnpm cf:setup` (needs a free Cloudflare account) and `pnpm cf:deploy`, commits the database id, and creates the first admin with the printed setup code.
- The Worker's CPU time per request was not measured on Cloudflare itself; `wrangler dev` does not enforce the 10 ms limit. Watch the Worker's metrics after the first deploy.
- Ideas: [[Flats held back from sale]], [[Telegram message for each new lead]], [[Payment schedule for ordered flats]].
