// Cross-dissolves between standing points. Just before the view changes, the frame on screen is frozen into a
// still; the camera then jumps, and the still fades out over the new view, the way a walk-through tour moves
// from spot to spot. A WebGL canvas can't be read back once its frame is on screen, so the still is taken
// inside the frame, right after the effect composer draws it (see FrameGrab).

type Done = (still: HTMLCanvasElement | null) => void;

let request: ((done: Done) => void) | null = null;
let pending: { still: HTMLCanvasElement; at: number } | null = null;
const viewers = new Set<(still: HTMLCanvasElement) => void>();

/** A navigation waits at most this long for its still, so a busy device never holds the viewer back. */
const WAIT_MS = 200;
/** A still older than this belongs to some other move and is dropped. */
const FRESH_MS = 1000;

/** Set by FrameGrab while the effect composer runs; null while plain rendering (panoramas) is on. */
export function setFrameGrabber(r: ((done: Done) => void) | null): void {
  request = r;
}

/** Freezes the current frame, then applies the change. Without a grabber, or with the tab hidden, applies it now. */
export function withFrozenFrame(apply: () => void): void {
  if (!request || document.hidden) {
    apply();
    return;
  }
  let done = false;
  const finish: Done = (still) => {
    if (done) return;
    done = true;
    pending = still ? { still, at: performance.now() } : null;
    apply();
  };
  request(finish);
  setTimeout(() => finish(null), WAIT_MS);
}

/** The still frozen for the move under way, once. */
export function takeFrozenFrame(): HTMLCanvasElement | null {
  const p = pending;
  pending = null;
  return p && performance.now() - p.at < FRESH_MS ? p.still : null;
}

/** Hands the still to the overlay that fades it out. False when no overlay is mounted. */
export function playDissolve(still: HTMLCanvasElement): boolean {
  viewers.forEach((v) => v(still));
  return viewers.size > 0;
}

export function onDissolve(v: (still: HTMLCanvasElement) => void): () => void {
  viewers.add(v);
  return () => {
    viewers.delete(v);
  };
}
