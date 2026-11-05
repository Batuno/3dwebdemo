---
type: guide
tags: [guide]
---

# How this vault works

This folder is an Obsidian vault inside the code repository. Because it lives in the repository, the same notes reach Obsidian on each computer, Claude Code on each computer and Claude Code in the cloud. The repository's `CLAUDE.md` tells every Claude session to read [[Now]] first, check `Inbox`, and leave a session note when it finishes.

## Open it in Obsidian

Do this once on each computer:

1. In Obsidian, choose **Open folder as vault**.
2. Pick the `vault` folder inside the repository, next to `start.bat`. Do not open the whole repository: it holds `node_modules`, with thousands of files that slow Obsidian down.
3. When Obsidian asks, trust the vault. Its settings come with it: new notes go to `Inbox`, pasted images to `Attachments`, templates come from `Templates`.

If **Insert template** is missing from the command palette, turn it on under **Settings → Core plugins → Templates**.

## How notes travel

| Who writes | Where it lands | When the others see it |
|---|---|---|
| You, in Obsidian | The repository on that computer | Auto-sync pushes to `main` about 45 seconds after you stop typing. The other computer has it within a minute |
| Claude Code on a computer (terminal, desktop app, VS Code) | The same folder | The same way, while that checkout is on `main` |
| Claude Code in the cloud (claude.ai/code, the mobile app) | Its own `claude/...` branch on GitHub | Once that branch is merged into `main`. Auto-sync then brings it to both computers |

Cloud sessions start from a fresh copy of GitHub, so they read whatever auto-sync has already pushed. A note you wrote a minute ago may not be there yet; `pnpm sync` pushes it right away.

Auto-sync has to be running: keep `start.bat` open, or run `pnpm sync:install` once on Windows.

## Working with Claude through the vault

- **Leave a request or idea:** make a note in `Inbox` (any name) and write what you want. Screenshots are fine. In the next session, say "check the inbox", or name the note. Claude also mentions inbox notes it sees.
- **Steer the next session:** edit [[Now]]. Every session loads it before doing anything.
- **See what happened:** each session that changed something leaves a note in `Sessions` and updates [[Now]].
- **Choices made on purpose** go in `Decisions`, so a later session does not undo them.
- Inbox notes that have been dealt with are moved to `Archive`, not deleted.

## Rules

- Do not turn on the Obsidian Git community plugin's automatic commit or push on these computers. Auto-sync already commits and pushes, and two tools committing the same folder get in each other's way.
- No passwords, tokens or buyers' phone numbers. Everything here stays in the Git history, even after it is deleted.
- Keep note names to letters, numbers, spaces and dashes. `: * ? " < > | # ^ [ ] \ /` break links or Windows.
- `.obsidian/workspace.json` (which panes are open) is not synced, so each computer keeps its own layout. The rest of `.obsidian` is shared.

## Other vaults and other projects

- A personal vault elsewhere stays separate: Obsidian can switch between vaults (**Open another vault**). Only notes inside this folder reach the cloud.
- For another repository, copy this folder (empty `Sessions`, `Decisions`, `Ideas`) and the "Project memory" section of `CLAUDE.md` into it.
