import { disposeNodeEditPaints } from '#core/canvas/node-edit-overlay'
import type { SkiaRenderer } from '#core/canvas/renderer'
import { clearSubtreePictureCache } from '#core/canvas/renderer/state'
import { fontManager } from '#core/text/font/manager'

function clearRetainedSceneState(r: SkiaRenderer): void {
  r.scenePicture?.delete()
  r.sceneBacking?.image.delete()
  r.sceneBacking = null
  r.sceneBackingBuild?.surface.delete()
  r.sceneBackingBuild = null
}

function disposePathCaches(r: SkiaRenderer): void {
  r.nodePaths.clear()
  r.glyphSilhouetteCache.clear()
  r.derivedGlyphPathCache.clear()
  r.emojiImageCache.clear()
}

/** Frees every live image `r`'s surface holds and forgets those an earlier surface held. */
export function releaseLiveImages(r: Pick<SkiaRenderer, 'liveImages' | 'surface'>): void {
  for (const { image, surface } of r.liveImages.values()) {
    if (surface === r.surface) image.delete()
  }
  r.liveImages.clear()
}

function releaseRuntimeEffects(r: SkiaRenderer): void {
  r.diamondGradientEffect?.delete()
  r.diamondGradientEffect = null
  r.pixelGridEffect?.delete()
  r.pixelGridEffect = null
  r.linearBurnBlender?.delete()
  r.linearBurnBlender = null
  r.linearDodgeBlender?.delete()
  r.linearDodgeBlender = null
}

export function destroyRenderer(r: SkiaRenderer): void {
  if (r.destroyed) return
  r.destroyed = true
  r.transientPreviews.clear()

  r.onImagePreviewReady = null
  r.imagePreviews.destroy()
  r.imageCache.clear()
  releaseLiveImages(r)
  disposePathCaches(r)
  r.fillPaint.delete()
  releaseRuntimeEffects(r)
  r.strokePaint.delete()
  r.selectionPaint.delete()
  r.snapPaint.delete()
  r.auxFill.delete()
  r.auxStroke.delete()
  r.opacityPaint.delete()
  r.textFont?.delete()
  r.labelFont?.delete()
  r.sizeFont?.delete()
  r.valueFont?.delete()
  r.sectionTitleFont?.delete()
  r.componentLabelFont?.delete()
  const fontProvider = r.fontProvider
  r.fontProvider = null
  r.fontsLoaded = false
  // Only its own provider: a renderer that never loaded fonts leaves the others' attached.
  if (fontProvider) {
    fontManager.detachProvider(fontProvider)
    fontProvider.delete()
  }
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
  r.pixelGridShader?.shader.delete()
  r.pixelGridShader = null
  disposeNodeEditPaints(r.nodeEditPaints)
  for (const pic of r.nodePictureCache.values()) pic?.delete()
  r.nodePictureCache.clear()
  r.labelParagraphCache.clear()
  r.textPreparationCache.clear()
  r.effectRasterCache.clear()
  r.tiledScene.destroy()
  clearSubtreePictureCache(r)
  clearRetainedSceneState(r)
  r.profiler.destroy()
  r.surface.delete()
}
