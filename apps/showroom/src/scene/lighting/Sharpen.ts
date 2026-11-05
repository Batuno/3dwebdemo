// Contrast-adaptive sharpening, after AMD's FidelityFX CAS: each pixel is pushed away from its four
// neighbours by an amount that falls as local contrast rises. Soft detail (facade joints, window frames,
// floor grain) gets crisper, while edges that are already hard are left alone, so it adds no halos and
// doesn't turn flat areas grainy. Runs on the tone-mapped image, after anti-aliasing.
import { Uniform } from 'three';
import { BlendFunction, Effect, EffectAttribute } from 'postprocessing';
import { wrapEffect } from '@react-three/postprocessing';

const fragmentShader = /* glsl */ `
uniform float sharpness;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  vec3 n = texture2D(inputBuffer, uv + vec2(0.0, texelSize.y)).rgb;
  vec3 s = texture2D(inputBuffer, uv - vec2(0.0, texelSize.y)).rgb;
  vec3 e = texture2D(inputBuffer, uv + vec2(texelSize.x, 0.0)).rgb;
  vec3 w = texture2D(inputBuffer, uv - vec2(texelSize.x, 0.0)).rgb;

  vec3 lo = min(c, min(min(n, s), min(e, w)));
  vec3 hi = max(c, max(max(n, s), max(e, w)));
  // How much room there is before clipping, relative to the local peak: high in soft areas, low at hard edges.
  vec3 amount = sqrt(clamp(min(lo, 1.0 - hi) / max(hi, 1e-4), 0.0, 1.0));
  // Negative neighbour weight: -1/8 is gentle, -1/5 the strongest CAS allows.
  vec3 weight = amount * (-1.0 / mix(8.0, 5.0, sharpness));
  vec3 sharp = (c + (n + s + e + w) * weight) / (1.0 + 4.0 * weight);
  outputColor = vec4(clamp(sharp, 0.0, 1.0), inputColor.a);
}
`;

export class SharpenEffect extends Effect {
  constructor({ sharpness = 0.5 }: { sharpness?: number } = {}) {
    super('SharpenEffect', fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      // Reads neighbouring pixels, so it needs a pass of its own after the anti-aliasing.
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([['sharpness', new Uniform(sharpness)]]),
    });
  }

  get sharpness(): number {
    return (this.uniforms.get('sharpness') as Uniform<number>).value;
  }

  set sharpness(v: number) {
    (this.uniforms.get('sharpness') as Uniform<number>).value = v;
  }
}

/** For the effect composer. The strength is fixed per tier: changing it would rebuild the effect. */
export const Sharpen = wrapEffect(SharpenEffect);
