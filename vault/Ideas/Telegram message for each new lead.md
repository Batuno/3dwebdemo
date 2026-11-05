---
type: idea
date: 2026-11-05
status: open
tags: [idea, admin, leads]
---

# Telegram message for each new lead

## What

When a lead arrives, the API posts it to a Telegram group of the sales team through a bot.

## Why it matters

Buyers who ask about a flat are most likely to buy when someone calls back within minutes; today the team sees new leads only when they open the admin panel.

## Notes

- The Telegram Bot API is free, so it keeps [[0005 The admin API runs free on Cloudflare Workers and D1]]: one `fetch` from `POST /api/public/leads`, with the bot token as a Worker secret.
- Send name, flat and a link to the lead's page, not the phone number, so the group never holds buyers' numbers.
