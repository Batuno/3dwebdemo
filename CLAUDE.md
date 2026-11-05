# CLAUDE.md

3D Байр Сонголт: a browser 3D showroom for a residential project (React, three.js, pnpm monorepo). `README.md` covers running it, the commands and the folder layout.

## Project memory: the Obsidian vault

`vault/` is an Obsidian vault. It is the shared memory between every Claude Code session, in the cloud and on the computers, and the people who open it in Obsidian. A cloud session starts from a fresh clone and remembers nothing, so anything the next session should know goes in the vault. `vault/How this vault works.md` explains it for people.

The current focus, open threads and next steps, kept in `vault/Now.md`:

@vault/Now.md

### At the start of a task

- Look in `vault/Inbox/` for notes left in Obsidian. They are the owner's own notes. Act on one when the request points to it ("check the inbox", its name or its subject); otherwise list the new ones in your reply.
- Before changing an area, search the vault for it (`grep -ril <word> vault/`), above all `vault/Decisions/`, so you do not undo a choice that was made on purpose.

### While working

- A choice someone could later question (one approach picked over another, a trade-off, a rule) gets a note in `vault/Decisions/`, named `NNNN Title.md` with the next number, from `vault/Templates/Decision.md`.
- Ideas that are out of scope for the task go in `vault/Ideas/Title.md`, from `vault/Templates/Idea.md`.

### Before finishing a task that changed something

1. Write `vault/Sessions/YYYY-MM-DD Short title.md` from `vault/Templates/Session.md`: what was asked, done, decided and left open. Set `source: cloud` when the environment variable `CLAUDE_CODE_REMOTE` is `true`, otherwise `local`, and `branch` to the current branch.
2. Update `vault/Now.md`. Every session loads it, so keep it under about 60 lines: drop what is finished, add new open threads and next steps, set `updated`, and link the session note under "Recent sessions" (keep the latest five).
3. Move inbox notes you dealt with to `vault/Archive/` and link them from the session note.
4. Commit the vault changes with the work they describe.

A question answered without changing anything needs no session note.

### Writing notes

- Obsidian Markdown: `[[Note name]]` links between notes, YAML properties at the top (`type`, `date`, `tags` and the template's others), plain Markdown otherwise. Obsidian cannot open files outside `vault/`, so name repository files as paths in backticks or link them on GitHub (`https://github.com/ba7aa-ireedui/3d-bair-songolt/blob/main/<path>`).
- English, short, facts rather than narration. Dates as YYYY-MM-DD.
- Note names: letters, numbers, spaces and dashes only.
- Images go in `vault/Attachments/`.
- No secrets, tokens, passwords or buyers' phone numbers: the Git history keeps them for good.
- Leave `vault/.obsidian/` alone unless asked; it holds the app's settings.

### How notes travel

- On a computer, Obsidian and Claude Code share this checkout, and `tools/sync.mjs` pushes `vault/` to `main` with everything else.
- In the cloud, a session commits to its own `claude/...` branch, and the notes reach `main` and Obsidian when that branch is merged.

## Working on the code

- Run `pnpm test`, `pnpm typecheck` and `pnpm lint` before committing; CI runs the same three.
- Commit subjects follow `feat(showroom): ...`, `fix(showroom): ...`. Commits made by `tools/sync.mjs` end in `[skip ci]`; do not add it to your own.
- A user-visible change gets a line in `CHANGELOG.md` under the top version.
- Interface text is Mongolian and lives in `packages/project-data/src/i18n/mn.ts`, not in components.
- Project data in `packages/project-data/src` drives everything. Furniture is never scaled to fit: a real conflict is recorded in `interiors/exceptions.ts`.
