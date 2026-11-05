import { useState, type FormEvent } from 'react';
import { projectConfig, ta } from '@bair/project-data';
import { ApiError, post } from '../lib/api';
import { newPasswordKey, stretch } from '../lib/kdf';
import type { AuthState } from '../lib/types';
import { Button, Field } from '../ui/kit';

const L = ta.login;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Login({ state, onDone }: { state: AuthState; onDone: () => void }) {
  const setup = state.needsSetup;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!EMAIL_RE.test(email.trim())) return setError(L.invalidEmail);
    if (setup) {
      if (password.length < 8) return setError(L.tooShort);
      if (password !== again) return setError(L.mismatch);
    }
    setBusy(true);
    try {
      if (setup) {
        const { salt, key } = await newPasswordKey(password);
        await post('/api/auth/setup', { code: code.trim(), name: name.trim() || email.trim(), email: email.trim(), salt, key });
      } else {
        const ch = await post<{ salt: string; iterations: number }>('/api/auth/challenge', { email: email.trim() });
        await post('/api/auth/login', { email: email.trim(), key: await stretch(password, ch.salt, ch.iterations) });
      }
      onDone();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'error';
      setError(
        code === 'bad_login' ? L.failed : code === 'locked' || code === 'too_many' ? L.locked : code === 'bad_code' ? L.badCode : code === 'offline' ? ta.app.offline : `${ta.app.error}: ${code}`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <form onSubmit={submit} noValidate className="card fade-in w-full max-w-sm p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-extrabold text-white" style={{ background: projectConfig.brand.accent }}>
            {projectConfig.developerLogoInitials}
          </span>
          <div>
            <div className="text-sm font-bold">{projectConfig.projectName}</div>
            <h1 className="text-xl font-extrabold">{setup ? L.setupTitle : L.title}</h1>
          </div>
        </div>
        {setup && !state.setupEnabled ? (
          <p className="text-sm text-[var(--ink-2)]">{L.setupDisabled}</p>
        ) : (
          <div className="grid gap-3">
            {setup && <p className="text-[13px] text-[var(--ink-2)]">{L.setupHint}</p>}
            {setup && (
              <Field label={L.setupCode}>
                <input className="field" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" required />
              </Field>
            )}
            {setup && (
              <Field label={L.name}>
                <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </Field>
            )}
            <Field label={L.email}>
              <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete={setup ? 'email' : 'username'} required autoFocus />
            </Field>
            <Field label={L.password} hint={setup ? ta.users.passwordHint : undefined}>
              <input className="field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={setup ? 'new-password' : 'current-password'} required />
            </Field>
            {setup && (
              <Field label={L.passwordAgain}>
                <input className="field" type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" required />
              </Field>
            )}
            {error && (
              <p role="alert" className="rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-[13px] font-semibold text-[var(--danger)]">
                {error}
              </p>
            )}
            <Button tone="primary" type="submit" disabled={busy} className="mt-1 w-full">
              {busy ? L.checking : setup ? L.setupSubmit : L.submit}
            </Button>
          </div>
        )}
      </form>
    </main>
  );
}
