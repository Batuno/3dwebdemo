// The still from just before a move between standing points, fading out over the new view with a slight push
// forward, so stepping from spot to spot feels like walking rather than a cut (see scene/dissolve).
import { useEffect, useRef } from 'react';
import { onDissolve } from '../scene/dissolve';

const reduceMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function Dissolve() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      onDissolve((still) => {
        const el = host.current;
        if (!el) return;
        still.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;will-change:opacity,transform;';
        // A new move replaces a still that is still fading.
        el.replaceChildren(still);
        const frames = reduceMotion
          ? [{ opacity: 1 }, { opacity: 0 }]
          : [
              { opacity: 1, transform: 'scale(1)' },
              { opacity: 0, transform: 'scale(1.045)' },
            ];
        const anim = still.animate(frames, {
          duration: reduceMotion ? 260 : 620,
          easing: 'cubic-bezier(0.33, 0, 0.2, 1)',
          fill: 'forwards',
        });
        anim.onfinish = () => still.remove();
      }),
    [],
  );
  return <div ref={host} data-dissolve="" aria-hidden="true" className="pointer-events-none fixed inset-0 z-[9] overflow-hidden" />;
}
