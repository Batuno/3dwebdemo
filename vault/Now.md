---
type: now
updated: 2026-11-05
tags: [now]
---

# Now

Every Claude Code session reads this note first, so keep it short and current. Edit it in Obsidian to steer the next session.

## Focus

- Version 0.4.0: the admin panel at `/admin/` (leads, flat grid with statuses and sales, parking, analytics, exports, users, audit log) and its API, which runs free on Cloudflare Workers and D1 or on a computer. See `CHANGELOG.md` and [[0005 The admin API runs free on Cloudflare Workers and D1]].
- Showroom 0.3.3 work (panels, plan, lighting, park, dissolves) is done; the showroom now shows live statuses and sale prices.

## Open threads

- Put it online: `pnpm cf:setup` (free Cloudflare account, no card), commit the database id in `apps/api/wrangler.jsonc`, `pnpm cf:deploy`, then create the first admin at `/admin/` with the printed setup code.
- After the first deploy, check the Worker's CPU time per request in the Cloudflare dashboard (free plan: 10 ms).
- The Obsidian vault is on `main`. Open `vault/` in Obsidian on both computers ([[How this vault works]]).

## Next steps

- Try the admin with the sales team; `pnpm dev:admin` and `pnpm demo:data` give a local copy with made-up data.
- Ideas waiting: [[Telegram message for each new lead]], [[Flats held back from sale]], [[Payment schedule for ordered flats]].
- Allow `ambientcg.com`, `api.polyhaven.com`, `dl.polyhaven.org` in the cloud environment's network settings, then upgrade hero textures to 2K.
- Bake lighting for the four flat types (Blender or Unreal GPU Lightmass), day, dusk and night.
- Unreal renders: neutral white balance, Local Exposure, path tracer for stills and top views.
- Try the flat entry and the room-to-room dissolve on a real phone and laptop.

## Recent sessions

- [[2026-11-05 Renames simpler flats page and camera short way]]
- [[2026-11-05 Admin panel and free API]]
- [[2026-11-04 Lighting plan park dissolve and stutter]]
- [[2026-11-04 Obsidian vault setup]]
