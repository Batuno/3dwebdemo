import { useEffect, useState } from 'react';
import { allUnits, ta, unitPrice } from '@bair/project-data';
import { useSession } from '../App';
import { ApiError, patch, post } from '../lib/api';
import { newPasswordKey, stretch } from '../lib/kdf';
import { millions } from '../lib/format';
import type { Pricing } from '../lib/types';
import { useApi } from '../lib/useApi';
import { Button, Card, ErrorBox, Field, PageHeader, Spinner, useToast } from '../ui/kit';

const S = ta.settings;

export default function Settings() {
  const { me, can } = useSession();
  return (
    <div className="fade-in">
      <PageHeader title={S.title} />
      <div className="grid gap-4 lg:grid-cols-2">
        <PricingCard editable={can('superadmin')} />
        <div className="grid content-start gap-4">
          <Card title={S.profile}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-[var(--ink-2)]">{ta.users.name}</dt>
              <dd className="font-semibold">{me.name}</dd>
              <dt className="text-[var(--ink-2)]">{ta.users.email}</dt>
              <dd className="font-semibold">{me.email}</dd>
              <dt className="text-[var(--ink-2)]">{ta.users.role}</dt>
              <dd className="font-semibold">{ta.role[me.role]}</dd>
            </dl>
          </Card>
          <PasswordCard email={me.email} />
          <Card title={S.connect}>
            <p className="text-sm text-[var(--ink-2)]">{S.connectHint}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PricingCard({ editable }: { editable: boolean }) {
  const toast = useToast();
  const { data, error, reload } = useApi<Pricing>('/api/settings/pricing');
  const [form, setForm] = useState({ pricePerM2: '', floorPremium: '', bayPrice: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data) setForm({ pricePerM2: String(data.pricePerM2), floorPremium: String(Math.round(data.floorPremium * 10000) / 100), bayPrice: String(data.bayPrice) });
  }, [data]);
  if (!data) return error ? <ErrorBox error={error} retry={reload} /> : <Spinner />;

  const next = { pricePerM2: Number(form.pricePerM2), floorPremium: Number(form.floorPremium) / 100 };
  const prices = allUnits.map((u) => unitPrice(u.totalArea, u.storey, next)).filter((p) => Number.isFinite(p));
  const save = async () => {
    setBusy(true);
    try {
      await patch('/api/settings/pricing', { pricePerM2: Number(form.pricePerM2), floorPremium: Number(form.floorPremium) / 100, bayPrice: Number(form.bayPrice) });
      toast(ta.app.saved);
      await reload();
    } catch (e) {
      toast(e instanceof ApiError ? `${ta.app.error}: ${e.message}` : ta.app.error, 'error');
    } finally {
      setBusy(false);
    }
  };
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  return (
    <Card title={S.pricing}>
      <p className="mb-3 text-[13px] text-[var(--ink-2)]">{S.pricingHint}</p>
      <div className="grid gap-3">
        <Field label={S.pricePerM2}>
          <input className="field" type="number" min={100000} step={10000} value={form.pricePerM2} disabled={!editable} onChange={set('pricePerM2')} />
        </Field>
        <Field label={S.floorPremium}>
          <input className="field" type="number" min={0} max={5} step={0.1} value={form.floorPremium} disabled={!editable} onChange={set('floorPremium')} />
        </Field>
        <Field label={S.bayPrice}>
          <input className="field" type="number" min={0} step={500000} value={form.bayPrice} disabled={!editable} onChange={set('bayPrice')} />
        </Field>
        {prices.length > 0 && <p className="text-[13px] font-semibold">{S.preview(millions(Math.min(...prices)), millions(Math.max(...prices)))}</p>}
        {editable && (
          <div className="flex justify-end">
            <Button tone="primary" disabled={busy} onClick={save}>
              {ta.app.save}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function PasswordCard({ email }: { email: string }) {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setErr(null);
    if (next.length < 8) return setErr(ta.login.tooShort);
    if (next !== again) return setErr(ta.login.mismatch);
    setBusy(true);
    try {
      const ch = await post<{ salt: string; iterations: number }>('/api/auth/challenge', { email });
      const currentKey = await stretch(current, ch.salt, ch.iterations);
      await post('/api/auth/password', { currentKey, ...(await newPasswordKey(next)) });
      setCurrent('');
      setNext('');
      setAgain('');
      toast(S.passwordChanged);
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'wrong_password' ? S.wrongPassword : ta.app.error);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title={S.password}>
      <div className="grid gap-3">
        <Field label={S.currentPassword}>
          <input className="field" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label={S.newPassword} hint={ta.users.passwordHint}>
          <input className="field" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label={ta.login.passwordAgain}>
          <input className="field" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        </Field>
        {err && (
          <p role="alert" className="text-sm font-semibold text-[var(--danger)]">
            {err}
          </p>
        )}
        <div className="flex justify-end">
          <Button tone="primary" disabled={busy || !current || !next} onClick={submit}>
            {busy ? ta.login.checking : ta.app.save}
          </Button>
        </div>
      </div>
    </Card>
  );
}
