import type { Canvas, Image, Paint, Shader } from '@open-pencil/canvaskit'
import type { SceneNode } from '@open-pencil/scene-graph'

import { ResourceCache } from '#core/cache/resource'
import type { SkiaRenderer } from '#core/canvas/renderer'
import { compiledProgram } from '#core/canvas/renderer/shaders'
import { makeOffscreenSurface } from '#core/canvas/renderer/tiles/surface-pool'

import { GLASS_GEOMETRY_MAP, type GlassOutline, glassGeometryUniforms } from './shader'

/** How far past the layer's box the map reaches, in layer units, so edge pixels interpolate. */
const MAP_MARGIN = 2

/** The longest side a map may have, in pixels; a layer that would need more gets a coarser one. */
const MAX_MAP_SIDE = 2048

/** Maps kept between frames: one per glass layer and zoom step, a few spare. */
const MAX_CACHED_MAPS = 32

/** A geometry map both glass shaders read, and where it lies in the layer. */
export interface GlassGeometryMap {
  image: Image
  shader: Shader
  /** The layer point the map's top-left corner lies at. */
  origin: [number, number]
  /** Map pixels per layer unit. */
  scale: number
}

export type GlassMapCache = ResourceCache<string, GlassGeometryMap>

export function createGlassMapCache(): GlassMapCache {
  return new ResourceCache({
    maxEntries: MAX_CACHED_MAPS,
    dispose: (map) => {
      map.shader.delete()
      map.image.delete()
    }
  })
}

/** A hash of the outline's segment floats, so a cache lookup builds no string of them. */
function segmentsHash(segments: Float32Array): string {
  const words = new Uint32Array(segments.buffer, segments.byteOffset, segments.length)
  // FNV-1a over each float's bits.
  let hash = 0x811c9dc5
  for (const word of words) hash = Math.imul(hash ^ word, 0x01000193)
  return `${segments.length}:${(hash >>> 0).toString(36)}`
}

/** How many device pixels a layer unit spans under the canvas's transform. */
function deviceScale(canvas: Canvas): number {
  const m = canvas.getTotalMatrix()
  return Math.max(Math.hypot(m[0], m[3]), Math.hypot(m[1], m[4]))
}

/**
 * The map of where each point of a non-box outline sits against it, drawn once per outline and
 * zoom step at the device's resolution or finer, so the glass shaders read it instead of walking
 * the outline at every pixel. Null for a box, which the shaders compute exactly, and when this
 * canvas cannot draw a half-float image; the shaders then walk the outline themselves.
 */
export function glassGeometryMap(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  outline: GlassOutline,
  depth: number
): GlassGeometryMap | null {
  if (outline.isBox) return null
  const width = node.width + 2 * MAP_MARGIN
  const height = node.height + 2 * MAP_MARGIN
  // A power of two at or above the device scale, so a zoom keeps its map until the next step.
  const step = 2 ** Math.ceil(Math.log2(Math.max(deviceScale(canvas), 1 / 64)))
  const scale = Math.min(step, MAX_MAP_SIDE / Math.max(width, height))
  const key = `${node.id}:${node.width}x${node.height}:${depth}:${scale}:${segmentsHash(outline.segments)}`
  const cached = r.glassMaps.get(key)
  if (cached) return cached
  // Compiling may fail; nothing is made before it has.
  const program = compiledProgram(r.ck, r.shaders, GLASS_GEOMETRY_MAP)
  const target = r.surface.imageInfo()
  const surface = makeOffscreenSurface(r, {
    width: Math.ceil(width * scale),
    height: Math.ceil(height * scale),
    colorType: r.ck.ColorType.RGBA_F16,
    alphaType: r.ck.AlphaType.Premul,
    // The canvas's own space, so nothing converts the values on the way in or out.
    colorSpace: target.colorSpace
  })
  if (!surface) return null
  const origin: [number, number] = [-MAP_MARGIN, -MAP_MARGIN]
  let fill: Shader | null = null
  let paint: Paint | null = null
  let image: Image | null = null
  try {
    fill = program.effect.makeShader(
      program.uniforms({
        ...glassGeometryUniforms(outline, depth),
        mapOrigin: origin,
        mapScale: scale
      })
    )
    paint = new r.ck.Paint()
    paint.setShader(fill)
    paint.setBlendMode(r.ck.BlendMode.Src)
    surface.getCanvas().drawPaint(paint)
    surface.flush()
    image = surface.makeImageSnapshot()
    const shader = image.makeShaderOptions(
      r.ck.TileMode.Clamp,
      r.ck.TileMode.Clamp,
      r.ck.FilterMode.Linear,
      r.ck.MipmapMode.None
    )
    const map: GlassGeometryMap = { image, shader, origin, scale }
    r.glassMaps.set(key, map)
    // The cache owns the image now.
    image = null
    return map
  } finally {
    image?.delete()
    paint?.delete()
    fill?.delete()
    surface.delete()
  }
}
