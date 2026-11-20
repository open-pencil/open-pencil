import type { ImageInfo, Surface } from '@open-pencil/canvaskit'
import type { ColorProfile } from '@open-pencil/scene-graph'

import { skColorSpace } from '#core/canvas/renderer/colors'
import type { SkiaRenderer } from '#core/canvas/renderer/skia'

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

/**
 * A square surface `size` device pixels across, like the ones tiles render on, in the document's
 * color space, so the document's colors blend there as on the screen.
 */
export function makeTileSurface(renderer: SkiaRenderer, size: number): Surface | null {
  return makeOffscreenSurface(renderer, {
    width: size,
    height: size,
    colorType: renderer.ck.ColorType.RGBA_8888,
    alphaType: renderer.ck.AlphaType.Premul,
    colorSpace: skColorSpace(renderer.ck, renderer.documentColorSpace)
  })
}

export class TileSurfacePool {
  private readonly available: Surface[] = []
  private space: ColorProfile = 'srgb'

  acquire(renderer: SkiaRenderer): Surface | null {
    // Surfaces of another document color space would convert what tiles draw into it.
    if (renderer.documentColorSpace !== this.space) {
      this.clear()
      this.space = renderer.documentColorSpace
    }
    return this.available.pop() ?? makeTileSurface(renderer, TILE_DEVICE_SIZE)
  }

  release(surface: Surface): void {
    this.available.push(surface)
  }

  clear(): void {
    for (const surface of this.available) surface.dispose()
    this.available.length = 0
  }

  size(): number {
    return this.available.length
  }
}
