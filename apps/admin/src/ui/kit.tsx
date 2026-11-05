import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ta } from '@bair/project-data';

/* ---------- Buttons ---------- */

type Tone = 'primary' | 'secondary' | 'ghost' | 'danger';
const TONES: Record<Tone, string> = {
  primary: 'bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent-hover)]',
  secondary: 'bg-[var(--surface-2)] text-[var(--ink)] hover:bg-[var(--surface-3)] border border-[var(--line)]',
  ghost: 'text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]',
  danger: 'bg-[var(--danger-soft)] text-[var(--danger)] hover:brightness-95',
};

export function Button({ tone = 'secondary', small, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; small?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded-[10px] font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        small ? 'min-h-8 px-2.5 text-[13px]' : 'min-h-10 px-3.5 text-sm'
      } ${TONES[tone]} ${className}`}
    />
  );
}

/* ---------- Status badges: a colour dot always next to the name ---------- */

export function Badge({ color, children, title }: { color: string; children: ReactNode; title?: string }) {
  return (
    <span title={title} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-[var(--ink)]">
      <span className="dot" style={{ background: color }} />
      {children}
    </span>
  );
}

export const UnitStatusBadge = ({ status }: { status: string }) => <Badge color={`var(--st-${status})`}>{ta.unitStatus[status] ?? status}</Badge>;
export const LeadStatusBadge = ({ status }: { status: string }) => <Badge color={`var(--ls-${status})`}>{ta.leadStatus[status] ?? status}</Badge>;

/* ---------- Layout pieces ---------- */

export function Card({ title, action, children, className = '', pad = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="flex min-h-12 items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-2">
          <h2 className="text-[15px] font-bold">{title}</h2>
          {action}
        </header>
      )}
      <div className={pad ? 'p-4' : ''}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** A KPI: label, value, and optionally the change against a named period. */
export function Stat({ label, value, delta, hint }: { label: string; value: ReactNode; delta?: { text: string; good: boolean | null }; hint?: ReactNode }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-[13px] font-medium text-[var(--ink-2)]">{label}</div>
      <div className="mt-1 text-[26px] leading-tight font-bold">{value}</div>
      {delta && (
        <div className={`mt-0.5 text-xs font-semibold ${delta.good === null ? 'text-[var(--ink-3)]' : delta.good ? 'text-[var(--good-ink)]' : 'text-[var(--danger)]'}`}>{delta.text}</div>
      )}
      {hint && <div className="mt-0.5 text-xs text-[var(--ink-3)]">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-2 py-6 text-center text-sm text-[var(--ink-3)]">{children}</p>;
}

export function Spinner() {
  return (
    <div role="status" aria-label={ta.app.loading} className="flex justify-center py-10">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--line-strong)] border-t-[var(--accent)]" />
    </div>
  );
}

export function ErrorBox({ error, retry }: { error: { code: string; message?: string } | null; retry?: () => void }) {
  if (!error) return null;
  const text = error.code === 'offline' ? ta.app.offline : error.code === 'forbidden' ? ta.app.forbidden : `${ta.app.error}: ${error.message ?? error.code}`;
  return (
    <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-[var(--danger-soft)] px-4 py-3 text-sm font-semibold text-[var(--danger)]">
      {text}
      {retry && (
        <Button small tone="ghost" onClick={retry}>
          {ta.app.retry}
        </Button>
      )}
    </div>
  );
}

/* ---------- Form fields ---------- */

export function Field({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-semibold text-[var(--ink-2)]">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-[var(--ink-3)]">{hint}</span>}
      {error && (
        <span role="alert" className="mt-1 block text-xs font-semibold text-[var(--danger)]">
          {error}
        </span>
      )}
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-[10px] border border-[var(--line)] bg-[var(--surface-2)] p-0.5">
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-8 rounded-lg px-3 text-[13px] font-semibold transition-colors ${value === o.value ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm' : 'text-[var(--ink-2)] hover:text-[var(--ink)]'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Overlays ---------- */

function useEscape(onClose: () => void) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onClose]);
}

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={`fade-in flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-[var(--surface)] shadow-2xl sm:rounded-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <CloseButton onClick={onClose} />
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-[var(--line)] px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

/** A panel from the right, full screen on phones: the detail view for one lead, flat or bay. */
export function Drawer({ title, subtitle, onClose, children }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode }) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onMouseDown={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className="drawer-in flex h-full w-full max-w-full min-w-0 flex-col bg-[var(--bg)] shadow-2xl sm:max-w-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-5 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-extrabold">{title}</h2>
            {subtitle && <div className="mt-0.5 text-[13px] text-[var(--ink-2)]">{subtitle}</div>}
          </div>
          <CloseButton onClick={onClose} />
        </header>
        <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4">{children}</div>
      </aside>
    </div>
  );
}

export function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" aria-label={ta.app.close} onClick={onClick} className="-mr-2 flex h-10 w-10 flex-none items-center justify-center rounded-xl text-[var(--ink-2)] hover:bg-[var(--surface-2)]">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );
}

/* ---------- Toasts ---------- */

const ToastCtx = createContext<(text: string, tone?: 'ok' | 'error') => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'error'; id: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => {
    clearTimeout(timer.current);
    setToast({ text, tone, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4">
        {toast && (
          <div
            key={toast.id}
            className={`fade-in rounded-xl px-4 py-2.5 text-sm font-semibold shadow-lg ${toast.tone === 'error' ? 'bg-[var(--danger)] text-white' : 'bg-[var(--ink)] text-[var(--bg)]'}`}
          >
            {toast.text}
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  );
}
