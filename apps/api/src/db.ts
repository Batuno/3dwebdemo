// The database as the services see it: async, SQLite dialect, no explicit transactions. Two adapters
// implement it: node:sqlite for a computer (node/sqlite.ts) and Cloudflare D1 (worker.ts).
//
// Written for D1's free plan: every request stays within 50 queries and 100 bound parameters, so bulk
// writes pass their rows as one JSON parameter and expand them with json_each().
import { toBase64Url } from '@bair/project-data';

export type Param = string | number | null;

export interface Statement {
  sql: string;
  params?: Param[];
}

export interface SqlDb {
  all<T = Record<string, unknown>>(sql: string, ...params: Param[]): Promise<T[]>;
  get<T = Record<string, unknown>>(sql: string, ...params: Param[]): Promise<T | undefined>;
  run(sql: string, ...params: Param[]): Promise<{ changes: number; lastId: number }>;
  /** Runs the statements in order, all or nothing. */
  batch(statements: Statement[]): Promise<void>;
}

export const nowIso = (): string => new Date().toISOString();

/**
 * One entry per schema version, applied in order. Tables that take many small writes are WITHOUT ROWID with
 * no extra indexes, because D1 counts every index entry as a row written.
 */
const MIGRATIONS: (() => string[])[] = [
  () => [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('superadmin', 'admin', 'sales')),
      salt TEXT NOT NULL,
      iterations INTEGER NOT NULL,
      verifier TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      last_login_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      seen_at TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT
    ) WITHOUT ROWID`,
    `CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)`,
    `CREATE TABLE IF NOT EXISTS throttle (key TEXT PRIMARY KEY, hits INTEGER NOT NULL, reset_at TEXT NOT NULL) WITHOUT ROWID`,
    `CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY,
      kind TEXT NOT NULL,
      source TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      unit_id TEXT,
      parking_bay TEXT,
      viewing_date TEXT,
      viewing_time TEXT,
      question TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      next_action_at TEXT,
      session TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS leads_created ON leads(created_at)`,
    `CREATE INDEX IF NOT EXISTS leads_phone ON leads(phone)`,
    `CREATE INDEX IF NOT EXISTS leads_unit ON leads(unit_id)`,
    `CREATE TABLE IF NOT EXISTS lead_activity (
      id INTEGER PRIMARY KEY,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      kind TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS lead_activity_lead ON lead_activity(lead_id)`,
    // What the sales team changed on a flat or bay. NULL means "as project data generates it".
    `CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('unit', 'bay')),
      status TEXT,
      list_price INTEGER,
      discount_pct REAL,
      sale_price INTEGER,
      sale_until TEXT,
      reserved_until TEXT,
      lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
      note TEXT,
      updated_at TEXT NOT NULL,
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
    ) WITHOUT ROWID`,
    `CREATE TABLE IF NOT EXISTS inventory_history (
      id INTEGER PRIMARY KEY,
      item_id TEXT NOT NULL,
      field TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS inventory_history_item ON inventory_history(item_id)`,
    `CREATE INDEX IF NOT EXISTS inventory_history_created ON inventory_history(created_at)`,
    // Showroom analytics as daily counters, so a 30-day report reads thousands of rows, not millions.
    // key: "b:804A" block, "f:804A:12" floor, "u:804A-12-325" flat, "t:4R" type, "r:living" room, "o:spot" outdoor,
    // "v:floor" views by kind, "h:14" hour, "a:share" action, "d:mobile" device, "k:3" visits that got this deep,
    // "x:visits" visits, "x:events" events, "x:writes" rows written by analytics.
    `CREATE TABLE IF NOT EXISTS view_counts (
      day TEXT NOT NULL,
      key TEXT NOT NULL,
      views INTEGER NOT NULL DEFAULT 0,
      visitors INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day, key)
    ) WITHOUT ROWID`,
    // One row per showroom visit per day: what it has counted already, and its recent path for the lead view.
    `CREATE TABLE IF NOT EXISTS visits (
      day TEXT NOT NULL,
      session TEXT NOT NULL,
      device TEXT NOT NULL,
      depth INTEGER NOT NULL,
      events INTEGER NOT NULL,
      first_at TEXT NOT NULL,
      last_at TEXT NOT NULL,
      seen TEXT NOT NULL,
      path TEXT NOT NULL,
      PRIMARY KEY (day, session)
    ) WITHOUT ROWID`,
    `CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY,
      ts TEXT NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      target TEXT,
      detail TEXT,
      ip TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS audit_ts ON audit_log(ts)`,
    // A random secret for this installation, used to answer unknown emails at login without revealing them.
    `INSERT OR IGNORE INTO meta (key, value) VALUES ('secret', '${toBase64Url(crypto.getRandomValues(new Uint8Array(32)))}')`,
  ],
];

export const SCHEMA_VERSION = MIGRATIONS.length;

/** Brings a database up to the current schema. Cheap when it already is: one read. */
export async function migrate(db: SqlDb): Promise<void> {
  await db.run('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID');
  const row = await db.get<{ value: string }>("SELECT value FROM meta WHERE key = 'schema'");
  for (let v = Number(row?.value ?? 0); v < MIGRATIONS.length; v++) {
    await db.batch([
      ...MIGRATIONS[v]().map((sql) => ({ sql })),
      { sql: "INSERT INTO meta (key, value) VALUES ('schema', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", params: [String(v + 1)] },
    ]);
  }
}

export async function getMeta(db: SqlDb, key: string): Promise<string | undefined> {
  return (await db.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', key))?.value;
}

export const setMetaStatement = (key: string, value: string): Statement => ({
  sql: 'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  params: [key, value],
});
