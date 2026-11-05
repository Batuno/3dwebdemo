---
type: idea
date: 2026-11-05
status: open
tags: [idea, admin, showroom]
---

# Flats held back from sale

## What

A fourth flat status, «Худалдаанд гараагүй» (held back), for flats the developer keeps out of the release or for its own use.

## Why it matters

Today such flats can only be marked reserved, which shows buyers a reservation that does not exist and mixes them into reservation reports.

## Notes

- Needs a colour and legend entry wherever the showroom shows status (`StackedBar`, the floor and garage legends, `countStatuses`), plus `UNIT_STATUSES` in `apps/api/src/services/inventory.ts`.
- See [[0009 Lead stages and admin roles]].
