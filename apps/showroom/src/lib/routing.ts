import { blockById, interiors, outdoorSpotById } from '@bair/project-data';

export type Route =
  | { view: 'overview' }
  | { view: 'garage' }
  | { view: 'outdoor'; spot: string }
  | { view: 'block'; block: string }
  | { view: 'floor'; block: string; storey: number }
  | { view: 'unit'; block: string; storey: number; stack: number; spot?: string };

/** "#/804A/12/325/living-1" → route. Anything unknown falls back as far as it stays valid. */
export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'garage') return { view: 'garage' };
  if (parts[0] === 'outdoor') {
    return outdoorSpotById(parts[1]) ? { view: 'outdoor', spot: parts[1] } : { view: 'overview' };
  }
  const block = parts[0] ? blockById(parts[0]) : undefined;
  if (!block) return { view: 'overview' };
  if (parts.length === 1) return { view: 'block', block: block.id };
  const storey = Number(parts[1]);
  if (!Number.isInteger(storey) || storey < 2 || storey > block.storeys) {
    return { view: 'block', block: block.id };
  }
  if (parts.length === 2) return { view: 'floor', block: block.id, storey };
  const stack = Number(parts[2]);
  const st = block.stacks.find((s) => s.stack === stack);
  if (!st) return { view: 'floor', block: block.id, storey };
  const unit = { view: 'unit' as const, block: block.id, storey, stack };
  const known = parts[3] && interiors[st.type].hotspots.some((h) => h.id === parts[3]);
  return known ? { ...unit, spot: parts[3] } : unit;
}

export function toHash(r: Route): string {
  switch (r.view) {
    case 'overview':
      return '#/';
    case 'garage':
      return '#/garage';
    case 'outdoor':
      return `#/outdoor/${r.spot}`;
    case 'block':
      return `#/${r.block}`;
    case 'floor':
      return `#/${r.block}/${r.storey}`;
    case 'unit':
      return `#/${r.block}/${r.storey}/${r.stack}${r.spot ? `/${r.spot}` : ''}`;
  }
}
