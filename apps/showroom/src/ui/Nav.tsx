import { blockById, interiors, outdoorSpotById, projectConfig, roomLabel } from '@bair/project-data';
import { t } from '@bair/project-data';
import { unitNumber } from '@bair/project-data';
import type { Route } from '../lib/routing';
import { useAppStore } from '../store/useAppStore';
import { IconChevron } from './icons';

function crumbs(route: Route): { label: string; to: Route }[] {
  const out: { label: string; to: Route }[] = [{ label: t.nav.project, to: { view: 'overview' } }];
  if (route.view === 'garage') out.push({ label: t.nav.garage, to: route });
  if (route.view === 'outdoor') {
    out.push({ label: t.nav.amenities, to: route });
    const spot = outdoorSpotById(route.spot);
    if (spot) out.push({ label: t.amenity[spot.labelKey], to: route });
  }
  if ('block' in route) out.push({ label: t.nav.block(route.block), to: { view: 'block', block: route.block } });
  if ('storey' in route) {
    out.push({ label: t.nav.storey(route.storey), to: { view: 'floor', block: route.block, storey: route.storey } });
  }
  if (route.view === 'unit') {
    out.push({ label: unitNumber(route.storey, route.stack), to: { ...route, spot: undefined } });
    const type = blockById(route.block)?.stacks.find((s) => s.stack === route.stack)?.type;
    const spot = type ? interiors[type].hotspots.find((h) => h.id === route.spot) : undefined;
    if (type && spot) out.push({ label: roomLabel(type, spot.room), to: route });
  }
  return out;
}

export function TopBar() {
  const route = useAppStore((s) => s.route);
  const navigate = useAppStore((s) => s.navigate);
  const items = crumbs(route);
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex flex-wrap items-start gap-2 p-3 md:p-4">
      <div className="glass pointer-events-auto flex min-w-0 items-center gap-2 rounded-2xl py-1.5 pr-3 pl-1.5">
        <button
          type="button"
          onClick={() => navigate({ view: 'overview' })}
          aria-label={projectConfig.developerName}
          className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-[var(--accent)] text-xs font-extrabold tracking-wide text-white"
        >
          {projectConfig.developerLogoInitials}
        </button>
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-0.5 text-[13px] font-semibold">
          {items.map((c, i) => (
            <span key={c.label} className="flex min-w-0 items-center gap-0.5">
              {i > 0 && (
                <span className="text-[var(--ink-soft)]">
                  <IconChevron />
                </span>
              )}
              <button
                type="button"
                onClick={() => navigate(c.to)}
                className={`min-h-9 truncate rounded-lg px-1.5 hover:bg-black/5 ${
                  i === items.length - 1 ? 'text-[var(--ink)]' : 'text-[var(--ink-soft)]'
                }`}
              >
                {c.label}
              </button>
            </span>
          ))}
        </nav>
      </div>
    </header>
  );
}
