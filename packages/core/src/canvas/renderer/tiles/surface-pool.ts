import type { ImageInfo, Surface } from '@open-pencil/canvaskit'

import type { SkiaRenderer } from '#core/canvas/renderer'

import { TILE_DEVICE_SIZE } from './geometry'

/**
 * An offscreen surface on the renderer's own backend, or null when it cannot make one, such as a
 * half-float surface on a WebGL context without float color buffers. CanvasKit returns null for
 * that since open-pencil/skia@1b658c75d3 and threw before, so a throw counts as null too.
 */
export function makeOffscreenSurface(renderer: SkiaRenderer, info: ImageInfo): Surface | null {
  try {
    return renderer.surface.makeSurface(info)
  } catch {
    return null
  }
}

/** A square surface `size` device pixels across, like the ones tiles render on. */
export function makeTileSurface(renderer: SkiaRenderer, size: number): Surface | null {
  return makeOffscreenSurface(renderer, {
    width: size,
    height: size,
    colorType: renderer.ck.ColorType.RGBA_8888,
    alphaType: renderer.ck.AlphaType.Premul,
    colorSpace: renderer.ck.ColorSpace.SRGB
  })
}

export class TileSurfacePool {
  private readonly available: Surface[] = []

  acquire(renderer: SkiaRenderer): Surface | null {
    return this.available.pop() ?? makeTileSurface(renderer, TILE_DEVICE_SIZE)
  }

  release(surface: Surface): void {
    this.available.push(surface)
  }

  clear(): void {
    for (const surface of this.available) surface.delete()
    this.available.length = 0
  }

  size(): number {
    return this.available.length
  }
}
