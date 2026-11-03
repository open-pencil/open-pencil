import type { CanvasKit, RuntimeEffect, Shader } from 'canvaskit-wasm'

import {
  IMAGE_ADJUSTMENT_KEYS,
  type CurvePoint,
  type ImageAdjustments,
  type ImageLevels
} from '@lawha/scene-graph'

/** How many evenly spaced samples of the tone curve the shader interpolates between. */
export const CURVE_SAMPLES = 33

/**
 * Image adjustments as one SkSL pass over the image shader. Works on unpremultiplied colour, then
 * premultiplies again, so transparent edges keep their alpha. Order: exposure, brightness,
 * contrast, temperature and tint, shadows and highlights, saturation and vibrance, hue, levels,
 * tone curve, invert.
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
uniform float sharpen;
uniform float noise;
uniform float vignette;
uniform float invert;
uniform float levelBlack;
uniform float levelWhite;
uniform float levelGamma;
uniform float curveOn;
uniform float curve[${CURVE_SAMPLES}];
uniform float2 size;

half lookup(half v) {
  float x = clamp(float(v), 0.0, 1.0) * ${CURVE_SAMPLES - 1}.0;
  float result = curve[0];
  for (int i = 0; i < ${CURVE_SAMPLES - 1}; i++) {
    float t = x - float(i);
    if (t >= 0.0 && t <= 1.0) result = mix(curve[i], curve[i + 1], t);
  }
  return half(result);
}

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
  if (sharpen != 0.0) {
    // Unsharp mask against the four neighbours; negative values blur toward them instead.
    half4 n = image.eval(p + float2(1, 0)) + image.eval(p - float2(1, 0)) +
      image.eval(p + float2(0, 1)) + image.eval(p - float2(0, 1));
    half3 around = n.a > 0.0 ? n.rgb / n.a : rgb;
    rgb = clamp(rgb + (rgb - around) * sharpen * 2.0, 0.0, 1.0);
  }
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
  if (levelBlack != 0.0 || levelWhite != 1.0 || levelGamma != 1.0) {
    rgb = clamp((rgb - levelBlack) / max(levelWhite - levelBlack, 0.0001), 0.0, 1.0);
    rgb = pow(rgb, half3(1.0 / levelGamma));
  }
  if (vignette != 0.0 && size.x > 0.0 && size.y > 0.0) {
    float2 uv = p / size - 0.5;
    float fall = smoothstep(0.2, 0.75, length(uv) * 1.2);
    rgb = vignette > 0.0 ? rgb * (1.0 - fall * vignette) : mix(rgb, half3(1.0), fall * -vignette);
  }
  if (noise > 0.0) {
    float grain = fract(sin(dot(floor(p), float2(12.9898, 78.233))) * 43758.5453) - 0.5;
    rgb += grain * noise * 0.4;
  }
  if (curveOn > 0.5) rgb = half3(lookup(rgb.r), lookup(rgb.g), lookup(rgb.b));
  if (invert > 0.5) rgb = 1.0 - rgb;
  rgb = clamp(rgb, 0.0, 1.0);
  return half4(rgb * c.a, c.a);
}
`

/** The adjustments without anything that has no effect: zeros, identity levels or curve. */
export function cleanAdjustments(adjust: ImageAdjustments): ImageAdjustments {
  const clean: ImageAdjustments = {}
  for (const key of IMAGE_ADJUSTMENT_KEYS) if (adjust[key]) clean[key] = adjust[key]
  if (adjust.invert) clean.invert = true
  if (!isIdentityLevels(adjust.levels)) clean.levels = adjust.levels
  if (!isIdentityCurve(adjust.curve)) clean.curve = adjust.curve
  return clean
}

/** Whether an adjustments value changes anything; an all-zero one is skipped entirely. */
export function hasAdjustments(adjust: ImageAdjustments | undefined): adjust is ImageAdjustments {
  if (!adjust) return false
  return (
    !!adjust.invert ||
    IMAGE_ADJUSTMENT_KEYS.some((key) => (adjust[key] ?? 0) !== 0) ||
    !isIdentityLevels(adjust.levels) ||
    !isIdentityCurve(adjust.curve)
  )
}

export function isIdentityLevels(levels: ImageLevels | undefined): boolean {
  return !levels || (levels.black === 0 && levels.white === 1 && levels.gamma === 1)
}

export function isIdentityCurve(curve: CurvePoint[] | undefined): boolean {
  return !curve || curve.every((p) => Math.abs(p.x - p.y) < 1e-6)
}

/**
 * The curve as {@link CURVE_SAMPLES} values at x = 0…1, through every point with a monotone
 * cubic (Fritsch–Carlson), so it never overshoots between points. Flat outside the first and
 * last point, like Photoshop and Affinity.
 */
export function sampleCurve(curve: CurvePoint[]): number[] {
  const pts = [...curve]
    .map((p) => ({ x: clamp01(p.x), y: clamp01(p.y) }))
    .sort((a, b) => a.x - b.x)
    .filter((p, i, all) => i === 0 || p.x - all[i - 1].x > 1e-6)
  const out: number[] = []
  if (pts.length === 0) {
    for (let i = 0; i < CURVE_SAMPLES; i++) out.push(i / (CURVE_SAMPLES - 1))
    return out
  }
  const n = pts.length
  const slopes: number[] = []
  for (let i = 0; i < n - 1; i++) slopes.push((pts[i + 1].y - pts[i].y) / (pts[i + 1].x - pts[i].x))
  const tangents = pts.map((_, i) => {
    if (n === 1) return 0
    if (i === 0) return slopes[0]
    if (i === n - 1) return slopes[n - 2]
    const a = slopes[i - 1]
    const b = slopes[i]
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b)
  })
  for (let s = 0; s < CURVE_SAMPLES; s++) {
    const x = s / (CURVE_SAMPLES - 1)
    out.push(clamp01(evalSegment(pts, tangents, x)))
  }
  return out
}

function evalSegment(pts: CurvePoint[], tangents: number[], x: number): number {
  const n = pts.length
  if (x <= pts[0].x) return pts[0].y
  if (x >= pts[n - 1].x) return pts[n - 1].y
  let i = 0
  while (x > pts[i + 1].x) i++
  const h = pts[i + 1].x - pts[i].x
  const t = (x - pts[i].x) / h
  const t2 = t * t
  const t3 = t2 * t
  return (
    (2 * t3 - 3 * t2 + 1) * pts[i].y +
    (t3 - 2 * t2 + t) * h * tangents[i] +
    (-2 * t3 + 3 * t2) * pts[i + 1].y +
    (t3 - t2) * h * tangents[i + 1]
  )
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

const clampUnit = (value: number | undefined) => Math.max(-1, Math.min(1, value ?? 0))

/** The shader's uniforms, in the order they are declared. */
export function adjustmentUniforms(
  adjust: ImageAdjustments,
  size: { width: number; height: number } = { width: 0, height: 0 }
): number[] {
  const levels = adjust.levels ?? { black: 0, white: 1, gamma: 1 }
  const curveOn = !isIdentityCurve(adjust.curve)
  return [
    ...IMAGE_ADJUSTMENT_KEYS.map((key) => clampUnit(adjust[key])),
    adjust.invert ? 1 : 0,
    clamp01(levels.black),
    clamp01(levels.white),
    Math.max(0.1, Math.min(10, levels.gamma)),
    curveOn ? 1 : 0,
    ...(curveOn && adjust.curve ? sampleCurve(adjust.curve) : sampleCurve([])),
    size.width,
    size.height
  ]
}

/** `image` with `adjust` applied; the caller owns and deletes the returned shader. */
export function adjustedImageShader(
  effect: RuntimeEffect,
  image: Shader,
  adjust: ImageAdjustments,
  size?: { width: number; height: number }
): Shader {
  return effect.makeShaderWithChildren(adjustmentUniforms(adjust, size), [image])
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
  const adjusted = adjustedImageShader(effect, source, adjust, {
    width: image.width(),
    height: image.height()
  })
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
