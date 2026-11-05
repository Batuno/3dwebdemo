---
type: decision
date: 2026-11-05
status: accepted
tags: [decision, admin, security]
---

# Passwords are stretched in the browser

## Context

A login must be slow to crack if the database leaks, which takes tens of milliseconds of hashing. The free Workers plan allows 10 ms of CPU per request.

## Decision

The browser runs PBKDF2-SHA256 with 600,000 rounds on the password and a per-user salt and sends only the 32-byte result. The server stores SHA-256 of that result and compares in constant time (`apps/api/src/auth.ts`, `LOGIN_KDF` in `packages/project-data/src/lib/loginKey.ts`). The salt comes from `POST /api/auth/challenge`; unknown emails get a stable fake salt from an installation secret, so the answer does not reveal who has an account.

## Why

- A leaked database costs an attacker 600,000 rounds per guess, as with server-side PBKDF2, while the server does one SHA-256 per login.
- The stretched key is what an attacker would need to sign in, and it cannot be recovered from the stored hash.
- Rejected: server-side PBKDF2 or scrypt (over the CPU limit), fewer rounds (weak), Cloudflare Access (more setup, and the owner asked for a login page).

## Consequences

- Browsers offer Web Crypto only on https and localhost. On plain http (an office computer on the local network) the admin falls back to the same PBKDF2 in JavaScript (`@noble/hashes`), about four times slower.
- The first superadmin is created on the setup page with a setup code (`SETUP_CODE` on Cloudflare, printed in the terminal on a computer), or from `ADMIN_EMAIL` and `ADMIN_PASSWORD` on a computer.
- Login throttling and the lead rate limit live in the database (`throttle` table), because Workers keep no shared memory.
