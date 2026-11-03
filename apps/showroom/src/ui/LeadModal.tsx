import { useMemo, useState, type FormEvent } from 'react';
import { t } from '@bair/project-data';
import { unitNumber } from '@bair/project-data';
import type { Unit } from '@bair/project-data';
import { submitLead, type LeadKind } from '../lib/leads';
import { isValidMongolianPhone } from '@bair/project-data';
import { useAppStore } from '../store/useAppStore';
import { primaryBtn, secondaryBtn } from './common';
import { IconClose } from './icons';

const SLOTS = ['10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

const isoDate = (d: Date) => {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
};

export function LeadModal({
  kind,
  unit,
  parkingBay,
  onClose,
}: {
  kind: LeadKind;
  unit: Unit;
  parkingBay?: string;
  onClose: () => void;
}) {
  const showToast = useAppStore((s) => s.showToast);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [question, setQuestion] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const minDate = useMemo(() => isoDate(new Date(Date.now() + 86400000)), []);
  const number = unitNumber(unit.storey, unit.stack);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!name.trim()) err.name = t.lead.errName;
    if (!isValidMongolianPhone(phone)) err.phone = t.lead.errPhone;
    if (kind === 'viewing') {
      if (!date) err.date = t.lead.errDate;
      if (!time) err.time = t.lead.errTime;
    } else if (!question.trim()) {
      err.question = t.lead.errQuestion;
    }
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    const ok = await submitLead({
      kind,
      unitId: unit.id,
      name: name.trim(),
      phone,
      date: kind === 'viewing' ? date : undefined,
      time: kind === 'viewing' ? time : undefined,
      question: kind === 'info' ? question.trim() : undefined,
      parkingBay,
    });
    setBusy(false);
    showToast(ok ? (kind === 'viewing' ? t.lead.bookOk : t.lead.infoOk) : t.lead.sendFailed);
    onClose();
  };

  const field = 'mt-1 w-full min-h-11 rounded-xl border border-black/10 bg-white px-3 text-sm outline-none focus:border-[var(--accent)]';
  const Err = ({ k }: { k: string }) =>
    errors[k] ? (
      <p role="alert" className="mt-1 text-xs font-semibold text-[#b3261e]">
        {errors[k]}
      </p>
    ) : null;

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-end justify-center bg-black/30 md:items-center" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        noValidate
        className="lead-form fade-in max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl md:w-[440px] md:rounded-3xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-lg font-extrabold">{kind === 'viewing' ? t.lead.bookTitle(number) : t.lead.infoTitle(number)}</h2>
          <button type="button" aria-label={t.nav.close} className="-mt-2 -mr-2 flex h-11 w-11 flex-none items-center justify-center rounded-xl hover:bg-black/5" onClick={onClose}>
            <IconClose />
          </button>
        </div>
        <label className="mb-3 block text-[13px] font-semibold">
          {t.lead.name}
          <input className={field} value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} />
          <Err k="name" />
        </label>
        <label className="mb-3 block text-[13px] font-semibold">
          {t.lead.phone}
          <input className={field} value={phone} type="tel" inputMode="tel" autoComplete="tel" placeholder={t.lead.phoneHint} onChange={(e) => setPhone(e.target.value)} />
          <Err k="phone" />
        </label>
        {kind === 'viewing' ? (
          <>
            <label className="mb-3 block text-[13px] font-semibold">
              {t.lead.date}
              <input className={field} type="date" min={minDate} value={date} onChange={(e) => setDate(e.target.value)} />
              <Err k="date" />
            </label>
            <fieldset className="mb-4">
              <legend className="mb-1 text-[13px] font-semibold">{t.lead.time}</legend>
              <div className="grid grid-cols-4 gap-1.5">
                {SLOTS.map((s) => (
                  <button
                    type="button"
                    key={s}
                    aria-pressed={time === s}
                    onClick={() => setTime(s)}
                    className={`min-h-11 rounded-xl text-[13px] font-semibold ${time === s ? 'bg-[var(--accent)] text-white' : 'bg-black/[0.05]'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <Err k="time" />
            </fieldset>
          </>
        ) : (
          <label className="mb-4 block text-[13px] font-semibold">
            {t.lead.question}
            <textarea className={`${field} min-h-24 py-2`} value={question} onChange={(e) => setQuestion(e.target.value)} />
            <Err k="question" />
          </label>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={secondaryBtn} onClick={onClose}>
            {t.lead.cancel}
          </button>
          <button type="submit" className={primaryBtn} disabled={busy}>
            {t.lead.submit}
          </button>
        </div>
      </form>
    </div>
  );
}
