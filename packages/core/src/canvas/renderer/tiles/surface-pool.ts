import type { Surface } from 'canvaskit-wasm'

import type { SkiaRenderer } from '#core/canvas/renderer'

import { TILE_DEVICE_SIZE } from './geometry'

export class TileSurfacePool {
  private readonly available: Surface[] = []

  acquire(renderer: SkiaRenderer): Surface {
    return (
      this.available.pop() ??
      renderer.surface.makeSurface({
        width: TILE_DEVICE_SIZE,
        height: TILE_DEVICE_SIZE,
        colorType: renderer.ck.ColorType.RGBA_8888,
        alphaType: renderer.ck.AlphaType.Premul,
        colorSpace: renderer.ck.ColorSpace.SRGB
      })
    )
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
