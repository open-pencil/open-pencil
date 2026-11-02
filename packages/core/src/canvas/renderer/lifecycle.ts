import { disposeNodeEditPaints } from '#core/canvas/node-edit-overlay'
import type { SkiaRenderer } from '#core/canvas/renderer'
import { fontManager } from '#core/text/font/manager'

import { releaseCompiledShaders } from './shaders'
import { clearNodePictures } from './state'

function disposePathCaches(r: SkiaRenderer): void {
  r.nodePaths.clear()
  r.textCaches.glyphSilhouettes.clear()
  r.textCaches.derivedGlyphPaths.clear()
  r.textCaches.emojiImages.clear()
}

/** Frees every live image `r`'s surface holds and forgets those an earlier surface held. */
export function releaseLiveImages(r: Pick<SkiaRenderer, 'images' | 'surface'>): void {
  for (const { image, surface } of r.images.live.values()) {
    if (surface === r.surface) image.delete()
  }
  r.images.live.clear()
}

function releaseFonts(r: SkiaRenderer): void {
  for (const font of Object.values(r.chromeFonts)) font?.delete()
  const fontProvider = r.fontProvider
  r.fontProvider = null
  r.fontsLoaded = false
  // Only its own provider: a renderer that never loaded fonts leaves the others' attached.
  if (fontProvider) {
    fontManager.detachProvider(fontProvider)
    fontProvider.delete()
  }
}

export function destroyRenderer(r: SkiaRenderer): void {
  if (r.destroyed) return
  r.destroyed = true
  r.transientPreviews.clear()

  r.images.onPreviewReady = null
  r.images.previews.destroy()
  r.images.cache.clear()
  releaseLiveImages(r)
  disposePathCaches(r)
  r.fillPaint.delete()
  releaseCompiledShaders(r.shaders)
  r.strokePaint.delete()
  r.selectionPaint.delete()
  r.snapPaint.delete()
  r.auxFill.delete()
  r.auxStroke.delete()
  r.opacityPaint.delete()
  releaseFonts(r)
  r.rulerBgPaint.delete()
  r.rulerTickPaint.delete()
  r.rulerTextPaint.delete()
  r.rulerHlPaint.delete()
  r.rulerBadgePaint.delete()
  r.rulerLabelPaint.delete()
  r.penPathPaint.delete()
  r.penLiveStrokePaint.delete()
  r.pencilStrokePaint.delete()
  r.penHandlePaint.delete()
  r.penVertexFill.delete()
  r.penVertexStroke.delete()
  r.effectLayerPaint.delete()
  r.imageFilterCache.clear()
  r.maskFilterCache.clear()
  r.dashEffects.clear()
  disposeNodeEditPaints(r.nodeEditPaints)
  clearNodePictures(r)
  r.issueMarkerStage.clear()
  r.labelParagraphCache.clear()
  r.textPreparationCache.clear()
  r.tiledScene.destroy()
  r.wholeScene.picture?.delete()
  r.profiler.destroy()
  r.surface.delete()
}
