---
type: decision
date: 2026-11-05
status: accepted
tags: [decision, admin, api, hosting]
---

# The admin API runs free on Cloudflare Workers and D1

## Context

The admin panel needs a server: logins, leads, live flat statuses and prices, analytics. The owner asked not to pay for it. A Node server with a database normally means a monthly bill.

## Decision

One API code base (`apps/api`) on web-standard Request/Response and an async SQLite interface (`src/db.ts`), with two adapters:

- Cloudflare Workers with a D1 database (`src/worker.ts`, `wrangler.jsonc`): the free production host. Cloudflare also serves `dist/` (website, showroom, admin) as static files. `pnpm cf:setup` and `pnpm cf:deploy` (`tools/cloudflare.mjs`).
- Node with `node:sqlite` (`src/node/`): development, tests, and running it on a computer (`pnpm dev:admin`, `pnpm start:server`).

## Why

- Cloudflare's free plan needs no credit card, allows commercial use, never sleeps, and serves static files free and unmetered. Its limits (checked 2026-11-05): 100,000 Worker requests and 10 ms CPU per request; D1 5 million rows read, 100,000 rows written per day, 500 MB per database, 50 queries and 100 bound parameters per request.
- Lost: Render free (no disk, sleeps, so SQLite is wiped and leads wait up to a minute), Supabase free (pauses after a quiet week), Fly and Railway (no lasting free tier), Oracle Always Free (needs a card and server administration), Vercel Hobby (no commercial use), only the owner's computer (leads are lost while it is off).
- `node:sqlite` is built into Node 22, so nothing native compiles on the Windows computers.

## Consequences

- The design rules in `CLAUDE.md` and [[0006 Passwords are stretched in the browser]], [[0007 Showroom analytics are daily counters]], [[0008 Spreadsheets are built in the browser]] come from these limits.
- Tested in `wrangler dev` (workerd and local D1) and with `pnpm test` on Node; both run the same SQL.
- Past the free plan, Workers Paid costs 5 USD a month and lifts the limits; no code change.
