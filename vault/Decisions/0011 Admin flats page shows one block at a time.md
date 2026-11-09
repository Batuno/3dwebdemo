---
type: decision
date: 2026-11-05
status: accepted
tags: [decision, admin]
---

# Admin flats page shows one block at a time

## Context

The owner found the flats page confusing. It stacked both blocks in one long page of decimal prices and type codes, above a bulk bar with every input open.

## Decision

- The page opens on a floor-by-floor view at the owner's request: floors on the left, the chosen floor's real plan drawn from the same layout data as the showroom, and a card per flat. The grid stays as a second view («Бүх давхар») because it is the quickest way to select whole stacks and compare all floors.
- Tabs pick one block; legend counts are for that block.
- Cells show whole millions (`481`, not `481.1`), with a line saying what the number means. The exact price is in the tooltip and the flat's page.
- Column headers say `2 өрөө` instead of `2F1`. The two 2-room types still differ in the tooltip, the type colours and the flat's page.
- The bulk bar shows status buttons; discount and price change open when asked for.
- The list view has one price column, with the discount beside it. List price stays on the flat's page and in the exports.

## Why

Sales staff mostly work one block at a time, and a calm page matters more than seeing both blocks at once. A side-by-side view on very wide screens was the option that lost.

## Consequences

Selection carries across the tabs, so a bulk change can span both blocks, but flats on the hidden tab are not visible while selected; the bar's count shows the total.
