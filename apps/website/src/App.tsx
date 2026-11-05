import { useState, type FormEvent } from 'react';
import { isValidMongolianPhone, projectConfig, t } from '@bair/project-data';

const copy = t.website;
const showroomUrl = `${import.meta.env.BASE_URL}showroom/`;
const api = projectConfig.api.url.replace(/\/$/, '');

/** Sends the form to the admin panel's API as a "website" lead. Without a server there is nowhere to send it. */
async function sendLead(name: string, phone: string, website: string): Promise<boolean> {
  if (!projectConfig.api.url) return true;
  try {
    const res = await fetch(`${api}/api/public/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'contact', source: 'website', name, phone, website }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function App() {
  const [errors, setErrors] = useState<{ name?: boolean; phone?: boolean }>({});
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const phone = String(form.get('phone') ?? '');
    const next = { name: !name, phone: !isValidMongolianPhone(phone) };
    setErrors(next);
    if (next.name || next.phone) return;
    setState('sending');
    setState((await sendLead(name, phone, String(form.get('website') ?? ''))) ? 'sent' : 'failed');
  };

  return (
    <main>
      <section className="hero">
        <h1>{copy.title}</h1>
        <p>{copy.lead}</p>
        <a className="button" href={showroomUrl}>
          {copy.demo}
        </a>
      </section>
      <section>
        <h2>{copy.whatTitle}</h2>
        <ul>
          {copy.what.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
      <section>
        <h2>{copy.contactTitle}</h2>
        {state === 'sent' ? (
          <p role="status">{copy.sent}</p>
        ) : (
          <form onSubmit={submit} noValidate>
            <label>
              {copy.name}
              <input name="name" autoComplete="name" aria-invalid={!!errors.name} required />
            </label>
            {errors.name && <p role="alert">{copy.nameError}</p>}
            <label>
              {copy.phone}
              <input name="phone" inputMode="numeric" autoComplete="tel" aria-invalid={!!errors.phone} required />
            </label>
            {errors.phone && <p role="alert">{copy.phoneError}</p>}
            {/* People never see this field; bots that fill it are ignored by the server. */}
            <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="trap" />
            {state === 'failed' && <p role="alert">{copy.sendFailed}</p>}
            <button className="button" type="submit" disabled={state === 'sending'}>
              {state === 'sending' ? copy.sending : copy.send}
            </button>
          </form>
        )}
        <p className="direct">
          <a href={`tel:${projectConfig.contact.phone}`}>{projectConfig.contact.phoneLabel}</a>
        </p>
      </section>
    </main>
  );
}
