import type { ShaderPreset } from '@open-pencil/scene-graph'

import { createShaderRasterizer } from '#vue/canvas/surface/shader-rasterizer'

import type { ShaderEffect } from './catalog'

/** A preview's size in CSS pixels, as a picker row shows it. */
const PREVIEW_SIZE = { width: 48, height: 32 }
/** What a filter is previewed over: it changes what is beneath it, which shows best on edges. */
const PREVIEW_BASE = { type: 'Voronoi' }

const previews = new Map<string, Promise<string | null>>()
let rasterizer: ReturnType<typeof createShaderRasterizer> | undefined
let queue: Promise<unknown> = Promise.resolve()

function previewPreset(effect: ShaderEffect): ShaderPreset {
  return {
    components: effect.filter ? [PREVIEW_BASE, { type: effect.name }] : [{ type: effect.name }]
  }
}

/**
 * A small still of `effect` with its default props, as an object URL for an `<img>`; null where
 * shaders cannot be drawn. Previews are drawn one at a time, the first time each is asked for,
 * and kept for the session.
 */
export function shaderEffectPreview(effect: ShaderEffect): Promise<string | null> {
  const known = previews.get(effect.name)
  if (known) return known
  rasterizer ??= createShaderRasterizer()
  const active = rasterizer
  const ratio = window.devicePixelRatio || 1
  const drawn = queue.then(async () => {
    const bytes = await active?.render(previewPreset(effect), {
      width: PREVIEW_SIZE.width * ratio,
      height: PREVIEW_SIZE.height * ratio
    })
    return bytes
      ? URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'image/png' }))
      : null
  })
  // A preview that fails to draw leaves the rest of the queue to go on.
  queue = drawn.catch(() => null)
  const url = drawn.catch(() => null)
  previews.set(effect.name, url)
  return url
}
