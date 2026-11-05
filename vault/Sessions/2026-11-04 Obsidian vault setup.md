---
type: session
date: 2026-11-04
source: cloud
branch: claude/determined-newton-z0upmx
tags: [session, vault]
---

# Obsidian vault setup

## Asked

Connect Claude Code in the cloud and on the computers to Obsidian, for the work ahead.

## Done

- `vault/`: an Obsidian vault with [[Home]], [[Now]], [[How this vault works]], [[Overview]], templates, and folders for the inbox, sessions, decisions, ideas, archive and attachments.
- `vault/.obsidian/app.json` and `templates.json`: new notes go to `Inbox`, pasted files to `Attachments`, templates from `Templates`.
- `CLAUDE.md`: loads `vault/Now.md` into every session and sets when Claude reads the inbox and writes session notes, decisions and ideas.
- `.gitignore`: Obsidian's per-computer window layout and its trash folder stay out of Git.
- `README.md`, `README.mn.md`, `CHANGELOG.md`: a short section on the vault.
- Merged into `main` through a pull request, at the owner's request.

## Decided

- [[0001 The vault lives in the repository]]

## Left open

- Open `vault/` in Obsidian on both computers (see [[How this vault works]]). This has to be done on the computers; a cloud session cannot open Obsidian there.
