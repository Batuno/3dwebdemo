import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import {
  Bloom,
  BrightnessContrast,
  EffectComposer,
  HueSaturation,
  N8AO,
  SMAA,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing';
import { ToneMappingMode, type BloomEffect } from 'postprocessing';
import type { Quality } from '../../store/useAppStore';
import { sceneUniforms } from '../shared';
import { Sharpen } from './Sharpen';
import { compileOffscreen, whenIdle } from '../warmup';

/** The parts of n8ao's pass this file drives (the package ships no types). */
interface AoPass {
  enabled: boolean;
  configuration: { intensity: number; aoRadius: number; distanceFalloff: number };
}

const reduceMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Ambient occlusion per tier, inside a flat (close) and over the site. */
const AO = {
  high: { close: { radius: 0.8, falloff: 0.7, intensity: 3.4 }, far: { radius: 2.6, falloff: 1.2, intensity: 2.6 } },
  // Medium keeps AO for the rooms only, where contact shadows matter.
  medium: { close: { radius: 0.8, falloff: 0.7, intensity: 3.4 }, far: { radius: 0.8, falloff: 0.7, intensity: 0 } },
} as const;

const BLOOM = { high: 0.3, medium: 0.2 } as const;
/** The full-screen passes inside n8ao's pass, each with its own shader (the compositer has two spellings across versions). */
const AO_QUADS = ['copyQuad', 'depthCopyPass', 'accumulationQuad', 'depthDownsampleQuad', 'effectShaderQuad', 'poissonBlurQuad', 'effectCompositerQuad', 'effectCompisterQuad'];
/**
 * Final sharpening per tier. Medium renders below the screen's resolution on sharp screens, so it gets a
 * little more; phones have no anti-aliasing to soften edges first, so a little less.
 */
const SHARPEN = { high: 0.45, medium: 0.6, low: 0.4 } as const;
/** Extra bloom after dark, so lit windows and lamps glow a little more. */
const NIGHT_BLOOM = 0.1;

// Khronos PBR Neutral tone mapping keeps materials their real colour and only rolls off the brightest
// highlights, so the facade palette reads as specified; AgX greyed every colour and needed a grade to undo it.
// The effect list never changes within a tier: adding or removing an effect rebuilds and recompiles
// the whole composer, so values move through refs instead of props.
export function PostFx({ quality, close }: { quality: Quality; close: boolean }) {
  if (quality === 'low') {
    // Kept as separate passes: merged into the tone mapping's pass, the sharpening would read its neighbours
    // from the image before tone mapping. On the full tier the anti-aliasing pass ahead of it splits them.
    return (
      <EffectComposer multisampling={0} enableNormalPass={false} mergeMode="none">
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        <BrightnessContrast contrast={0.04} />
        <Sharpen sharpness={SHARPEN.low} />
      </EffectComposer>
    );
  }
  return <FullFx quality={quality} close={close} />;
}

function FullFx({ quality, close }: { quality: 'high' | 'medium'; close: boolean }) {
  const ao = useRef<AoPass>(null);
  const bloom = useRef<BloomEffect>(null);
  const aoSet = AO[quality];
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  // Medium runs ambient occlusion only inside flats, so its six shaders used to compile on the first frames
  // of the glide into one. Compile them while the page is idle instead; already compiled, this costs nothing.
  useEffect(
    () =>
      whenIdle(() => {
        const pass = ao.current as unknown as Record<string, { _mesh?: THREE.Mesh } | undefined> | null;
        if (!pass) return;
        for (const key of AO_QUADS) {
          const mesh = pass[key]?._mesh;
          // Each quad is drawn on its own, outside any scene, so it compiles that way too: no lights, no shadows.
          if (mesh) void compileOffscreen(gl, mesh, camera, null).catch(() => {});
        }
      }, 6000),
    [gl, camera],
  );
  // Props stay as they were on mount; changing them would re-apply the whole AO configuration at once.
  const [start] = useState(() => (close ? aoSet.close : aoSet.far));
  useFrame((_, dt) => {
    const pass = ao.current;
    if (pass) {
      const want = close ? aoSet.close : aoSet.far;
      const c = pass.configuration;
      const k = reduceMotion ? 1 : 1 - Math.exp(-5 * dt);
      const next = (from: number, to: number) => (Math.abs(to - from) < 0.005 ? to : from + (to - from) * k);
      if (c.intensity !== want.intensity) c.intensity = next(c.intensity, want.intensity);
      if (c.aoRadius !== want.radius) c.aoRadius = next(c.aoRadius, want.radius);
      if (c.distanceFalloff !== want.falloff) c.distanceFalloff = next(c.distanceFalloff, want.falloff);
      // A pass at zero strength still costs a full frame of work, so it switches off instead.
      pass.enabled = c.intensity > 0.001;
    }
    if (bloom.current) bloom.current.intensity = BLOOM[quality] + NIGHT_BLOOM * sceneUniforms.uNight.value;
  });
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO
        ref={ao as never}
        enabled={start.intensity > 0}
        aoRadius={start.radius}
        distanceFalloff={start.falloff}
        intensity={start.intensity}
        // AO is the costliest pass by far: medium runs half the samples of N8AO's lowest preset. (Its halfRes
        // mode hands three 0.187 a render target it can't bind, so resolution stays full.) High is the Medium preset.
        {...(quality === 'high' ? { aoSamples: 16, denoiseSamples: 8, denoiseRadius: 12 } : { aoSamples: 8, denoiseSamples: 2, denoiseRadius: 8 })}
        color="#141210"
      />
      <Bloom ref={bloom as never} mipmapBlur intensity={BLOOM[quality]} luminanceThreshold={1.05} luminanceSmoothing={0.3} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <HueSaturation hue={0.01} saturation={0.02} />
      <BrightnessContrast contrast={0.06} />
      <SMAA />
      <Sharpen sharpness={SHARPEN[quality]} />
      <Vignette eskil={false} offset={0.28} darkness={0.42} />
    </EffectComposer>
  );
}
