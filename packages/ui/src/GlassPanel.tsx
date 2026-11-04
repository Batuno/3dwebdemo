import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent, type ReactNode } from 'react';

const STORAGE_KEY = 'bair.panels';

/** How far a bottom sheet must be dragged down before it collapses, in pixels. */
const COLLAPSE_DRAG = 36;

/** Phones in either orientation. */
export const PHONE = '(max-width: 767px), (max-height: 480px)';
export const isPhone = (): boolean => typeof window !== 'undefined' && !!window.matchMedia?.(PHONE).matches;

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

/* Which panels are open right now, so the 3D view can frame its subject in the space they leave free. */
const openNow = new Map<string, boolean>();
const openListeners = new Set<() => void>();

function publishOpen(id: string, open: boolean | undefined) {
  if (openNow.get(id) === open) return;
  if (open === undefined) openNow.delete(id);
  else openNow.set(id, open);
  openListeners.forEach((l) => l());
}

function subscribeOpen(listener: () => void) {
  openListeners.add(listener);
  return () => {
    openListeners.delete(listener);
  };
}

/** Whether the panel with this id is open (true), hidden (false) or not on screen (undefined). */
export function usePanelOpen(id: string | null): boolean | undefined {
  return useSyncExternalStore(
    subscribeOpen,
    () => (id ? openNow.get(id) : undefined),
    () => undefined,
  );
}

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

/** Portrait phones, where side panels become bottom sheets. */
export const PORTRAIT_PHONE = '(max-width: 767px) and (min-height: 481px)';

/** Live result of a media query. */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia?.(query);
      m?.addEventListener('change', cb);
      return () => m?.removeEventListener('change', cb);
    },
    () => !!window.matchMedia?.(query).matches,
    () => false,
  );
}

export type TuckSide = 'left' | 'right';

export interface GlassPanelProps {
  id: string;
  title: ReactNode;
  children: ReactNode;
  initial?: PanelState;
  /** Overrides `initial` on phones, where screen space is tight. */
  initialOnPhone?: PanelState;
  footer?: ReactNode;
  /** Label of the tab a hidden panel leaves behind; defaults to the title. */
  pill?: ReactNode;
  closable?: boolean;
  minimizeLabel: string;
  expandLabel: string;
  closeLabel: string;
  className?: string;
  /** Where the tab of a hidden panel sits; defaults to className. */
  pillClassName?: string;
  /** The side a hidden panel slides out to. */
  tuck?: TuckSide;
  /** On portrait phones: a bottom sheet that folds down to its header instead of sliding away. */
  sheet?: boolean;
  /**
   * On every other screen too: the panel folds up into its header where it stands instead of sliding
   * away, and one button in that header toggles it open and folded.
   */
  fold?: boolean;
  /** Sits on top of a sheet and travels with it, such as a view switch. */
  dock?: ReactNode;
}

const Chevron = ({ dir }: { dir: 'left' | 'right' | 'up' | 'down' }) => (
  <svg className="glass-chevron" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d={{ left: 'M15 5l-7 7 7 7', right: 'M9 5l7 7-7 7', up: 'M5 15l7-7 7 7', down: 'M5 9l7 7 7-7' }[dir]}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Every pop-up uses this. Hiding a panel (its × button, Esc, or dragging a sheet down) never removes it:
 * it slides out towards its side and leaves a tab that slides it back, or on phones folds into its header.
 */
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
  tuck = 'right',
  sheet = false,
  fold = false,
  dock,
}: GlassPanelProps) {
  const [state, setState] = usePanelState(id, initialOnPhone && isPhone() ? initialOnPhone : initial);
  const portrait = useMedia(PORTRAIT_PHONE);
  const asSheet = sheet && portrait;
  // A sheet hangs from the bottom of the screen; a folding panel hangs from its header at the top.
  const folds = asSheet || fold;
  const open = state === 'open';
  const dragFrom = useRef<number | null>(null);
  const hide = () => setState(closable ? 'closed' : 'collapsed');

  useEffect(() => {
    publishOpen(id, open);
  }, [id, open]);
  useEffect(() => () => publishOpen(id, undefined), [id]);

  useEffect(() => {
    if (!open) return;
    const close = () => setState(closable ? 'closed' : 'collapsed');
    if (escStack.length === 0) window.addEventListener('keydown', onEsc);
    escStack.unshift(close);
    return () => {
      escStack.splice(escStack.indexOf(close), 1);
      if (escStack.length === 0) window.removeEventListener('keydown', onEsc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, closable]);

  // A sheet follows the finger: dragging the grip or the folded header up opens it, down folds it.
  const drag = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      // Capturing a press that starts on a button would send its click to the header instead.
      if ((e.target as HTMLElement).closest('button')) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragFrom.current = e.clientY;
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (dragFrom.current === null) return;
      const dy = e.clientY - dragFrom.current;
      if (dy > COLLAPSE_DRAG && open) {
        dragFrom.current = null;
        hide();
      } else if (dy < -COLLAPSE_DRAG && !open) {
        dragFrom.current = null;
        setState('open');
      }
    },
    onPointerUp: () => {
      dragFrom.current = null;
    },
    onPointerCancel: () => {
      dragFrom.current = null;
    },
  };

  if (folds) {
    // The toggle points the way the panel will move: a sheet folds down, a top panel folds up.
    const chevron = asSheet === open ? 'down' : 'up';
    return (
      <section
        className={`glass-panel glass-sheet ${asSheet ? '' : 'glass-fold'} ${className} ${open ? '' : 'is-folded'}`}
        aria-label={typeof title === 'string' ? title : undefined}
      >
        {dock && asSheet && <div className="glass-sheet-dock">{dock}</div>}
        {asSheet && <div className="glass-panel-grip" aria-hidden="true" {...drag} />}
        <header className="glass-panel-head" {...(asSheet ? drag : {})} onClick={open ? undefined : () => setState('open')}>
          <div className="glass-panel-title">{open ? title : (pill ?? title)}</div>
          <button
            type="button"
            className="glass-icon-btn glass-sheet-toggle"
            aria-label={open ? minimizeLabel : expandLabel}
            aria-expanded={open}
            onClick={(e) => {
              e.stopPropagation();
              if (open) hide();
              else setState('open');
            }}
          >
            <Chevron dir={chevron} />
          </button>
        </header>
        <div className="glass-sheet-fold" inert={!open}>
          <div className="glass-sheet-fold-inner">
            <div className="glass-panel-body">{children}</div>
            {footer && <div className="glass-panel-foot">{footer}</div>}
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section
        className={`glass-panel ${className} ${open ? '' : `is-tucked is-tucked-${tuck}`}`}
        aria-label={typeof title === 'string' ? title : undefined}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="glass-panel-grip" aria-hidden="true" {...drag} />
        <header className="glass-panel-head">
          <div className="glass-panel-title">{title}</div>
          <button type="button" className="glass-icon-btn" aria-label={closeLabel} onClick={hide}>
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div className="glass-panel-body">{children}</div>
        {footer && <div className="glass-panel-foot">{footer}</div>}
      </section>
      {!open && (
        <button
          type="button"
          aria-label={expandLabel}
          className={`glass-pill glass-tab glass-tab-${tuck} ${pillClassName ?? className}`}
          onClick={() => setState('open')}
        >
          {tuck === 'left' ? null : <Chevron dir="left" />}
          <span className="glass-tab-label">{pill ?? title}</span>
          {tuck === 'left' ? <Chevron dir="right" /> : null}
        </button>
      )}
    </>
  );
}
