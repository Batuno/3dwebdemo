// Dev page #/dev/plan/<type>[/m]: an orthographic top view of a furnished unit, walls cut at 1.2 m,
// next to the debug plan. Used to compare each type against the design diagrams.
import { interiors, mirroredInteriors, parseTime } from '@bair/project-data';
import { TopViewCanvas } from '../scene/unit/TopViewScene';
import { DebugPlan } from './DebugPlan';

const PX_PER_M = 90;

export function PlanReview({ type, mirrored }: { type: string; mirrored: boolean }) {
  const layout = (mirrored ? mirroredInteriors : interiors)[type];
  if (!layout) return <p style={{ padding: 24 }}>Unknown unit type: {type}</p>;
  const w = layout.width * PX_PER_M;
  const h = layout.depth * PX_PER_M;
  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', padding: 24, background: '#fff', minHeight: '100vh', boxSizing: 'border-box', overflow: 'auto' }}>
      <div data-testid="topview" style={{ width: w, height: h, flex: 'none' }}>
        <TopViewCanvas
          layout={layout}
          pxPerMetre={PX_PER_M}
          people
          minutes={parseTime(new URLSearchParams(location.search).get('t')) ?? 12 * 60}
          onReady={() => Object.assign(window, { __sceneReady: true })}
        />
      </div>
      <DebugPlan layout={layout} />
    </div>
  );
}
