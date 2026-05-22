import type { SkiaRenderer } from '#core/canvas/renderer'
import { clearSubtreePictureCache } from '#core/canvas/renderer/state'
import { fontManager } from '#core/text/fonts'
import { clearOpenTypeCaches } from '#core/text/opentype'

function clearRetainedSceneState(r: SkiaRenderer): void {
  r.scenePicture?.delete()
  r.sceneBacking?.image.delete()
  r.sceneBacking = null
  r.sceneBackingBuild?.surface.delete()
  r.sceneBackingBuild = null
}

function deletePathCaches(r: SkiaRenderer): void {
  // LRUMap.clear() calls destroyValue which handles .delete() on
  // WASM objects (including arrays of deletable paths)
  r.vectorPathCache.clear()
  r.vectorStrokePathCache.clear()
  r.vectorStrokeOutlineCache.clear()
  r.fillGeometryCache.clear()
  r.strokeGeometryCache.clear()
}

function deletePaints(r: SkiaRenderer): void {
  r.fillPaint.delete()
  r.strokePaint.delete()
  r.selectionPaint.delete()
  r.snapPaint.delete()
  r.auxFill.delete()
  r.auxStroke.delete()
  r.opacityPaint.delete()
  r.parentOutlineDashEffect.delete()
  r.parentOutlinePaint.delete()
  r.rulerBgPaint.delete()
  r.rulerTickPaint.delete()
  r.rulerTextPaint.delete()
  r.rulerHlPaint.delete()
  r.rulerBadgePaint.delete()
  r.rulerLabelPaint.delete()
  r.penPathPaint.delete()
  r.penLiveStrokePaint.delete()
  r.penHandlePaint.delete()
  r.penVertexFill.delete()
  r.penVertexStroke.delete()
  r.effectLayerPaint.delete()
}

function deleteCaches(r: SkiaRenderer): void {
  // LRUMap.clear() calls destroyValue which handles .delete() on
  // WASM objects (including nullable filters/pictures)
  r.imageFilterCache.clear()
  r.maskFilterCache.clear()
  r.nodePictureCache.clear()
  r.shaderCache.clear()
  clearSubtreePictureCache(r)
  clearRetainedSceneState(r)
}

export function destroyRenderer(r: SkiaRenderer): void {
  if (r.destroyed) return
  r.destroyed = true

  // LRUMap.clear() handles .delete() via destroyValue
  r.imageCache.clear()
  if (r.imageFillShader) {
    r.imageFillShader.delete()
    r.imageFillShader = null
  }
  deletePathCaches(r)
  deletePaints(r)
  r.textFont?.delete()
  r.labelFont?.delete()
  r.sizeFont?.delete()
  r.componentLabelFont?.delete()
  r.sectionTitleFont?.delete()
  r.fontMgr?.delete()
  const fontProvider = r.fontProvider
  fontProvider?.delete()
  r.fontProvider = null
  r.fontsLoaded = false
  clearOpenTypeCaches()
  fontManager.detachProvider(fontProvider)
  deleteCaches(r)
  r._flashPaint?.delete()
  r.profiler.destroy()
  r.surface.delete()
}
