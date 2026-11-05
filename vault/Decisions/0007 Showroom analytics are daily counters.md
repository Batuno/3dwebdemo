---
type: decision
date: 2026-11-05
status: accepted
tags: [decision, analytics, api]
---

# Showroom analytics are daily counters

## Context

The admin needs interest per block, floor, flat, type and room. Storing every event and querying it would read every event of the period for each chart; D1's free plan allows 5 million rows read a day.

## Decision

Each batch of events updates daily counters (`view_counts`: views and visitors per place per day) and one row per visit (`visits`: what that visit counted already, its depth and its last 60 steps). Reports read only counters (`apps/api/src/services/analytics.ts`).

## Why

- A 30-day report reads about 4,400 rows on the six-week demo data, instead of every event.
- A batch reads two rows and writes one row per counter it moves.
- Analytics may write at most 60,000 rows a day (`ANALYTICS_WRITES_PER_DAY`), so the 100,000 free writes always leave room for leads; past that, statistics pause until midnight UTC.

## Consequences

- Visitors are counted once per place per day: a buyer who returns the next day counts again.
- A floor's views include views of its flats, a block's every view inside it; room views do not add to flat views.
- New questions about past visits need a new counter from the day it is added; there are no raw events to query.
- Visit rows (the path on a lead's page) are deleted after 120 days; counters are kept.
- The showroom sends no events for browsers with Do Not Track or Global Privacy Control.
