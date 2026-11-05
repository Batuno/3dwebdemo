import { useState } from 'react';
import { isValidMongolianPhone, LEAD_STATUSES, ta, type LeadStatus } from '@bair/project-data';
import { useSession } from '../../App';
import { ApiError, del, patch, post } from '../../lib/api';
import { day, millions, stamp, today, unitLabel } from '../../lib/format';
import { pathLabel } from '../../lib/labels';
import type { Activity, Lead, UnitView, UserOption } from '../../lib/types';
import { useApi } from '../../lib/useApi';
import { Icon } from '../../ui/icons';
import { Button, Card, Drawer, ErrorBox, Field, LeadStatusBadge, Spinner, UnitStatusBadge, useToast } from '../../ui/kit';
import { parseUnitId } from './AddLeadModal';

const T = ta.leads;

interface Detail {
  lead: Lead;
  activity: Activity[];
  journey: { path: string[]; device: string | null };
  others: { id: number; name: string; unitId: string | null; status: LeadStatus; createdAt: string }[];
  unit: UnitView | null;
}

/** What a timeline entry says, in words. */
function activityText(a: Activity): string {
  switch (a.kind) {
    case 'status': {
      const [from, to] = a.body.split('→');
      return `${ta.leadStatus[from] ?? from} → ${ta.leadStatus[to] ?? to}`;
    }
    case 'unit':
      return a.body ? unitLabel(a.body) : '—';
    case 'inventory': {
      const [id, status] = a.body.split(':');
      return `${unitLabel(id)} · ${ta.unitStatus[status] ?? status}`;
    }
    default:
      return a.body || '—';
  }
}

export function LeadDrawer({ id, users, onClose, onChanged }: { id: number; users: UserOption[]; onClose: () => void; onChanged: () => void }) {
  const { can } = useSession();
  const toast = useToast();
  const { data, error, reload } = useApi<Detail>(`/api/leads/${id}`);
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reserveDays, setReserveDays] = useState(7);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast(ok);
      await reload();
      onChanged();
    } catch (e) {
      toast(e instanceof ApiError ? `${ta.app.error}: ${e.code}` : ta.app.error, 'error');
    } finally {
      setBusy(false);
    }
  };
  const update = (body: Record<string, unknown>) => run(() => patch(`/api/leads/${id}`, body), ta.app.saved);

  if (!data) {
    return (
      <Drawer title={ta.app.loading} onClose={onClose}>
        {error ? <ErrorBox error={error} retry={reload} /> : <Spinner />}
      </Drawer>
    );
  }
  const { lead, unit } = data;

  const setUnit = (status: 'reserved' | 'sold') =>
    run(
      () =>
        patch('/api/units', {
          ids: [unit!.id],
          set: { status, leadId: lead.id, ...(status === 'reserved' ? { reservedUntil: today(reserveDays) } : {}) },
        }),
      `${unitLabel(unit!.id)}: ${ta.unitStatus[status]}`,
    );

  return (
    <Drawer
      title={lead.name}
      subtitle={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <a href={`tel:${lead.phone}`} className="tnum inline-flex items-center gap-1 font-semibold text-[var(--accent)]">
            <Icon name="phone" size={14} />
            {lead.phone}
          </a>
          <span>{stamp(lead.created_at)}</span>
          <span>{ta.leadSource[lead.source]}</span>
        </span>
      }
      onClose={onClose}
    >
      <div className="grid gap-4">
        <Card>
          <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label={T.status}>
            {LEAD_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={lead.status === s}
                disabled={busy}
                onClick={() => lead.status !== s && update({ status: s })}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors ${
                  lead.status === s ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--surface-2)]'
                }`}
              >
                <span className="dot" style={{ background: `var(--ls-${s})` }} />
                {ta.leadStatus[s]}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={T.assigned}>
              <select className="field" value={lead.assigned_to ?? ''} disabled={busy} onChange={(e) => update({ assignedTo: e.target.value ? Number(e.target.value) : null })}>
                <option value="">{T.unassigned}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={T.nextAction}>
              <input className="field" type="date" value={lead.next_action_at ?? ''} disabled={busy} onChange={(e) => update({ nextActionAt: e.target.value || null })} />
            </Field>
          </div>
        </Card>

        <Card title={T.kind} action={<Button small tone="ghost" onClick={() => setEditing(!editing)}>{ta.app.edit}</Button>}>
          {editing ? (
            <EditLead lead={lead} busy={busy} onSave={(body) => update(body).then(() => setEditing(false))} />
          ) : (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-[var(--ink-2)]">{T.kind}</dt>
              <dd className="font-semibold">{ta.leadKind[lead.kind]}</dd>
              {lead.viewing_date && (
                <>
                  <dt className="text-[var(--ink-2)]">{T.viewing}</dt>
                  <dd className="tnum font-semibold">
                    {lead.viewing_date} {lead.viewing_time}
                  </dd>
                </>
              )}
              {lead.question && (
                <>
                  <dt className="text-[var(--ink-2)]">{T.question}</dt>
                  <dd className="whitespace-pre-wrap">{lead.question}</dd>
                </>
              )}
              {lead.parking_bay && (
                <>
                  <dt className="text-[var(--ink-2)]">{T.parking}</dt>
                  <dd className="font-semibold">{lead.parking_bay}</dd>
                </>
              )}
              {lead.duplicates > 0 && (
                <>
                  <dt className="text-[var(--ink-2)]">{T.phone}</dt>
                  <dd className="font-semibold text-[var(--warn-ink)]">{T.duplicate(lead.duplicates)}</dd>
                </>
              )}
            </dl>
          )}
        </Card>

        {unit && (
          <Card title={T.unit} action={<a href={`#/units/${unit.id}`} className="text-xs font-semibold text-[var(--accent)]">{T.openUnit}</a>}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-base font-extrabold">{unitLabel(unit.id)}</div>
                <div className="text-[13px] text-[var(--ink-2)]">
                  {millions(unit.price)}
                  {unit.price < unit.listPrice && <s className="ml-1.5 text-[var(--ink-3)]">{millions(unit.listPrice)}</s>}
                </div>
              </div>
              <UnitStatusBadge status={unit.status} />
            </div>
            {can('admin') && (unit.status === 'available' || (unit.leadId === lead.id && unit.status === 'reserved')) && (
              <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-[var(--line)] pt-3">
                {unit.status === 'available' && (
                  <>
                    <Field label={T.reserveDays}>
                      <input className="field !w-24" type="number" min={1} max={90} value={reserveDays} onChange={(e) => setReserveDays(Math.max(1, Number(e.target.value) || 1))} />
                    </Field>
                    <Button tone="primary" disabled={busy} onClick={() => setUnit('reserved')}>
                      {T.reserveUnit}
                    </Button>
                  </>
                )}
                {unit.status === 'reserved' && unit.leadId === lead.id && (
                  <Button tone="primary" disabled={busy} onClick={() => setUnit('sold')}>
                    {T.sellUnit}
                  </Button>
                )}
              </div>
            )}
          </Card>
        )}

        <Card title={T.timeline}>
          <form
            className="mb-3 grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (note.trim()) void run(() => post(`/api/leads/${id}/notes`, { body: note.trim() })).then(() => setNote(''));
            }}
          >
            <textarea className="field min-h-20" value={note} onChange={(e) => setNote(e.target.value)} placeholder={T.notePlaceholder} aria-label={T.addNote} maxLength={2000} />
            <div className="flex justify-end">
              <Button tone="primary" small type="submit" disabled={busy || !note.trim()}>
                {T.addNote}
              </Button>
            </div>
          </form>
          <ol className="grid gap-3 border-l-2 border-[var(--line)] pl-4">
            {data.activity.map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute top-1.5 -left-[21px] h-2 w-2 rounded-full bg-[var(--ink-3)]" />
                <div className="text-xs text-[var(--ink-3)]">
                  {stamp(a.createdAt)} · {a.user ?? '—'} · {ta.activity[a.kind] ?? a.kind}
                </div>
                <div className={`text-sm ${a.kind === 'note' ? 'whitespace-pre-wrap' : 'font-semibold'}`}>{activityText(a)}</div>
              </li>
            ))}
            <li className="relative">
              <span className="absolute top-1.5 -left-[21px] h-2 w-2 rounded-full bg-[var(--accent)]" />
              <div className="text-xs text-[var(--ink-3)]">{stamp(lead.created_at)}</div>
              <div className="text-sm font-semibold">
                {ta.activity.created} · {ta.leadSource[lead.source]}
              </div>
            </li>
          </ol>
        </Card>

        <Card title={T.journey}>
          {data.journey.path.length ? (
            <ol className="flex flex-wrap items-center gap-1.5 text-[13px]">
              {data.journey.path.map((k, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-[var(--ink-3)]">→</span>}
                  <span className={`rounded-lg px-2 py-1 ${k.startsWith('u:') || k.startsWith('r:') ? 'bg-[var(--accent-soft)] font-semibold' : 'bg-[var(--surface-2)]'}`}>{pathLabel(k)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-[var(--ink-3)]">{T.journeyEmpty}</p>
          )}
          {data.journey.device && <p className="mt-2 text-xs text-[var(--ink-3)]">{ta.device[data.journey.device]}</p>}
        </Card>

        {data.others.length > 0 && (
          <Card title={T.others} pad={false}>
            <ul>
              {data.others.map((o) => (
                <li key={o.id} className="border-b border-[var(--line)] last:border-0">
                  <a href={`#/leads/${o.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-[var(--surface-2)]">
                    <span className="text-sm">
                      <b>{o.name}</b> · {o.unitId ? unitLabel(o.unitId) : '—'} · <span className="tnum">{day(o.createdAt)}</span>
                    </span>
                    <LeadStatusBadge status={o.status} />
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {can('superadmin') && (
          <div className="flex justify-end">
            <Button
              tone="danger"
              disabled={busy}
              onClick={() => {
                if (confirm(ta.app.confirmDelete)) void run(() => del(`/api/leads/${id}`), ta.app.saved).then(onClose);
              }}
            >
              <Icon name="trash" size={16} />
              {T.deleteLead}
            </Button>
          </div>
        )}
      </div>
    </Drawer>
  );
}

function EditLead({ lead, busy, onSave }: { lead: Lead; busy: boolean; onSave: (body: Record<string, unknown>) => void }) {
  const [name, setName] = useState(lead.name);
  const [phone, setPhone] = useState(lead.phone);
  const [unit, setUnit] = useState(lead.unit_id ?? '');
  const [err, setErr] = useState<Record<string, string>>({});
  const submit = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = ta.app.required;
    if (!isValidMongolianPhone(phone)) e.phone = T.invalidPhone;
    const unitId = unit.trim() ? parseUnitId(unit) : null;
    if (unit.trim() && !unitId) e.unit = T.unknownUnit;
    setErr(e);
    if (Object.keys(e).length) return;
    onSave({ name: name.trim(), phone, unitId });
  };
  return (
    <div className="grid gap-3">
      <Field label={T.name} error={err.name}>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label={T.phone} error={err.phone}>
        <input className="field" value={phone} inputMode="tel" onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <Field label={T.unit} hint={T.unitHint} error={err.unit}>
        <input className="field" value={unit} onChange={(e) => setUnit(e.target.value)} />
      </Field>
      <div className="flex justify-end">
        <Button tone="primary" disabled={busy} onClick={submit}>
          {ta.app.save}
        </Button>
      </div>
    </div>
  );
}
