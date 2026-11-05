import { useEffect, useState } from 'react';
import { t, ta, type UnitStatus } from '@bair/project-data';
import { ApiError, patch } from '../../lib/api';
import { money, stamp, unitLabel } from '../../lib/format';
import { typeName } from '../../lib/labels';
import type { HistoryEntry, Lead, UnitView } from '../../lib/types';
import { useApi } from '../../lib/useApi';
import { Button, Card, Drawer, Empty, ErrorBox, Field, LeadStatusBadge, Segmented, Spinner, UnitStatusBadge, useToast } from '../../ui/kit';

const U = ta.units;
const STATUSES: UnitStatus[] = ['available', 'reserved', 'sold'];

/** What a history entry changed, in words. */
export function historyText(h: HistoryEntry): string {
  const v = (x: string | null) => {
    if (x == null || x === '') return '—';
    if (h.field === 'status') return ta.unitStatus[x] ?? x;
    if (h.field === 'price' || h.field === 'list_price') return money(Number(x));
    if (h.field === 'lead') return `#${x}`;
    return x;
  };
  return `${ta.history[h.field] ?? h.field}: ${v(h.oldValue)} → ${v(h.newValue)}`;
}

type SaleMode = 'none' | 'pct' | 'fixed';

export function UnitDrawer({ id, interest, canEdit, onClose, onChanged }: { id: string; interest?: { views: number; visitors: number }; canEdit: boolean; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const { data, error, reload } = useApi<{ unit: UnitView; history: HistoryEntry[]; leads: Lead[] }>(`/api/units/${id}`);
  const [form, setForm] = useState<null | {
    status: UnitStatus;
    reservedUntil: string;
    leadId: string;
    listPrice: string;
    sale: SaleMode;
    pct: string;
    salePrice: string;
    saleUntil: string;
    note: string;
  }>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    const u = data.unit;
    setForm({
      status: u.status,
      reservedUntil: u.reservedUntil ?? '',
      leadId: u.leadId ? String(u.leadId) : '',
      listPrice: u.customListPrice ? String(u.listPrice) : '',
      sale: u.salePrice != null ? 'fixed' : u.discountPct ? 'pct' : 'none',
      pct: u.discountPct ? String(u.discountPct) : '5',
      salePrice: u.salePrice ? String(u.salePrice) : '',
      saleUntil: u.saleUntil ?? '',
      note: u.note ?? '',
    });
  }, [data]);

  if (!data || !form) {
    return (
      <Drawer title={unitLabel(id)} onClose={onClose}>
        {error ? <ErrorBox error={error} retry={reload} /> : <Spinner />}
      </Drawer>
    );
  }
  const u = data.unit;
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    const body: Record<string, unknown> = {};
    if (form.status !== u.status) body.status = form.status;
    if (form.status === 'reserved' && (form.reservedUntil || null) !== u.reservedUntil) body.reservedUntil = form.reservedUntil || null;
    if ((form.leadId ? Number(form.leadId) : null) !== u.leadId) body.leadId = form.leadId ? Number(form.leadId) : null;
    const list = form.listPrice ? Number(form.listPrice) : null;
    if (list !== (u.customListPrice ? u.listPrice : null)) body.listPrice = list;
    if (form.sale === 'none' && (u.discountPct || u.salePrice != null)) body.clearSale = true;
    if (form.sale === 'pct' && Number(form.pct) !== u.discountPct) body.discountPct = Number(form.pct);
    if (form.sale === 'fixed' && Number(form.salePrice) !== u.salePrice) body.salePrice = Number(form.salePrice);
    if (form.sale !== 'none' && (form.saleUntil || null) !== u.saleUntil) body.saleUntil = form.saleUntil || null;
    if ((form.note.trim() || null) !== u.note) body.note = form.note.trim() || null;
    if (!Object.keys(body).length) return toast(U.noChanges);
    setBusy(true);
    try {
      await patch('/api/units', { ids: [u.id], set: body });
      toast(ta.app.saved);
      await reload();
      onChanged();
    } catch (e) {
      toast(e instanceof ApiError ? (e.code === 'sale_not_lower' ? U.salePriceHigh : `${ta.app.error}: ${e.message}`) : ta.app.error, 'error');
    } finally {
      setBusy(false);
    }
  };

  const discount = u.price < u.listPrice ? Math.round((1 - u.price / u.listPrice) * 100) : 0;

  return (
    <Drawer title={unitLabel(u.id)} subtitle={`${t.nav.block(u.block)} · ${typeName(u.type)} · ${u.totalArea} м²`} onClose={onClose}>
      <div className="grid gap-4">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-2xl font-extrabold">{money(u.price)}</div>
              {discount > 0 && (
                <div className="text-sm">
                  <s className="text-[var(--ink-3)]">{money(u.listPrice)}</s> <b className="text-[var(--danger)]">−{discount}%</b>
                  {u.saleUntil && <span className="text-[var(--ink-2)]"> · {ta.dashboard.until(u.saleUntil)}</span>}
                </div>
              )}
              <div className="text-xs text-[var(--ink-2)]">
                {U.perM2}: {money(Math.round(u.price / u.totalArea))}
              </div>
            </div>
            <UnitStatusBadge status={u.status} />
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-[var(--surface-2)] px-2 py-2">
              <dt className="text-[11px] text-[var(--ink-2)]">{U.visitors30}</dt>
              <dd className="text-lg font-bold">{interest?.visitors ?? 0}</dd>
            </div>
            <div className="rounded-xl bg-[var(--surface-2)] px-2 py-2">
              <dt className="text-[11px] text-[var(--ink-2)]">{U.views30}</dt>
              <dd className="text-lg font-bold">{interest?.views ?? 0}</dd>
            </div>
            <div className="rounded-xl bg-[var(--surface-2)] px-2 py-2">
              <dt className="text-[11px] text-[var(--ink-2)]">{ta.nav.leads}</dt>
              <dd className="text-lg font-bold">{data.leads.length}</dd>
            </div>
          </dl>
        </Card>

        {canEdit && (
          <Card title={ta.app.edit}>
            <div className="grid gap-3">
              <Field label={U.status}>
                <Segmented label={U.status} value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={STATUSES.map((s) => ({ value: s, label: ta.unitStatus[s] }))} />
              </Field>
              {form.status === 'reserved' && (
                <Field label={U.reservedUntil}>
                  <input className="field" type="date" value={form.reservedUntil} onChange={set('reservedUntil')} />
                </Field>
              )}
              <Field label={U.lead}>
                <select className="field" value={form.leadId} onChange={set('leadId')}>
                  <option value="">{U.leadNone}</option>
                  {data.leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      #{l.id} {l.name} · {l.phone}
                    </option>
                  ))}
                  {u.leadId && !data.leads.some((l) => l.id === u.leadId) && <option value={u.leadId}>#{u.leadId}</option>}
                </select>
              </Field>
              <Field label={U.listPrice} hint={u.customListPrice ? U.custom : `${U.formulaPrice}: ${money(u.listPrice)}`}>
                <div className="flex gap-2">
                  <input className="field" type="number" min={1000000} step={100000} placeholder={String(u.customListPrice ? '' : u.listPrice)} value={form.listPrice} onChange={set('listPrice')} />
                  {form.listPrice && (
                    <Button small onClick={() => setForm({ ...form, listPrice: '' })}>
                      {U.resetPrice}
                    </Button>
                  )}
                </div>
              </Field>
              <Field label={U.discount}>
                <Segmented
                  label={U.discount}
                  value={form.sale}
                  onChange={(v) => setForm({ ...form, sale: v })}
                  options={[
                    { value: 'none', label: U.saleNone },
                    { value: 'pct', label: U.salePercent },
                    { value: 'fixed', label: U.saleFixed },
                  ]}
                />
              </Field>
              {form.sale !== 'none' && (
                <div className="grid grid-cols-2 gap-3">
                  {form.sale === 'pct' ? (
                    <Field label={U.discountPct}>
                      <input className="field" type="number" min={1} max={90} step={0.5} value={form.pct} onChange={set('pct')} />
                    </Field>
                  ) : (
                    <Field label={U.salePrice}>
                      <input className="field" type="number" min={1000000} step={100000} value={form.salePrice} onChange={set('salePrice')} />
                    </Field>
                  )}
                  <Field label={U.saleUntil}>
                    <input className="field" type="date" value={form.saleUntil} onChange={set('saleUntil')} />
                  </Field>
                </div>
              )}
              <Field label={U.note}>
                <textarea className="field min-h-16" maxLength={500} value={form.note} onChange={set('note')} />
              </Field>
              <div className="flex justify-end">
                <Button tone="primary" disabled={busy} onClick={save}>
                  {ta.app.save}
                </Button>
              </div>
            </div>
          </Card>
        )}

        <Card title={U.leadsHere} pad={false}>
          {data.leads.length ? (
            <ul>
              {data.leads.map((l) => (
                <li key={l.id} className="border-b border-[var(--line)] last:border-0">
                  <a href={`#/leads/${l.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-[var(--surface-2)]">
                    <span className="min-w-0 text-sm">
                      <b>{l.name}</b> <span className="tnum text-[var(--ink-2)]">· {l.phone}</span>
                    </span>
                    <LeadStatusBadge status={l.status} />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{ta.app.noData}</Empty>
          )}
        </Card>

        <Card title={U.history}>
          {data.history.length ? (
            <ol className="grid gap-2">
              {data.history.map((h) => (
                <li key={h.id} className="text-sm">
                  <div className="text-xs text-[var(--ink-3)]">
                    {stamp(h.createdAt)} · {h.user ?? '—'}
                  </div>
                  <div className="font-semibold">{historyText(h)}</div>
                </li>
              ))}
            </ol>
          ) : (
            <Empty>{U.historyEmpty}</Empty>
          )}
        </Card>
      </div>
    </Drawer>
  );
}
