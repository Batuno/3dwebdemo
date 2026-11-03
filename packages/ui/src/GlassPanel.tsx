import { useEffect, useRef, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'bair.panels';

/** How far a bottom sheet must be dragged down before it collapses, in pixels. */
const COLLAPSE_DRAG = 36;

/** Phones in either orientation. */
export const isPhone = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 767px), (max-height: 480px)').matches;

type PanelState = 'open' | 'collapsed' | 'closed';

function readStates(): Record<string, PanelState> {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeState(id: string, state: PanelState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readStates(), [id]: state }));
  } catch {
    // Private windows can refuse storage; the panel still works for this page view.
  }
}

/** Open, collapsed or closed; remembered for the session. */
export function usePanelState(id: string, initial: PanelState = 'open') {
  const [state, setState] = useState<PanelState>(() => readStates()[id] ?? initial);
  useEffect(() => {
    const restore = () => setState((s) => (s === 'closed' ? 'open' : s));
    restorers.add(restore);
    return () => {
      restorers.delete(restore);
    };
  }, []);
  const set = (next: PanelState) => {
    writeState(id, next);
    setState(next);
  };
  return [state, set] as const;
}

const restorers = new Set<() => void>();

/** Brings back every panel the viewer closed. */
export function restorePanels() {
  try {
    const open = Object.fromEntries(Object.entries(readStates()).filter(([, s]) => s !== 'closed'));
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(open));
  } catch {
    // Storage may be blocked; the open panels below still restore for this page view.
  }
  restorers.forEach((restore) => restore());
}

// Topmost first, so Esc closes only the most recently opened panel.
const escStack: (() => void)[] = [];

function onEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') escStack[0]?.();
}

export interface GlassPanelProps {
  id: string;
  title: ReactNode;
  children: ReactNode;
  initial?: PanelState;
  /** Overrides `initial` on phones, where screen space is tight. */
  initialOnPhone?: PanelState;
  footer?: ReactNode;
  /** Collapsed pill label; defaults to the title. */
  pill?: ReactNode;
  closable?: boolean;
  minimizeLabel: string;
  expandLabel: string;
  closeLabel: string;
  className?: string;
  /** Where the collapsed pill sits; defaults to className. */
  pillClassName?: string;
}

/** Every pop-up uses this: minimize to a pill, close, Esc closes the top-most. */
export function GlassPanel({
  id,
  title,
  children,
  initial = 'open',
  initialOnPhone,
  footer,
  pill,
  closable = true,
  minimizeLabel,
  expandLabel,
  closeLabel,
  className = '',
  pillClassName,
}: GlassPanelProps) {
  const [state, setState] = usePanelState(id, initialOnPhone && isPhone() ? initialOnPhone : initial);
  const dragFrom = useRef<number | null>(null);

  useEffect(() => {
    if (state !== 'open') return;
    const close = () => setState(closable ? 'closed' : 'collapsed');
    if (escStack.length === 0) window.addEventListener('keydown', onEsc);
    escStack.unshift(close);
    return () => {
      escStack.splice(escStack.indexOf(close), 1);
      if (escStack.length === 0) window.removeEventListener('keydown', onEsc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, closable]);

  if (state === 'closed') return null;
  if (state === 'collapsed') {
    return (
      <button
        type="button"
        aria-label={expandLabel}
        className={`glass-pill ${pillClassName ?? className}`}
        onClick={() => setState('open')}
      >
        {pill ?? title}
      </button>
    );
  }
  return (
    <section className={`glass-panel ${className}`} aria-label={typeof title === 'string' ? title : undefined}>
      <div
        className="glass-panel-grip"
        aria-hidden="true"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dragFrom.current = e.clientY;
        }}
        onPointerMove={(e) => {
          if (dragFrom.current !== null && e.clientY - dragFrom.current > COLLAPSE_DRAG) {
            dragFrom.current = null;
            setState('collapsed');
          }
        }}
        onPointerUp={() => {
          dragFrom.current = null;
        }}
      />
      <header className="glass-panel-head">
        <div className="glass-panel-title">{title}</div>
        <button type="button" className="glass-icon-btn" aria-label={minimizeLabel} onClick={() => setState('collapsed')}>
          <span aria-hidden="true">–</span>
        </button>
        {closable && (
          <button type="button" className="glass-icon-btn" aria-label={closeLabel} onClick={() => setState('closed')}>
            <span aria-hidden="true">×</span>
          </button>
        )}
      </header>
      <div className="glass-panel-body">{children}</div>
      {footer && <div className="glass-panel-foot">{footer}</div>}
    </section>
  );
}
