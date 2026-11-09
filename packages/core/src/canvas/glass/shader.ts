/**
 * Figma's Glass effect as two Skia runtime shaders over the backdrop, measured against Figma 126
 * exports. Both work in the layer's own units: `p` is a point in the layer, `s` its distance in
 * from the outline, and the direction points inward along the outline's normal.
 *
 * Refraction moves each sample inward by d(s). A box (any corner radius) uses Figma's exact
 * profile, refraction · D · (1 − (s − 1) / D)^3.5 with D = min(depth, half the shorter side),
 * pointing at the corner centre of a box rounded by max(radius, D). Other outlines use Figma's
 * smoother profile, refraction · D · (1 − 2(s + 0.5) / D)^1.4 blurred along s by σ 3.5. The
 * outermost layer pixel ramps the displacement up from a fifth, and pixels there are averaged
 * along the normal, as Figma's exports are. Dispersion moves red 10% further and blue 10% less per unit.
 *
 * Light follows the outline's own normal. It adds a white rim on the outermost pixel, brightest facing away from the light's axis and
 * fading with the angle to it, and a faint band that darkens the side facing the light and
 * lightens the other, fading in over 0.65 · D.
 */

import type { Effect, GlassEffectParams, SceneNode } from '@open-pencil/scene-graph'
import { UNSET_GLASS } from '@open-pencil/scene-graph/constants'
import { blurSigma } from '@open-pencil/scene-graph/geometry'

import { defineShader, sksl, type UniformValues } from '#core/canvas/sksl'

/** The most outline segments a non-box shape passes to the shaders. */
export const GLASS_MAX_SEGMENTS = 128

/** How many consecutive segments share one bounding circle, which lets a pixel skip them. */
const CHUNK = 8
const CHUNKS = GLASS_MAX_SEGMENTS / CHUNK

/** The outline both glass shaders read: a box, or segments grouped in bounding circles. */
const GEOMETRY_UNIFORMS = {
  origin: 'float2',
  size: 'float2',
  radii: 'float4',
  isBox: 'float',
  depth: 'float',
  segmentCount: 'float',
  segments: { type: 'float4', length: GLASS_MAX_SEGMENTS },
  chunks: { type: 'float4', length: CHUNKS }
} as const

const GEOMETRY = sksl`
  float boxDistance(float2 q, float2 h, float r) {
    float2 k = abs(q) - h + r;
    return length(max(k, 0.0)) + min(max(k.x, k.y), 0.0) - r;
  }

  // (distance in from the outline, inward direction), negative distance outside a box. A box's
  // direction bends around corners rounded by at least bend.
  float3 geometry(float2 p, float bend) {
    if (isBox > 0.5) {
      float2 h = size * 0.5;
      float2 q = p - origin - h;
      float r = q.x < 0.0 ? (q.y < 0.0 ? radii.x : radii.w) : (q.y < 0.0 ? radii.y : radii.z);
      float s = -boxDistance(q, h, r);
      float b = min(max(r, bend), min(h.x, h.y));
      float2 k = abs(q) - (h - b);
      float2 sq = float2(q.x < 0.0 ? -1.0 : 1.0, q.y < 0.0 ? -1.0 : 1.0);
      float2 dir = (k.x > 0.0 && k.y > 0.0)
        ? -normalize(k) * sq
        : (k.x > k.y ? float2(-sq.x, 0.0) : float2(0.0, -sq.y));
      return float3(s, dir);
    }
    // Each chunk of segments lies in a circle (centre, radius). Beyond depth + 8 nothing refracts
    // or lights, so a pixel that far from every circle skips the outline, and otherwise it walks
    // only the chunks that may hold the nearest segment.
    float nearest = 1e9;
    float farthest = 1e9;
    for (int c = 0; c < ${CHUNKS}; c++) {
      if (chunks[c].z < 0.0) break;
      float centre = length(p - chunks[c].xy);
      nearest = min(nearest, centre - chunks[c].z);
      farthest = min(farthest, centre + chunks[c].z);
    }
    if (nearest >= depth + 8.0) return float3(nearest, 0.0, 0.0);
    float best = 1e9;
    float2 closest = p;
    for (int c = 0; c < ${CHUNKS}; c++) {
      if (chunks[c].z < 0.0) break;
      if (length(p - chunks[c].xy) - chunks[c].z <= farthest) {
        for (int k = 0; k < ${CHUNK}; k++) {
          if (float(c * ${CHUNK} + k) >= segmentCount) break;
          float2 a = segments[c * ${CHUNK} + k].xy;
          float2 b = segments[c * ${CHUNK} + k].zw;
          float2 ab = b - a;
          float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
          float2 point = a + ab * t;
          float dist = length(p - point);
          if (dist < best) { best = dist; closest = point; }
        }
      }
    }
    float2 away = p - closest;
    float len = length(away);
    return float3(best, len > 1e-4 ? away / len : float2(0.0));
  }
`

export const GLASS_REFRACTION = defineShader('glass refraction', {
  uniforms: { ...GEOMETRY_UNIFORMS, refraction: 'float', dispersion: 'float' },
  children: ['backdrop'],
  body: [
    GEOMETRY,
    sksl`
      float edgeRamp(float s) { return max(0.19, clamp(1.12 * (s - 0.12), 0.0, 1.0)); }

      float roundedProfile(float s) {
        float u = max(0.0, 1.0 - 2.0 * (abs(s) + 0.5) / depth);
        return depth * pow(u, 1.4);
      }

      float displacement(float s) {
        if (isBox > 0.5) {
          float t = clamp(1.0 - (s - 1.0) / depth, 0.0, 1.0);
          return depth * pow(t, 3.5) * edgeRamp(s);
        }
        float sum = 0.0;
        float weights = 0.0;
        for (int k = -4; k <= 4; k++) {
          float t = float(k) * 1.75;
          float w = exp(-t * t / 24.5);
          sum += w * roundedProfile(s + t);
          weights += w;
        }
        return sum / weights * edgeRamp(s);
      }

      half4 refracted(float2 p, float2 dir, float d) {
        if (dispersion <= 0.0) return backdrop.eval(p + d * dir);
        half4 red = backdrop.eval(p + d * (1.0 + 0.1 * dispersion) * dir);
        half4 green = backdrop.eval(p + d * dir);
        half4 blue = backdrop.eval(p + d * (1.0 - 0.1 * dispersion) * dir);
        return half4(red.r, green.g, blue.b, green.a);
      }

      // Near the outline the displacement ramps steeply, so a pixel there averages eight points
      // spread over half a layer pixel along the normal: one device pixel at 2×, which is how
      // exports and high-density screens draw. Points outside the outline are left to the clip's
      // antialiasing.
      half4 main(float2 p) {
        float3 g = geometry(p, depth);
        float2 dir = g.yz;
        if (g.x >= 1.5) return refracted(p, dir, refraction * displacement(g.x));
        half4 sum = half4(0.0);
        float count = 0.0;
        for (int i = 0; i < 8; i++) {
          float t = (float(i) + 0.5) / 16.0 - 0.25;
          float s = g.x + t;
          if (s < 0.0) continue;
          sum += refracted(p + t * dir, dir, refraction * displacement(s));
          count += 1.0;
        }
        return count > 0.0 ? sum / count : refracted(p, dir, refraction * displacement(g.x));
      }
    `
  ]
})

export const GLASS_LIGHT = defineShader('glass light', {
  uniforms: { ...GEOMETRY_UNIFORMS, axis: 'float2', intensity: 'float' },
  children: ['backdrop'],
  body: [
    GEOMETRY,
    sksl`
      float light(float3 g) {
        float facing = dot(-g.yz, axis);
        float spread = clamp(2.2 * (abs(facing) - 0.44), 0.0, 1.0);
        float rim = intensity * (facing < 0.0 ? 1.08 : 0.71) * spread * max(0.0, 1.0 - g.x);
        float band = 12.0 / 255.0 * intensity * facing * max(0.0, 1.0 - g.x / (0.65 * depth));
        return rim + band;
      }

      half4 main(float2 p) {
        half4 color = backdrop.eval(p);
        float3 g = geometry(p, 0.0);
        if (g.x >= 1.5) return half4(clamp(color.rgb + light(g) * color.a, 0.0, color.a), color.a);
        half3 sum = half3(0.0);
        float count = 0.0;
        for (int i = 0; i < 8; i++) {
          float s = g.x + (float(i) + 0.5) / 16.0 - 0.25;
          if (s < 0.0) continue;
          sum += clamp(color.rgb + light(float3(s, g.yz)) * color.a, 0.0, color.a);
          count += 1.0;
        }
        return half4(count > 0.0 ? sum / count : color.rgb, color.a);
      }
    `
  ]
})

/** Where a glass layer's outline sits, in the layer's units: a box or flattened segments. */
export interface GlassOutline {
  origin: [number, number]
  size: [number, number]
  /** Top-left, top-right, bottom-right, bottom-left corner radii of a box. */
  radii: [number, number, number, number]
  isBox: boolean
  /** Segment end points `x0, y0, x1, y1` of a non-box outline, at most `GLASS_MAX_SEGMENTS`. */
  segments: Float32Array
}

/** The uniforms both glass shaders open with. */
export function glassGeometryUniforms(
  outline: GlassOutline,
  depth: number
): UniformValues<typeof GEOMETRY_UNIFORMS> {
  const segments = new Float32Array(GLASS_MAX_SEGMENTS * 4)
  segments.set(outline.segments.subarray(0, segments.length))
  return {
    origin: outline.origin,
    size: outline.size,
    radii: outline.radii,
    isBox: outline.isBox ? 1 : 0,
    depth,
    segmentCount: Math.min(GLASS_MAX_SEGMENTS, outline.segments.length / 4),
    segments,
    chunks: chunkCircles(outline.segments)
  }
}

/**
 * A circle around each chunk of `CHUNK` segments, as centre and radius; a negative radius ends
 * the list.
 */
function chunkCircles(segments: Float32Array): number[] {
  const circles: number[] = []
  for (let chunk = 0; chunk < CHUNKS; chunk++) {
    const start = chunk * CHUNK * 4
    const end = Math.min(segments.length, start + CHUNK * 4)
    if (start >= end) {
      circles.push(0, 0, -1, 0)
      continue
    }
    let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity]
    for (let i = start; i < end; i += 2) {
      minX = Math.min(minX, segments[i])
      maxX = Math.max(maxX, segments[i])
      minY = Math.min(minY, segments[i + 1])
      maxY = Math.max(maxY, segments[i + 1])
    }
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    let radius = 0
    for (let i = start; i < end; i += 2) {
      radius = Math.max(radius, Math.hypot(segments[i] - cx, segments[i + 1] - cy))
    }
    circles.push(cx, cy, radius, 0)
  }
  return circles
}

/** The light's axis for Figma's light angle: straight down at 0°, turning with the angle. */
export function glassLightAxis(lightAngle: number): [number, number] {
  const radians = (lightAngle * Math.PI) / 180
  return [-Math.sin(radians), Math.cos(radians)]
}

/** The refraction depth Figma uses: never more than half the layer's shorter side. */
export function glassDepth(depth: number, width: number, height: number): number {
  return Math.max(1e-3, Math.min(depth, Math.min(width, height) / 2))
}

export function glassParams(effect: Effect): GlassEffectParams {
  return effect.glass ?? UNSET_GLASS
}

/**
 * The low-pass Figma's glass always gives the backdrop, as a blur sigma in layer units: the one
 * that draws a Figma export of glass over sharp stripes most closely here.
 */
const BACKDROP_SIGMA = 0.6

/** The blur the refraction reads the backdrop through: the base low-pass and the frost. */
export function glassBackdropSigma(effect: Effect): number {
  return Math.hypot(BACKDROP_SIGMA, blurSigma(effect.radius))
}

/**
 * How far past a point the refraction reads, in layer units: the displacement with dispersion's
 * extra tenth, and the blur.
 */
export function glassSampleRadius(node: SceneNode, effect: Effect): number {
  const depth = glassDepth(glassParams(effect).depth, node.width, node.height)
  return depth * 1.1 + 3 * glassBackdropSigma(effect) + 1
}
