import { type ReactNode } from 'react';
import { GlassPanel, useMedia } from '@bair/ui';
import { t } from '@bair/project-data';
import type { StatusCounts } from '@bair/project-data';
import type { UnitStatus } from '@bair/project-data';

export function StatusBadge({ status }: { status: UnitStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold">
      <span className={`dot status-${status}`} />
      {t.status[status]}
    </span>
  );
}

export function StackedBar({ c }: { c: StatusCounts }) {
  const pct = (n: number) => `${(n / Math.max(1, c.total)) * 100}%`;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-black/5" role="img" aria-label={`${t.status.availableCount(c.available)}, ${t.status.reservedCount(c.reserved)}, ${t.status.soldCount(c.sold)}`}>
      <div className="status-available" style={{ width: pct(c.available) }} />
      <div className="status-reserved" style={{ width: pct(c.reserved) }} />
      <div className="status-sold" style={{ width: pct(c.sold) }} />
    </div>
  );
}

export function IconButton({
  label,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors disabled:opacity-35 ${
        active ? 'bg-[var(--accent)] text-white' : 'text-[var(--ink)] hover:bg-black/5'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Side panel on desktop, bottom sheet on portrait phones. Hiding it slides it to its side (or folds the
 * sheet into its header) and leaves a tab to bring it back; with `fold` it folds into its header everywhere.
 */
export function Panel({
  id,
  title,
  initial,
  initialOnPhone,
  side = 'right',
  children,
  width = 'md:w-[380px]',
  footer,
  dock,
  pill,
  fold,
}: {
  id: string;
  title: ReactNode;
  initial?: 'open' | 'collapsed';
  initialOnPhone?: 'open' | 'collapsed';
  side?: 'left' | 'right';
  children: ReactNode;
  width?: string;
  footer?: ReactNode;
  /** Rides on top of the phone sheet, such as the 3D / plan switch. */
  dock?: ReactNode;
  /** What the hidden panel's tab (or folded sheet) shows; defaults to the title. */
  pill?: ReactNode;
  /** Folds into its header in place, with one toggle button, instead of sliding away. */
  fold?: boolean;
}) {
  // The right edge belongs to the time slider.
  const pos = side === 'right' ? 'md:right-[92px]' : 'md:left-4';
  // Landscape phones keep every panel in a column on the right.
  const landscapePhone = useMedia('(max-height: 480px)');
  return (
    <GlassPanel
      id={id}
      title={title}
      initial={initial}
      initialOnPhone={initialOnPhone}
      footer={footer}
      sheet
      fold={fold}
      dock={dock}
      pill={pill}
      tuck={landscapePhone ? 'right' : side}
      minimizeLabel={t.panel.minimize}
      expandLabel={t.panel.expand}
      closeLabel={t.panel.close}
      className={`side-panel fade-in pointer-events-auto fixed inset-x-0 bottom-0 z-30 flex flex-col md:inset-x-auto md:top-20 ${pos} ${width}`}
      pillClassName={`pointer-events-auto fixed z-30 bottom-[70px] right-[60px] md:top-20 md:bottom-auto ${side === 'right' ? 'md:right-[92px]' : 'md:right-auto md:left-4'}`}
    >
      {children}
    </GlassPanel>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-black/[0.035] px-3 py-2">
      <div className="text-[11px] font-medium text-[var(--ink-soft)]">{label}</div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  );
}

export const primaryBtn =
  'flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50';
export const secondaryBtn =
  'flex min-h-11 items-center justify-center gap-2 rounded-xl bg-black/[0.05] px-4 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-black/10 disabled:opacity-50';
