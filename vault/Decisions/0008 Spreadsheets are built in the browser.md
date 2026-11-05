---
type: decision
date: 2026-11-05
status: accepted
tags: [decision, admin, export]
---

# Spreadsheets are built in the browser

## Context

The admin exports leads, flats, bays and analytics to CSV and Excel. Building an Excel file of all sheets took 30 to 150 ms of CPU, over the 10 ms a free Worker may use.

## Decision

The admin builds the files from the data it already shows (`apps/admin/src/lib/sheets.ts`, `exports.ts`) and records each export with `POST /api/audit/export`. The Excel writer is a small zip of SpreadsheetML (fflate): bold frozen header, filter, column widths, real numbers. CSV starts with a byte-order mark so Excel reads Cyrillic, and text starting with = + - @ is defused.

## Why

- No server CPU at all for exports, and no spreadsheet library in the API.
- The admin already holds exactly what is on screen, so a leads export follows the current filters.

## Consequences

- An admin could skip the audit call by using the JSON API directly; the log records exports made through the panel.
- Exports are for admins and superadmins; sales staff do not see the buttons and the audit call refuses them.
