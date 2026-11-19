import type { Canvas, Surface } from '@open-pencil/canvaskit'
import type { DocumentColorSpace } from '@open-pencil/scene-graph'

import { skColorSpace } from '#core/canvas/renderer/colors'
import type { SkiaRenderer } from '#core/canvas/renderer/skia'
import { makeOffscreenSurface } from '#core/canvas/renderer/tiles/surface-pool'

/** A surface in the document's color space, the size of the screen surface it is shown on. */
export interface DocumentSurface {
  surface: Surface
  width: number
  height: number
  space: DocumentColorSpace
}

/**
 * Where the scene is drawn this frame: the screen surface when it is in the document's color space,
 * or a surface in the document's space the size of the screen's, which {@link presentDocumentSurface}
 * then draws onto the screen. Skia blends in the space of the surface it draws on, so a P3 document
 * on an sRGB screen blends in P3, as Figma blends it, and is converted only to be shown. Null when
 * the screen surface serves, or when no such surface can be made.
 */
export function documentSurfaceFor(r: SkiaRenderer): Surface | null {
  const space = r.documentColorSpace
  if (space === r.presentationColorSpace) {
    releaseDocumentSurface(r)
    return null
  }
  const width = r.surface.width()
  const height = r.surface.height()
  const kept = r.documentSurface
  if (kept?.space === space && kept.width === width && kept.height === height) return kept.surface
  releaseDocumentSurface(r)
  const surface = makeOffscreenSurface(r, {
    width,
    height,
    colorType: r.ck.ColorType.RGBA_8888,
    alphaType: r.ck.AlphaType.Premul,
    colorSpace: skColorSpace(r.ck, space)
  })
  if (!surface) return null
  r.documentSurface = { surface, width, height, space }
  return surface
}

/** Draws what the document surface holds onto the screen, converted into the screen's space. */
export function presentDocumentSurface(screen: Canvas, surface: Surface): void {
  const image = surface.makeImageSnapshot()
  try {
    screen.drawImage(image, 0, 0)
  } finally {
    image.delete()
  }
}

export function releaseDocumentSurface(r: Pick<SkiaRenderer, 'documentSurface'>): void {
  r.documentSurface?.surface.dispose()
  r.documentSurface = null
}
