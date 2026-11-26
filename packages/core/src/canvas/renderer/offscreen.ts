import type { CanvasKit } from '@open-pencil/canvaskit'

import { SkiaRenderer } from './skia'

/**
 * A renderer nothing presents: it draws into pictures and images of its own, so its surface is a
 * 1×1 software one. Its fonts are loaded and the caller destroys it. Null when CanvasKit cannot
 * make the surface.
 */
export async function createOffscreenRenderer(ck: CanvasKit): Promise<SkiaRenderer | null> {
  const surface = ck.MakeSurface(1, 1)
  if (!surface) return null
  const renderer = new SkiaRenderer(ck, surface)
  try {
    await renderer.loadFonts()
  } catch (error) {
    renderer.destroy()
    throw error
  }
  return renderer
}

/**
 * Runs `job` with an offscreen renderer and destroys the renderer once `job` settles. Null when
 * CanvasKit cannot make the renderer's surface.
 */
export async function withOffscreenRenderer<T>(
  ck: CanvasKit,
  job: (renderer: SkiaRenderer) => Promise<T>
): Promise<T | null> {
  const renderer = await createOffscreenRenderer(ck)
  if (!renderer) return null
  try {
    return await job(renderer)
  } finally {
    renderer.destroy()
  }
}
