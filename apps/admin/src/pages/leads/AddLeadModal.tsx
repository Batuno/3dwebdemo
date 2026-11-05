import { useState } from 'react';
import { getUnit, isValidMongolianPhone, LEAD_KINDS, ta, type LeadKind } from '@bair/project-data';
import { ApiError, post } from '../../lib/api';
import { Button, Field, Modal } from '../../ui/kit';

const T = ta.leads;
const SOURCES = ['phone', 'walkin', 'referral', 'other'] as const;

/** "804A-12-325" or "804a 12 325" → the flat's id, or null. */
export function parseUnitId(input: string): string | null {
  const m = input.trim().toUpperCase().match(/^(\d{3}[A-Z])[\s#-]*(\d{1,2})[\s-]+(\d{3})$/);
  if (!m) return null;
  const u = getUnit(m[1], Number(m[2]), Number(m[3]));
  return u ? u.id : null;
}

/** A buyer who phoned or walked into the office, entered by hand. */
export function AddLeadModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [form, setForm] = useState({ name: '', phone: '', source: 'phone', kind: 'viewing' as LeadKind, unit: '', date: '', time: '', note: '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = ta.app.required;
    if (!isValidMongolianPhone(form.phone)) e.phone = T.invalidPhone;
    const unitId = form.unit.trim() ? parseUnitId(form.unit) : undefined;
    if (unitId === null) e.unit = T.unknownUnit;
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const r = await post<{ id: number }>('/api/leads', {
        name: form.name.trim(),
        phone: form.phone,
        source: form.source,
        kind: form.kind,
        unitId,
        date: form.kind === 'viewing' ? form.date || undefined : undefined,
        time: form.kind === 'viewing' ? form.time || undefined : undefined,
        note: form.note.trim() || undefined,
      });
      onCreated(r.id);
    } catch (x) {
      setErr({ form: x instanceof ApiError ? `${ta.app.error}: ${x.code}` : ta.app.error });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={T.add}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{ta.app.cancel}</Button>
          <Button tone="primary" disabled={busy} onClick={submit}>
            {ta.app.save}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label={T.name} error={err.name}>
          <input className="field" value={form.name} onChange={set('name')} autoFocus />
        </Field>
        <Field label={T.phone} error={err.phone}>
          <input className="field" value={form.phone} inputMode="tel" onChange={set('phone')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={T.source}>
            <select className="field" value={form.source} onChange={set('source')}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {ta.leadSource[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={T.kind}>
            <select className="field" value={form.kind} onChange={set('kind')}>
              {LEAD_KINDS.map((k) => (
                <option key={k} value={k}>
                  {ta.leadKind[k]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={T.unit} hint={T.unitHint} error={err.unit}>
          <input className="field" value={form.unit} onChange={set('unit')} />
        </Field>
        {form.kind === 'viewing' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={ta.export.columns.viewingDate}>
              <input className="field" type="date" value={form.date} onChange={set('date')} />
            </Field>
            <Field label={ta.export.columns.viewingTime}>
              <input className="field" type="time" value={form.time} onChange={set('time')} />
            </Field>
          </div>
        )}
        <Field label={T.question}>
          <textarea className="field min-h-20" value={form.note} onChange={set('note')} maxLength={2000} />
        </Field>
        {err.form && (
          <p role="alert" className="text-sm font-semibold text-[var(--danger)]">
            {err.form}
          </p>
        )}
      </div>
    </Modal>
  );
}
