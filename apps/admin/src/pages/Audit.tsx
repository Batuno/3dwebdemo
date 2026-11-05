import { useEffect, useState } from 'react';
import { ta } from '@bair/project-data';
import { RequireRole } from '../App';
import { get } from '../lib/api';
import { stamp, unitLabel } from '../lib/format';
import { Button, Empty, ErrorBox, PageHeader, Spinner } from '../ui/kit';

const A = ta.audit;

interface Entry {
  id: number;
  ts: string;
  action: string;
  target: string | null;
  detail: string | null;
  ip: string | null;
  user: string | null;
}

/** A short, readable form of an entry's detail JSON. */
function detailText(e: Entry): string {
  if (!e.detail) return '';
  try {
    const d = JSON.parse(e.detail) as Record<string, unknown> | string[];
    if (Array.isArray(d)) return d.join(', ');
    if (e.action === 'export') return `${String(d.format).toUpperCase()} · ${d.rows}`;
    if ('set' in d) return Object.entries(d.set as Record<string, unknown>).map(([k, v]) => `${k}: ${v === null ? '—' : ta.unitStatus[String(v)] ?? String(v)}`).join(', ');
    return Object.entries(d)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
      .join(', ');
  } catch {
    return e.detail;
  }
}

export default function Audit() {
  return (
    <RequireRole role="superadmin">
      <AuditPage />
    </RequireRole>
  );
}

function AuditPage() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<{ code: string } | null>(null);
  const [more, setMore] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async (before?: number) => {
    setBusy(true);
    try {
      const r = await get<{ entries: Entry[] }>(`/api/audit?limit=100${before ? `&before=${before}` : ''}`);
      setEntries((prev) => [...(before ? (prev ?? []) : []), ...r.entries]);
      setMore(r.entries.length === 100);
      setError(null);
    } catch {
      setError({ code: 'error' });
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  if (!entries) return error ? <ErrorBox error={error} retry={() => load()} /> : <Spinner />;
  return (
    <div className="fade-in">
      <PageHeader title={A.title} />
      <div className="card scroll-x">
        {entries.length ? (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-xs text-[var(--ink-2)]">
                <th className="px-4 py-2.5 font-semibold">{A.when}</th>
                <th className="px-2 py-2.5 font-semibold">{A.who}</th>
                <th className="px-2 py-2.5 font-semibold">{A.what}</th>
                <th className="px-2 py-2.5 font-semibold">{A.target}</th>
                <th className="px-2 py-2.5 font-semibold">{A.detail}</th>
                <th className="px-4 py-2.5 font-semibold">{A.ip}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-[var(--line)] align-top last:border-0">
                  <td className="tnum px-4 py-2 whitespace-nowrap text-[var(--ink-2)]">{stamp(e.ts)}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{e.user ?? '—'}</td>
                  <td className="px-2 py-2 font-semibold whitespace-nowrap">{A.actions[e.action] ?? e.action}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{e.target && /^\d{3}[A-Z]-/.test(e.target) ? unitLabel(e.target) : (e.target ?? '')}</td>
                  <td className="max-w-[380px] px-2 py-2 text-[13px] break-words text-[var(--ink-2)]">{detailText(e)}</td>
                  <td className="tnum px-4 py-2 text-xs text-[var(--ink-3)]">{e.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>{ta.app.noData}</Empty>
        )}
      </div>
      {more && entries.length > 0 && (
        <div className="mt-3 flex justify-center">
          <Button disabled={busy} onClick={() => load(entries[entries.length - 1].id)}>
            {ta.app.loading.replace('…', '')} +100
          </Button>
        </div>
      )}
    </div>
  );
}
