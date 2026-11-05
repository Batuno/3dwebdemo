// Logins, sessions, roles and throttling, on Web Crypto only (Node and Cloudflare Workers alike).
// The browser sends a PBKDF2-stretched login key (see LOGIN_KDF in project-data); the server keeps a
// SHA-256 of it and compares. Sessions are random tokens in an HttpOnly cookie with only their hash stored.
import { fromBase64Url, LOGIN_KDF, toBase64Url } from '@bair/project-data';
import type { SqlDb } from './db';
import { getMeta, nowIso } from './db';

export const ROLES = ['sales', 'admin', 'superadmin'] as const;
export type Role = (typeof ROLES)[number];

/** sales < admin < superadmin. */
export const hasRole = (role: Role, needed: Role): boolean => ROLES.indexOf(role) >= ROLES.indexOf(needed);

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  active: number;
  created_at: string;
  last_login_at: string | null;
}

const toUser = (r: User): User => ({ id: r.id, email: r.email, name: r.name, role: r.role, active: r.active, created_at: r.created_at, last_login_at: r.last_login_at });

export const SESSION_COOKIE = 'bair_session';
export const SESSION_DAYS = 7;
export const MIN_PASSWORD = 8;

const enc = new TextEncoder();

export async function sha256(s: string): Promise<string> {
  return toBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s))));
}

/** Compares two strings in time that does not depend on where they differ. */
export function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export const randomToken = (bytes = 32): string => toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));

/** What is stored for a login key. */
export const verifierFor = (key: string): Promise<string> => sha256(`bair-login:${key}`);

/**
 * The salt to stretch a password with. Unknown emails get a stable salt made from the installation secret,
 * so the answer does not reveal who has an account.
 */
export async function loginChallenge(db: SqlDb, email: string): Promise<{ salt: string; iterations: number }> {
  const row = await db.get<{ salt: string; iterations: number }>('SELECT salt, iterations FROM users WHERE email = ?', email.toLowerCase());
  if (row) return row;
  const secret = (await getMeta(db, 'secret')) ?? '';
  const key = await crypto.subtle.importKey('raw', fromBase64Url(secret || 'AA'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`salt:${email.toLowerCase()}`)));
  return { salt: toBase64Url(mac.slice(0, LOGIN_KDF.saltBytes)), iterations: LOGIN_KDF.iterations };
}

/** The active user for a correct email and login key, or null. */
export async function checkLogin(db: SqlDb, email: string, key: string): Promise<User | null> {
  const row = await db.get<User & { verifier: string }>(
    'SELECT id, email, name, role, active, created_at, last_login_at, verifier FROM users WHERE email = ?',
    email.toLowerCase(),
  );
  const expected = row?.verifier ?? (await verifierFor('no-such-user'));
  const ok = safeEqual(await verifierFor(key), expected);
  if (!row || !ok || !row.active) return null;
  return toUser(row);
}

export async function createSession(db: SqlDb, userId: number, ip: string, userAgent: string): Promise<string> {
  const token = randomToken();
  const now = nowIso();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString();
  await db.batch([
    {
      sql: 'INSERT INTO sessions (token_hash, user_id, created_at, expires_at, seen_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
      params: [await sha256(token), userId, now, expires, now, ip, userAgent.slice(0, 300)],
    },
    { sql: 'UPDATE users SET last_login_at = ? WHERE id = ?', params: [now, userId] },
  ]);
  return token;
}

/** The active user behind a session token. Slides the expiry forward, at most once an hour. */
export async function userForToken(db: SqlDb, token: string | undefined): Promise<User | null> {
  if (!token || token.length > 100) return null;
  const hash = await sha256(token);
  const row = await db.get<User & { expires_at: string; seen_at: string }>(
    `SELECT u.id, u.email, u.name, u.role, u.active, u.created_at, u.last_login_at, s.expires_at, s.seen_at
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
    hash,
  );
  if (!row) return null;
  if (!row.active || Date.parse(row.expires_at) < Date.now()) {
    await db.run('DELETE FROM sessions WHERE token_hash = ?', hash);
    return null;
  }
  if (Date.now() - Date.parse(row.seen_at) > 3600_000) {
    await db.run('UPDATE sessions SET seen_at = ?, expires_at = ? WHERE token_hash = ?', nowIso(), new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString(), hash);
  }
  return toUser(row);
}

export async function deleteSession(db: SqlDb, token: string | undefined) {
  if (token) await db.run('DELETE FROM sessions WHERE token_hash = ?', await sha256(token));
}

/** Signs a user out everywhere, except the session given. */
export async function deleteUserSessions(db: SqlDb, userId: number, keepToken?: string) {
  if (keepToken) await db.run('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?', userId, await sha256(keepToken));
  else await db.run('DELETE FROM sessions WHERE user_id = ?', userId);
}

export function sessionCookie(token: string, secure: boolean): string {
  return `${SESSION_COOKIE}=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}${secure ? '; Secure' : ''}`;
}
export const clearedCookie = (secure: boolean): string => `${SESSION_COOKIE}=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`;

/* ---------- Throttling, kept in the database so every server instance sees the same counts ---------- */

/** Counts a hit against `key`; returns the count inside the current window. */
export async function throttleHit(db: SqlDb, key: string, windowSec: number): Promise<number> {
  const now = nowIso();
  const reset = new Date(Date.now() + windowSec * 1000).toISOString();
  const row = await db.get<{ hits: number }>(
    `INSERT INTO throttle (key, hits, reset_at) VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       hits = CASE WHEN throttle.reset_at < ? THEN 1 ELSE throttle.hits + 1 END,
       reset_at = CASE WHEN throttle.reset_at < ? THEN excluded.reset_at ELSE throttle.reset_at END
     RETURNING hits`,
    key,
    reset,
    now,
    now,
  );
  return row?.hits ?? 1;
}

/** Hits so far in the current window, without counting one. */
export async function throttleCount(db: SqlDb, key: string): Promise<number> {
  const row = await db.get<{ hits: number; reset_at: string }>('SELECT hits, reset_at FROM throttle WHERE key = ?', key);
  return row && row.reset_at >= nowIso() ? row.hits : 0;
}

export async function throttleClear(db: SqlDb, key: string) {
  await db.run('DELETE FROM throttle WHERE key = ?', key);
}

/* ---------- Users ---------- */

export interface NewUser {
  email: string;
  name: string;
  role: Role;
  salt: string;
  key: string;
}

export async function createUser(db: SqlDb, u: NewUser): Promise<number> {
  const r = await db.run(
    'INSERT INTO users (email, name, role, salt, iterations, verifier, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    u.email.trim().toLowerCase(),
    u.name.trim(),
    u.role,
    u.salt,
    LOGIN_KDF.iterations,
    await verifierFor(u.key),
    nowIso(),
  );
  return r.lastId;
}

export async function userCount(db: SqlDb): Promise<number> {
  return (await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM users'))?.n ?? 0;
}
