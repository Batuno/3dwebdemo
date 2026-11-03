import { describe, expect, it } from 'vitest';
import { t } from '../i18n';
import { unitXform } from '../lib/geometry';
import { blocks } from './blocks';
import { outdoorSpotForAmenity, outdoorSpots } from './outdoor';
import { site } from './site';

describe('outdoor hotspots', () => {
  it('has unique ids and a label for every spot', () => {
    expect(new Set(outdoorSpots.map((s) => s.id)).size).toBe(outdoorSpots.length);
    for (const s of outdoorSpots) expect(t.amenity[s.labelKey], s.id).toBeTruthy();
  });

  it('covers everything the brief names, plus each block entrance', () => {
    for (const id of ['path', 'playground', 'garden', 'court', 'adult-fitness', 'elderly-fitness', 'pavilion', 'drop-off', 'garage-entry']) {
      expect(outdoorSpots.some((s) => s.id === id), id).toBe(true);
    }
    for (const b of blocks) expect(outdoorSpots.some((s) => s.id === `entrance-${b.id}`), b.id).toBe(true);
  });

  it('stands on the plot and never inside a flat stack', () => {
    for (const s of outdoorSpots) {
      expect(Math.abs(s.x), s.id).toBeLessThan(site.plot.halfX);
      expect(Math.abs(s.z), s.id).toBeLessThan(site.plot.halfZ);
      for (const b of blocks) {
        for (const st of b.stacks) {
          const xf = unitXform(b, st);
          const wx = b.position[0] + xf.center[0];
          const wz = b.position[1] + xf.center[1];
          const c = Math.cos(xf.rotY);
          const n = Math.sin(xf.rotY);
          const dx = s.x - wx;
          const dz = s.z - wz;
          const lx = dx * c - dz * n;
          const lz = dx * n + dz * c;
          const inside = Math.abs(lx) < xf.layout.width / 2 && Math.abs(lz) < xf.layout.depth / 2;
          expect(inside, `${s.id} inside ${b.id}-${st.stack}`).toBe(false);
        }
      }
    }
  });

  it('links amenity labels to real amenities', () => {
    for (const s of outdoorSpots) {
      if (s.amenity) expect(site.amenities.some((a) => a.id === s.amenity), s.id).toBe(true);
    }
    expect(outdoorSpotForAmenity('playground')?.id).toBe('playground');
    expect(outdoorSpotForAmenity('substation')).toBeUndefined();
  });
});
