import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
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
/** Extra bloom after dark, so lit windows and lamps glow a little more. */
const NIGHT_BLOOM = 0.1;

// AgX keeps highlights soft like an architectural render; the grade is warm and slightly muted.
// The effect list never changes within a tier: adding or removing an effect rebuilds and recompiles
// the whole composer, so values move through refs instead of props.
export function PostFx({ quality, close }: { quality: Quality; close: boolean }) {
  if (quality === 'low') {
    return (
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <ToneMapping mode={ToneMappingMode.AGX} />
        <HueSaturation saturation={0.05} />
        <BrightnessContrast brightness={0.03} contrast={0.08} />
      </EffectComposer>
    );
  }
  return <FullFx quality={quality} close={close} />;
}

function FullFx({ quality, close }: { quality: 'high' | 'medium'; close: boolean }) {
  const ao = useRef<AoPass>(null);
  const bloom = useRef<BloomEffect>(null);
  const aoSet = AO[quality];
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
      <ToneMapping mode={ToneMappingMode.AGX} />
      <HueSaturation hue={0.01} saturation={0.09} />
      <BrightnessContrast brightness={0.035} contrast={0.11} />
      <SMAA />
      <Vignette eskil={false} offset={0.28} darkness={0.42} />
    </EffectComposer>
  );
}
