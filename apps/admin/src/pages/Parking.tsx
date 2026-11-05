import { useMemo, useState } from 'react';
import { ta, type UnitStatus } from '@bair/project-data';
import { useSession } from '../App';
import { ApiError, patch } from '../lib/api';
import { baysSheet } from '../lib/exports';
import { millions, money } from '../lib/format';
import type { BayView } from '../lib/types';
import { useApi } from '../lib/useApi';
import { ExportButtons } from '../ui/ExportButtons';
import { Badge, Button, ErrorBox, PageHeader, Spinner, useToast } from '../ui/kit';

const P = ta.parking;
const STATUSES: UnitStatus[] = ['available', 'reserved', 'sold'];

export default function Parking() {
  const { can } = useSession();
  const toast = useToast();
  const { data, error, loading, reload } = useApi<{ bays: BayView[]; canEdit: boolean }>('/api/bays');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const rows = useMemo(() => {
    const out: BayView[][] = [];
    for (const b of data?.bays ?? []) (out[b.row] ??= []).push(b);
    return out;
  }, [data]);

  if (!data) return error ? <ErrorBox error={error} retry={reload} /> : <Spinner />;
  const canEdit = data.canEdit;
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const apply = async (set: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await patch<{ changed: string[] }>('/api/bays', { ids: [...selected], set });
      toast(r.changed.length ? ta.units.updated(r.changed.length) : ta.units.noChanges);
      await reload();
    } catch (e) {
      toast(e instanceof ApiError ? `${ta.app.error}: ${e.code}` : ta.app.error, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fade-in pb-36">
      <PageHeader title={P.title}>{can('admin') && <ExportButtons what="bays" sheets={() => [baysSheet(data.bays)]} />}</PageHeader>
      <ErrorBox error={error} retry={reload} />
      <div className="card mb-3 flex flex-wrap items-center gap-2 p-3">
        {STATUSES.map((s) => (
          <Badge key={s} color={`var(--st-${s})`}>
            {ta.unitStatus[s]} <b className="tnum">{data.bays.filter((b) => b.status === s).length}</b>
          </Badge>
        ))}
        <span className="text-xs text-[var(--ink-3)]">{canEdit ? P.hint : ta.units.readOnly}</span>
      </div>
      <section className={`card p-3 ${loading ? 'opacity-60' : ''}`}>
        <div className="scroll-x">
          <table className="tnum border-separate border-spacing-[2px] text-[10px]">
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={i % 2 === 1 ? '[&>td]:pb-3' : ''}>
                  <th className="pr-1 text-right text-[11px] font-semibold whitespace-nowrap text-[var(--ink-3)]">{P.row(i + 1)}</th>
                  {row.map((b) => {
                    const sel = selected.has(b.id);
                    return (
                      <td key={b.id} className="p-0">
                        <button
                          type="button"
                          disabled={!canEdit}
                          aria-pressed={sel}
                          title={`${b.id} · ${ta.unitStatus[b.status]} · ${money(b.price)}`}
                          aria-label={`${b.id}, ${ta.unitStatus[b.status]}, ${money(b.price)}`}
                          onClick={() => toggle(b.id)}
                          className={`h-8 w-8 rounded-[4px] font-bold cell-${b.status} ${sel ? 'outline-[3px] outline-offset-[-3px] outline-[var(--ink)] outline-solid' : ''} disabled:cursor-default`}
                        >
                          {b.number}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {canEdit && selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-[var(--surface)] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] lg:left-60">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-end gap-x-5 gap-y-3 px-4 py-3 sm:px-6">
            <div>
              <div className="text-sm font-extrabold">{ta.units.selected(selected.size)}</div>
              <button type="button" onClick={() => setSelected(new Set())} className="text-xs font-semibold text-[var(--accent)] hover:underline">
                {ta.units.clear}
              </button>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold text-[var(--ink-2)]">{ta.units.setStatus}</div>
              <div className="flex gap-1.5">
                {STATUSES.map((s) => (
                  <Button key={s} small disabled={busy} onClick={() => apply({ status: s })}>
                    <span className="dot" style={{ background: `var(--st-${s})` }} />
                    {ta.unitStatus[s]}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold text-[var(--ink-2)]">{ta.units.listPrice}</div>
              <div className="flex items-center gap-1.5">
                <input className="field !min-h-8 !w-36 !px-2" type="number" min={1000000} step={500000} placeholder={millions(data.bays[0]?.listPrice)} value={price} onChange={(e) => setPrice(e.target.value)} aria-label={ta.units.listPrice} />
                <Button small tone="primary" disabled={busy || !(Number(price) >= 1_000_000)} onClick={() => apply({ listPrice: Number(price) })}>
                  {ta.app.save}
                </Button>
                <Button small tone="ghost" disabled={busy} onClick={() => apply({ listPrice: null, clearSale: true })}>
                  {ta.units.resetPrice}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
