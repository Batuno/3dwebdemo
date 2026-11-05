// The database on a computer: one SQLite file through node:sqlite, built into Node 22.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { Param, SqlDb } from '../db';

const bind = (params: Param[]): SQLInputValue[] => params.map((p) => (p === undefined ? null : p));

export function openSqlite(file: string): SqlDb & { close: () => void } {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  const cache = new Map<string, ReturnType<DatabaseSync['prepare']>>();
  const stmt = (sql: string) => {
    let s = cache.get(sql);
    if (!s) {
      s = db.prepare(sql);
      if (cache.size < 500) cache.set(sql, s);
    }
    return s;
  };
  return {
    async all<T>(sql: string, ...params: Param[]) {
      return stmt(sql).all(...bind(params)) as T[];
    },
    async get<T>(sql: string, ...params: Param[]) {
      return stmt(sql).get(...bind(params)) as T | undefined;
    },
    async run(sql: string, ...params: Param[]) {
      const r = stmt(sql).run(...bind(params));
      return { changes: Number(r.changes), lastId: Number(r.lastInsertRowid) };
    },
    async batch(statements) {
      db.exec('BEGIN IMMEDIATE');
      try {
        for (const s of statements) stmt(s.sql).run(...bind(s.params ?? []));
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    close: () => db.close(),
  };
}
