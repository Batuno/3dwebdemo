import { useState, type FormEvent } from 'react';
import { isValidMongolianPhone, projectConfig, t } from '@bair/project-data';

const copy = t.website;
const showroomUrl = `${import.meta.env.BASE_URL}showroom/`;

export function App() {
  const [phoneError, setPhoneError] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const phone = String(new FormData(e.currentTarget).get('phone') ?? '');
    const valid = isValidMongolianPhone(phone);
    setPhoneError(!valid);
    setSent(valid);
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
        {sent ? (
          <p role="status">{copy.sent}</p>
        ) : (
          <form onSubmit={submit} noValidate>
            <label>
              {copy.name}
              <input name="name" autoComplete="name" required />
            </label>
            <label>
              {copy.phone}
              <input name="phone" inputMode="numeric" autoComplete="tel" aria-invalid={phoneError} required />
            </label>
            {phoneError && <p role="alert">{copy.phoneError}</p>}
            <button className="button" type="submit">
              {copy.send}
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
