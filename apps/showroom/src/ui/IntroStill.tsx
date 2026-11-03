// When an Unreal still of the opening shot exists, it fills the screen during the intro, then fades into
// the live 3D scene once the viewer starts moving around.
import { useEffect, useMemo, useState } from 'react';
import { renderBlend } from '@bair/project-data';
import { rendersBase } from '../lib/renderManifest';
import { useAppStore } from '../store/useAppStore';

const HOLD_MS = 4500;

export function IntroStill() {
  const stills = useAppStore((s) => s.manifest?.stills.opening);
  const isHome = useAppStore((s) => s.route.view === 'overview');
  const ready = useAppStore((s) => s.sceneReady);
  const [done, setDone] = useState(false);
  const file = useMemo(() => {
    if (!stills) return undefined;
    const blend = renderBlend(Object.keys(stills), useAppStore.getState().time);
    return blend ? stills[blend.t > 0.5 ? blend.to : blend.from] : undefined;
  }, [stills]);

  useEffect(() => {
    if (!file || !ready) return undefined;
    const finish = () => setDone(true);
    const id = setTimeout(finish, HOLD_MS);
    window.addEventListener('pointerdown', finish);
    window.addEventListener('wheel', finish, { passive: true });
    return () => {
      clearTimeout(id);
      window.removeEventListener('pointerdown', finish);
      window.removeEventListener('wheel', finish);
    };
  }, [file, ready]);

  if (!file) return null;
  return <img className={`intro-still ${done || !isHome ? 'is-done' : ''}`} src={`${rendersBase()}${file}`} alt="" />;
}
