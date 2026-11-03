// The furnished plan: an Unreal render when one exists, otherwise the real-time top view.
import { forwardRef, lazy, Suspense } from 'react';
import { t, type InteriorLayout } from '@bair/project-data';
import { rendersBase } from '../lib/renderManifest';
import { useAppStore } from '../store/useAppStore';

const TopViewCanvas = lazy(() => import('../scene/unit/TopViewScene').then((m) => ({ default: m.TopViewCanvas })));

const EVENING_FROM = 18 * 60;

/** The rendered image for a plan at this time of day, and its full-size master. */
export function usePlanRender(layout: InteriorLayout, minutes: number) {
  const rendered = useAppStore((s) => s.manifest?.topviews[`${layout.type}${layout.mirrored ? '_mirror' : ''}`]);
  const image = rendered && (minutes >= EVENING_FROM && rendered.evening ? rendered.evening : (rendered.day ?? rendered.evening));
  return { image, master: rendered?.master ?? image };
}

export interface PlanPictureProps {
  layout: InteriorLayout;
  pxPerMetre: number;
  dpr?: number;
  people?: boolean;
  minutes: number;
  turnDeg?: number;
}

export const PlanPicture = forwardRef<HTMLCanvasElement, PlanPictureProps>(function PlanPicture(
  { layout, pxPerMetre, dpr, people, minutes, turnDeg },
  ref,
) {
  const { image } = usePlanRender(layout, minutes);
  if (image) {
    return (
      <img
        src={`${rendersBase()}${image}`}
        alt={t.unit.plan}
        draggable={false}
        style={{ display: 'block', width: layout.width * pxPerMetre, height: layout.depth * pxPerMetre }}
      />
    );
  }
  return (
    <Suspense fallback={null}>
      <TopViewCanvas ref={ref} layout={layout} pxPerMetre={pxPerMetre} dpr={dpr} people={people} minutes={minutes} turnDeg={turnDeg} />
    </Suspense>
  );
});
