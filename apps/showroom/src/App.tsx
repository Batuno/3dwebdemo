import { lazy, Suspense, useEffect } from 'react';
import { blockById, interiors, mirroredInteriors } from '@bair/project-data';
import { loadRenderManifest } from './lib/renderManifest';
import { SceneRoot } from './scene/SceneRoot';
import { useAppStore } from './store/useAppStore';
import { Overlay } from './ui/Overlay';

const PlanReview = lazy(() => import('./dev/PlanReview').then((m) => ({ default: m.PlanReview })));
const ExportPage = import.meta.env.DEV ? lazy(() => import('./dev/ExportPage').then((m) => ({ default: m.ExportPage }))) : null;
const DebugPlan = lazy(() => import('./dev/DebugPlan').then((m) => ({ default: m.DebugPlan })));

const debugEnabled = new URLSearchParams(location.search).get('debug') === '1';

function UnitDebugOverlay() {
  const route = useAppStore((s) => s.route);
  if (route.view !== 'unit') return null;
  const stack = blockById(route.block)?.stacks.find((s) => s.stack === route.stack);
  if (!stack) return null;
  return (
    <div style={{ position: 'fixed', top: 72, left: 16, zIndex: 60, maxHeight: '80vh', overflow: 'auto', background: '#fff', padding: 8, borderRadius: 12 }}>
      <Suspense fallback={null}>
        <DebugPlan layout={(stack.mirror ? mirroredInteriors : interiors)[stack.type]} scale={30} />
      </Suspense>
    </div>
  );
}

export function App() {
  const devPlan = location.hash.match(/^#\/dev\/plan\/([^/]+)(\/m)?/);
  if (devPlan) {
    return (
      <Suspense fallback={null}>
        <PlanReview type={devPlan[1]} mirrored={!!devPlan[2]} />
      </Suspense>
    );
  }
  if (ExportPage && location.hash.startsWith('#/dev/export')) {
    return (
      <Suspense fallback={null}>
        <ExportPage />
      </Suspense>
    );
  }
  return <MainApp />;
}

function MainApp() {
  const sync = useAppStore((s) => s.syncFromHash);
  const setManifest = useAppStore((s) => s.setManifest);
  useEffect(() => {
    void loadRenderManifest().then(setManifest);
  }, [setManifest]);
  useEffect(() => {
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [sync]);
  return (
    <div className="fixed inset-0">
      <SceneRoot />
      <Overlay />
      {debugEnabled && <UnitDebugOverlay />}
    </div>
  );
}
