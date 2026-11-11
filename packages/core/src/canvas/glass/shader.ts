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

import { defineShader, type Float2, type Float4 } from '#core/canvas/sksl'

import geometrySource from './geometry.sksl?raw'
import lightSource from './light.sksl?raw'
import mapSource from './map.sksl?raw'
import refractionSource from './refraction.sksl?raw'
import shapeSource from './shape.sksl?raw'

/**
 * The most outline segments a non-box shape passes to the shaders, and how many consecutive ones
 * share a bounding circle: `SEGMENTS` and `CHUNK` in `geometry.sksl`. Packing the uniforms throws
 * when the arrays built from these no longer match the arrays the shaders declare.
 */
export const GLASS_MAX_SEGMENTS = 128
const CHUNK = 8
const CHUNKS = GLASS_MAX_SEGMENTS / CHUNK

/** The outline both glass shaders read: a box, or segments grouped in bounding circles. */
interface GeometryUniforms {
  origin: Float2
  size: Float2
  radii: Float4
  isBox: number
  depth: number
  segmentCount: number
  segments: ArrayLike<number>
  chunks: ArrayLike<number>
}

/** Where the geometry map lies in the layer and how many map pixels a layer unit spans. */
export interface GeometryMapUniforms {
  mapOrigin: Float2
  mapScale: number
}

/** How both glass shaders find the outline: computed, or read from the geometry map. */
export type ShapeUniforms = GeometryUniforms & GeometryMapUniforms & { useMap: number }

export const GLASS_REFRACTION = defineShader<
  ShapeUniforms & { refraction: number; dispersion: number }
>('glass refraction', geometrySource, shapeSource, refractionSource)

export const GLASS_LIGHT = defineShader<ShapeUniforms & { axis: Float2; intensity: number }>(
  'glass light',
  geometrySource,
  shapeSource,
  lightSource
)

/** Draws geometry() into a map both glass shaders read, so neither walks the outline per pixel. */
export const GLASS_GEOMETRY_MAP = defineShader<GeometryUniforms & GeometryMapUniforms>(
  'glass geometry map',
  geometrySource,
  mapSource
)

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
export function glassGeometryUniforms(outline: GlassOutline, depth: number): GeometryUniforms {
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
