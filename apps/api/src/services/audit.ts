import type { Statement } from '../db';
import { nowIso } from '../db';

/** Who changed or exported what. Read by superadmins on the audit page. */
export function auditStatement(userId: number | null, action: string, target: string | null, detail: unknown, ip: string): Statement {
  return {
    sql: 'INSERT INTO audit_log (ts, user_id, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?)',
    params: [nowIso(), userId, action, target, detail === undefined ? null : JSON.stringify(detail).slice(0, 4000), ip],
  };
}
