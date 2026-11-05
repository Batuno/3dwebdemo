---
type: decision
date: 2026-11-05
status: accepted
tags: [decision, i18n, admin]
---

# Admin text has its own file

## Context

Interface text lives in `packages/project-data/src/i18n/mn.ts`. The admin panel adds a few hundred strings the showroom never shows.

## Decision

Admin and export text lives in `packages/project-data/src/i18n/admin.ts`, exported as `ta` next to `t`.

## Why

- The rule's point is that text stays out of components and in one package; that holds.
- The showroom's bundle does not carry the admin's text.

## Consequences

- A new language needs both files translated.
