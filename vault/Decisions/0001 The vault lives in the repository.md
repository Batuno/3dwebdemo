---
type: decision
date: 2026-11-04
status: accepted
tags: [decision, vault]
---

# The vault lives in the repository

## Context

Claude Code runs in two places: on the computers, and in the cloud, where each session starts from a fresh clone of GitHub and keeps nothing afterwards. The owner wants both, and Obsidian, to share one set of project notes.

## Decision

The Obsidian vault is the `vault/` folder of this repository. `CLAUDE.md` loads `vault/Now.md` into every session and says when to read and write the other notes. On the computers, the existing auto-sync (`tools/sync.mjs`) carries the notes to and from GitHub.

## Why

- The repository is the one thing every session can reach. A cloud session cannot see a vault on a computer, and an Obsidian MCP server or the Local REST API plugin would only work for local sessions.
- Auto-sync already commits and pushes the whole checkout, so no second sync tool is needed. The Obsidian Git plugin would compete with it.
- A subfolder rather than the whole repository, because `node_modules` would slow Obsidian down and code files would clutter search and the graph.

## Consequences

- Notes from a cloud session reach Obsidian only after its branch is merged into `main`.
- Obsidian cannot open repository files outside `vault/`; notes name them as paths or GitHub links.
- `vault/.obsidian/workspace*.json` is ignored by Git so each computer keeps its own window layout.
