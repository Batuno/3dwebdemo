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
import { ToneMappingMode } from 'postprocessing';
import type { Quality } from '../../store/useAppStore';

// AgX keeps highlights soft like an architectural render; the grade is warm and slightly muted.
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
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {(quality === 'high' || close) && (
        <N8AO
          aoRadius={close ? 0.8 : quality === 'high' ? 2.6 : 2.0}
          distanceFalloff={close ? 0.7 : 1.2}
          intensity={close ? 3.4 : quality === 'high' ? 2.6 : 2.0}
          // AO is the costliest pass by far: medium keeps it for the rooms, where contact shadows matter, at half the samples of N8AO's lowest preset.
          {...(quality === 'high' ? { quality: 'medium' as const } : { aoSamples: 8, denoiseSamples: 2, denoiseRadius: 8 })}
          color="#141210"
        />
      )}
      <Bloom
        mipmapBlur
        intensity={quality === 'high' ? 0.3 : 0.2}
        luminanceThreshold={1.05}
        luminanceSmoothing={0.3}
      />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <HueSaturation hue={0.01} saturation={0.09} />
      <BrightnessContrast brightness={0.035} contrast={0.11} />
      <SMAA />
      <Vignette eskil={false} offset={0.28} darkness={0.42} />
    </EffectComposer>
  );
}
