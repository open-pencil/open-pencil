import type { CanvasKit, RuntimeEffect, Shader } from 'canvaskit-wasm'

import { IMAGE_ADJUSTMENT_KEYS, type ImageAdjustments } from '@lawha/scene-graph'

/**
 * Image adjustments as one SkSL pass over the image shader. Works on unpremultiplied colour, then
 * premultiplies again, so transparent edges keep their alpha. Order: exposure, brightness,
 * contrast, temperature and tint, shadows and highlights, saturation and vibrance, hue, invert.
 */
export const IMAGE_ADJUST_SKSL = `
uniform shader image;
uniform float exposure;
uniform float contrast;
uniform float brightness;
uniform float saturation;
uniform float vibrance;
uniform float temperature;
uniform float tint;
uniform float highlights;
uniform float shadows;
uniform float hue;
uniform float invert;

half3 hueRotate(half3 c, float turn) {
  // Rotation about the grey axis in YIQ.
  float a = turn * 3.14159265;
  float s = sin(a);
  float k = cos(a);
  half3 yiq = half3(
    dot(c, half3(0.299, 0.587, 0.114)),
    dot(c, half3(0.596, -0.274, -0.322)),
    dot(c, half3(0.211, -0.523, 0.312)));
  half2 iq = half2(yiq.y * k - yiq.z * s, yiq.y * s + yiq.z * k);
  return half3(
    yiq.x + 0.956 * iq.x + 0.621 * iq.y,
    yiq.x - 0.272 * iq.x - 0.647 * iq.y,
    yiq.x - 1.106 * iq.x + 1.703 * iq.y);
}

half4 main(float2 p) {
  half4 c = image.eval(p);
  if (c.a <= 0.0) return c;
  half3 rgb = c.rgb / c.a;
  rgb *= exp2(exposure * 2.0);
  rgb += brightness * 0.25;
  rgb = (rgb - 0.5) * (1.0 + contrast) + 0.5;
  rgb += half3(temperature * 0.12, -tint * 0.12, -temperature * 0.12);
  rgb.rb += tint * 0.06;
  half lum = dot(rgb, half3(0.2126, 0.7152, 0.0722));
  half low = 1.0 - smoothstep(0.0, 0.6, lum);
  half high = smoothstep(0.4, 1.0, lum);
  rgb += shadows * 0.35 * low + highlights * 0.35 * high;
  lum = dot(rgb, half3(0.2126, 0.7152, 0.0722));
  rgb = mix(half3(lum), rgb, 1.0 + saturation);
  half spread = max(rgb.r, max(rgb.g, rgb.b)) - min(rgb.r, min(rgb.g, rgb.b));
  rgb = mix(half3(lum), rgb, 1.0 + vibrance * (1.0 - clamp(spread, 0.0, 1.0)));
  if (hue != 0.0) rgb = hueRotate(rgb, hue);
  if (invert > 0.5) rgb = 1.0 - rgb;
  rgb = clamp(rgb, 0.0, 1.0);
  return half4(rgb * c.a, c.a);
}
`

/** Whether an adjustments value changes anything; an all-zero one is skipped entirely. */
export function hasAdjustments(adjust: ImageAdjustments | undefined): adjust is ImageAdjustments {
  if (!adjust) return false
  return !!adjust.invert || IMAGE_ADJUSTMENT_KEYS.some((key) => (adjust[key] ?? 0) !== 0)
}

const clampUnit = (value: number | undefined) => Math.max(-1, Math.min(1, value ?? 0))

/** The shader's uniforms, in the order they are declared. */
export function adjustmentUniforms(adjust: ImageAdjustments): number[] {
  return [...IMAGE_ADJUSTMENT_KEYS.map((key) => clampUnit(adjust[key])), adjust.invert ? 1 : 0]
}

/** `image` with `adjust` applied; the caller owns and deletes the returned shader. */
export function adjustedImageShader(
  effect: RuntimeEffect,
  image: Shader,
  adjust: ImageAdjustments
): Shader {
  return effect.makeShaderWithChildren(adjustmentUniforms(adjust), [image])
}

/**
 * Bakes adjustments into a copy of an image, for formats that embed image files (SVG, and PDF,
 * which draws from SVG), so they match the canvas. Returns PNG bytes, or null when the image
 * cannot be decoded. The caller owns `effect`.
 */
export function bakeAdjustedImage(
  ck: CanvasKit,
  effect: RuntimeEffect,
  bytes: Uint8Array,
  adjust: ImageAdjustments
): Uint8Array | null {
  const image = ck.MakeImageFromEncoded(bytes)
  if (!image) return null
  const surface = ck.MakeSurface(image.width(), image.height())
  if (!surface) {
    image.delete()
    return null
  }
  const source = image.makeShaderOptions(
    ck.TileMode.Clamp,
    ck.TileMode.Clamp,
    ck.FilterMode.Nearest,
    ck.MipmapMode.None
  )
  const adjusted = adjustedImageShader(effect, source, adjust)
  const paint = new ck.Paint()
  try {
    paint.setShader(adjusted)
    const canvas = surface.getCanvas()
    canvas.clear(ck.TRANSPARENT)
    canvas.drawRect(ck.XYWHRect(0, 0, image.width(), image.height()), paint)
    surface.flush()
    const snapshot = surface.makeImageSnapshot()
    const png = snapshot.encodeToBytes(ck.ImageFormat.PNG, 100)
    snapshot.delete()
    return png
  } finally {
    paint.delete()
    adjusted.delete()
    source.delete()
    surface.delete()
    image.delete()
  }
}

/** A baker bound to one CanvasKit, compiling the shader once; call `release` when done. */
export function imageAdjustBaker(ck: CanvasKit): {
  bake: (bytes: Uint8Array, adjust: ImageAdjustments) => Uint8Array | null
  release: () => void
} {
  let effect: RuntimeEffect | null = null
  return {
    bake: (bytes, adjust) => {
      effect ??= ck.RuntimeEffect.Make(IMAGE_ADJUST_SKSL)
      return effect ? bakeAdjustedImage(ck, effect, bytes, adjust) : null
    },
    release: () => {
      effect?.delete()
      effect = null
    }
  }
}
