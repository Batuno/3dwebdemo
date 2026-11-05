import { useState } from 'react';
import { ta } from '@bair/project-data';
import { RequireRole, useSession } from '../App';
import { ApiError, patch, post } from '../lib/api';
import { newPasswordKey } from '../lib/kdf';
import { stamp } from '../lib/format';
import type { Role } from '../lib/types';
import { useApi } from '../lib/useApi';
import { Icon } from '../ui/icons';
import { Button, ErrorBox, Field, Modal, PageHeader, Spinner, useToast } from '../ui/kit';

const T = ta.users;
const ROLES: Role[] = ['superadmin', 'admin', 'sales'];

interface UserRow {
  id: number;
  email: string;
  name: string;
  role: Role;
  active: number;
  createdAt: string;
  lastLoginAt: string | null;
}

function errorText(e: unknown): string {
  if (!(e instanceof ApiError)) return ta.app.error;
  if (e.code === 'email_taken') return T.emailTaken;
  if (e.code === 'last_superadmin') return T.lastSuperadmin;
  return `${ta.app.error}: ${e.message}`;
}

export default function Users() {
  return (
    <RequireRole role="superadmin">
      <UsersPage />
    </RequireRole>
  );
}

function UsersPage() {
  const { me } = useSession();
  const toast = useToast();
  const { data, error, reload } = useApi<{ users: UserRow[] }>('/api/users');
  const [adding, setAdding] = useState(false);
  const [resetFor, setResetFor] = useState<UserRow | null>(null);

  const change = async (u: UserRow, body: Record<string, unknown>) => {
    try {
      await patch(`/api/users/${u.id}`, body);
      toast(ta.app.saved);
      await reload();
    } catch (e) {
      toast(errorText(e), 'error');
    }
  };

  if (!data) return error ? <ErrorBox error={error} retry={reload} /> : <Spinner />;
  return (
    <div className="fade-in">
      <PageHeader title={T.title}>
        <Button tone="primary" onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} />
          {T.add}
        </Button>
      </PageHeader>
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {ROLES.map((r) => (
          <div key={r} className="card px-4 py-3 text-[13px]">
            <div className="font-bold">{ta.role[r]}</div>
            <div className="text-[var(--ink-2)]">{ta.roleHint[r]}</div>
          </div>
        ))}
      </div>
      <div className="card scroll-x">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] text-xs text-[var(--ink-2)]">
              <th className="px-4 py-2.5 font-semibold">{T.name}</th>
              <th className="px-2 py-2.5 font-semibold">{T.role}</th>
              <th className="px-2 py-2.5 font-semibold">{T.active}</th>
              <th className="px-2 py-2.5 font-semibold">{T.lastLogin}</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {data.users.map((u) => {
              const self = u.id === me.id;
              return (
                <tr key={u.id} className={`border-b border-[var(--line)] last:border-0 ${u.active ? '' : 'opacity-60'}`}>
                  <td className="px-4 py-2.5">
                    <div className="font-bold">
                      {u.name} {self && <span className="ml-1 rounded bg-[var(--accent-soft)] px-1.5 text-[11px] text-[var(--accent)]">{T.you}</span>}
                    </div>
                    <div className="text-xs text-[var(--ink-2)]">{u.email}</div>
                  </td>
                  <td className="px-2 py-2.5">
                    <select className="field !min-h-8 !w-auto !text-[13px]" aria-label={`${u.name}: ${T.role}`} value={u.role} disabled={self} onChange={(e) => change(u, { role: e.target.value })}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ta.role[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2.5">
                    <Button small tone={u.active ? 'secondary' : 'primary'} disabled={self} onClick={() => change(u, { active: !u.active })}>
                      {u.active ? T.deactivate : T.activate}
                    </Button>
                  </td>
                  <td className="tnum px-2 py-2.5 text-[13px] text-[var(--ink-2)]">{u.lastLoginAt ? stamp(u.lastLoginAt) : T.never}</td>
                  <td className="px-4 py-2.5 text-right">
                    {!self && (
                      <Button small tone="ghost" onClick={() => setResetFor(u)}>
                        {T.resetPassword}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {adding && <UserModal onClose={() => setAdding(false)} onDone={reload} />}
      {resetFor && <UserModal user={resetFor} onClose={() => setResetFor(null)} onDone={reload} />}
    </div>
  );
}

/** A new user, or a new password for `user`. The password is stretched here and never sent as typed. */
function UserModal({ user, onClose, onDone }: { user?: UserRow; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', role: 'sales' as Role, password: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!user && (!form.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))) return setErr(ta.login.invalidEmail);
    if (form.password.length < 8) return setErr(ta.login.tooShort);
    setBusy(true);
    try {
      const key = await newPasswordKey(form.password);
      if (user) await patch(`/api/users/${user.id}`, key);
      else await post('/api/users', { name: form.name.trim(), email: form.email.trim(), role: form.role, ...key });
      toast(ta.app.saved);
      onDone();
      onClose();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={user ? `${T.resetPassword}: ${user.name}` : T.add}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{ta.app.cancel}</Button>
          <Button tone="primary" disabled={busy} onClick={submit}>
            {busy ? ta.login.checking : ta.app.save}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        {!user && (
          <>
            <Field label={T.name}>
              <input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </Field>
            <Field label={T.email}>
              <input className="field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label={T.role} hint={ta.roleHint[form.role]}>
              <select className="field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ta.role[r]}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
        <Field label={user ? T.newPassword : T.password} hint={T.passwordHint}>
          <input className="field" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoFocus={!!user} />
        </Field>
        {err && (
          <p role="alert" className="text-sm font-semibold text-[var(--danger)]">
            {err}
          </p>
        )}
      </div>
    </Modal>
  );
}
