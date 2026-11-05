---
type: decision
date: 2026-11-05
status: accepted
tags: [decision, admin]
---

# Lead stages and admin roles

## Context

The owner asked for contact statuses new, in progress, meeting and order, flat statuses available, ordered and sold, and price changes that "a basic admin user also can do".

## Decision

- Lead stages: `new`, `in_progress`, `meeting`, `order`, and `lost` for buyers who will not buy (`LEAD_STATUSES` in `packages/project-data/src/lib/crm.ts`).
- Flat and bay statuses stay the showroom's three: `available` (Боломжтой), `reserved` (Захиалгатай, the owner's "ordered") and `sold`.
- Roles: superadmin (everything, including users, base prices, deleting leads, the audit log), admin (leads, statuses, prices and sales, exports), sales (works every lead and sees flats, parking and analytics, but changes no status or price; leads they add are assigned to them).

## Why

- Without a closing stage, dead leads would sit in "new" and "in progress" forever.
- Three flat statuses keep the showroom's colours and legends unchanged; a fourth ("held back") is in [[Flats held back from sale]].
- The "basic admin" the owner described is the admin role; sales staff are a third, narrower role for agents.

## Consequences

- Lead stage colours were checked for colour-blind readers; every stage is shown with its name.
- A flat moved away from reserved loses its reservation date.
