// Takes the stills for cross-dissolves (see dissolve). Its frame callback runs after the effect composer's
// (priority 1), while the drawing buffer still holds the finished frame. Any callback above priority 0 stops
// R3F's own rendering and leaves it to the composer, so this must only ever mount beside the composer.
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { setFrameGrabber } from './dissolve';

type Done = (still: HTMLCanvasElement | null) => void;

export function FrameGrab() {
  const gl = useThree((s) => s.gl);
  const queue = useRef<Done[]>([]);

  useEffect(() => {
    const waiting = queue.current;
    setFrameGrabber((done) => waiting.push(done));
    return () => {
      setFrameGrabber(null);
      // Anyone still waiting gets no still and moves on with a plain cut.
      waiting.splice(0).forEach((d) => d(null));
    };
  }, []);

  useFrame(() => {
    if (queue.current.length === 0) return;
    const src = gl.domElement;
    let still: HTMLCanvasElement | null = document.createElement('canvas');
    still.width = src.width;
    still.height = src.height;
    try {
      const ctx = still.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.drawImage(src, 0, 0);
    } catch {
      still = null;
    }
    queue.current.splice(0).forEach((d) => d(still));
  }, 2);

  return null;
}
